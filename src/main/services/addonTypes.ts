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

export function curseForgeClassId(type: AddonType): number {
  switch (type) {
    case 'mod':
      return 6
    case 'modpack':
      return 4471
    case 'resourcepack':
      return 12
    case 'world':
      return 4546
    case 'shader':
      return 6552
    default:
      return 6
  }
}

export function curseForgeModLoaderType(loader: LoaderType): number | undefined {
  switch (loader) {
    case 'forge':
      return 1
    case 'fabric':
      return 4
    case 'quilt':
      return 5
    case 'neoforge':
      return 6
    default:
      return undefined
  }
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
