import { describe, expect, it } from 'vitest'
import { updateBlockerLabel, updateInstallBlocker } from '@main/services/updatePolicy'

describe('automatic launcher update policy', () => {
  it('installs only when the launcher is idle', () => {
    expect(
      updateInstallBlocker({ runningServers: 0, activeInstances: false, activeTasks: false })
    ).toBeNull()
  })

  it('prioritises running servers over other work', () => {
    expect(
      updateInstallBlocker({ runningServers: 1, activeInstances: true, activeTasks: true })
    ).toBe('server')
  })

  it('waits for Minecraft and tasks separately', () => {
    expect(
      updateInstallBlocker({ runningServers: 0, activeInstances: true, activeTasks: false })
    ).toBe('instance')
    expect(
      updateInstallBlocker({ runningServers: 0, activeInstances: false, activeTasks: true })
    ).toBe('task')
  })

  it('describes every waiting reason', () => {
    expect(updateBlockerLabel('server')).toContain('server')
    expect(updateBlockerLabel('instance')).toContain('Minecraft')
    expect(updateBlockerLabel('task')).toContain('task')
  })
})
