import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AuthAccount, Instance } from '@shared/types'
import {
  TLSKINCAPE_ARTIFACTS,
  findTlsCapeArtifact,
  supportsTlsCape
} from '@shared/tlskincape'

const capeStore = vi.hoisted(() => ({
  instance: null as Instance | null,
  settings: { tlauncherCapePlugin: true },
  updateInstance: vi.fn(async (_id: string, mutate: (instance: Instance) => void) => {
    if (!capeStore.instance) throw new Error('No instance')
    mutate(capeStore.instance)
    return capeStore.instance
  })
}))

const capePaths = vi.hoisted(() => ({ cache: '' }))

vi.mock('@main/services/store', () => ({
  store: {
    settings: () => capeStore.settings,
    updateInstance: capeStore.updateInstance
  }
}))

vi.mock('@main/services/paths', () => ({
  paths: capePaths
}))

vi.mock('@main/services/http', () => ({
  downloadFile: vi.fn(async (_url: string, destination: string) => {
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, Buffer.alloc(2048, 1))
    return 2048
  })
}))

import { downloadFile } from '@main/services/http'
import { syncTlsCape } from '@main/services/tlskincape'

let root = ''
let gameDir = ''
let modsDir = ''

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  const now = new Date().toISOString()
  return {
    id: 'inst_cape',
    name: 'Cape Test',
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
        addonIds: [],
        createdAt: now,
        updatedAt: now
      }
    ],
    addons: [],
    tlauncherCape: true,
    ...overrides
  }
}

function makeAccount(type: AuthAccount['type'] = 'tlauncher'): AuthAccount {
  return {
    id: 'tl_test',
    type,
    username: 'CapeUser',
    uuid: '00000000-0000-0000-0000-000000000000',
    active: true,
    createdAt: new Date().toISOString()
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-cape-'))
  gameDir = path.join(root, 'minecraft')
  modsDir = path.join(gameDir, 'mods')
  capePaths.cache = path.join(root, 'cache')
  capeStore.settings = { tlauncherCapePlugin: true }
  capeStore.instance = null
  await fs.mkdir(modsDir, { recursive: true })
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('TLSkinCape support matrix', () => {
  it('maps Fabric and Forge versions to the official builds', () => {
    const fabric = findTlsCapeArtifact('fabric', '1.20.1')
    expect(fabric?.fileName).toBe('tl_skin_cape_fabric_1.20_1.20.1-1.38.jar')
    expect(fabric?.url).toMatch(/^https:\/\/res\.tlauncher\.org\//)
    expect(fabric?.sha1).toHaveLength(40)
    expect(fabric?.size).toBeGreaterThan(0)

    const forge = findTlsCapeArtifact('forge', '1.20.1')
    expect(forge?.fileName).toBe('tl_skin_cape_forge_1.20-1.38.jar')
    expect(forge?.url.startsWith('https://')).toBe(true)
  })

  it('supports newer Fabric releases including 26.x', () => {
    expect(supportsTlsCape('fabric', '1.21.2')).toBe(true)
    expect(supportsTlsCape('fabric', '1.21.11')).toBe(true)
    expect(supportsTlsCape('fabric', '26.3')).toBe(true)
    expect(supportsTlsCape('forge', '26.3')).toBe(true)
  })

  it('does not claim support for vanilla, Quilt or NeoForge', () => {
    expect(supportsTlsCape('vanilla', '1.20.1')).toBe(false)
    expect(supportsTlsCape('quilt', '1.20.1')).toBe(false)
    expect(supportsTlsCape('neoforge', '1.20.1')).toBe(false)
    expect(supportsTlsCape('fabric', '1.7.10')).toBe(false)
  })

  it('never maps one loader/version pair to two artifacts', () => {
    const seen = new Set<string>()
    for (const artifact of TLSKINCAPE_ARTIFACTS) {
      for (const version of artifact.versions) {
        const key = `${artifact.loader}:${version}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })
})

describe('TLSkinCape installation', () => {
  it('downloads and places the verified build for a TLauncher account', async () => {
    const instance = makeInstance()
    capeStore.instance = instance

    const result = await syncTlsCape(instance, makeAccount())

    expect(result.active).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.fileName).toBe('tl_skin_cape_fabric_1.20_1.20.1-1.38.jar')
    expect(await fs.stat(path.join(modsDir, result.fileName!))).toBeTruthy()
    expect(instance.tlsCapeFile).toBe(`mods/${result.fileName}`)
    expect(downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('/tl_skin_cape_fabric_1.20_1.20.1/1.38/'),
      expect.stringContaining(result.fileName!),
      expect.objectContaining({ sha1: expect.any(String), size: expect.any(Number) })
    )
  })

  it('uses the game version even when resolvedVersionId is a loader profile', async () => {
    const instance = makeInstance({ resolvedVersionId: 'fabric-loader-0.15.0-1.20.1' })
    capeStore.instance = instance

    const result = await syncTlsCape(instance, makeAccount())

    expect(result.active).toBe(true)
    expect(result.fileName).toBe('tl_skin_cape_fabric_1.20_1.20.1-1.38.jar')
  })

  it('removes only the Newbie-owned file when the instance toggle is off', async () => {
    const instance = makeInstance()
    capeStore.instance = instance
    await syncTlsCape(instance, makeAccount())
    const installed = instance.tlsCapeFile!
    expect(await fs.stat(path.join(gameDir, installed))).toBeTruthy()

    const disabled = makeInstance({ tlauncherCape: false, tlsCapeFile: installed })
    capeStore.instance = disabled
    const result = await syncTlsCape(disabled, makeAccount())

    expect(result.active).toBe(false)
    expect(result.reason).toBe('disabled')
    expect(await fs.stat(path.join(gameDir, installed)).catch(() => null)).toBeNull()
    expect(disabled.tlsCapeFile).toBeUndefined()
  })

  it('leaves an existing user-supplied TLSkinCape jar alone', async () => {
    const existing = path.join(modsDir, 'tlskincape_custom.jar')
    await fs.writeFile(existing, 'custom')
    const instance = makeInstance()
    capeStore.instance = instance

    const result = await syncTlsCape(instance, makeAccount())

    expect(result.reason).toBe('existing')
    expect(downloadFile).not.toHaveBeenCalled()
    expect(await fs.readFile(existing, 'utf8')).toBe('custom')
    expect(instance.tlsCapeFile).toBeUndefined()
  })

  it('does not install when the active account is not TLauncher', async () => {
    const instance = makeInstance()
    capeStore.instance = instance
    const result = await syncTlsCape(instance, makeAccount('microsoft'))
    expect(result.active).toBe(false)
    expect(result.reason).toBe('account')
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('removes a managed file when the version becomes unsupported', async () => {
    const instance = makeInstance()
    capeStore.instance = instance
    await syncTlsCape(instance, makeAccount())
    const installed = instance.tlsCapeFile!
    expect(await fs.stat(path.join(gameDir, installed))).toBeTruthy()

    const unsupported = makeInstance({
      versionId: '1.7.10',
      resolvedVersionId: '1.7.10',
      tlsCapeFile: installed
    })
    capeStore.instance = unsupported
    const result = await syncTlsCape(unsupported, makeAccount())

    expect(result.reason).toBe('unsupported')
    expect(await fs.stat(path.join(gameDir, installed)).catch(() => null)).toBeNull()
  })
})
