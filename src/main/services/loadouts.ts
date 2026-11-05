import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { AddonRecord, Instance, Loadout, LoadoutMode, LoadoutPlan } from '@shared/types'
import { store } from './store'
import { addonRecordFolder } from './addonTypes'
import { addonCacheEntry, cacheFileFromUrl } from './installer'
import { getModrinthVersion, pickPrimaryFile } from './modrinth'
import { ensureDir, pathExists, uniqueId } from '../util/fs'
import { paths } from './paths'
import { persistInstance } from './addons'
import { logger } from '../util/log'

export async function createLoadout(
  instanceId: string,
  input: { name: string; mode: LoadoutMode; addonIds: string[] }
): Promise<Loadout> {
  const instance = requireInstance(instanceId)
  const name = input.name.trim()
  if (!name) throw new Error('Give the loadout a name')
  if (instance.loadouts.some((loadout) => loadout.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A loadout with that name already exists')
  }
  const now = new Date().toISOString()
  const loadout: Loadout = {
    id: uniqueId('loadout'),
    name,
    mode: input.mode,
    addonIds: [...new Set(input.addonIds)],
    createdAt: now,
    updatedAt: now
  }
  instance.loadouts.push(loadout)
  if (instance.loadouts.length === 1) instance.activeLoadoutId = loadout.id
  await persistInstance(instance)
  return loadout
}

export async function updateLoadout(
  instanceId: string,
  loadoutId: string,
  patch: { name?: string; mode?: LoadoutMode; addonIds?: string[] }
): Promise<Loadout> {
  const instance = requireInstance(instanceId)
  const loadout = instance.loadouts.find((candidate) => candidate.id === loadoutId)
  if (!loadout) throw new Error('Loadout not found')
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('Give the loadout a name')
    if (instance.loadouts.some((candidate) => candidate.id !== loadoutId && candidate.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A loadout with that name already exists')
    }
    loadout.name = name
  }
  if (patch.mode) loadout.mode = patch.mode
  if (patch.addonIds) loadout.addonIds = [...new Set(patch.addonIds)]
  loadout.updatedAt = new Date().toISOString()
  await persistInstance(instance)
  return loadout
}

export async function removeLoadout(instanceId: string, loadoutId: string): Promise<void> {
  const instance = requireInstance(instanceId)
  if (instance.loadouts.length <= 1) throw new Error('Keep at least one loadout')
  instance.loadouts = instance.loadouts.filter((loadout) => loadout.id !== loadoutId)
  if (instance.activeLoadoutId === loadoutId) {
    instance.activeLoadoutId = instance.loadouts[0]!.id
  }
  await persistInstance(instance)
}

export async function planLoadout(instanceId: string, loadoutId: string): Promise<LoadoutPlan> {
  const instance = requireInstance(instanceId)
  const loadout = instance.loadouts.find((candidate) => candidate.id === loadoutId)
  if (!loadout) throw new Error('Loadout not found')
  const addonIds = new Set(loadout.addonIds)
  const required = instance.addons.filter((addon) => addonIds.has(addon.id))
  const missing: LoadoutPlan['missing'] = []
  let copy = 0
  let download = 0
  let totalBytes = 0
  for (const record of required) {
    const target = path.join(instance.gameDir, addonRecordFolder(record), record.filename)
    if (await pathExists(target)) continue
    const cached = await cachedPathFor(record)
    if (cached) copy += 1
    else if (record.provider !== 'local') download += 1
    else missing.push({ addonId: record.id, name: record.name })
    totalBytes += record.size
  }
  const remove = instance.addons
    .filter((addon) => !addonIds.has(addon.id))
    .filter((addon) => addon.enabled)
    .map((addon) => addon.filename)
  return {
    addonIds: [...addonIds],
    missing,
    remove,
    copy,
    download,
    totalBytes
  }
}

export async function activateLoadout(
  instanceId: string,
  loadoutId: string,
  options: { quiet?: boolean } = {}
): Promise<void> {
  const instance = requireInstance(instanceId)
  const loadout = instance.loadouts.find((candidate) => candidate.id === loadoutId)
  if (!loadout) throw new Error('Loadout not found')
  const wanted = new Set(loadout.addonIds)

  for (const record of instance.addons) {
    if (wanted.has(record.id)) {
      const active = path.join(instance.gameDir, addonRecordFolder(record), record.filename)
      if (!record.enabled) {
        const disabled = `${active}.disabled`
        if (await pathExists(disabled)) await fs.rename(disabled, active)
      }
      await ensureAddonFile(instance, record)
      record.enabled = true
    } else if (record.enabled) {
      const active = path.join(instance.gameDir, addonRecordFolder(record), record.filename)
      if (await pathExists(active)) await fs.rm(active, { force: true }).catch(() => undefined)
      record.enabled = false
    }
  }

  instance.activeLoadoutId = loadout.id
  loadout.lastActivatedAt = new Date().toISOString()
  loadout.updatedAt = loadout.lastActivatedAt
  await persistInstance(instance)
  await evictUnreferencedCache()
  if (!options.quiet) logger.info('loadouts', `Activated ${loadout.name} for ${instance.name}`)
}

/**
 * Offline loadouts keep a copy of every file in cache/addons. Download-on-switch
 * loadouts do not, so cache entries not referenced by any offline loadout are
 * removed. This is what makes the two modes meaningfully different on disk.
 */
export async function evictUnreferencedCache(): Promise<void> {
  const keep = new Set<string>()
  for (const current of store.instances()) {
    for (const loadout of current.loadouts) {
      if (loadout.mode !== 'offline') continue
      for (const addonId of loadout.addonIds) {
        const addon = current.addons.find((candidate) => candidate.id === addonId)
        if (addon?.sha1) keep.add(addon.sha1)
      }
    }
  }
  let entries
  try {
    entries = await fs.readdir(paths.addonCache, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (keep.has(entry.name)) continue
    await fs.rm(path.join(paths.addonCache, entry.name), { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function ensureActiveLoadout(instance: Instance): Promise<void> {
  const loadout = instance.loadouts.find((candidate) => candidate.id === instance.activeLoadoutId)
  if (!loadout) return
  const wanted = new Set(loadout.addonIds)
  for (const record of instance.addons) {
    if (!wanted.has(record.id) || !record.enabled) continue
    await ensureAddonFile(instance, record)
  }
}

export async function backupLoadout(instanceId: string, loadoutId: string): Promise<void> {
  const instance = requireInstance(instanceId)
  const loadout = instance.loadouts.find((candidate) => candidate.id === loadoutId)
  if (!loadout) throw new Error('Loadout not found')
  for (const id of loadout.addonIds) {
    const record = instance.addons.find((addon) => addon.id === id)
    if (!record) continue
    await ensureAddonFile(instance, record, true)
  }
  loadout.mode = 'offline'
  loadout.updatedAt = new Date().toISOString()
  await persistInstance(instance)
  await evictUnreferencedCache()
}

export async function ensureAddonFile(instance: Instance, record: AddonRecord, forceCache = false): Promise<void> {
  const target = path.join(instance.gameDir, addonRecordFolder(record), record.filename)
  if (!forceCache && (await pathExists(target))) return

  let source = await cachedPathFor(record)
  if (!source) {
    source = await downloadRecord(record)
  }
  if (!source) throw new Error(`No download source for ${record.name}. Reinstall the add-on to repair it.`)
  await ensureDir(path.dirname(target))
  await fs.copyFile(source, target)
}

export async function downloadRecord(record: AddonRecord): Promise<string | null> {
  try {
    if (record.provider === 'modrinth') {
      const version = await getModrinthVersion(record.versionId)
      const file = pickPrimaryFile(version)
      if (!file) return null
      return await cacheFileFromUrl(file.url, file.hashes.sha1, record.filename)
    }
  } catch (error) {
    logger.warn('loadouts', `Unable to download ${record.name}`, error)
  }
  return null
}

export async function cachedPathFor(record: AddonRecord): Promise<string | null> {
  if (record.sha1) {
    const candidate = addonCacheEntry(record.sha1, record.filename)
    if (await pathExists(candidate)) return candidate
  }
  const fallback = path.join(store.settings().dataDir, 'cache', 'downloads', record.filename)
  if (await pathExists(fallback)) return fallback
  return null
}

function requireInstance(id: string): Instance {
  const instance = store.instance(id)
  if (!instance) throw new Error('Instance not found')
  return instance
}
