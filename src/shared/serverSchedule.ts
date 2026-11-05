import type { ServerRestartSchedule } from './types'

export const RESTART_INTERVAL_MIN_MINUTES = 15
export const RESTART_INTERVAL_MAX_MINUTES = 7 * 24 * 60
export const DEFAULT_RESTART_SCHEDULE: ServerRestartSchedule = {
  enabled: false,
  mode: 'interval',
  intervalMinutes: 6 * 60,
  time: '04:00'
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function normalizeRestartSchedule(
  input?: Partial<ServerRestartSchedule> | null
): ServerRestartSchedule {
  const mode = input?.mode === 'daily' ? 'daily' : 'interval'
  const interval = Number(input?.intervalMinutes)
  const intervalMinutes = Number.isFinite(interval)
    ? Math.min(
        RESTART_INTERVAL_MAX_MINUTES,
        Math.max(RESTART_INTERVAL_MIN_MINUTES, Math.round(interval))
      )
    : DEFAULT_RESTART_SCHEDULE.intervalMinutes
  const time = TIME_PATTERN.test(input?.time ?? '') ? input!.time! : DEFAULT_RESTART_SCHEDULE.time
  return {
    enabled: Boolean(input?.enabled),
    mode,
    intervalMinutes,
    time,
    lastRestartAt: input?.lastRestartAt,
    nextRestartAt: input?.nextRestartAt
  }
}

/** Returns the next local restart time, or null when the schedule is disabled. */
export function nextRestartAt(
  schedule: Pick<ServerRestartSchedule, 'enabled' | 'mode' | 'intervalMinutes' | 'time'>,
  from = new Date()
): string | null {
  if (!schedule.enabled) return null
  if (schedule.mode === 'interval') {
    const raw = Number(schedule.intervalMinutes)
    if (!Number.isFinite(raw)) return null
    const minutes = Math.min(
      RESTART_INTERVAL_MAX_MINUTES,
      Math.max(RESTART_INTERVAL_MIN_MINUTES, Math.round(raw))
    )
    return new Date(from.getTime() + minutes * 60_000).toISOString()
  }
  const [hoursRaw, minutesRaw] = schedule.time.split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }
  const next = new Date(from)
  next.setHours(hours, minutes, 0, 0)
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1)
  return next.toISOString()
}

export function restartIntervalLabel(minutes: number): string {
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60)
    return days === 1 ? 'Every day' : `Every ${days} days`
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? 'Every hour' : `Every ${hours} hours`
  }
  return `Every ${minutes} minutes`
}
