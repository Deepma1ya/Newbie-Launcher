import path from 'node:path'
import { promises as fs } from 'node:fs'
import AdmZip from 'adm-zip'
import type {
  JavaMapDetail,
  JavaMapFile,
  JavaMapInstallResult,
  JavaMapProject,
  JavaMapSearchInput,
  JavaMapSearchPage
} from '@shared/types'
import { USER_AGENT } from '@shared/constants'
import { store } from './store'
import { paths } from './paths'
import { downloadFile, fetchJson } from './http'
import { isInstanceBusy } from './launch'
import { ensureDir, pathExists, safeJoin, sanitizeFilename, uniqueId } from '../util/fs'
import { logger } from '../util/log'

const CURSE_API = 'https://api.curse.tools/v1/cf'
const GAME_ID = 432
const CLASS_WORLDS = 17
const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024
const CACHE_TTL_MS = 5 * 60_000

interface CurseAuthor {
  name?: string
}

interface CurseImage {
  url?: string
  thumbnailUrl?: string
}

interface CurseCategory {
  name?: string
}

interface CurseLinks {
  websiteUrl?: string
}

interface CurseProject {
  id?: number
  name?: string
  slug?: string
  summary?: string
  downloadCount?: number
  dateModified?: string
  logo?: CurseImage
  screenshots?: CurseImage[]
  authors?: CurseAuthor[]
  categories?: CurseCategory[]
  links?: CurseLinks
}

interface CurseSearchResponse {
  data?: CurseProject[]
  pagination?: { totalCount?: number; index?: number; pageSize?: number }
}

interface CurseFile {
  id?: number
  displayName?: string
  fileName?: string
  downloadUrl?: string | null
  fileLength?: number
  gameVersions?: string[]
  releaseType?: number
  fileDate?: string
}

interface CurseFilesResponse {
  data?: CurseFile[]
}

const searchCache = new Map<string, { at: number; value: JavaMapSearchPage }>()
const detailCache = new Map<number, { at: number; value: JavaMapDetail }>()

export async function searchJavaMaps(input: JavaMapSearchInput): Promise<JavaMapSearchPage> {
  const query = input.query.trim()
  const limit = Math.min(50, Math.max(1, Math.round(input.limit ?? 20)))
  const offset = Math.max(0, Math.round(input.offset ?? 0))
  const sort =
    input.sort === 'updated' ? 3 : input.sort === 'downloads' ? 6 : 2
  const key = `${query.toLowerCase()}:${sort}:${offset}:${limit}`
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

  const params = new URLSearchParams({
    gameId: String(GAME_ID),
    classId: String(CLASS_WORLDS),
    index: String(offset),
    pageSize: String(limit),
    sortField: String(sort),
    sortOrder: 'desc'
  })
  if (query) params.set('searchFilter', query)
  const response = await fetchJson<CurseSearchResponse>(
    `${CURSE_API}/mods/search?${params.toString()}`,
    { headers: { 'User-Agent': USER_AGENT } },
    { timeoutMs: 25_000, retries: 1 }
  )
  const items = (response.data ?? [])
    .map(normalizeProject)
    .filter((project): project is JavaMapProject => Boolean(project))
  const value: JavaMapSearchPage = {
    items,
    total: response.pagination?.totalCount ?? items.length,
    offset: response.pagination?.index ?? offset,
    limit: response.pagination?.pageSize ?? limit
  }
  searchCache.set(key, { at: Date.now(), value })
  if (searchCache.size > 80) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) searchCache.delete(oldest[0])
  }
  return value
}

export async function getJavaMapDetail(id: number): Promise<JavaMapDetail> {
  const cached = detailCache.get(id)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
  const headers = { 'User-Agent': USER_AGENT }
  const [projectResponse, filesResponse, descriptionResponse] = await Promise.all([
    fetchJson<{ data?: CurseProject }>(`${CURSE_API}/mods/${id}`, { headers }, { timeoutMs: 25_000, retries: 1 }),
    fetchJson<CurseFilesResponse>(
      `${CURSE_API}/mods/${id}/files?pageSize=50&index=0`,
      { headers },
      { timeoutMs: 25_000, retries: 1 }
    ),
    fetchJson<{ data?: string }>(
      `${CURSE_API}/mods/${id}/description`,
      { headers },
      { timeoutMs: 25_000, retries: 1 }
    ).catch(() => ({ data: '' }))
  ])
  const project = normalizeProject(projectResponse.data)
  if (!project) throw new Error('CurseForge did not return this map')
  const files = (filesResponse.data ?? [])
    .map(normalizeFile)
    .filter((file): file is JavaMapFile => Boolean(file))
  const screenshots = (projectResponse.data?.screenshots ?? [])
    .map((image) => image.url)
    .filter((url): url is string => Boolean(url))
    .slice(0, 8)
  const value: JavaMapDetail = {
    ...project,
    description: stripHtml(descriptionResponse.data ?? '').slice(0, 6000),
    screenshots,
    files
  }
  detailCache.set(id, { at: Date.now(), value })
  if (detailCache.size > 80) {
    const oldest = [...detailCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) detailCache.delete(oldest[0])
  }
  return value
}

export async function installJavaMap(
  instanceId: string,
  mapId: number,
  fileId?: number
): Promise<JavaMapInstallResult> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  if (isInstanceBusy(instanceId)) {
    throw new Error('Close Minecraft before installing a map.')
  }
  const detail = await getJavaMapDetail(mapId)
  const file =
    fileId !== undefined
      ? detail.files.find((entry) => entry.id === fileId)
      : detail.files.find((entry) => entry.releaseType === 1) ?? detail.files[0]
  if (!file) throw new Error('This map has no downloadable .zip file')
  const url = file.url ?? (await resolveDownloadUrl(mapId, file.id))
  if (!url || !url.startsWith('https://')) {
    throw new Error('The map author has not allowed third-party downloads.')
  }
  if (file.size > MAX_DOWNLOAD_BYTES) throw new Error('This map is larger than 1 GB')

  const temp = path.join(paths.downloadsCache, `java-map-${uniqueId('download')}.zip`)
  await ensureDir(path.dirname(temp))
  try {
    await downloadFile(url, temp, {
      size: file.size > 0 ? file.size : undefined,
      retries: 2,
      headers: { 'User-Agent': USER_AGENT }
    })
    const result = await extractJavaMapArchive(instance.gameDir, temp, detail.title)
    logger.info('maps', `Installed ${detail.title} into ${instance.name} as ${result.folder}`)
    return result
  } finally {
    await fs.rm(temp, { force: true }).catch(() => undefined)
  }
}

async function resolveDownloadUrl(mapId: number, fileId: number): Promise<string> {
  const response = await fetchJson<{ data?: string }>(
    `${CURSE_API}/mods/${mapId}/files/${fileId}/download-url`,
    { headers: { 'User-Agent': USER_AGENT } },
    { timeoutMs: 20_000, retries: 1 }
  )
  return typeof response.data === 'string' ? response.data : ''
}

export async function extractJavaMapArchive(
  gameDir: string,
  archive: string,
  title: string
): Promise<JavaMapInstallResult> {
  const zip = new AdmZip(archive)
  const entries = zip.getEntries()
  if (entries.length === 0) throw new Error('This map archive is empty')
  if (entries.length > 50_000) throw new Error('This map archive contains too many files')
  let uncompressed = 0
  for (const entry of entries) {
    const name = normalizeEntryName(entry.entryName)
    if (!isSafeEntry(name)) throw new Error(`Unsafe path in map archive: ${entry.entryName}`)
    const size = Number(entry.header.size ?? 0)
    if (Number.isFinite(size) && size > 0) uncompressed += size
  }
  if (uncompressed > 4 * 1024 * 1024 * 1024) {
    throw new Error('This map is larger than 4 GB when unpacked')
  }

  const levelEntries = entries.filter(
    (entry) => !entry.isDirectory && /(^|\/)level\.dat$/i.test(normalizeEntryName(entry.entryName))
  )
  if (levelEntries.length === 0) {
    throw new Error('This archive does not contain a Java world (level.dat).')
  }
  levelEntries.sort((a, b) => normalizeEntryName(a.entryName).length - normalizeEntryName(b.entryName).length)
  const levelName = normalizeEntryName(levelEntries[0]!.entryName)
  const prefix = path.posix.dirname(levelName)
  const prefixWithSlash = prefix === '.' ? '' : `${prefix.replace(/\/$/, '')}/`

  const levelNameEntry = zip.getEntry(`${prefixWithSlash}levelname.txt`)
  const worldNameFromLevel = levelNameEntry
    ? levelNameEntry.getData().toString('utf8').trim()
    : ''
  const desired = sanitizeFilename(worldNameFromLevel || title || 'Map') || 'Map'
  const saves = path.join(gameDir, 'saves')
  await ensureDir(saves)
  const folder = await uniqueFolder(saves, desired)
  const target = path.join(saves, folder)
  await ensureDir(target)

  let files = 0
  for (const entry of entries) {
    if (entry.isDirectory) continue
    const name = normalizeEntryName(entry.entryName)
    if (name.startsWith('__MACOSX/')) continue
    if (!name.startsWith(prefixWithSlash)) continue
    const relative = name.slice(prefixWithSlash.length)
    if (!relative) continue
    const destination = safeJoin(target, relative)
    await ensureDir(path.dirname(destination))
    await fs.writeFile(destination, entry.getData())
    files += 1
  }
  if (!(await pathExists(path.join(target, 'level.dat')))) {
    throw new Error('The map archive could not be unpacked into a world folder.')
  }
  return { folder, name: worldNameFromLevel || title, path: target, files }
}

async function uniqueFolder(root: string, desired: string): Promise<string> {
  let candidate = desired
  let index = 2
  while (await pathExists(path.join(root, candidate))) {
    candidate = `${desired} (${index})`
    index += 1
  }
  return candidate
}

function normalizeProject(raw?: CurseProject): JavaMapProject | null {
  if (!raw?.id || !raw.name || !raw.slug) return null
  const image = raw.screenshots?.find((entry) => entry.url)?.url ?? raw.logo?.url
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.name,
    summary: stripHtml(raw.summary ?? ''),
    imageUrl: image,
    iconUrl: raw.logo?.thumbnailUrl ?? raw.logo?.url,
    author: raw.authors?.find((author) => author.name)?.name,
    downloads: Number(raw.downloadCount ?? 0) || 0,
    categories: (raw.categories ?? [])
      .map((category) => category.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 4),
    updatedAt: raw.dateModified,
    url: raw.links?.websiteUrl ?? `https://www.curseforge.com/minecraft/worlds/${raw.slug}`
  }
}

function normalizeFile(raw: CurseFile): JavaMapFile | null {
  if (!raw.id || !raw.fileName || !/\.zip$/i.test(raw.fileName)) return null
  return {
    id: raw.id,
    label: raw.displayName ?? raw.fileName,
    filename: raw.fileName,
    url: raw.downloadUrl ?? undefined,
    size: Number(raw.fileLength ?? 0) || 0,
    gameVersions: Array.isArray(raw.gameVersions) ? raw.gameVersions.slice(0, 12) : [],
    releaseType: Number(raw.releaseType ?? 1),
    publishedAt: raw.fileDate
  }
}

function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\/+/, '')
}

function isSafeEntry(name: string): boolean {
  if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name)) return false
  return !name.split('/').some((part) => part === '..')
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
