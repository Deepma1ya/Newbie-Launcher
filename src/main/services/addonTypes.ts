import type { AddonType, LoaderType } from '@shared/types'

export function loaderTypeToModrinth(loader: LoaderType): string {
  switch (loader) {
    case 'fabric':
      return 'fabric'
    case 'quilt':
      return 'quilt'
    case 'forge':
      return 'forge'
    case 'neoforge':
      return 'neoforge'
    default:
      return 'minecraft'
  }
}

export function modrinthToLoaderType(loader: string): LoaderType | null {
  if (loader === 'fabric' || loader === 'quilt' || loader === 'forge' || loader === 'neoforge') return loader
  return null
}

export function addonTypeToLoaderCategories(type: AddonType): string[] {
  switch (type) {
    case 'shader':
      return ['iris', 'optifine']
    case 'resourcepack':
      return ['minecraft']
    default:
      return []
  }
}

export function modrinthProjectType(type: AddonType): string {
  return type
}

export function addonFolder(type: AddonType): string {
  switch (type) {
    case 'resourcepack':
      return 'resourcepacks'
    case 'shader':
      return 'shaderpacks'
    case 'datapack':
      return 'datapacks'
    case 'world':
      return 'saves'
    default:
      return 'mods'
  }
}
