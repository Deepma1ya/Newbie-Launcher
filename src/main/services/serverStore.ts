import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { ServerRecord } from '@shared/types'
import { paths } from './paths'
import { ensureDir, readJson, slugify, writeJsonAtomic } from '../util/fs'

export async function listServers(): Promise<ServerRecord[]> {
  const entries = await fs.readdir(paths.servers, { withFileTypes: true }).catch(() => [])
  const servers: ServerRecord[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const record = await getServer(entry.name)
    if (record) servers.push(record)
  }
  return servers.sort((a, b) => {
    const aTime = Date.parse(a.lastStartedAt ?? a.createdAt)
    const bTime = Date.parse(b.lastStartedAt ?? b.createdAt)
    return bTime - aTime
  })
}

export async function getServer(id: string): Promise<ServerRecord | null> {
  return readJson<ServerRecord | null>(paths.serverMeta(id), null)
}

export async function saveServer(server: ServerRecord): Promise<ServerRecord> {
  await ensureDir(paths.server(server.id))
  await writeJsonAtomic(paths.serverMeta(server.id), server)
  return server
}

export async function uniqueServerId(name: string): Promise<string> {
  const base = slugify(name) || 'server'
  let candidate = base
  let index = 1
  while (await getServer(candidate)) {
    index += 1
    candidate = `${base}-${index}`
  }
  return candidate
}
