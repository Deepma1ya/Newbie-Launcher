import type { LoaderType, ServerAddonType, ServerType } from './types'

export interface ServerTypeInfo {
  value: ServerType
  label: string
  description: string
  mods: boolean
  plugins: boolean
  datapacks: boolean
}

export const SERVER_TYPES: ServerTypeInfo[] = [
  {
    value: 'paper',
    label: 'Paper',
    description: 'Fast plugin server. Best for survival, minigames and plugins.',
    mods: false,
    plugins: true,
    datapacks: true
  },
  {
    value: 'vanilla',
    label: 'Vanilla',
    description: 'Official Mojang server. Datapacks only, no plugins or mods.',
    mods: false,
    plugins: false,
    datapacks: true
  },
  {
    value: 'fabric',
    label: 'Fabric',
    description: 'Lightweight modded server using Fabric mods.',
    mods: true,
    plugins: false,
    datapacks: true
  },
  {
    value: 'forge',
    label: 'Forge',
    description: 'Classic modded server using Forge mods.',
    mods: true,
    plugins: false,
    datapacks: true
  },
  {
    value: 'neoforge',
    label: 'NeoForge',
    description: 'Modern Forge-compatible server using NeoForge mods.',
    mods: true,
    plugins: false,
    datapacks: true
  },
  {
    value: 'quilt',
    label: 'Quilt',
    description: 'Fabric-compatible modded server using Quilt mods.',
    mods: true,
    plugins: false,
    datapacks: true
  }
]

export function serverTypeInfo(type: ServerType): ServerTypeInfo {
  return SERVER_TYPES.find((entry) => entry.value === type) ?? SERVER_TYPES[1]!
}

export function serverTypeLabel(type: ServerType): string {
  return serverTypeInfo(type).label
}

export function serverSupportsAddon(type: ServerType, addon: ServerAddonType): boolean {
  const info = serverTypeInfo(type)
  if (addon === 'mod') return info.mods
  if (addon === 'plugin') return info.plugins
  return info.datapacks
}

export function serverLoader(type: ServerType): LoaderType | undefined {
  if (type === 'fabric' || type === 'quilt' || type === 'forge' || type === 'neoforge') return type
  return undefined
}

/** Plugin platforms a Paper server can load. Paper is preferred when choosing versions. */
export const PAPER_PLUGIN_LOADERS = ['paper', 'purpur', 'spigot', 'bukkit'] as const
