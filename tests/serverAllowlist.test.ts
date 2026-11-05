import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const state = vi.hoisted(() => ({
  root: '',
  running: false,
  commands: [] as string[],
  serverType: 'bedrock' as 'bedrock' | 'paper'
}))

vi.mock('@main/services/serverStore', () => ({
  getServer: vi.fn(async (id: string) => ({ id, type: state.serverType }) as never)
}))

vi.mock('@main/services/paths', () => ({
  paths: {
    server: (id: string) => `${state.root}/${id}`
  }
}))

vi.mock('@main/services/serverProcess', () => ({
  isServerRunning: () => state.running,
  sendServerCommand: (_id: string, command: string) => {
    state.commands.push(command)
  }
}))

import {
  addServerAllowlistEntry,
  removeServerAllowlistEntry,
  serverAllowlist
} from '@main/services/serverAllowlist'

describe('Bedrock server allow list', () => {
  beforeEach(async () => {
    state.root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-allowlist-'))
    state.running = false
    state.commands = []
    state.serverType = 'bedrock'
  })

  afterEach(async () => {
    await fs.rm(state.root, { recursive: true, force: true })
  })

  it('adds, deduplicates and removes players by XUID', async () => {
    await addServerAllowlistEntry('test', { name: 'NotchGamer', xuid: '1234567890123456' })
    await addServerAllowlistEntry('test', { name: 'Notch', xuid: '1234567890123456' })

    expect(await serverAllowlist('test')).toEqual([
      { name: 'Notch', xuid: '1234567890123456' }
    ])

    await addServerAllowlistEntry('test', { name: 'Alex', xuid: '9876543210987654' })
    expect(await serverAllowlist('test')).toHaveLength(2)

    expect(await removeServerAllowlistEntry('test', '1234567890123456')).toEqual([
      { name: 'Alex', xuid: '9876543210987654' }
    ])
  })

  it('rejects malformed Xbox IDs and non-Bedrock servers', async () => {
    await expect(
      addServerAllowlistEntry('test', { name: 'Notch', xuid: 'not-a-number' })
    ).rejects.toThrow(/XUID/)

    state.serverType = 'paper'
    await expect(
      addServerAllowlistEntry('test', { name: 'Notch', xuid: '1234567890123456' })
    ).rejects.toThrow(/Bedrock/)
    expect(await serverAllowlist('test')).toEqual([])
  })

  it('reloads a running server after a change', async () => {
    state.running = true
    await addServerAllowlistEntry('test', { name: 'Notch', xuid: '1234567890123456' })

    expect(state.commands).toContain('allowlist reload')
    const file = path.join(state.root, 'test', 'allowlist.json')
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual([
      { name: 'Notch', xuid: '1234567890123456' }
    ])
  })
})
