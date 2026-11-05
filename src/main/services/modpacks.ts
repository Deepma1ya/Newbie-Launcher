import path from 'node:path'
import { promises as fs } from 'node:fs'
import AdmZip from 'adm-zip'
import type { AddonRecord, AddonType, Instance } from '@shared/types'
import {
  getModrinthProject,
  getModrinthVersion,
  getModrinthVersions,
  getModrinthVersionsByHashes,
  pickPrimaryFile,
  projectTypeToAddonType
} from './modrinth'
import {
  curseForgeDownloadUrl,
  curseForgeSha1,
  getCurseForgeFile,
  getCurseForgeMod
} from './curseforge'
import { addonCacheEntry } from './installer'
import { downloadFile } from './http'
import { paths } from './paths'
import { store } from './store'
import { createInstance } from './instances'
import { ensureDir, safeJoin } from '../util/fs'
import { mapLimit } from '../util/async'
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

interface CurseForgeManifest {
  minecraft: {
    version: string
    modLoaders: { id: string; primary: boolean }[]
  }
  manifestType: string
  manifestVersion: number
  name: string
  version: string
  author: string
  files: { projectID: number; fileID: number; required: boolean }[]
  overrides: string
}

interface PreparedModpack {
  provider: 'modrinth' | 'curseforge'
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
  curseManifest?: CurseForgeManifest
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
      provider: meta.provider,
      projectId,
      versionId
    }
  })
}

export async function installModpackIntoInstance(
  instanceId: string,
  provider: 'modrinth' | 'curseforge',
  projectId: string,
  versionId: string,
  onProgress?: (message: string, percent?: number) => void
): Promise<void> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const meta = await prepareModpack(projectId, versionId, provider)

  await ensureDir(instance.gameDir)
  const loadout = instance.loadouts.find((candidate) => candidate.id === instance.activeLoadoutId)
  if (loadout) {
    loadout.mode = 'offline'
    loadout.updatedAt = new Date().toISOString()
  }

  if (provider === 'modrinth' && meta.mrpack) {
    await installMrpackFiles(instance, meta, onProgress)
  } else if (provider === 'curseforge' && meta.curseManifest) {
    await installCurseForgeFiles(instance, meta, onProgress)
  }

  const active = instance.loadouts.find((candidate) => candidate.id === instance.activeLoadoutId)
  if (active) {
    active.addonIds = [...new Set(instance.addons.map((addon) => addon.id))]
    active.mode = 'offline'
    active.updatedAt = new Date().toISOString()
  }
  await store.updateInstance(instanceId, (current) => {
    current.addons = instance.addons
    current.loadouts = instance.loadouts
  })
  onProgress?.('Modpack installed', 100)
}

async function prepareModpack(
  projectId: string,
  requestedVersionId: string,
  hintedProvider?: 'modrinth' | 'curseforge'
): Promise<PreparedModpack> {
  if (hintedProvider === 'curseforge' || /^\d+$/.test(projectId)) {
    return prepareCurseForge(projectId, requestedVersionId)
  }
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
    provider: 'modrinth',
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

async function prepareCurseForge(projectId: string, requestedVersionId: string): Promise<PreparedModpack> {
  const project = await getCurseForgeMod(projectId)
  const file = requestedVersionId
    ? await getCurseForgeFile(projectId, requestedVersionId).catch(() => null)
    : project.latestFiles?.[0] ?? null
  if (!file) throw new Error('This CurseForge modpack has no downloadable file')
  const archive = path.join(paths.downloadsCache, file.fileName)
  await downloadFile(curseForgeDownloadUrl(file), archive, {
    sha1: curseForgeSha1(file),
    size: file.fileLength,
    retries: 4
  })
  const zip = new AdmZip(archive)
  const entry = zip.getEntry('manifest.json')
  if (!entry) throw new Error('This CurseForge modpack is missing manifest.json')
  const manifest = JSON.parse(entry.getData().toString('utf8')) as CurseForgeManifest
  const loaderEntry = manifest.minecraft.modLoaders.find((item) => item.primary) ?? manifest.minecraft.modLoaders[0]
  const loader = detectCurseForgeLoader(loaderEntry?.id ?? 'forge')
  return {
    provider: 'curseforge',
    projectId,
    versionId: String(file.id),
    name: project.name || manifest.name,
    summary: project.summary,
    gameVersion: manifest.minecraft.version,
    loader: loader.type,
    loaderVersion: loader.version,
    iconUrl: project.logo?.thumbnailUrl ?? project.logo?.url,
    archive,
    curseManifest: manifest
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
  instance.addons = [...instance.addons, ...enriched]

  onProgress?.('Extracting overrides', 92)
  await extractOverrides(meta.archive, instance.gameDir, ['overrides', 'client-overrides'])
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

async function installCurseForgeFiles(
  instance: Instance,
  meta: PreparedModpack,
  onProgress?: (message: string, percent?: number) => void
): Promise<void> {
  const manifest = meta.curseManifest!
  const required = manifest.files.filter((file) => file.required)
  let completed = 0
  const added = await mapLimit(required, 4, async (entry): Promise<AddonRecord | null> => {
    try {
      const file = await getCurseForgeFile(entry.projectID, entry.fileID)
      const mod = await getCurseForgeMod(entry.projectID)
      const sha1 = curseForgeSha1(file)
      const filename = path.basename(file.fileName)
      const target = path.join(instance.gameDir, 'mods', filename)
      const cache = sha1 ? addonCacheEntry(sha1, filename) : path.join(paths.downloadsCache, filename)
      await downloadFile(curseForgeDownloadUrl(file), cache, { sha1, size: file.fileLength, retries: 4 })
      await ensureDir(path.dirname(target))
      await fs.copyFile(cache, target)
      completed += 1
      onProgress?.(`Installing CurseForge files (${completed}/${required.length})`, 40 + Math.round((completed / Math.max(1, required.length)) * 45))
      return {
        id: `addon_curseforge_${mod.id}`,
        provider: 'curseforge',
        projectId: String(mod.id),
        versionId: String(file.id),
        name: mod.name,
        slug: mod.slug,
        type: 'mod',
        filename,
        versionNumber: file.displayName,
        sha1,
        size: file.fileLength,
        iconUrl: mod.logo?.thumbnailUrl,
        description: mod.summary,
        sourceUrl: mod.links?.websiteUrl,
        dependencies: [],
        enabled: true,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    } catch (error) {
      logger.warn('modpacks', `Could not install CurseForge file ${entry.fileID}`, error)
      return null
    }
  })
  instance.addons = [...instance.addons, ...added.filter((record): record is AddonRecord => Boolean(record))]
  onProgress?.('Extracting overrides', 88)
  await extractOverrides(meta.archive, instance.gameDir, [manifest.overrides || 'overrides'])
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

function detectCurseForgeLoader(id: string): { type: Instance['loader']; version: string } {
  if (id.startsWith('forge-')) return { type: 'forge', version: id.slice(6) }
  if (id.startsWith('fabric-')) return { type: 'fabric', version: id.slice(7) }
  if (id.startsWith('quilt-')) return { type: 'quilt', version: id.slice(6) }
  if (id.startsWith('neoforge-')) return { type: 'neoforge', version: id.slice(9) }
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
