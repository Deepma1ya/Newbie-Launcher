import type { AddonRecord, BulkAddonType } from './types'

export const BULK_ADDON_TYPES: readonly BulkAddonType[] = [
  'mod',
  'datapack',
  'resourcepack',
  'shader'
]

export type AddonBulkFilter = 'all' | BulkAddonType

export function isBulkAddonType(type: string): type is BulkAddonType {
  return (BULK_ADDON_TYPES as readonly string[]).includes(type)
}

export function addonBulkTargets(
  addons: Pick<AddonRecord, 'type'>[],
  filter: AddonBulkFilter
): number {
  return addons.filter(
    (addon) => isBulkAddonType(addon.type) && (filter === 'all' || addon.type === filter)
  ).length
}

export function addonBulkNoun(filter: AddonBulkFilter): string {
  switch (filter) {
    case 'mod':
      return 'mods'
    case 'datapack':
      return 'datapacks'
    case 'resourcepack':
      return 'resource packs'
    case 'shader':
      return 'shaders'
    default:
      return 'add-ons'
  }
}
