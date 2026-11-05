import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  ModrinthHit,
  ModrinthProject,
  ModrinthVersion,
  SearchPage,
  ServerAddonRecord,
  ServerAddonType,
  ServerRecord,
  ServerSearchQuery
} from '@shared/types'
import { MODRINTH_API } from '@shared/constants'
import {
  PAPER_PLUGIN_LOADERS,
  serverLoader,
  serverSupportsAddon
} from '@shared/serverTypes'
import {
  getModrinthProject,
  getModrinthVersion,
  getModrinthVersions,
  pickPrimaryFile
} from './modrinth'
import { cacheFileFromUrl } from './installer'
import { getServer, saveServer } from './serverStore'
import { isServerRunning } from './serverProcess'
import { levelName } from './serverProperties'
import { paths } from './paths'
import { fetchJson } from './http'
import { ensureDir, pathExists, safeJoin, sanitizeFilename } from '../util/fs'
import { sleep } from '../util/async'
import { logger } from '../util/log'

let lastRequest = 0

async function polite(): Promise<void> {
  const wait = 250 - (Date.now() - lastRequest)
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()
}

export async function searchServerAddons(query: ServerSearchQuery): Promise<SearchPage> {
  const server = await getServer(query.serverId)
  if (!server) throw new Error('Server not found')
  if (!serverSupportsAddon(server.type, query.type)) {
    throw new Error(`${query.type} add-ons are not supported by this server type`)
  }
  await polite()
  // Modrinth currently returns project_type "mod" for plugins and datapacks too, and the
  // project_type facet is not reliable for those. Loader categories filter correctly.
  const facets: string[][] = [[`versions:${server.versionId}`]]
  if (query.type === 'mod') {
    const loader = serverLoader(server.type)
    if (loader) facets.push([`categories:${loader}`])
  } else if (query.type === 'plugin') {
    facets.push(PAPER_PLUGIN_LOADERS.map((loader) => `categories:${loader}`))
  } else {
    facets.push(['categories:datapack'])
  }
  const limit = query.limit ?? 24
  const params = new URLSearchParams({
    query: query.query ?? '',
    facets: JSON.stringify(facets),
    index:
      query.sort === 'downloads'
        ? 'downloads'
        : query.sort === 'follows'
          ? 'follows'
          : query.sort === 'newest'
            ? 'newest'
            : query.sort === 'updated'
              ? 'updated'
              : 'relevance',
    limit: String(limit),
    offset: String(query.offset ?? 0)
  })
  const response = await fetchModrinth<{
    hits: ModrinthHit[]
    total_hits: number
    offset: number
    limit: number
  }>(`/search?${params.toString()}`)
  const hits = response.hits.filter(
    (hit) => hit.project_type !== 'modpack' && hit.project_type !== 'resourcepack' && hit.project_type !== 'shader'
  )
  return {
    provider: 'modrinth',
    hits: hits.slice(0, limit),
    total: response.total_hits,
    offset: response.offset,
    limit: response.limit
  }
}

export async function installServerAddon(
  serverId: string,
  ref: { projectId: string; versionId?: string; type?: ServerAddonType },
  onProgress?: (message: string, percent?: number) => void
): Promise<ServerAddonRecord[]> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  if (isServerRunning(serverId)) throw new Error('Stop the server before installing add-ons')
  const added = new Map<string, ServerAddonRecord>()
  await installRef(server, ref, added, new Set(), 0, onProgress)
  await saveServer(server)
  return [...added.values()]
}

async function installRef(
  server: ServerRecord,
  ref: { projectId: string; versionId?: string; type?: ServerAddonType },
  added: Map<string, ServerAddonRecord>,
  visited: Set<string>,
  depth: number,
  onProgress?: (message: string, percent?: number) => void
): Promise<void> {
  if (depth > 6) return
  const key = `${server.id}:${ref.projectId}:${ref.type ?? ''}`
  if (visited.has(key)) return
  visited.add(key)

  const project = await getModrinthProject(ref.projectId)
  const type = ref.type ?? inferAddonType(server, project)
  if (!type || !serverSupportsAddon(server.type, type)) {
    throw new Error(`${project.title} is not compatible with this ${server.type} server`)
  }
  const version = ref.versionId
    ? await getModrinthVersion(ref.versionId)
    : selectServerVersion(
        await getModrinthVersions(ref.projectId, server.versionId),
        server,
        type
      )
  if (!version) throw new Error(`${project.title} has no build for Minecraft ${server.versionId}`)
  const file = pickPrimaryFile(version)
  if (!file) throw new Error(`${project.title} has no downloadable file`)

  onProgress?.(`Downloading ${project.title}`, 30)
  const filename = sanitizeFilename(file.filename)
  const cached = await cacheFileFromUrl(file.url, file.hashes.sha1, filename)
  const relativePath = await addonFolder(server, type)
  const targetDir = path.dirname(
    safeJoin(serverDirPath(server), path.join(relativePath, filename))
  )
  await ensureDir(targetDir)
  await fs.copyFile(cached, safeJoin(serverDirPath(server), path.join(relativePath, filename)))

  const existing = server.addons.find((addon) => addon.projectId === project.id)
  if (existing && (existing.filename !== filename || existing.relativePath !== relativePath)) {
    await removeAddonFile(server, existing)
  }
  const now = new Date().toISOString()
  const record: ServerAddonRecord = {
    id: `server_addon_${project.id}`,
    provider: 'modrinth',
    projectId: project.id,
    versionId: version.id,
    name: project.title,
    filename,
    type,
    versionNumber: version.version_number,
    sha1: file.hashes.sha1,
    size: file.size,
    iconUrl: project.icon_url ?? undefined,
    description: project.description,
    sourceUrl: `https://modrinth.com/${
      type === 'plugin' ? 'plugin' : type === 'datapack' ? 'datapack' : 'mod'
    }/${project.slug}`,
    enabled: existing?.enabled ?? true,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    latestVersionId: version.id,
    latestVersionNumber: version.version_number,
    relativePath
  }
  server.addons = server.addons.filter((addon) => addon.projectId !== project.id)
  server.addons.push(record)
  added.set(record.id, record)
  onProgress?.(`Installed ${project.title}`, 60)

  for (const dependency of version.dependencies) {
    if (dependency.dependency_type !== 'required' || !dependency.project_id) continue
    if (server.addons.some((addon) => addon.projectId === dependency.project_id)) continue
    try {
      await installRef(
        server,
        {
          projectId: dependency.project_id,
          versionId: dependency.version_id ?? '',
          type
        },
        added,
        visited,
        depth + 1,
        onProgress
      )
    } catch (error) {
      logger.warn('server-addons', `Unable to install dependency ${dependency.project_id}`, error)
    }
  }
}

export async function removeServerAddon(
  serverId: string,
  addonId: string,
  deleteFile = true
): Promise<void> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  if (isServerRunning(serverId)) throw new Error('Stop the server before removing add-ons')
  const record = server.addons.find((addon) => addon.id === addonId)
  if (!record) return
  if (deleteFile) await removeAddonFile(server, record)
  server.addons = server.addons.filter((addon) => addon.id !== addonId)
  await saveServer(server)
}

export async function toggleServerAddon(
  serverId: string,
  addonId: string,
  enabled: boolean
): Promise<ServerAddonRecord> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  if (isServerRunning(serverId)) throw new Error('Stop the server before changing add-ons')
  const record = server.addons.find((addon) => addon.id === addonId)
  if (!record) throw new Error('Add-on not found')
  let active: string
  try {
    active = safeJoin(serverDirPath(server), path.join(record.relativePath, record.filename))
  } catch {
    throw new Error('This add-on has an invalid file path')
  }
  const disabled = `${active}.disabled`
  if (enabled) {
    if (await pathExists(disabled)) await fs.rename(disabled, active)
  } else if (await pathExists(active)) {
    await fs.rename(active, disabled)
  }
  record.enabled = enabled
  record.updatedAt = new Date().toISOString()
  await saveServer(server)
  return record
}

export async function checkServerAddonUpdates(serverId: string): Promise<ServerAddonRecord[]> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  for (const record of server.addons) {
    if (record.provider !== 'modrinth') continue
    try {
      const versions = await getModrinthVersions(record.projectId, server.versionId)
      const best = selectServerVersion(versions, server, record.type)
      if (best) {
        record.latestVersionId = best.id
        record.latestVersionNumber = best.version_number
      }
      record.updatedAt = new Date().toISOString()
    } catch (error) {
      logger.warn('server-addons', `Update check failed for ${record.name}`, error)
    }
  }
  await saveServer(server)
  return server.addons
}

export async function updateAllServerAddons(
  serverId: string,
  onProgress?: (message: string, percent?: number) => void
): Promise<ServerAddonRecord[]> {
  const checked = await checkServerAddonUpdates(serverId)
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  if (isServerRunning(serverId)) throw new Error('Stop the server before updating add-ons')
  const pending = checked.filter(
    (record) =>
      record.provider === 'modrinth' &&
      record.latestVersionId &&
      record.latestVersionId !== record.versionId
  )
  let index = 0
  for (const record of pending) {
    index += 1
    onProgress?.(`Updating ${record.name} (${index}/${pending.length})`, 20 + (index / pending.length) * 70)
    try {
      await installServerAddon(serverId, {
        projectId: record.projectId,
        versionId: record.latestVersionId,
        type: record.type
      })
    } catch (error) {
      logger.warn('server-addons', `Could not update ${record.name}`, error)
    }
  }
  return (await getServer(serverId))?.addons ?? []
}

export function inferAddonType(server: ServerRecord, project: ModrinthProject): ServerAddonType | null {
  const loaders = project.loaders ?? []
  if (
    serverSupportsAddon(server.type, 'plugin') &&
    loaders.some((loader) => (PAPER_PLUGIN_LOADERS as readonly string[]).includes(loader))
  ) {
    return 'plugin'
  }
  const modLoader = serverLoader(server.type)
  if (
    serverSupportsAddon(server.type, 'mod') &&
    modLoader &&
    loaders.includes(modLoader)
  ) {
    return 'mod'
  }
  if (serverSupportsAddon(server.type, 'datapack') && loaders.includes('datapack')) {
    return 'datapack'
  }
  return null
}

export function selectServerVersion(
  versions: ModrinthVersion[],
  server: ServerRecord,
  type: ServerAddonType
): ModrinthVersion | null {
  const loader = serverLoader(server.type)
  const compatible = versions.filter((version) => {
    if (!version.game_versions.includes(server.versionId)) return false
    if (type === 'datapack') return version.loaders.includes('datapack')
    if (type === 'plugin') {
      return version.loaders.some((entry) =>
        (PAPER_PLUGIN_LOADERS as readonly string[]).includes(entry)
      )
    }
    return loader ? version.loaders.includes(loader) : true
  })
  if (compatible.length === 0) return null
  const rank = (version: ModrinthVersion): number =>
    version.version_type === 'release' ? 0 : version.version_type === 'beta' ? 1 : 2
  compatible.sort((a, b) => {
    const release = rank(a) - rank(b)
    if (release !== 0) return release
    return Date.parse(b.date_published) - Date.parse(a.date_published)
  })
  return compatible[0] ?? null
}

async function addonFolder(server: ServerRecord, type: ServerAddonType): Promise<string> {
  if (type === 'mod') return 'mods'
  if (type === 'plugin') return 'plugins'
  const world = await levelName(serverDirPath(server))
  return `${world}/datapacks`
}

function serverDirPath(server: ServerRecord): string {
  return paths.server(server.id)
}

async function removeAddonFile(server: ServerRecord, record: ServerAddonRecord): Promise<void> {
  let target: string
  try {
    target = safeJoin(serverDirPath(server), path.join(record.relativePath, record.filename))
  } catch {
    return
  }
  await fs.rm(target, { force: true }).catch(() => undefined)
  await fs.rm(`${target}.disabled`, { force: true }).catch(() => undefined)
}

async function fetchModrinth<T>(pathName: string): Promise<T> {
  return fetchJson<T>(
    `${MODRINTH_API}${pathName}`,
    {},
    { timeoutMs: 30_000, retries: 3 }
  )
}
