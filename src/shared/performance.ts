import type { PerformanceProfile } from './types'

/**
 * Values Newbie writes to options.txt for each preset. Every preset manages
 * the same keys so a profile switch is a small, predictable edit.
 */
export const PERFORMANCE_PRESETS: Record<PerformanceProfile, Record<string, string>> = {
  balanced: {
    renderDistance: '12',
    simulationDistance: '10',
    maxFps: '120',
    enableVsync: 'true',
    graphicsMode: '1',
    ao: 'true',
    entityShadows: 'true',
    particles: '1',
    mipmapLevels: '4'
  },
  performance: {
    renderDistance: '8',
    simulationDistance: '6',
    maxFps: '144',
    enableVsync: 'false',
    graphicsMode: '0',
    ao: 'false',
    entityShadows: 'false',
    particles: '2',
    mipmapLevels: '2'
  },
  quality: {
    renderDistance: '16',
    simulationDistance: '12',
    maxFps: '260',
    enableVsync: 'true',
    graphicsMode: '2',
    ao: 'true',
    entityShadows: 'true',
    particles: '0',
    mipmapLevels: '4'
  }
}

export const PERFORMANCE_PROFILE_VALUES: PerformanceProfile[] = ['performance', 'balanced', 'quality']

export function isPerformanceProfile(value: unknown): value is PerformanceProfile {
  return typeof value === 'string' && (PERFORMANCE_PROFILE_VALUES as string[]).includes(value)
}

export function parseOptionsText(raw: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf(':')
    if (index > 0) map.set(line.slice(0, index), line.slice(index + 1))
  }
  return map
}

export type OptionsPresetState = 'missing' | 'match' | 'custom'

/**
 * Compares only the keys the preset manages. Keys the running Minecraft version
 * does not write are ignored, so older versions do not look custom just because
 * a newer option is absent from options.txt.
 */
export function compareOptionsToPreset(raw: string, profile: PerformanceProfile): OptionsPresetState {
  const map = parseOptionsText(raw)
  const managed = Object.entries(PERFORMANCE_PRESETS[profile]).filter(([key]) => map.has(key))
  if (managed.length === 0) return 'missing'
  return managed.every(([key, value]) => map.get(key) === value) ? 'match' : 'custom'
}

/** Preserves every other option and rewrites only the keys the preset owns. */
export function applyPresetToOptions(raw: string, profile: PerformanceProfile): string {
  const map = parseOptionsText(raw)
  for (const [key, value] of Object.entries(PERFORMANCE_PRESETS[profile])) map.set(key, value)
  return [...map.entries()].map(([key, value]) => `${key}:${value}`).join('\n') + '\n'
}
