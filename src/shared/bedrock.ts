import type { BedrockChannel, BedrockVersion, DefenderExclusionState } from './types'

export const BEDROCK_RELEASE_IDENTITY = 'Microsoft.MinecraftUWP'
export const BEDROCK_PREVIEW_IDENTITY = 'Microsoft.MinecraftWindowsBeta'
export const BEDROCK_PUBLISHER_ID = '8wekyb3d8bbwe'

/**
 * Windows Security exclusion paths are case-insensitive and may be stored with
 * either slash style or a trailing separator. Normalise before comparing.
 */
export function normalizeExclusionPath(value: string): string {
  return value
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\//g, '\\')
    .replace(/\\+$/, '')
    .toLowerCase()
}

/** Windows Security returns this sentinel when exclusions need admin rights. */
export function isDefenderUnreadableExclusion(value: string): boolean {
  return /must be an administrator to view exclusions/i.test(value)
}

/** Defender excludes subfolders too, so a parent folder covers nested paths. */
export function isExcludedPath(target: string, exclusions: string[]): boolean {
  const normalized = normalizeExclusionPath(target)
  if (!normalized) return false
  return exclusions.some((entry) => {
    const candidate = normalizeExclusionPath(entry)
    if (!candidate) return false
    return normalized === candidate || normalized.startsWith(`${candidate}\\`)
  })
}

export interface ExclusionSummary {
  state: Exclude<DefenderExclusionState, 'unknown'>
  excluded: string[]
  missing: string[]
}

export function summarizeExclusion(required: string[], exclusions: string[]): ExclusionSummary {
  const excluded: string[] = []
  const missing: string[] = []
  for (const entry of required) {
    if (isExcludedPath(entry, exclusions)) excluded.push(entry)
    else missing.push(entry)
  }
  const state: ExclusionSummary['state'] =
    required.length > 0 && missing.length === 0 ? 'added' : excluded.length === 0 ? 'missing' : 'partial'
  return { state, excluded, missing }
}

const PACKAGE_FILE =
  /^(Microsoft\.MinecraftUWP|Microsoft\.MinecraftWindowsBeta)_(\d+\.\d+\.\d+\.\d+)_(x64)__8wekyb3d8bbwe\.msixvc$/i

const ALLOWED_CDN_SUFFIXES = ['.xboxlive.com', '.xboxlive.cn']

/**
 * Minecraft writes 1.26.62.1 as package version 1.26.6201.0:
 * major.minor.(build * 100 + revision).0.
 */
export function bedrockPackageVersion(displayVersion: string): string | null {
  const parts = displayVersion.trim().split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0)) return null
  const [major, minor, build, revision] = parts
  if (major === undefined || minor === undefined || build === undefined || revision === undefined) return null
  if (revision > 99) return null
  return `${major}.${minor}.${build * 100 + revision}.0`
}

export function comparePackageVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => Number(part) || 0)
  const b = right.split('.').map((part) => Number(part) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0)
    if (delta !== 0) return delta
  }
  return 0
}

/** The full product package, never a trial/demo stub. */
export function isTrialPackageIdentity(value: string): boolean {
  return /trial|demo/i.test(value)
}

export function isAllowedBedrockUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (!ALLOWED_CDN_SUFFIXES.some((suffix) => url.hostname.toLowerCase().endsWith(suffix))) return false
    if (/trial|demo/i.test(url.pathname)) return false
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? '')
    return PACKAGE_FILE.test(filename) && !isTrialPackageIdentity(filename)
  } catch {
    return false
  }
}

/**
 * Parses the public GdkLinks catalog:
 * { "release": { "1.26.62.1": ["http://assets1.xboxlive.com/..."], ... }, "preview": {...} }
 *
 * Only x64, full release/preview identities on Xbox Live CDNs are accepted. An
 * entry is rejected rather than guessed when its URL identity does not match
 * the advertised version. This is what keeps trial or unrelated packages out
 * of the list.
 */
export function parseBedrockCatalog(raw: unknown): BedrockVersion[] {
  if (!raw || typeof raw !== 'object') return []
  const root = raw as Record<string, unknown>
  const versions = new Map<string, BedrockVersion>()

  for (const channel of ['release', 'preview'] as const) {
    const entries = root[channel]
    if (!entries || typeof entries !== 'object') continue
    for (const [displayVersion, value] of Object.entries(entries as Record<string, unknown>)) {
      const expectedPackageVersion = bedrockPackageVersion(displayVersion)
      if (!expectedPackageVersion) continue

      const urls = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
      const accepted: string[] = []
      let identity: string | null = null

      for (const candidate of urls) {
        if (!isAllowedBedrockUrl(candidate)) continue
        const filename = decodeURIComponent(new URL(candidate).pathname.split('/').pop() ?? '')
        const match = PACKAGE_FILE.exec(filename)
        if (!match) continue
        const name = match[1]!
        const packageVersion = match[2]!
        const fileChannel: BedrockChannel = /windowsbeta/i.test(name) ? 'preview' : 'release'

        if (isTrialPackageIdentity(filename)) continue
        if (fileChannel !== channel) continue
        if (packageVersion !== expectedPackageVersion) continue

        const fullName = `${name}_${packageVersion}_x64__${BEDROCK_PUBLISHER_ID}`
        if (identity && identity.toLowerCase() !== fullName.toLowerCase()) continue
        identity = fullName
        if (!accepted.includes(candidate)) accepted.push(candidate)
      }

      if (!identity || accepted.length === 0) continue
      const existing = versions.get(identity.toLowerCase())
      if (existing) {
        for (const url of accepted) if (!existing.urls.includes(url)) existing.urls.push(url)
        continue
      }
      versions.set(identity.toLowerCase(), {
        id: identity,
        version: displayVersion,
        packageVersion: expectedPackageVersion,
        channel,
        urls: accepted,
        latest: false,
        downloaded: false,
        installed: false
      })
    }
  }

  const list = [...versions.values()]
  for (const channel of ['release', 'preview'] as const) {
    const latest = list
      .filter((entry) => entry.channel === channel)
      .sort((a, b) => comparePackageVersions(b.packageVersion, a.packageVersion))[0]
    if (latest) latest.latest = true
  }
  return list.sort((a, b) => comparePackageVersions(b.packageVersion, a.packageVersion))
}
