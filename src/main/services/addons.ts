import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  AddonDependency,
  AddonRecord,
  AddonType,
  Instance,
  LoaderType,
  ModrinthVersion
} from '@shared/types'
import {
  getModrinthProject,
  getModrinthUpdatesByHashes,
  getModrinthVersion,
  getModrinthVersions,
  getModrinthVersionsByHashes,
  pickPrimaryFile,
  projectTypeToAddonType,
  selectBestVersion
} from './modrinth'
import { addonFolder } from './addonTypes'
import { store } from './store'
import { sha1File } from '../util/hash'
import { addonCacheEntry, cacheFileFromUrl } from './installer'
import { ensureDir, pathExists, sanitizeFilename, uniqueId } from '../util/fs'
import { readJarMeta } from './jarMeta'
import { logger } from '../util/log'

export interface InstallAddonResult {
  records: AddonRecord[]
  installed: number
}

type Progress = (message: string, percent?: number) => void

export async function installAddon(
  instanceId: string,
  ref: { projectId: string; versionId: string },
  onProgress?: Progress
): Promise<InstallAddonResult> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const visited = new Set<string>()
  const added = new Map<string, AddonRecord>()

  await installRef(instance, ref, added, visited, 0, onProgress)
  await persistInstance(instance)
  onProgress?.('Add-ons installed', 100)
  return { records: [...added.values()], installed: added.size }
}

async function installRef(
  instance: Instance,
  ref: { projectId: string; versionId: string },
  added: Map<string, AddonRecord>,
  visited: Set<string>,
  depth: number,
  onProgress?: Progress
): Promise<void> {
  if (depth > 6) return
  const key = `modrinth:${ref.projectId}`
  if (visited.has(key)) return
  visited.add(key)

  const project = await getModrinthProject(ref.projectId)
  const type = projectTypeToAddonType(project.project_type)
  const version = ref.versionId
    ? await getModrinthVersion(ref.versionId)
    : selectBestVersion(
        await getModrinthVersions(
          ref.projectId,
          instance.versionId,
          type === 'mod' || type === 'modpack' ? instance.loader : undefined
        ),
        instance.versionId,
        instance.loader,
        type
      )
  if (!version) throw new Error(`${project.title} has no version compatible with ${instance.versionId}`)
  if (type === 'mod' && instance.loader === 'vanilla') {
    throw new Error(
      'This instance is vanilla and cannot load mods. Change the instance to Fabric, Quilt, Forge or NeoForge first.'
    )
  }
  const file = pickPrimaryFile(version)
  if (!file) throw new Error(`${project.title} has no downloadable file`)
  onProgress?.(`Downloading ${project.title} ${version.version_number}`, 25)
  const record = await materialiseFile(instance, {
    provider: 'modrinth',
    projectId: project.id,
    versionId: version.id,
    name: project.title,
    slug: project.slug,
    type,
    filename: sanitizeFilename(file.filename),
    versionNumber: version.version_number,
    sha1: file.hashes.sha1,
    size: file.size,
    iconUrl: project.icon_url ?? undefined,
    description: project.description,
    sourceUrl: `https://modrinth.com/${project.project_type}/${project.slug}`,
    dependencies: version.dependencies
      .filter((dependency) => dependency.project_id)
      .map((dependency) => ({
        provider: 'modrinth' as const,
        projectId: dependency.project_id ?? undefined,
        versionId: dependency.version_id ?? undefined,
        type: dependency.dependency_type
      })),
    url: file.url
  })
  added.set(record.id, record)
  onProgress?.(`Installed ${project.title}`, 60)

  for (const dependency of version.dependencies) {
    if (dependency.dependency_type !== 'required' || !dependency.project_id) continue
    if (instance.addons.some((addon) => addon.provider === 'modrinth' && addon.projectId === dependency.project_id)) continue
    if (visited.has(`modrinth:${dependency.project_id}`)) continue
    try {
      await installRef(
        instance,
        {
          projectId: dependency.project_id,
          versionId: dependency.version_id ?? ''
        },
        added,
        visited,
        depth + 1,
        onProgress
      )
    } catch (error) {
      logger.warn('addons', `Unable to install dependency ${dependency.project_id}`, error)
    }
  }
}

async function materialiseFile(
  instance: Instance,
  input: {
    provider: 'modrinth'
    projectId: string
    versionId: string
    name: string
    slug?: string
    type: AddonType
    filename: string
    versionNumber: string
    sha1?: string
    size: number
    iconUrl?: string
    description?: string
    sourceUrl?: string
    dependencies: AddonDependency[]
    url: string
  }
): Promise<AddonRecord> {
  const cachePath = input.sha1
    ? addonCacheEntry(input.sha1, input.filename)
    : path.join(store.settings().dataDir, 'cache', 'downloads', input.filename)
  await cacheFileFromUrl(input.url, input.sha1, input.filename)
  const recordId = `addon_${input.provider}_${input.projectId}`
  const existing = instance.addons.find((addon) => addon.id === recordId)
  if (existing && existing.filename !== input.filename) {
    await removeRecordFile(instance, existing)
  }
  const target = path.join(instance.gameDir, addonFolder(input.type), input.filename)
  await ensureDir(path.dirname(target))
  await fs.copyFile(cachePath, target)

  const now = new Date().toISOString()
  const record: AddonRecord = {
    id: recordId,
    provider: input.provider,
    projectId: input.projectId,
    versionId: input.versionId,
    name: input.name,
    slug: input.slug,
    type: input.type,
    filename: input.filename,
    versionNumber: input.versionNumber,
    sha1: input.sha1,
    size: input.size,
    iconUrl: input.iconUrl,
    description: input.description,
    sourceUrl: input.sourceUrl,
    dependencies: input.dependencies,
    enabled: true,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    latestVersionId: input.versionId,
    latestVersionNumber: input.versionNumber,
    updateCheckedAt: now
  }
  instance.addons = instance.addons.filter((addon) => addon.id !== recordId)
  instance.addons.push(record)
  const active = instance.loadouts.find((loadout) => loadout.id === instance.activeLoadoutId)
  if (active && !active.addonIds.includes(recordId)) {
    active.addonIds.push(recordId)
    active.updatedAt = now
  }
  return record
}

export async function removeAddon(
  instanceId: string,
  addonId: string,
  deleteFile: boolean
): Promise<void> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const record = instance.addons.find((addon) => addon.id === addonId)
  if (!record) return
  if (deleteFile) await removeRecordFile(instance, record)
  instance.addons = instance.addons.filter((addon) => addon.id !== addonId)
  for (const loadout of instance.loadouts) {
    loadout.addonIds = loadout.addonIds.filter((id) => id !== addonId)
    loadout.updatedAt = new Date().toISOString()
  }
  await persistInstance(instance)
}

export async function toggleAddon(
  instanceId: string,
  addonId: string,
  enabled: boolean
): Promise<AddonRecord> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const record = instance.addons.find((addon) => addon.id === addonId)
  if (!record) throw new Error('Add-on not found')
  const folder = addonFolder(record.type)
  const active = path.join(instance.gameDir, folder, record.filename)
  const disabled = `${active}.disabled`
  if (enabled) {
    if (await pathExists(disabled)) await fs.rename(disabled, active)
  } else if (await pathExists(active)) {
    await fs.rename(active, disabled)
  }
  record.enabled = enabled
  record.updatedAt = new Date().toISOString()
  await persistInstance(instance)
  return record
}

export async function checkAddonUpdates(instanceId: string): Promise<AddonRecord[]> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const now = new Date().toISOString()
  for (const record of instance.addons) {
    if (record.provider !== 'modrinth') continue
    try {
      const versions = await getModrinthVersions(
        record.projectId,
        instance.versionId,
        record.type === 'mod' || record.type === 'modpack' ? instance.loader : undefined
      )
      const best = selectBestVersion(versions, instance.versionId, instance.loader, record.type)
      if (best) {
        record.latestVersionId = best.id
        record.latestVersionNumber = best.version_number
      }
      record.updateCheckedAt = now
    } catch (error) {
      logger.warn('addons', `Update check failed for ${record.name}`, error)
    }
  }
  await persistInstance(instance)
  return instance.addons
}

export async function updateAllAddons(
  instanceId: string,
  onProgress?: Progress
): Promise<AddonRecord[]> {
  const checked = await checkAddonUpdates(instanceId)
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const pending = checked.filter(
    (record) => record.latestVersionId && record.latestVersionId !== record.versionId && record.provider === 'modrinth'
  )
  let index = 0
  for (const record of pending) {
    index += 1
    onProgress?.(`Updating ${record.name} (${index}/${pending.length})`, Math.round((index / Math.max(1, pending.length)) * 100))
    try {
      await installAddon(instanceId, {
        projectId: record.projectId,
        versionId: record.latestVersionId ?? ''
      })
    } catch (error) {
      logger.warn('addons', `Failed to update ${record.name}`, error)
    }
  }
  return store.instance(instanceId)?.addons ?? []
}

export async function scanUnmanagedAddons(instanceId: string): Promise<AddonRecord[]> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const folders: { folder: string; type: AddonType }[] = [
    { folder: 'mods', type: 'mod' },
    { folder: 'resourcepacks', type: 'resourcepack' },
    { folder: 'shaderpacks', type: 'shader' },
    { folder: 'datapacks', type: 'datapack' }
  ]
  const known = new Set(instance.addons.flatMap((addon) => [addon.filename, `${addon.filename}.disabled`]))
  const candidates: { file: string; filename: string; type: AddonType; sha1: string }[] = []
  for (const { folder, type } of folders) {
    const dir = path.join(instance.gameDir, folder)
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!/\.(jar|zip|mrpack)$/i.test(entry.name)) continue
      if (known.has(entry.name)) continue
      const file = path.join(dir, entry.name)
      const sha1 = await sha1File(file)
      candidates.push({ file, filename: entry.name, type, sha1 })
    }
  }
  if (candidates.length === 0) return []

  const matches = await getModrinthVersionsByHashes(candidates.map((candidate) => candidate.sha1))
  const projectCache = new Map<string, Awaited<ReturnType<typeof getModrinthProject>>>()
  const added: AddonRecord[] = []
  for (const candidate of candidates) {
    const version = matches[candidate.sha1]
    if (!version) {
      const meta = readJarMeta(candidate.file)
      const record: AddonRecord = {
        id: uniqueId('local'),
        provider: 'local',
        projectId: `local_${candidate.sha1}`,
        versionId: 'local',
        name: meta?.name ?? candidate.filename,
        type: candidate.type,
        filename: candidate.filename,
        versionNumber: meta?.version ?? 'unknown',
        sha1: candidate.sha1,
        size: (await fs.stat(candidate.file)).size,
        description: meta?.description,
        dependencies: [],
        enabled: !candidate.filename.endsWith('.disabled'),
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      instance.addons.push(record)
      added.push(record)
      continue
    }
    let project = projectCache.get(version.project_id)
    if (!project) {
      project = await getModrinthProject(version.project_id)
      projectCache.set(version.project_id, project)
    }
    const type = projectTypeToAddonType(project.project_type)
    const record: AddonRecord = {
      id: `addon_modrinth_${project.id}`,
      provider: 'modrinth',
      projectId: project.id,
      versionId: version.id,
      name: project.title,
      slug: project.slug,
      type,
      filename: candidate.filename,
      versionNumber: version.version_number,
      sha1: candidate.sha1,
      size: (await fs.stat(candidate.file)).size,
      iconUrl: project.icon_url ?? undefined,
      description: project.description,
      sourceUrl: `https://modrinth.com/${project.project_type}/${project.slug}`,
      dependencies: version.dependencies
        .filter((dependency) => dependency.project_id)
        .map((dependency) => ({
          provider: 'modrinth' as const,
          projectId: dependency.project_id ?? undefined,
          versionId: dependency.version_id ?? undefined,
          type: dependency.dependency_type
        })),
      enabled: !candidate.filename.endsWith('.disabled'),
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latestVersionId: version.id,
      latestVersionNumber: version.version_number
    }
    if (!instance.addons.some((addon) => addon.id === record.id)) {
      instance.addons.push(record)
      added.push(record)
    }
  }
  const active = instance.loadouts.find((loadout) => loadout.id === instance.activeLoadoutId)
  if (active) {
    for (const record of added) {
      if (!active.addonIds.includes(record.id)) active.addonIds.push(record.id)
    }
    active.updatedAt = new Date().toISOString()
  }
  await persistInstance(instance)
  return added
}

export async function updateHashesForLoadout(instanceId: string): Promise<Record<string, ModrinthVersion>> {
  const instance = store.instance(instanceId)
  if (!instance) return {}
  const hashes = instance.addons.map((addon) => addon.sha1).filter((sha1): sha1 is string => Boolean(sha1))
  return getModrinthUpdatesByHashes(hashes, instance.versionId, instance.loader)
}

export function addonFilePath(instance: Instance, record: AddonRecord, disabled = false): string {
  const base = path.join(instance.gameDir, addonFolder(record.type), record.filename)
  return disabled ? `${base}.disabled` : base
}

async function removeRecordFile(instance: Instance, record: AddonRecord): Promise<void> {
  const active = addonFilePath(instance, record)
  const disabled = `${active}.disabled`
  await fs.rm(active, { force: true }).catch(() => undefined)
  await fs.rm(disabled, { force: true }).catch(() => undefined)
}

export async function persistInstance(instance: Instance): Promise<void> {
  await store.updateInstance(instance.id, (current) => {
    current.addons = instance.addons
    current.loadouts = instance.loadouts
    current.activeLoadoutId = instance.activeLoadoutId
    current.lastPlayedAt = instance.lastPlayedAt
    current.totalPlayTimeSec = instance.totalPlayTimeSec
    if (instance.repairFailures !== undefined) current.repairFailures = instance.repairFailures
  })
}

export function inferAddonTypeFromFile(file: string): AddonType {
  if (/\.zip$/i.test(file)) {
    const meta = readJarMeta(file)
    if (meta?.packFormat) return 'resourcepack'
  }
  return 'mod'
}
