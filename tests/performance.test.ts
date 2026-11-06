import { describe, expect, it } from 'vitest'
import {
  PERFORMANCE_PRESETS,
  applyPresetToOptions,
  compareOptionsToPreset,
  isPerformanceProfile,
  parseOptionsText
} from '@shared/performance'

const balancedOptions = Object.entries(PERFORMANCE_PRESETS.balanced)
  .map(([key, value]) => `${key}:${value}`)
  .join('\n')

describe('performance presets', () => {
  it('parses options.txt into a key map', () => {
    const map = parseOptionsText('renderDistance:12\nmaxFps:120\n# comment\n')
    expect(map.get('renderDistance')).toBe('12')
    expect(map.get('maxFps')).toBe('120')
    expect(map.has('# comment')).toBe(false)
  })

  it('recognises values that still match the preset', () => {
    expect(compareOptionsToPreset(balancedOptions, 'balanced')).toBe('match')
  })

  it('reports custom when a managed value was changed in game', () => {
    const changed = balancedOptions.replace('renderDistance:12', 'renderDistance:24')
    expect(compareOptionsToPreset(changed, 'balanced')).toBe('custom')
  })

  it('ignores managed keys that the installed game version does not write', () => {
    const olderVersion = balancedOptions.replace('simulationDistance:10\n', '')
    expect(compareOptionsToPreset(olderVersion, 'balanced')).toBe('match')
  })

  it('treats an empty file as missing', () => {
    expect(compareOptionsToPreset('', 'balanced')).toBe('missing')
  })

  it('writes preset values while keeping unrelated options', () => {
    const output = applyPresetToOptions('renderDistance:24\nfov:90\n', 'performance')
    const map = parseOptionsText(output)
    expect(map.get('renderDistance')).toBe('8')
    expect(map.get('maxFps')).toBe('144')
    expect(map.get('fov')).toBe('90')
    expect(output.endsWith('\n')).toBe(true)
  })

  it('only accepts real preset names', () => {
    expect(isPerformanceProfile('balanced')).toBe(true)
    expect(isPerformanceProfile('custom')).toBe(false)
    expect(isPerformanceProfile(undefined)).toBe(false)
  })

  it('manages the same keys in every preset', () => {
    const keys = Object.keys(PERFORMANCE_PRESETS.balanced).sort()
    expect(Object.keys(PERFORMANCE_PRESETS.performance).sort()).toEqual(keys)
    expect(Object.keys(PERFORMANCE_PRESETS.quality).sort()).toEqual(keys)
  })
})
