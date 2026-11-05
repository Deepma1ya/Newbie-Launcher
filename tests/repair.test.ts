import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import type { AddonRecord, Instance } from '@shared/types'

vi.mock('@main/services/store', () => ({
  store: { instance: vi.fn() }
}))

vi.mock('@main/services/paths', () => ({
  paths: { repairBackups: 'repair-backups' }
}))

vi.mock('@main/util/archive', () => ({
  zipPaths: vi.fn(async () => undefined)
}))

vi.mock('@main/services/addons', () => ({
  installAddon: vi.fn(async () => ({ records: [], installed: 0 })),
  persistInstance: vi.fn(async () => undefined)
}))

vi.mock('@main/services/loadouts', () => ({
  ensureAddonFile: vi.fn(async () => undefined)
}))

vi.mock('@main/services/modrinth', () => ({
  searchModrinth: vi.fn()
}))

import { repairInstance, clearRepairFailures } from '@main/services/repair'
import { store } from '@main/services/store'
import { zipPaths } from '@main/util/archive'
import { ensureAddonFile } from '@main/services/loadouts'
import { installAddon } from '@main/services/addons'
import { searchModrinth } from '@main/services/modrinth'

let root = ''
let gameDir = ''
let modsDir = ''

beforeEach(async () => {
  vi.clearAllMocks()
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-repair-'))
  gameDir = path.join(root, 'minecraft')
  modsDir = path.join(gameDir, 'mods')
  await fs.mkdir(modsDir, { recursive: true })
  vi.mocked(searchModrinth).mockResolvedValue({
    provider: 'modrinth',
    hits: [],
    total: 0,
    offset: 0,
    limit: 12
  })
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

function addonRecord(filename: string, enabled = true, provider: 'modrinth' | 'local' = 'local'): AddonRecord {
  const now = new Date().toISOString()
  return {
    id: `addon_${filename}`,
    provider,
    projectId: `project_${filename}`,
    versionId: 'version_1',
    name: filename,
    type: 'mod',
    filename,
    versionNumber: '1.0.0',
    size: 1,
    dependencies: [],
    enabled,
    installedAt: now,
    updatedAt: now
  }
}

function makeInstance(addons: AddonRecord[] = [], activeAddonIds = addons.filter((entry) => entry.enabled).map((entry) => entry.id)): Instance {
  const now = new Date().toISOString()
  return {
    id: 'inst_test',
    name: 'Repair Test',
    versionId: '1.20.1',
    resolvedVersionId: '1.20.1',
    loader: 'fabric',
    loaderVersion: '0.15.0',
    color: '#6EE7A0',
    createdAt: now,
    totalPlayTimeSec: 0,
    memoryMb: 4096,
    width: 854,
    height: 480,
    fullscreen: false,
    javaPath: null,
    jvmArgs: '',
    gameDir,
    activeLoadoutId: 'loadout_1',
    loadouts: [
      {
        id: 'loadout_1',
        name: 'Default',
        mode: 'offline',
        addonIds: activeAddonIds,
        createdAt: now,
        updatedAt: now
      }
    ],
    addons
  }
}

function writeFabricJar(
  filename: string,
  meta: {
    id: string
    version?: string
    depends?: Record<string, string>
    breaks?: Record<string, string>
  }
): void {
  const zip = new AdmZip()
  zip.addFile(
    'fabric.mod.json',
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        id: meta.id,
        name: meta.id,
        version: meta.version ?? '1.0.0',
        depends: meta.depends ?? {},
        breaks: meta.breaks ?? {}
      })
    )
  )
  zip.writeZip(path.join(modsDir, filename))
}

function writeForgeJar(filename: string, id: string): void {
  const zip = new AdmZip()
  zip.addFile(
    'META-INF/mods.toml',
    Buffer.from(
      `modLoader="javafml"\nloaderVersion="[47,)"\n[[mods]]\nmodId="${id}"\nversion="1.0.0"\ndisplayName="${id}"\n`
    )
  )
  zip.writeZip(path.join(modsDir, filename))
}

async function exists(file: string): Promise<boolean> {
  return fs
    .stat(file)
    .then(() => true)
    .catch(() => false)
}

describe('repair planning', () => {
  it('does not report a missing tracked file outside the active loadout', async () => {
    const record = addonRecord('not-active.jar', false, 'local')
    const instance = makeInstance([record], [])
    vi.mocked(store.instance).mockReturnValue(instance)

    const report = await repairInstance('inst_test', false)
    expect(report.issues).toHaveLength(0)
  })

  it('keeps a healthy instance clean and creates no backup', async () => {
    const record = addonRecord('healthy.jar')
    writeFabricJar('healthy.jar', { id: 'healthy' })
    const instance = makeInstance([record], [record.id])
    vi.mocked(store.instance).mockReturnValue(instance)

    const report = await repairInstance('inst_test', true)
    expect(report.issues).toHaveLength(0)
    expect(report.fixed).toBe(0)
    expect(report.failed).toBe(0)
    expect(report.backupPath).toBeUndefined()
    expect(zipPaths).not.toHaveBeenCalled()
  })
})

describe('repair application', () => {
  it('resolves a duplicate even when a stale disabled copy exists', async () => {
    const record = addonRecord('a.jar')
    writeFabricJar('a.jar', { id: 'duplicate', version: '2.0.0' })
    writeFabricJar('b.jar', { id: 'duplicate', version: '1.0.0' })
    writeFabricJar('b.jar.disabled', { id: 'duplicate', version: '0.9.0' })
    const instance = makeInstance([record], [record.id])
    vi.mocked(store.instance).mockReturnValue(instance)

    const report = await repairInstance('inst_test', true)
    expect(report.fixed).toBe(1)
    expect(report.failed).toBe(0)
    expect(await exists(path.join(modsDir, 'a.jar'))).toBe(true)
    expect(await exists(path.join(modsDir, 'b.jar'))).toBe(false)
    expect(await exists(path.join(modsDir, 'b.jar.disabled'))).toBe(true)
    const entries = await fs.readdir(modsDir)
    expect(entries.some((entry) => entry.startsWith('b.jar.disabled.newbie-backup-'))).toBe(true)

    const after = await repairInstance('inst_test', false)
    expect(after.issues.filter((issue) => issue.kind === 'duplicate')).toHaveLength(0)
    expect(after.issues.filter((issue) => issue.autoFixable)).toHaveLength(0)
  })

  it('disables only one side of a mutual incompatibility', async () => {
    writeFabricJar('a.jar', { id: 'a', breaks: { b: '*' } })
    writeFabricJar('b.jar', { id: 'b', breaks: { a: '*' } })
    const instance = makeInstance()
    vi.mocked(store.instance).mockReturnValue(instance)

    const report = await repairInstance('inst_test', true)
    expect(report.fixed).toBe(1)
    expect(report.failed).toBe(0)
    const active = (await fs.readdir(modsDir)).filter((entry) => entry.endsWith('.jar'))
    expect(active).toHaveLength(1)
    expect(await exists(path.join(modsDir, 'a.jar.disabled')) || await exists(path.join(modsDir, 'b.jar.disabled'))).toBe(true)

    const after = await repairInstance('inst_test', false)
    expect(after.issues.filter((issue) => issue.kind === 'incompatible')).toHaveLength(0)
    expect(after.issues.filter((issue) => issue.autoFixable)).toHaveLength(0)
  })

  it('turns a failed dependency install into a manual issue', async () => {
    writeFabricJar('needs-lib.jar', { id: 'needslib', depends: { missinglib: '*' } })
    const instance = makeInstance()
    vi.mocked(store.instance).mockReturnValue(instance)

    const report = await repairInstance('inst_test', true)
    expect(report.fixed).toBe(0)
    expect(report.failed).toBe(1)
    expect(report.issues).toHaveLength(1)
    expect(report.issues[0]?.kind).toBe('missing-dependency')
    expect(report.issues[0]?.autoFixable).toBe(false)
    expect(report.issues[0]?.detail).toContain('failed')

    // A later repair must not retry the same failed fix or create another backup.
    const again = await repairInstance('inst_test', true)
    expect(again.fixed).toBe(0)
    expect(again.failed).toBe(0)
    expect(again.blocked).toBe(1)
    expect(again.backupPath).toBeUndefined()
    expect(zipPaths).toHaveBeenCalledTimes(1)

    const scanAgain = await repairInstance('inst_test', false)
    expect(scanAgain.blocked).toBe(1)
    expect(scanAgain.issues.filter((issue) => issue.autoFixable)).toHaveLength(0)

    // Retry is explicit, never automatic.
    await clearRepairFailures('inst_test')
    const retried = await repairInstance('inst_test', true)
    expect(retried.failed).toBe(1)
  })

  it('installs a matching dependency and verifies it on the next scan', async () => {
    writeFabricJar('needs-lib.jar', { id: 'needslib', depends: { missinglib: '*' } })
    const instance = makeInstance()
    vi.mocked(store.instance).mockReturnValue(instance)
    vi.mocked(searchModrinth).mockResolvedValue({
      provider: 'modrinth',
      hits: [
        {
          project_id: 'missinglib_project',
          slug: 'missinglib',
          title: 'Missing Lib',
          description: '',
          categories: [],
          client_side: 'required',
          server_side: 'required',
          project_type: 'mod',
          downloads: 1,
          follows: 0,
          icon_url: null,
          date_created: '',
          date_modified: '',
          latest_version: '',
          license: '',
          gallery: [],
          versions: []
        }
      ],
      total: 1,
      offset: 0,
      limit: 12
    } as never)
    vi.mocked(installAddon).mockImplementation(async () => {
      writeFabricJar('missinglib.jar', { id: 'missinglib' })
      return { records: [], installed: 1 }
    })

    const report = await repairInstance('inst_test', true)
    expect(report.fixed).toBe(1)
    expect(report.failed).toBe(0)
    expect(await exists(path.join(modsDir, 'missinglib.jar'))).toBe(true)

    const after = await repairInstance('inst_test', false)
    expect(after.issues).toHaveLength(0)
  })

  it('restores a missing Modrinth add-on that belongs to the active loadout', async () => {
    const record = addonRecord('restore-me.jar', true, 'modrinth')
    const instance = makeInstance([record], [record.id])
    vi.mocked(store.instance).mockReturnValue(instance)
    vi.mocked(ensureAddonFile).mockImplementation(async (targetInstance, targetRecord) => {
      writeFabricJar(targetRecord.filename, { id: 'restored' })
      void targetInstance
    })

    const report = await repairInstance('inst_test', true)
    expect(report.fixed).toBe(1)
    expect(report.failed).toBe(0)
    expect(await exists(path.join(modsDir, 'restore-me.jar'))).toBe(true)

    const after = await repairInstance('inst_test', false)
    expect(after.issues.filter((issue) => issue.kind === 'corrupt')).toHaveLength(0)
  })

  it('disables a wrong-loader mod and leaves a clean second scan', async () => {
    writeForgeJar('forge-only.jar', 'forgeonly')
    const instance = makeInstance()
    vi.mocked(store.instance).mockReturnValue(instance)

    const report = await repairInstance('inst_test', true)
    expect(report.fixed).toBe(1)
    expect(await exists(path.join(modsDir, 'forge-only.jar'))).toBe(false)
    expect(await exists(path.join(modsDir, 'forge-only.jar.disabled'))).toBe(true)

    const after = await repairInstance('inst_test', false)
    expect(after.issues).toHaveLength(0)
  })
})
