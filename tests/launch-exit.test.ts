import { describe, expect, it } from 'vitest'
import { isCrashedExit } from '@shared/launch'

describe('launch exit classification', () => {
  it('treats a non-zero exit as a crash', () => {
    expect(isCrashedExit(1, false, false)).toBe(true)
    expect(isCrashedExit(-1, false, false)).toBe(true)
  })

  it('treats a clean exit as normal', () => {
    expect(isCrashedExit(0, false, false)).toBe(false)
  })

  it('does not treat an intentional stop as a crash', () => {
    expect(isCrashedExit(1, false, true)).toBe(false)
    expect(isCrashedExit(null, false, true)).toBe(false)
  })

  it('treats a spawn error as a crash', () => {
    expect(isCrashedExit(null, true, false)).toBe(true)
  })
})
