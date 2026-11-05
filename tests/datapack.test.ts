import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Instance, ModrinthProject, ModrinthVersion } from '@shared/types'

const datapackStore = vi.hoisted(() => ({
  instance: null as Instance | null,
  settings: { dataDir: '' },
  updateInstance: vi.fn(async (_id: string, mutate: (instance: Instance) => void) => {
    if (!datapackStore.instance) throw new Error('No instance')
    mutate(datapackStore.instance)
    return datapackStore.instance
  })
}))

vi.mock('@main/services/store', () => ({
  store: {
    instance: () => datapackStore.instance,
    updateInstance: datapackStore.updateInstance,
    settings: () => datapackStore.settings
  }
}))

vi.mock('@main/services/modrinth', () => ({
  getModrinthProject: vi.fn(),
  getModrinthVersion: vi.fn(),
  getModrinthVersions: vi.fn(),
  getModrinthVersionsByHashes: vi.fn(async () => ({})),
  getModrinthUpdatesByHashes: vi.fn(async () => ({})),
  pickPrimaryFile: (version: ModrinthVersion) =>
    version.files.find((file) => file.primary) ?? version.files[0] ?? null,
  projectTypeToAddonType: (type: string) => (type === 'datapack' ? 'datapack' : 'mod'),
  selectBestVersion: vi.fn()
}))

vi.mock('@main/services/installer', () => ({
  addonCacheEntry: (_sha1: string, filename: string) =>
    path.join(datapackStore.settings.dataDir, 'cache', filename),
  cacheFileFromUrl: async (_url: string, _sha1: string, filename: string) => {
    const target = path.join(datapackStore.settings.dataDir, 'cache', filename)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, 'datapack-bytes')
  }
}))

import { installAddon, worldForRecord } from '@main/services/addons'
import {
  getModrinthProject,
  getModrinthVersion,
  getModrinthVersions,
  selectBestVersion
} from '@main/services/modrinth'

let root = ''
let gameDir = ''
let worldsDir = ''

function makeInstance(): Instance {
  const now = new Date().toISOString()
  return {
    id: 'inst_pack',
    name: 'Datapack Test',
    versionId: '1.20.1',
    resolvedVersionId: '1.20.1',
    loader: 'vanilla',
    loaderVersion: '',
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
    addons: []
  }
}

function makeProject(): ModrinthProject {
  return {
    id: 'project_dp',
    slug: 'test-datapack',
    project_type: 'mod',
    title: 'Test Datapack',
    description: 'A test datapack',
    body: '',
    categories: [],
    client_side: 'optional',
    server_side: 'required',
    downloads: 1,
    followers: 0,
    icon_url: null,
    gallery: [],
    license: 'MIT',
    versions: ['version_dp'],
    game_versions: ['1.20.1'],
    loaders: ['datapack'],
    published: new Date().toISOString(),
    updated: new Date().toISOString()
  }
}

function makeVersion(): ModrinthVersion {
  return {
    id: 'version_dp',
    project_id: 'project_dp',
    name: 'Test Datapack 1.0',
    version_number: '1.0',
    game_versions: ['1.20.1'],
    loaders: ['datapack'],
    date_published: new Date().toISOString(),
    downloads: 1,
    version_type: 'release',
    files: [
      {
        hashes: { sha1: 'abc123' },
        url: 'https://example.invalid/test-datapack.zip',
        filename: 'test-datapack.zip',
        primary: true,
        size: 14
      }
    ],
    dependencies: []
  }
}

async function exists(file: string): Promise<boolean> {
  return fs
    .stat(file)
    .then(() => true)
    .catch(() => false)
}

beforeEach(async () => {
  vi.clearAllMocks()
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-datapack-'))
  gameDir = path.join(root, 'minecraft')
  worldsDir = path.join(gameDir, 'saves')
  await fs.mkdir(path.join(worldsDir, 'World One'), { recursive: true })
  await fs.writeFile(path.join(worldsDir, 'World One', 'level.dat'), 'level')
  datapackStore.settings.dataDir = path.join(root, 'data')
  datapackStore.instance = makeInstance()
  vi.mocked(getModrinthProject).mockResolvedValue(makeProject())
  vi.mocked(getModrinthVersion).mockResolvedValue(makeVersion())
  vi.mocked(getModrinthVersions).mockResolvedValue([makeVersion()])
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('datapack installation', () => {
  it('installs a world datapack into saves/<world>/datapacks', async () => {
    const result = await installAddon('inst_pack', {
      projectId: 'project_dp',
      versionId: 'version_dp',
      type: 'datapack',
      world: 'World One'
    })

    const record = result.records[0]!
    const target = path.join(worldsDir, 'World One', 'datapacks', 'test-datapack.zip')
    expect(record.type).toBe('datapack')
    expect(record.relativeFolder).toBe('saves/World One/datapacks')
    expect(record.provider).toBe('modrinth')
    expect(await exists(target)).toBe(true)
    expect(datapackStore.instance?.addons[0]?.id).toBe(record.id)
  })

  it('installs into the instance datapacks folder when no world is selected', async () => {
    const result = await installAddon('inst_pack', {
      projectId: 'project_dp',
      versionId: 'version_dp',
      type: 'datapack'
    })

    const record = result.records[0]!
    expect(record.relativeFolder).toBeUndefined()
    expect(await exists(path.join(gameDir, 'datapacks', 'test-datapack.zip'))).toBe(true)
  })

  it('rejects a world that no longer exists', async () => {
    await expect(
      installAddon('inst_pack', {
        projectId: 'project_dp',
        versionId: 'version_dp',
        type: 'datapack',
        world: 'Missing World'
      })
    ).rejects.toThrow(/world no longer exists/i)
  })

  it('keeps datapacks out of the mod folder and allows vanilla instances', async () => {
    expect(datapackStore.instance?.loader).toBe('vanilla')
    await installAddon('inst_pack', {
      projectId: 'project_dp',
      versionId: 'version_dp',
      type: 'datapack'
    })
    expect(await exists(path.join(gameDir, 'datapacks', 'test-datapack.zip'))).toBe(true)
    expect(await exists(path.join(gameDir, 'mods', 'test-datapack.zip'))).toBe(false)
  })

  it('tracks the same datapack separately for each world', async () => {
    await fs.mkdir(path.join(worldsDir, 'World Two'), { recursive: true })
    await fs.writeFile(path.join(worldsDir, 'World Two', 'level.dat'), 'level')

    await installAddon('inst_pack', {
      projectId: 'project_dp',
      versionId: 'version_dp',
      type: 'datapack',
      world: 'World One'
    })
    await installAddon('inst_pack', {
      projectId: 'project_dp',
      versionId: 'version_dp',
      type: 'datapack',
      world: 'World Two'
    })

    const records = datapackStore.instance?.addons ?? []
    expect(records).toHaveLength(2)
    expect(new Set(records.map((record) => record.id)).size).toBe(2)
    expect(records.map((record) => record.relativeFolder)).toEqual(
      expect.arrayContaining(['saves/World One/datapacks', 'saves/World Two/datapacks'])
    )
    expect(await exists(path.join(worldsDir, 'World One', 'datapacks', 'test-datapack.zip'))).toBe(true)
    expect(await exists(path.join(worldsDir, 'World Two', 'datapacks', 'test-datapack.zip'))).toBe(true)
    expect(worldForRecord(records[0]!)).toBeTruthy()
    expect(worldForRecord({ type: 'mod' })).toBeUndefined()
  })
})

describe('datapack version selection', () => {
  it('filters out mod builds when selecting a datapack version', async () => {
    const actual = await vi.importActual<typeof import('@main/services/modrinth')>(
      '@main/services/modrinth'
    )
    const modVersion: ModrinthVersion = {
      ...makeVersion(),
      id: 'version_mod',
      loaders: ['fabric']
    }
    const datapackVersion: ModrinthVersion = {
      ...makeVersion(),
      id: 'version_dp',
      loaders: ['datapack']
    }

    expect(
      actual.selectBestVersion(
        [modVersion, datapackVersion],
        '1.20.1',
        'fabric',
        'datapack'
      )?.id
    ).toBe('version_dp')
    expect(
      actual.selectBestVersion([modVersion, datapackVersion], '1.20.1', 'fabric', 'mod')?.id
    ).toBe('version_mod')
    void selectBestVersion
  })
})
