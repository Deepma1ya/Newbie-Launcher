export interface ReleaseNoteEntry {
  version?: string
  note?: string | null
}

export interface ReleaseNoteLine {
  kind: 'heading' | 'text' | 'bullet' | 'space'
  text: string
}

/**
 * Formats a byte count for update sizes. Kept in shared code so the updater
 * and the renderer describe downloads the same way.
 */
export function formatBytes(bytes?: number | null): string {
  if (!Number.isFinite(bytes) || (bytes ?? 0) <= 0) return '0 B'
  const value = bytes as number
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  const scaled = value / 1024 ** index
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${units[index]}`
}

export function formatSpeed(bytesPerSecond?: number | null): string {
  if (!Number.isFinite(bytesPerSecond) || (bytesPerSecond ?? 0) <= 0) return ''
  return `${formatBytes(bytesPerSecond)}/s`
}

/**
 * electron-updater can return release notes as a string or as a list of
 * per-version notes. Normalise both into one readable document.
 */
export function releaseNotesText(notes?: string | ReleaseNoteEntry[] | null): string | undefined {
  if (!notes) return undefined
  const raw =
    typeof notes === 'string'
      ? notes
      : notes
          .map((entry) => {
            const note = entry.note?.trim()
            if (!note) return ''
            return entry.version ? `## Version ${entry.version}\n\n${note}` : note
          })
          .filter(Boolean)
          .join('\n\n')
  const cleaned = decodeEntities(stripHtml(raw))
    .replace(/\r\n?/g, '\n')
    .replace(/^#\s*Newbie Launcher[^\n]*\n+/i, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned || undefined
}

/**
 * Turns GitHub-flavoured release notes into simple lines the renderer can
 * display without a markdown dependency. Anything that is not a heading, a
 * bullet or plain text is flattened safely.
 */
export function parseReleaseNotes(text?: string | null): ReleaseNoteLine[] {
  if (!text) return []
  const lines: ReleaseNoteLine[] = []
  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      if (lines.length && lines[lines.length - 1]?.kind !== 'space') lines.push({ kind: 'space', text: '' })
      continue
    }
    if (/^([-*_=])\1{2,}$/.test(trimmed)) continue
    const heading = /^#{1,6}\s+(.+)$/.exec(trimmed)
    if (heading) {
      lines.push({ kind: 'heading', text: cleanInline(heading[1]!) })
      continue
    }
    const bullet = /^[-*+]\s+(.+)$/.exec(trimmed)
    if (bullet) {
      lines.push({ kind: 'bullet', text: cleanInline(bullet[1]!) })
      continue
    }
    lines.push({ kind: 'text', text: cleanInline(trimmed) })
  }
  while (lines.length && lines[lines.length - 1]?.kind === 'space') lines.pop()
  return lines
}

function cleanInline(value: string): string {
  return decodeEntities(
    value
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
