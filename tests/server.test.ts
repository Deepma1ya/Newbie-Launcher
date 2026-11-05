import { afterEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ModrinthProject, ModrinthVersion, ServerRecord, ServerType } from '@shared/types'
import {
  defaultProperties,
  ensureEula,
  formatProperties,
  parseProperties,
  readProperties,
  writeProperties
} from '@main/services/serverProperties'
import {
  inferAddonType,
  selectServerVersion
} from '@main/services/serverAddons'
import { serverLoader, serverSupportsAddon, serverTypeLabel } from '@shared/serverTypes'

const roots: string[] = []

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-server-test-'))
  roots.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

function makeServer(type: ServerType, versionId = '1.20.1'): ServerRecord {
  return {
    id: `server_${type}`,
    name: `${type} test`,
    type,
    versionId,
    loaderVersion: '',
    port: 25565,
    memoryMb: 4096,
    javaPath: null,
    javaMajor: 21,
    eulaAccepted: true,
    createdAt: new Date().toISOString(),
    levelName: 'world',
    launchKind: 'jar',
    launchFile: 'server.jar',
    addons: []
  }
}

function makeVersion(
  id: string,
  loaders: string[],
  overrides: Partial<ModrinthVersion> = {}
): ModrinthVersion {
  return {
    id,
    project_id: 'project',
    name: `Version ${id}`,
    version_number: id,
    game_versions: ['1.20.1'],
    loaders,
    date_published: new Date(2024, 0, Number(id.replace(/\D/g, '')) || 1).toISOString(),
    downloads: 0,
    version_type: 'release',
    files: [],
    dependencies: [],
    ...overrides
  }
}

describe('server.properties handling', () => {
  it('round-trips escaped values', () => {
    const properties = new Map([
      ['motd', 'Hello: world = yes\nnext line'],
      ['level-seed', 'a=b:c\\d'],
      ['custom-key', 'plain value']
    ])
    const parsed = parseProperties(formatProperties(properties))
    expect(parsed.get('motd')).toBe('Hello: world = yes\nnext line')
    expect(parsed.get('level-seed')).toBe('a=b:c\\d')
    expect(parsed.get('custom-key')).toBe('plain value')
  })

  it('ignores comments and blank lines', () => {
    const parsed = parseProperties('# comment\n\n! another comment\nserver-port=25566\nmotd = Hi\n')
    expect([...parsed.entries()]).toEqual([
      ['server-port', '25566'],
      ['motd', 'Hi']
    ])
  })

  it('writes, reads and merges GUI settings with defaults', async () => {
    const dir = await tempDir()
    await writeProperties(
      dir,
      defaultProperties({ motd: 'Test server', 'server-port': '25570', 'level-name': 'my-world' })
    )
    const read = await readProperties(dir)
    expect(read.get('motd')).toBe('Test server')
    expect(read.get('server-port')).toBe('25570')
    expect(read.get('level-name')).toBe('my-world')
    expect(read.get('online-mode')).toBe('true')
  })

  it('returns defaults when no properties file exists', async () => {
    const dir = await tempDir()
    const properties = await readProperties(dir)
    expect(properties.get('max-players')).toBe('20')
    expect(properties.get('gamemode')).toBe('survival')
  })

  it('only writes eula=true after consent', async () => {
    const dir = await tempDir()
    await ensureEula(dir, false)
    await expect(fs.readFile(path.join(dir, 'eula.txt'), 'utf8')).rejects.toThrow()
    await ensureEula(dir, true)
    const text = await fs.readFile(path.join(dir, 'eula.txt'), 'utf8')
    expect(text).toContain('eula=true')
  })
})

describe('server type capabilities', () => {
  it('exposes the expected add-on support', () => {
    expect(serverSupportsAddon('vanilla', 'datapack')).toBe(true)
    expect(serverSupportsAddon('vanilla', 'plugin')).toBe(false)
    expect(serverSupportsAddon('vanilla', 'mod')).toBe(false)
    expect(serverSupportsAddon('paper', 'plugin')).toBe(true)
    expect(serverSupportsAddon('paper', 'datapack')).toBe(true)
    expect(serverSupportsAddon('paper', 'mod')).toBe(false)
    expect(serverSupportsAddon('fabric', 'mod')).toBe(true)
    expect(serverSupportsAddon('forge', 'mod')).toBe(true)
    expect(serverSupportsAddon('neoforge', 'mod')).toBe(true)
    expect(serverSupportsAddon('quilt', 'mod')).toBe(true)
    expect(serverSupportsAddon('fabric', 'plugin')).toBe(false)
  })

  it('maps server types to loader names', () => {
    expect(serverLoader('fabric')).toBe('fabric')
    expect(serverLoader('quilt')).toBe('quilt')
    expect(serverLoader('forge')).toBe('forge')
    expect(serverLoader('neoforge')).toBe('neoforge')
    expect(serverLoader('paper')).toBeUndefined()
    expect(serverLoader('vanilla')).toBeUndefined()
    expect(serverTypeLabel('paper')).toBe('Paper')
  })
})

describe('server add-on selection', () => {
  it('prefers stable plugin versions with Paper-compatible loaders', () => {
    const server = makeServer('paper')
    const chosen = selectServerVersion(
      [
        makeVersion('1', ['paper'], { version_type: 'beta' }),
        makeVersion('2', ['spigot'], { version_type: 'release' }),
        makeVersion('3', ['fabric'], { version_type: 'release' })
      ],
      server,
      'plugin'
    )
    expect(chosen?.id).toBe('2')
  })

  it('requires the datapack loader for datapacks', () => {
    const server = makeServer('vanilla')
    const chosen = selectServerVersion(
      [
        makeVersion('1', ['fabric']),
        makeVersion('2', ['datapack'])
      ],
      server,
      'datapack'
    )
    expect(chosen?.id).toBe('2')
  })

  it('requires the server loader for mods', () => {
    const server = makeServer('fabric')
    const chosen = selectServerVersion(
      [makeVersion('1', ['forge']), makeVersion('2', ['fabric', 'quilt'])],
      server,
      'mod'
    )
    expect(chosen?.id).toBe('2')
  })

  it('rejects versions for other Minecraft releases', () => {
    const server = makeServer('fabric')
    const chosen = selectServerVersion(
      [makeVersion('1', ['fabric'], { game_versions: ['1.21.1'] })],
      server,
      'mod'
    )
    expect(chosen).toBeNull()
  })

  it('infers plugin, mod and datapack types from project loaders', () => {
    const project = (loaders: string[]): ModrinthProject => ({ loaders } as ModrinthProject)
    expect(inferAddonType(makeServer('paper'), project(['paper', 'spigot']))).toBe('plugin')
    expect(inferAddonType(makeServer('fabric'), project(['fabric']))).toBe('mod')
    expect(inferAddonType(makeServer('vanilla'), project(['datapack']))).toBe('datapack')
    expect(inferAddonType(makeServer('vanilla'), project(['fabric']))).toBeNull()
  })
})
