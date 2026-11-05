import type { BedrockFixFile, BedrockFixManifestEntry } from './types'

/** Folder next to the launcher that holds files applied to Bedrock before launch. */
export const BEDROCK_FIX_FOLDER_NAME = 'minecraft bedrock fix'

const IGNORED_NAMES = new Set(['thumbs.db', 'desktop.ini', '.ds_store'])

/**
 * Operating-system droppings and half-finished downloads should never be
 * injected into the Minecraft package.
 */
export function isIgnoredFixEntry(name: string): boolean {
  const lower = name.trim().toLowerCase()
  if (!lower) return true
  if (IGNORED_NAMES.has(lower)) return true
  if (lower.startsWith('~$')) return true
  return lower.endsWith('.tmp') || lower.endsWith('.part')
}

/**
 * Normalises a path inside the fix folder to forward slashes and rejects
 * anything that could escape the source or destination root.
 */
export function normalizeFixRelativePath(value: string): string | null {
  const raw = value.trim().replace(/\\/g, '/')
  if (!raw || raw.includes('\u0000')) return null
  if (raw.startsWith('/') || /^[a-z]:/i.test(raw)) return null
  const parts: string[] = []
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') return null
    if (/[<>:"|?*]/.test(part)) return null
    // Windows silently strips trailing dots and spaces, which would make the
    // written path differ from the intended one.
    if (/[. ]$/.test(part)) return null
    parts.push(part)
  }
  return parts.length > 0 ? parts.join('/') : null
}

/**
 * A file is pending when it is new, changed, or missing from the installation.
 * `destinationSize === undefined` means Windows would not let us inspect the
 * destination, so the manifest is trusted instead of forcing a copy on every
 * launch.
 */
export function isFixFilePending(
  file: BedrockFixFile,
  previous: BedrockFixManifestEntry | undefined,
  destinationSize: number | null | undefined
): boolean {
  if (destinationSize === null) return true
  if (!previous) return true
  if (previous.size !== file.size || previous.mtimeMs !== file.mtimeMs) return true
  if (destinationSize === undefined) return false
  return destinationSize !== file.size
}
