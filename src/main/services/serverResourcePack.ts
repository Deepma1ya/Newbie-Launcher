import path from 'node:path'
import { createHash } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import type {
  ModrinthVersion,
  SearchPage,
  ServerRecord,
  ServerResourcePackFile,
  ServerResourcePackImport,
  ServerResourcePackInput,
  ServerResourcePackSearchQuery,
  ServerResourcePackSource,
  ServerResourcePackState
} from '@shared/types'
import {
  getModrinthProject,
  getModrinthVersions,
  pickPrimaryFile,
  searchModrinth
} from './modrinth'
import { cacheFileFromUrl } from './installer'
import { getServer, saveServer } from './serverStore'
import { readProperties, writeProperties } from './serverProperties'
import { paths } from './paths'
import { ensureDir, pathExists, safeJoin, sanitizeFilename } from '../util/fs'
import { logger } from '../util/log'

const MAX_RESOURCE_PACK_BYTES = 512 * 1024 * 1024

export async function getServerResourcePack(serverId: string): Promise<ServerResourcePackState> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const dir = paths.server(server.id)
  const properties = await readProperties(dir)
  const url = properties.get('resource-pack')?.trim() ?? ''
  const sha1 = properties.get('resource-pack-sha1')?.trim() ?? ''
  const required = (properties.get('require-resource-pack') ?? '').toLowerCase() === 'true'
  const prompt = properties.get('resource-pack-prompt') ?? ''
  const files = await listResourcePackFiles(dir)
  const info = server.resourcePack
  const activeFilename =
    info && info.url === url && info.filename ? info.filename : filenameFromUrl(url) || undefined
  return {
    serverId: server.id,
    url,
    sha1,
    required,
    prompt,
    files,
    activeFilename,
    info: info && info.url === url ? info : undefined
  }
}

export async function searchServerResourcePacks(
  query: ServerResourcePackSearchQuery
): Promise<SearchPage> {
  const server = await getServer(query.serverId)
  if (!server) throw new Error('Server not found')
  return searchModrinth({
    type: 'resourcepack',
    query: query.query ?? '',
    gameVersion: server.versionId,
    sort: query.sort ?? 'relevance',
    offset: query.offset ?? 0,
    limit: query.limit ?? 20
  })
}

export async function installServerResourcePack(
  serverId: string,
  projectId: string,
  versionId?: string
): Promise<ServerResourcePackState> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const project = await getModrinthProject(projectId)
  if (project.project_type !== 'resourcepack') {
    throw new Error(`${project.title} is not a resource pack`)
  }

  let versions = await getModrinthVersions(projectId, server.versionId)
  if (versions.length === 0) versions = await getModrinthVersions(projectId)
  const version = versionId
    ? versions.find((entry) => entry.id === versionId) ?? null
    : pickServerResourcePackVersion(versions, server.versionId)
  if (!version) throw new Error(`${project.title} has no downloadable resource pack build`)
  const file = pickPrimaryFile(version)
  if (!file) throw new Error(`${project.title} has no downloadable file`)
  const filename = sanitizeFilename(file.filename)
  if (!/\.zip$/i.test(filename)) {
    throw new Error(`${project.title} did not provide a .zip resource pack`)
  }

  const dir = paths.server(server.id)
  const target = safeJoin(path.join(dir, 'resourcepacks'), filename)
  await ensureDir(path.dirname(target))
  const cached = await cacheFileFromUrl(file.url, file.hashes.sha1, filename)
  await fs.copyFile(cached, target)
  const sha1 = (file.hashes.sha1 ?? (await sha1File(target))).toLowerCase()
  const properties = await readProperties(dir)
  const required = (properties.get('require-resource-pack') ?? '').toLowerCase() === 'true'
  const prompt = properties.get('resource-pack-prompt') ?? ''

  await replaceManagedFile(server, filename)
  const state = await writeResourcePackState(server, {
    url: file.url,
    sha1,
    required,
    prompt,
    name: project.title,
    filename,
    size: file.size,
    source: 'modrinth',
    projectId: project.id,
    versionId: version.id
  })
  logger.info('server', `Installed resource pack ${project.title} on ${server.name}`)
  return state
}

export async function importServerResourcePack(
  serverId: string,
  filePath: string
): Promise<ServerResourcePackImport> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const source = path.resolve(filePath)
  const stat = await fs.stat(source).catch(() => null)
  if (!stat?.isFile()) throw new Error('Choose a resource pack .zip file')
  if (!/\.zip$/i.test(source)) throw new Error('Resource packs must be .zip files')
  if (stat.size === 0) throw new Error('That resource pack file is empty')
  if (stat.size > MAX_RESOURCE_PACK_BYTES) {
    throw new Error('That resource pack is larger than 512 MB')
  }

  const filename = sanitizeFilename(path.basename(source))
  const target = safeJoin(path.join(paths.server(server.id), 'resourcepacks'), filename)
  await ensureDir(path.dirname(target))
  if (path.resolve(source) === path.resolve(target)) {
    return { filename, size: stat.size, sha1: await sha1File(target) }
  }
  await fs.copyFile(source, target)
  return { filename, size: stat.size, sha1: await sha1File(target) }
}

export async function saveServerResourcePack(
  serverId: string,
  input: ServerResourcePackInput
): Promise<ServerResourcePackState> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const url = validateUrl(input.url)
  const sha1 = normalizeSha1(input.sha1)
  const required = Boolean(input.required)
  const prompt = (input.prompt ?? '').trim().slice(0, 256)
  const filename = input.filename ? sanitizeFilename(path.basename(input.filename)) : ''
  if (filename && !/\.zip$/i.test(filename)) {
    throw new Error('Resource pack files must be .zip files')
  }
  if (filename && !(await pathExists(safeJoin(path.join(paths.server(server.id), 'resourcepacks'), filename)))) {
    throw new Error('That resource pack file is no longer in the server folder')
  }
  const source: ServerResourcePackSource =
    input.source === 'modrinth' || input.source === 'file' ? input.source : 'url'

  await replaceManagedFile(server, filename)
  return writeResourcePackState(server, {
    url,
    sha1,
    required,
    prompt,
    name: (input.name ?? filename ?? filenameFromUrl(url) ?? 'Server resource pack').slice(0, 120),
    filename,
    size: input.size,
    source,
    projectId: input.projectId,
    versionId: input.versionId
  })
}

export async function removeServerResourcePack(
  serverId: string,
  deleteFile = true
): Promise<ServerResourcePackState> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const dir = paths.server(server.id)
  const properties = await readProperties(dir)
  for (const key of [
    'resource-pack',
    'resource-pack-sha1',
    'require-resource-pack',
    'resource-pack-prompt'
  ]) {
    properties.delete(key)
  }
  await writeProperties(dir, properties)

  const filename = server.resourcePack?.filename
  if (deleteFile && filename) {
    await fs
      .rm(safeJoin(path.join(dir, 'resourcepacks'), filename), { force: true })
      .catch(() => undefined)
  }
  delete server.resourcePack
  await saveServer(server)
  logger.info('server', `Removed the resource pack from ${server.name}`)
  return getServerResourcePack(server.id)
}

async function writeResourcePackState(
  server: ServerRecord,
  input: {
    url: string
    sha1: string
    required: boolean
    prompt: string
    name: string
    filename?: string
    size?: number
    source: ServerResourcePackSource
    projectId?: string
    versionId?: string
  }
): Promise<ServerResourcePackState> {
  const dir = paths.server(server.id)
  const properties = await readProperties(dir)
  properties.set('resource-pack', input.url)
  if (input.sha1) properties.set('resource-pack-sha1', input.sha1)
  else properties.delete('resource-pack-sha1')
  properties.set('require-resource-pack', String(input.required))
  if (input.prompt.trim()) properties.set('resource-pack-prompt', input.prompt.trim())
  else properties.delete('resource-pack-prompt')
  await writeProperties(dir, properties)
  server.resourcePack = {
    name: input.name,
    filename: input.filename ?? '',
    url: input.url,
    sha1: input.sha1 || undefined,
    size: input.size,
    source: input.source,
    projectId: input.projectId,
    versionId: input.versionId,
    installedAt: new Date().toISOString()
  }
  await saveServer(server)
  return getServerResourcePack(server.id)
}

async function replaceManagedFile(server: ServerRecord, nextFilename: string): Promise<void> {
  const previous = server.resourcePack?.filename
  if (!previous || previous === nextFilename) return
  await fs
    .rm(safeJoin(path.join(paths.server(server.id), 'resourcepacks'), previous), { force: true })
    .catch(() => undefined)
}

async function listResourcePackFiles(serverDir: string): Promise<ServerResourcePackFile[]> {
  const dir = path.join(serverDir, 'resourcepacks')
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: ServerResourcePackFile[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !/\.zip$/i.test(entry.name)) continue
    const stat = await fs.stat(path.join(dir, entry.name)).catch(() => null)
    if (stat?.isFile()) files.push({ filename: entry.name, size: stat.size })
  }
  return files.sort((a, b) => a.filename.localeCompare(b.filename))
}

function pickServerResourcePackVersion(
  versions: ModrinthVersion[],
  gameVersion: string
): ModrinthVersion | null {
  const compatible = versions.filter((version) => version.game_versions.includes(gameVersion))
  const pool = compatible.length > 0 ? compatible : versions
  const rank = (version: ModrinthVersion): number =>
    version.version_type === 'release' ? 0 : version.version_type === 'beta' ? 1 : 2
  return (
    [...pool].sort((a, b) => {
      const byType = rank(a) - rank(b)
      if (byType !== 0) return byType
      return Date.parse(b.date_published) - Date.parse(a.date_published)
    })[0] ?? null
  )
}

function validateUrl(raw: string): string {
  const value = raw.trim()
  if (!value) throw new Error('Enter a public download URL for the resource pack')
  if (value.length > 2048) throw new Error('That resource pack URL is too long')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Enter a valid resource pack URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Resource pack URLs must start with http:// or https://')
  }
  return url.toString()
}

function normalizeSha1(raw?: string): string {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return ''
  if (!/^[a-f0-9]{40}$/.test(value)) throw new Error('SHA-1 must be 40 hexadecimal characters')
  return value
}

function filenameFromUrl(raw: string): string {
  if (!raw) return ''
  try {
    return sanitizeFilename(decodeURIComponent(new URL(raw).pathname.split('/').pop() ?? ''))
  } catch {
    return ''
  }
}

function sha1File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1')
    const stream = createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
