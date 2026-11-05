import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RESTART_SCHEDULE,
  nextRestartAt,
  normalizeRestartSchedule,
  restartIntervalLabel
} from '@shared/serverSchedule'

describe('server restart schedules', () => {
  it('normalises invalid values into safe defaults', () => {
    const schedule = normalizeRestartSchedule({
      enabled: true,
      mode: 'daily',
      intervalMinutes: 5,
      time: '99:99'
    })
    expect(schedule.enabled).toBe(true)
    expect(schedule.mode).toBe('daily')
    expect(schedule.intervalMinutes).toBe(15)
    expect(schedule.time).toBe(DEFAULT_RESTART_SCHEDULE.time)
  })

  it('computes interval restart times from the supplied clock', () => {
    const from = new Date(2026, 0, 5, 10, 0, 0)
    const next = nextRestartAt(
      { enabled: true, mode: 'interval', intervalMinutes: 90, time: '04:00' },
      from
    )
    expect(next).toBe(new Date(2026, 0, 5, 11, 30, 0).toISOString())
  })

  it('computes the next daily occurrence in local time', () => {
    const morning = new Date(2026, 0, 5, 10, 0, 0)
    expect(
      nextRestartAt({ enabled: true, mode: 'daily', intervalMinutes: 60, time: '11:30' }, morning)
    ).toBe(new Date(2026, 0, 5, 11, 30, 0).toISOString())

    const evening = new Date(2026, 0, 5, 23, 0, 0)
    expect(
      nextRestartAt({ enabled: true, mode: 'daily', intervalMinutes: 60, time: '04:00' }, evening)
    ).toBe(new Date(2026, 0, 6, 4, 0, 0).toISOString())
  })

  it('returns no next time when disabled', () => {
    expect(
      nextRestartAt({ enabled: false, mode: 'interval', intervalMinutes: 60, time: '04:00' })
    ).toBeNull()
  })

  it('formats common intervals', () => {
    expect(restartIntervalLabel(30)).toBe('Every 30 minutes')
    expect(restartIntervalLabel(60)).toBe('Every hour')
    expect(restartIntervalLabel(360)).toBe('Every 6 hours')
    expect(restartIntervalLabel(1440)).toBe('Every day')
  })
})
