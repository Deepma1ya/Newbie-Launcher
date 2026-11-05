import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import AdmZip from 'adm-zip'
import type { AddonRecord, Instance } from '@shared/types'
import { initPaths, paths } from '@main/services/paths'
import { store } from '@main/services/store'
import {
  copyAddonsToInstance,
  exportInstancePack,
  startPackShare,
  stopPackShare
} from '@main/services/packTransfer'

vi.mock('@main/services/serverShare', () => ({
  getServerShareAddresses: async () => []
}))

let root = ''
let source: Instance
let target: Instance

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-pack-transfer-'))
  await fs
    .rm(path.join(os.tmpdir(), 'newbie-test-userdata', 'bootstrap.json'), { force: true })
    .catch(() => undefined)
  process.env.NEWBIE_DATA_DIR = root
  await initPaths()
  await store.init()

  source = makeInstance('pack-source', 'Pack source')
  target = makeInstance('pack-target', 'Pack target')
  await store.addInstance(source)
  await store.addInstance(target)

  const files: { type: AddonRecord['type']; folder: string; name: string; body: string }[] = [
    { type: 'mod', folder: 'mods', name: 'example-mod.jar', body: 'mod-bytes' },
    { type: 'resourcepack', folder: 'resourcepacks', name: 'example-pack.zip', body: 'pack-bytes' },
    { type: 'shader', folder: 'shaderpacks', name: 'example-shader.zip', body: 'shader-bytes' },
    { type: 'datapack', folder: 'datapacks', name: 'example-data.zip', body: 'data-bytes' }
  ]
  source.addons = files.map((file, index) => {
    const full = path.join(source.gameDir, file.folder, file.name)
    return {
      id: `test_${index}`,
      provider: 'local',
      projectId: `local_${index}`,
      versionId: 'local',
      name: file.name,
      type: file.type,
      filename: file.name,
      versionNumber: '1.0.0',
      size: file.body.length,
      dependencies: [],
      enabled: true,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relativeFolder: file.folder === 'datapacks' ? undefined : file.folder
    }
  })
  for (const [index, file] of files.entries()) {
    const full = path.join(source.gameDir, file.folder, file.name)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, file.body)
    source.addons[index]!.size = file.body.length
  }
  await store.updateInstance(source.id, (current) => {
    current.addons = source.addons
  })
})

afterAll(async () => {
  await stopPackShare().catch(() => undefined)
  await fs.rm(root, { recursive: true, force: true }).catch(() => undefined)
  await fs
    .rm(path.join(os.tmpdir(), 'newbie-test-userdata', 'bootstrap.json'), { force: true })
    .catch(() => undefined)
  delete process.env.NEWBIE_DATA_DIR
})

describe('pack transfer', () => {
  it('exports enabled add-ons as a self-contained mrpack', async () => {
    const destination = path.join(root, 'share-test.mrpack')
    const result = await exportInstancePack(source.id, destination)
    expect(result.addons).toBe(4)
    expect(result.bytes).toBeGreaterThan(0)

    const zip = new AdmZip(destination)
    const index = JSON.parse(zip.getEntry('modrinth.index.json')!.getData().toString('utf8'))
    expect(index.dependencies.minecraft).toBe('1.21.1')
    expect(index.dependencies['fabric-loader']).toBe('0.16.0')
    expect(zip.getEntry('overrides/mods/example-mod.jar')).toBeTruthy()
    expect(zip.getEntry('overrides/resourcepacks/example-pack.zip')).toBeTruthy()
    expect(zip.getEntry('overrides/shaderpacks/example-shader.zip')).toBeTruthy()
    expect(zip.getEntry('overrides/datapacks/example-data.zip')).toBeTruthy()
  })

  it('copies enabled add-on files into another instance', async () => {
    const result = await copyAddonsToInstance(source.id, target.id, {
      types: ['mod', 'resourcepack', 'datapack', 'shader']
    })
    expect(result.copied).toBe(4)
    expect(result.skipped).toBe(0)
    expect(
      await fs.readFile(path.join(target.gameDir, 'mods', 'example-mod.jar'), 'utf8')
    ).toBe('mod-bytes')
    const updated = store.instance(target.id)!
    expect(updated.addons).toHaveLength(4)
    expect(updated.loadouts[0]!.addonIds).toHaveLength(4)
  })

  it('reports conflicts instead of overwriting by default', async () => {
    const result = await copyAddonsToInstance(source.id, target.id, {
      types: ['mod', 'resourcepack', 'datapack', 'shader']
    })
    expect(result.copied).toBe(0)
    expect(result.skipped).toBe(4)
    expect(result.conflicts.length).toBe(4)
  })

  it('serves a downloadable pack link locally', async () => {
    const share = await startPackShare(source.id)
    expect(share.urls.length).toBeGreaterThan(0)
    const response = await fetch(share.urls[0]!)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/octet-stream')
    const bytes = Buffer.from(await response.arrayBuffer())
    expect(bytes.byteLength).toBe(share.bytes)
    await stopPackShare()
  })
})

function makeInstance(id: string, name: string): Instance {
  const now = new Date().toISOString()
  return {
    id,
    name,
    versionId: '1.21.1',
    resolvedVersionId: '1.21.1',
    loader: 'fabric',
    loaderVersion: '0.16.0',
    color: '#6EE7A0',
    createdAt: now,
    totalPlayTimeSec: 0,
    memoryMb: 2048,
    width: 1280,
    height: 720,
    fullscreen: false,
    javaPath: null,
    jvmArgs: '',
    gameDir: paths.instanceGameDir(id),
    activeLoadoutId: `loadout_${id}`,
    loadouts: [
      {
        id: `loadout_${id}`,
        name: 'Default',
        mode: 'offline',
        addonIds: [],
        createdAt: now,
        updatedAt: now
      }
    ],
    addons: [],
    tlauncherCape: true
  }
}
