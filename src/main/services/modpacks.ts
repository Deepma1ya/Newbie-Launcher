import path from 'node:path'
import { promises as fs } from 'node:fs'
import AdmZip from 'adm-zip'
import type { AddonRecord, AddonType, Instance } from '@shared/types'
import { isPackCompatible } from '@shared/packCompatibility'
import {
  getModrinthProject,
  getModrinthVersion,
  getModrinthVersions,
  getModrinthVersionsByHashes,
  pickPrimaryFile,
  projectTypeToAddonType
} from './modrinth'
import { addonCacheEntry } from './installer'
import { downloadFile } from './http'
import { paths } from './paths'
import { store } from './store'
import { createInstance } from './instances'
import { addonRecordFolder } from './addonTypes'
import { ensureDir, safeJoin } from '../util/fs'
import { mapLimit } from '../util/async'
import { zipPaths } from '../util/archive'
import { logger } from '../util/log'

interface MrpackIndex {
  formatVersion: number
  game: string
  versionId: string
  name: string
  summary?: string
  files: {
    path: string
    hashes: { sha1: string; sha512?: string }
    env?: { client?: string; server?: string }
    downloads: string[]
    fileSize: number
  }[]
  dependencies: Record<string, string>
}

interface PreparedModpack {
  projectId: string
  versionId: string
  name: string
  summary?: string
  gameVersion: string
  loader: Instance['loader']
  loaderVersion: string
  iconUrl?: string
  archive: string
  mrpack?: MrpackIndex
}

export async function installModpack(projectId: string, versionId: string): Promise<Instance> {
  const meta = await prepareModpack(projectId, versionId)
  return createInstance({
    name: meta.name,
    versionId: meta.gameVersion,
    loader: meta.loader,
    loaderVersion: meta.loaderVersion,
    iconUrl: meta.iconUrl,
    modpack: {
      projectId,
      versionId
    }
  })
}

export async function installModpackIntoInstance(
  instanceId: string,
  projectId: string,
  versionId: string,
  onProgress?: (message: string, percent?: number) => void
): Promise<void> {
  const meta = await prepareModpack(projectId, versionId)
  await installPreparedModpack(instanceId, meta, onProgress)
}

/**
 * Add a modpack to an existing instance. This is intentionally stricter than
 * installing individual mods: game version and loader must match the pack.
 */
export async function installModpackToInstance(
  instanceId: string,
  projectId: string,
  versionId: string,
  onProgress?: (message: string, percent?: number) => void
): Promise<Instance> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const meta = await prepareModpack(projectId, versionId)

  if (!isPackCompatible(meta.gameVersion, meta.loader, instance.versionId, instance.loader)) {
    throw new Error(
      `This pack targets Minecraft ${meta.gameVersion} with ${loaderLabel(meta.loader)}, but ${instance.name} is ${instance.versionId} with ${loaderLabel(instance.loader)}. Create a matching instance instead.`
    )
  }

  onProgress?.('Creating a safety backup', 4)
  await backupBeforeModpack(instance)
  onProgress?.('Adding modpack to instance', 10)
  await installPreparedModpack(instanceId, meta, onProgress, { preserveLoadoutMode: true })
  return store.instance(instanceId)!
}

async function installPreparedModpack(
  instanceId: string,
  meta: PreparedModpack,
  onProgress?: (message: string, percent?: number) => void,
  options: { preserveLoadoutMode?: boolean } = {}
): Promise<void> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')

  await ensureDir(instance.gameDir)
  const loadout = instance.loadouts.find((candidate) => candidate.id === instance.activeLoadoutId)
  if (loadout && !options.preserveLoadoutMode) {
    loadout.mode = 'offline'
    loadout.updatedAt = new Date().toISOString()
  }

  if (meta.mrpack) {
    await installMrpackFiles(instance, meta, onProgress)
  }

  const active = instance.loadouts.find((candidate) => candidate.id === instance.activeLoadoutId)
  if (active) {
    active.addonIds = [...new Set(instance.addons.map((addon) => addon.id))]
    if (!options.preserveLoadoutMode) active.mode = 'offline'
    active.updatedAt = new Date().toISOString()
  }
  const known = new Set(instance.addons.map((addon) => addon.id))
  for (const existingLoadout of instance.loadouts) {
    existingLoadout.addonIds = existingLoadout.addonIds.filter((id) => known.has(id))
  }

  await store.updateInstance(instanceId, (current) => {
    current.addons = instance.addons
    current.loadouts = instance.loadouts
  })
  onProgress?.('Modpack installed', 100)
}

async function backupBeforeModpack(instance: Instance): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destination = path.join(paths.modpackBackups, `${instance.id}-${stamp}.zip`)
  try {
    await zipPaths(instance.gameDir, [
      'mods',
      'config',
      'defaultconfigs',
      'kubejs',
      'scripts',
      'resourcepacks',
      'shaderpacks',
      'options.txt'
    ], destination)
    logger.info('modpacks', `Pre-modpack backup created at ${destination}`)
    return destination
  } catch (error) {
    logger.error('modpacks', 'Could not create a pre-modpack backup', error)
    throw new Error('The safety backup could not be created, so the modpack was not added.')
  }
}

function loaderLabel(loader: Instance['loader']): string {
  return loader === 'vanilla' ? 'Vanilla' : loader.charAt(0).toUpperCase() + loader.slice(1)
}

async function prepareModpack(projectId: string, requestedVersionId: string): Promise<PreparedModpack> {
  const project = await getModrinthProject(projectId)
  const versions = await getModrinthVersions(projectId)
  const version = versions.find((candidate) => candidate.id === requestedVersionId) ?? versions[0]
  if (!version) throw new Error('This modpack has no downloadable versions')
  const file = pickPrimaryFile(version)
  if (!file) throw new Error('The modpack version has no .mrpack file')
  const archive = file.hashes.sha1
    ? addonCacheEntry(file.hashes.sha1, file.filename)
    : path.join(paths.downloadsCache, file.filename)
  await downloadFile(file.url, archive, {
    sha1: file.hashes.sha1,
    size: file.size,
    retries: 4
  })
  const zip = new AdmZip(archive)
  const entry = zip.getEntry('modrinth.index.json')
  if (!entry) throw new Error('This .mrpack file is missing modrinth.index.json')
  const index = JSON.parse(entry.getData().toString('utf8')) as MrpackIndex
  const loader = detectLoader(index.dependencies)
  return {
    projectId,
    versionId: version.id,
    name: project.title || index.name,
    summary: project.description || index.summary,
    gameVersion: index.dependencies.minecraft ?? version.game_versions[0] ?? '',
    loader: loader.type,
    loaderVersion: loader.version,
    iconUrl: project.icon_url ?? undefined,
    archive,
    mrpack: index
  }
}

async function installMrpackFiles(
  instance: Instance,
  meta: PreparedModpack,
  onProgress?: (message: string, percent?: number) => void
): Promise<void> {
  const index = meta.mrpack!
  const files = index.files.filter((file) => file.env?.client !== 'unsupported')
  let completed = 0

  const added = await mapLimit(files, 6, async (file): Promise<AddonRecord | null> => {
    const relative = file.path.replace(/\\/g, '/')
    const target = safeJoin(instance.gameDir, relative)
    const filename = path.basename(relative)
    const type = typeFromPath(relative)
    const cache = addonCacheEntry(file.hashes.sha1, filename)
    try {
      await downloadFile(file.downloads[0]!, cache, {
        sha1: file.hashes.sha1,
        size: file.fileSize,
        retries: 4
      })
      await ensureDir(path.dirname(target))
      await fs.copyFile(cache, target)
      completed += 1
      onProgress?.(`Installing modpack files (${completed}/${files.length})`, 40 + Math.round((completed / Math.max(1, files.length)) * 45))
      return {
        id: `mrpack_${file.hashes.sha1.slice(0, 12)}`,
        provider: 'local',
        projectId: `mrpack_${file.hashes.sha1.slice(0, 12)}`,
        versionId: 'local',
        name: filename.replace(/\.[^.]+$/, ''),
        type,
        filename,
        versionNumber: 'from modpack',
        sha1: file.hashes.sha1,
        size: file.fileSize,
        dependencies: [],
        enabled: true,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    } catch (error) {
      logger.warn('modpacks', `Could not download modpack file ${relative}`, error)
      return null
    }
  })
  const downloaded = added.filter((record): record is AddonRecord => Boolean(record))
  onProgress?.(`Identifying mods (${downloaded.length})`, 86)
  const enriched = await enrichMrpackRecords(downloaded)
  await mergePackRecords(instance, enriched)

  onProgress?.('Extracting overrides', 92)
  await extractOverrides(meta.archive, instance.gameDir, ['overrides', 'client-overrides'])
}

async function mergePackRecords(instance: Instance, incoming: AddonRecord[]): Promise<void> {
  const result = [...instance.addons]
  for (const record of incoming) {
    const matches = result.filter((existing) => sameOrReplacedAddon(existing, record))
    for (const match of matches) {
      if (match.filename !== record.filename || match.type !== record.type) {
        await removeManagedFile(instance, match)
      }
      record.installedAt = match.installedAt ?? record.installedAt
    }
    for (let index = result.length - 1; index >= 0; index -= 1) {
      if (sameOrReplacedAddon(result[index]!, record)) result.splice(index, 1)
    }
    result.push(record)
  }
  instance.addons = result
}

function sameOrReplacedAddon(existing: AddonRecord, incoming: AddonRecord): boolean {
  if (existing.id === incoming.id) return true
  if (
    existing.provider !== 'local' &&
    incoming.provider !== 'local' &&
    existing.provider === incoming.provider &&
    existing.projectId === incoming.projectId
  ) {
    return true
  }
  return existing.filename === incoming.filename && existing.type === incoming.type
}

async function removeManagedFile(instance: Instance, record: AddonRecord): Promise<void> {
  const base = path.join(instance.gameDir, addonRecordFolder(record), record.filename)
  await fs.rm(base, { force: true }).catch(() => undefined)
  await fs.rm(`${base}.disabled`, { force: true }).catch(() => undefined)
}

async function enrichMrpackRecords(records: AddonRecord[]): Promise<AddonRecord[]> {
  const hashes = records.map((record) => record.sha1).filter((sha1): sha1 is string => Boolean(sha1))
  const matches = await getModrinthVersionsByHashes(hashes)
  const projectCache = new Map<string, Awaited<ReturnType<typeof getModrinthProject>>>()
  return mapLimit(records, 5, async (record) => {
    const version = record.sha1 ? matches[record.sha1] : undefined
    if (!version) return record
    let project = projectCache.get(version.project_id)
    if (!project) {
      project = await getModrinthProject(version.project_id).catch(() => undefined as never)
      if (project) projectCache.set(version.project_id, project)
    }
    if (!project) return record
    return {
      ...record,
      id: `addon_modrinth_${project.id}`,
      provider: 'modrinth' as const,
      projectId: project.id,
      versionId: version.id,
      name: project.title,
      slug: project.slug,
      type: projectTypeToAddonType(project.project_type),
      versionNumber: version.version_number,
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
      latestVersionId: version.id,
      latestVersionNumber: version.version_number
    }
  })
}

async function extractOverrides(archive: string, gameDir: string, prefixes: string[]): Promise<void> {
  const zip = new AdmZip(archive)
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const name = entry.entryName.replace(/\\/g, '/')
    const prefix = prefixes.find((candidate) => name.startsWith(`${candidate}/`))
    if (!prefix) continue
    const relative = name.slice(prefix.length + 1)
    if (!relative) continue
    const target = safeJoin(gameDir, relative)
    await ensureDir(path.dirname(target))
    await fs.writeFile(target, entry.getData())
  }
}

function detectLoader(dependencies: Record<string, string>): { type: Instance['loader']; version: string } {
  if (dependencies['fabric-loader']) return { type: 'fabric', version: dependencies['fabric-loader'] }
  if (dependencies['quilt-loader']) return { type: 'quilt', version: dependencies['quilt-loader'] }
  if (dependencies.forge) return { type: 'forge', version: dependencies.forge }
  if (dependencies.neoforge) return { type: 'neoforge', version: dependencies.neoforge }
  return { type: 'vanilla', version: '' }
}

function typeFromPath(relative: string): AddonType {
  if (relative.startsWith('resourcepacks/')) return 'resourcepack'
  if (relative.startsWith('shaderpacks/')) return 'shader'
  if (relative.startsWith('datapacks/')) return 'datapack'
  return 'mod'
}

export async function loadModpackIndex(archive: string): Promise<MrpackIndex> {
  const zip = new AdmZip(archive)
  const entry = zip.getEntry('modrinth.index.json')
  if (!entry) throw new Error('Not a Modrinth modpack')
  return JSON.parse(entry.getData().toString('utf8')) as MrpackIndex
}
