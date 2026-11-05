export { formatBytes } from '@shared/update'

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.round(value))
}

export function formatPlaytime(seconds: number): string {
  if (!seconds || seconds < 60) return 'Never played'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m played`
  if (hours < 24) return `${hours}h ${minutes}m played`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h played`
}

export function relativeTime(value?: string): string {
  if (!value) return 'Never'
  const date = Date.parse(value)
  if (!Number.isFinite(date)) return 'Unknown'
  const diff = Date.now() - date
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function loaderLabel(loader: string): string {
  switch (loader) {
    case 'fabric':
      return 'Fabric'
    case 'quilt':
      return 'Quilt'
    case 'forge':
      return 'Forge'
    case 'neoforge':
      return 'NeoForge'
    default:
      return 'Vanilla'
  }
}

export function addonTypeLabel(type: string): string {
  switch (type) {
    case 'resourcepack':
      return 'Resource pack'
    case 'shader':
      return 'Shader pack'
    case 'modpack':
      return 'Modpack'
    case 'datapack':
      return 'Data pack'
    case 'world':
      return 'World'
    default:
      return 'Mod'
  }
}

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .replace(/\s+\n\s+/g, ' ')
    .trim()
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function colorFromString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 45% 55%)`
}

export function modrinthProjectUrl(type: string, slug: string): string {
  return `https://modrinth.com/${type}/${slug}`
}

export function currency(value: number): string {
  return formatNumber(value)
}
