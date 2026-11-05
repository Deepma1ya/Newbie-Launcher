import path from 'node:path'
import type { ServerAllowlistEntry } from '@shared/types'
import { getServer } from './serverStore'
import { paths } from './paths'
import { isServerRunning, sendServerCommand } from './serverProcess'
import { readJson, writeJsonAtomic } from '../util/fs'
import { logger } from '../util/log'

const ALLOWLIST_FILE = 'allowlist.json'
const XUID_PATTERN = /^\d{1,20}$/

function normalizeEntry(value: unknown): ServerAllowlistEntry | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim().slice(0, 64) : ''
  const xuid = typeof record.xuid === 'string' ? record.xuid.trim() : ''
  if (!XUID_PATTERN.test(xuid)) return null
  return { name: name || xuid, xuid }
}

function normalizeList(value: unknown): ServerAllowlistEntry[] {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, ServerAllowlistEntry>()
  for (const item of value) {
    const entry = normalizeEntry(item)
    if (entry) unique.set(entry.xuid, entry)
  }
  return [...unique.values()]
}

export async function serverAllowlist(serverId: string): Promise<ServerAllowlistEntry[]> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  if (server.type !== 'bedrock') return []
  return normalizeList(await readJson<unknown>(path.join(paths.server(serverId), ALLOWLIST_FILE), []))
}

async function saveAllowlist(serverId: string, entries: ServerAllowlistEntry[]): Promise<void> {
  await writeJsonAtomic(path.join(paths.server(serverId), ALLOWLIST_FILE), entries)
  if (isServerRunning(serverId)) {
    try {
      sendServerCommand(serverId, 'allowlist reload')
    } catch (error) {
      logger.warn('server', 'Could not reload the Bedrock allow list', error)
    }
  }
}

export async function addServerAllowlistEntry(
  serverId: string,
  entry: { name: string; xuid: string }
): Promise<ServerAllowlistEntry[]> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  if (server.type !== 'bedrock') throw new Error('Only Bedrock servers use this allow list')
  const normalized = normalizeEntry(entry)
  if (!normalized) throw new Error('Enter a valid Xbox XUID (digits only)')
  const entries = await serverAllowlist(serverId)
  const next = [...entries.filter((candidate) => candidate.xuid !== normalized.xuid), normalized]
  await saveAllowlist(serverId, next)
  return next
}

export async function removeServerAllowlistEntry(
  serverId: string,
  xuid: string
): Promise<ServerAllowlistEntry[]> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  if (server.type !== 'bedrock') throw new Error('Only Bedrock servers use this allow list')
  const next = (await serverAllowlist(serverId)).filter((entry) => entry.xuid !== xuid)
  await saveAllowlist(serverId, next)
  return next
}
