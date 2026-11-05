import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { ServerRecord } from '@shared/types'
import { initPaths, paths } from '@main/services/paths'
import { getServer, saveServer } from '@main/services/serverStore'
import { readProperties } from '@main/services/serverProperties'
import {
  getServerResourcePack,
  importServerResourcePack,
  removeServerResourcePack,
  saveServerResourcePack
} from '@main/services/serverResourcePack'

let root = ''
let server: ServerRecord

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-resource-pack-'))
  await fs
    .rm(path.join(os.tmpdir(), 'newbie-test-userdata', 'bootstrap.json'), { force: true })
    .catch(() => undefined)
  process.env.NEWBIE_DATA_DIR = root
  await initPaths()
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true }).catch(() => undefined)
  await fs
    .rm(path.join(os.tmpdir(), 'newbie-test-userdata', 'bootstrap.json'), { force: true })
    .catch(() => undefined)
  delete process.env.NEWBIE_DATA_DIR
})

beforeEach(async () => {
  server = {
    id: 'resource-pack-server',
    name: 'Resource pack test',
    type: 'paper',
    versionId: '1.21.1',
    loaderVersion: '',
    port: 25565,
    memoryMb: 2048,
    javaPath: null,
    javaMajor: 21,
    eulaAccepted: true,
    createdAt: new Date().toISOString(),
    levelName: 'world',
    launchKind: 'jar',
    launchFile: 'server.jar',
    addons: []
  }
  await saveServer(server)
  await fs.rm(paths.server(server.id), { recursive: true, force: true }).catch(() => undefined)
  await saveServer(server)
})

describe('server resource packs', () => {
  it('writes URL, SHA-1, required flag and prompt to server.properties', async () => {
    const sha1 = 'a'.repeat(40)
    const state = await saveServerResourcePack(server.id, {
      url: 'https://example.com/pack.zip',
      sha1,
      required: true,
      prompt: 'Download the server pack'
    })

    expect(state.url).toBe('https://example.com/pack.zip')
    expect(state.sha1).toBe(sha1)
    expect(state.required).toBe(true)
    expect(state.prompt).toBe('Download the server pack')

    const properties = await readProperties(paths.server(server.id))
    expect(properties.get('resource-pack')).toBe('https://example.com/pack.zip')
    expect(properties.get('resource-pack-sha1')).toBe(sha1)
    expect(properties.get('require-resource-pack')).toBe('true')
    expect(properties.get('resource-pack-prompt')).toBe('Download the server pack')

    const stored = await getServer(server.id)
    expect(stored?.resourcePack?.url).toBe('https://example.com/pack.zip')
  })

  it('rejects non-http URLs and malformed SHA-1 values', async () => {
    await expect(
      saveServerResourcePack(server.id, { url: 'file:///C:/pack.zip' })
    ).rejects.toThrow(/http/)
    await expect(
      saveServerResourcePack(server.id, {
        url: 'https://example.com/pack.zip',
        sha1: 'not-a-hash'
      })
    ).rejects.toThrow(/SHA-1/)
  })

  it('copies a local pack, hashes it and removes it again', async () => {
    const source = path.join(root, 'custom-pack.zip')
    await fs.writeFile(source, Buffer.from('PK resource pack test'))
    const imported = await importServerResourcePack(server.id, source)
    expect(imported.filename).toBe('custom-pack.zip')
    expect(imported.sha1).toMatch(/^[a-f0-9]{40}$/)

    const state = await saveServerResourcePack(server.id, {
      url: 'https://example.com/custom-pack.zip',
      sha1: imported.sha1,
      filename: imported.filename,
      size: imported.size,
      source: 'file'
    })
    expect(state.files.map((file) => file.filename)).toContain('custom-pack.zip')
    expect(state.activeFilename).toBe('custom-pack.zip')

    await removeServerResourcePack(server.id, true)
    const after = await getServerResourcePack(server.id)
    expect(after.url).toBe('')
    expect(after.files).toHaveLength(0)
    await expect(
      fs.stat(path.join(paths.server(server.id), 'resourcepacks', imported.filename))
    ).rejects.toThrow()
  })
})
