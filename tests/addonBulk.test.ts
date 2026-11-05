import { describe, expect, it } from 'vitest'
import {
  addonBulkNoun,
  addonBulkTargets,
  isBulkAddonType
} from '@shared/addonBulk'

const addons = [
  { type: 'mod' },
  { type: 'mod' },
  { type: 'resourcepack' },
  { type: 'datapack' },
  { type: 'shader' },
  { type: 'world' },
  { type: 'modpack' }
] as const

describe('bulk add-on deletion', () => {
  it('only treats removable client add-on types as bulk targets', () => {
    expect(isBulkAddonType('mod')).toBe(true)
    expect(isBulkAddonType('resourcepack')).toBe(true)
    expect(isBulkAddonType('world')).toBe(false)
    expect(isBulkAddonType('modpack')).toBe(false)
  })

  it('counts the active section and ignores worlds/modpacks for All', () => {
    expect(addonBulkTargets(addons as never, 'all')).toBe(5)
    expect(addonBulkTargets(addons as never, 'mod')).toBe(2)
    expect(addonBulkTargets(addons as never, 'datapack')).toBe(1)
    expect(addonBulkTargets(addons as never, 'resourcepack')).toBe(1)
    expect(addonBulkTargets(addons as never, 'shader')).toBe(1)
  })

  it('uses readable section names', () => {
    expect(addonBulkNoun('all')).toBe('add-ons')
    expect(addonBulkNoun('mod')).toBe('mods')
    expect(addonBulkNoun('datapack')).toBe('datapacks')
    expect(addonBulkNoun('resourcepack')).toBe('resource packs')
    expect(addonBulkNoun('shader')).toBe('shaders')
  })
})
