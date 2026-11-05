import type { ServerRecord, ServerStats } from '@shared/types'
import { parseServerPlayers, parseServerTps, type ServerTpsSample } from '@shared/serverMonitor'
import { getServer } from './serverStore'
import {
  sendServerCommand,
  serverLogs,
  serverRuntimeStatus
} from './serverProcess'
import { sleep } from '../util/async'
import { logger } from '../util/log'

const CACHE_MS = 3_000
const RESPONSE_WAIT_STEPS = 12
const RESPONSE_WAIT_MS = 150

const cache = new Map<string, { at: number; value: ServerStats }>()
const inFlight = new Map<string, Promise<ServerStats>>()

export async function getServerStats(serverId: string): Promise<ServerStats> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const cached = cache.get(serverId)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  const pending = inFlight.get(serverId)
  if (pending) return pending

  const promise = sample(server)
    .then((value) => {
      cache.set(serverId, { at: Date.now(), value })
      return value
    })
    .finally(() => inFlight.delete(serverId))
  inFlight.set(serverId, promise)
  return promise
}

async function sample(server: ServerRecord): Promise<ServerStats> {
  const status = serverRuntimeStatus(server.id, server.port).status
  const sampledAt = new Date().toISOString()
  if (status !== 'running') {
    return {
      serverId: server.id,
      online: status === 'starting',
      status,
      players: cachedPlayers(server.id),
      sampledAt,
      message: status === 'starting' ? 'The server is still starting.' : 'Start the server to sample TPS.'
    }
  }

  const tpsCommand = tpsCommandFor(server.type)
  const before = await serverLogs(server.id)
  const mark = before.length
  try {
    sendServerCommand(server.id, 'list')
    if (tpsCommand) sendServerCommand(server.id, tpsCommand)
  } catch (error) {
    logger.warn('server', `Could not request server stats for ${server.name}`, error)
    return {
      serverId: server.id,
      online: true,
      status,
      players: cachedPlayers(server.id),
      sampledAt,
      message: 'The server did not accept the stats command.'
    }
  }

  let tps: ServerTpsSample = {}
  let players: string[] | undefined
  let maxPlayers: number | undefined
  for (let step = 0; step < RESPONSE_WAIT_STEPS; step += 1) {
    await sleep(RESPONSE_WAIT_MS)
    const lines = (await serverLogs(server.id)).slice(mark)
    if (!tps.tps && !tps.tps15m) tps = parseServerTps(lines) ?? tps
    if (!players) {
      const parsed = parseServerPlayers(lines)
      if (parsed) {
        players = parsed.players
        maxPlayers = parsed.maxPlayers
      }
    }
    if ((!tpsCommand || tps.tps !== undefined) && players !== undefined) break
  }

  return {
    serverId: server.id,
    online: true,
    status,
    players: players ?? cachedPlayers(server.id),
    maxPlayers,
    ...tps,
    sampledAt,
    message: tpsCommand
      ? tps.tps === undefined
        ? `No TPS response from this ${server.type} server.`
        : undefined
      : 'Vanilla servers do not expose TPS. Use Paper, or a TPS plugin/mod on Fabric or Quilt.'
  }
}

function tpsCommandFor(type: ServerRecord['type']): string | null {
  if (type === 'paper') return 'tps'
  if (type === 'forge') return 'forge tps'
  if (type === 'neoforge') return 'neoforge tps'
  if (type === 'fabric' || type === 'quilt') return 'tps'
  return null
}

function cachedPlayers(serverId: string): string[] {
  return cache.get(serverId)?.value.players ?? []
}

