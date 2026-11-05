import { nextRestartAt, normalizeRestartSchedule } from '@shared/serverSchedule'
import type { ServerRecord } from '@shared/types'
import { listServers, getServer, saveServer } from './serverStore'
import {
  isServerRunning,
  sendServerCommand,
  serverRuntimeStatus,
  startServer,
  stopServer
} from './serverProcess'
import { emit } from './events'
import { sleep } from '../util/async'
import { logger } from '../util/log'

const CHECK_INTERVAL_MS = 30_000
const RESTART_WARNING_MS = 10_000
const FAILURE_RETRY_MS = 5 * 60_000

let timer: NodeJS.Timeout | null = null
let ticking = false
let shuttingDown = false

export function initServerScheduler(): void {
  if (timer) return
  shuttingDown = false
  timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
  timer.unref?.()
  logger.info('server', 'Scheduled restart checker started')
}

export function stopServerScheduler(): void {
  shuttingDown = true
  if (!timer) return
  clearInterval(timer)
  timer = null
}

/** Re-anchor an interval schedule after a manual start or restart. */
export async function resetServerRestartSchedule(serverId: string): Promise<void> {
  const server = await getServer(serverId)
  if (!server?.restartSchedule?.enabled) return
  const schedule = normalizeRestartSchedule(server.restartSchedule)
  await saveServer({
    ...server,
    restartSchedule: {
      ...schedule,
      nextRestartAt: nextRestartAt(schedule) ?? undefined
    }
  })
}

async function tick(): Promise<void> {
  if (ticking || shuttingDown) return
  ticking = true
  try {
    const servers = await listServers()
    for (const server of servers) {
      if (shuttingDown) return
      const schedule = server.restartSchedule
      if (!schedule?.enabled) continue
      const due = Date.parse(schedule.nextRestartAt ?? '')
      if (!Number.isFinite(due)) {
        await saveSchedule(server, schedule)
        continue
      }
      if (Date.now() < due) continue
      if (!isServerRunning(server.id)) {
        // The server was offline when the restart was due. Do not wake it up;
        // start a fresh interval instead.
        await saveSchedule(server, schedule)
        continue
      }
      if (serverRuntimeStatus(server.id).status !== 'running') continue
      await restartScheduledServer(server)
    }
  } catch (error) {
    logger.warn('server', 'Scheduled restart check failed', error)
  } finally {
    ticking = false
  }
}

async function restartScheduledServer(server: ServerRecord): Promise<void> {
  try {
    sendServerCommand(
      server.id,
      `say [Newbie] Scheduled restart in ${Math.round(RESTART_WARNING_MS / 1000)} seconds.`
    )
  } catch {
    // The server may have stopped between the status check and the warning.
  }
  await sleep(RESTART_WARNING_MS)
  if (shuttingDown) return

  const latest = await getServer(server.id)
  if (!latest?.restartSchedule?.enabled) return
  if (!isServerRunning(server.id)) {
    await saveSchedule(latest, latest.restartSchedule)
    return
  }

  try {
    sendServerCommand(server.id, 'say [Newbie] Restarting now.')
  } catch {
    // Already stopping.
  }
  try {
    await stopServer(latest.id)
    if (shuttingDown) return
    await startServer(latest)
    const current = await getServer(server.id)
    if (current?.restartSchedule) {
      const schedule = normalizeRestartSchedule(current.restartSchedule)
      await saveServer({
        ...current,
        restartSchedule: {
          ...schedule,
          lastRestartAt: new Date().toISOString(),
          nextRestartAt: nextRestartAt(schedule) ?? undefined
        }
      })
    }
    emit({
      type: 'toast',
      payload: {
        kind: 'info',
        title: 'Server restarted',
        message: `${server.name} · scheduled restart`
      }
    })
    emit({ type: 'server-schedule', payload: { serverId: server.id } })
    logger.info('server', `Scheduled restart completed for ${server.name}`)
  } catch (error) {
    logger.warn('server', `Scheduled restart failed for ${server.name}`, error)
    emit({
      type: 'toast',
      payload: {
        kind: 'error',
        title: 'Scheduled restart failed',
        message: server.name
      }
    })
    emit({ type: 'server-schedule', payload: { serverId: server.id } })
    const current = await getServer(server.id)
    if (current?.restartSchedule) {
      const schedule = normalizeRestartSchedule(current.restartSchedule)
      await saveServer({
        ...current,
        restartSchedule: {
          ...schedule,
          nextRestartAt: new Date(Date.now() + FAILURE_RETRY_MS).toISOString()
        }
      })
    }
  }
}

async function saveSchedule(
  server: ServerRecord,
  schedule: NonNullable<ServerRecord['restartSchedule']>
): Promise<void> {
  const normalized = normalizeRestartSchedule(schedule)
  await saveServer({
    ...server,
    restartSchedule: {
      ...normalized,
      nextRestartAt: nextRestartAt(normalized) ?? undefined
    }
  })
}
