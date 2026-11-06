import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  BedrockContentItem,
  BedrockMarketDetail,
  BedrockMarketDownload,
  BedrockMarketInstallResult,
  BedrockMarketProject,
  BedrockMarketSearchInput,
  BedrockMarketSearchPage
} from '@shared/types'
import { USER_AGENT } from '@shared/constants'
import { store } from './store'
import { paths } from './paths'
import { downloadFile, fetchJson } from './http'
import { isBedrockGameRunning, isBedrockSessionActive } from './bedrock'
import {
  countBedrockContent,
  installBedrockArchive,
  removeBedrockContent,
  scanBedrockContent
} from './bedrockContent'
import { ensureDir, uniqueId } from '../util/fs'
import { logger } from '../util/log'

const API_BASE = 'https://api.mcpedl.com/api'
const CACHE_TTL_MS = 5 * 60_000
const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024

const TYPE_LABELS: Record<number, string> = {
  1: 'Add-on',
  2: 'World',
  3: 'Texture pack',
  6: 'Skin pack'
}

interface RawProject {
  slug?: string
  title?: string
  summary?: string
  short_description?: string
  image?: string
  display_name?: string
  downloadCount?: number
  download_count?: number
  average_rating?: number | string
  type_id?: number
  updated_at?: string
  cf_tags?: { name?: string }[]
}

interface RawSearchResponse {
  results?: RawProject[]
  meta?: { total?: number; page?: number; page_count?: number }
}

interface RawDownload {
  file?: string
  display_name?: string
  name?: string
  id?: number
  fileDate?: string
}

interface RawDetail extends RawProject {
  description?: string
  short_description?: string
  downloads?: RawDownload[]
  downloads_vip?: RawDownload[]
}

const searchCache = new Map<string, { at: number; value: BedrockMarketSearchPage }>()
const detailCache = new Map<string, { at: number; value: BedrockMarketDetail }>()

export async function searchBedrockMarket(
  input: BedrockMarketSearchInput
): Promise<BedrockMarketSearchPage> {
  const query = (input.query ?? '').trim()
  const page = Math.max(1, Math.round(input.page ?? 1))
  const sort = input.sort === 'popularity_all' ? 'popularity_all' : 'popularity_week'
  const key = `${input.typeId}:${sort}:${page}:${query.toLowerCase()}`
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

  const params = new URLSearchParams({
    sort,
    updated_at: '2y',
    type_id: String(input.typeId),
    page: String(page)
  })
  if (query) params.set('q', query)
  const url = `${API_BASE}/search/advanced?${params.toString()}`
  const raw = await fetchJson<RawSearchResponse>(
    url,
    { headers: { 'User-Agent': USER_AGENT } },
    { timeoutMs: 25_000, retries: 1 }
  )
  const items = (Array.isArray(raw.results) ? raw.results : [])
    .map((project) => normalizeProject(project, input.typeId))
    .filter((project): project is BedrockMarketProject => Boolean(project))
  const value: BedrockMarketSearchPage = {
    items,
    page: raw.meta?.page ?? page,
    pageCount: Math.max(1, raw.meta?.page_count ?? 1),
    total: raw.meta?.total ?? items.length
  }
  searchCache.set(key, { at: Date.now(), value })
  if (searchCache.size > 80) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) searchCache.delete(oldest[0])
  }
  return value
}

export async function getBedrockMarketDetail(slug: string): Promise<BedrockMarketDetail> {
  const clean = slug.trim()
  if (!clean) throw new Error('Missing MCPEDL project slug')
  const cached = detailCache.get(clean)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

  const response = await fetchJson<{ data?: RawDetail }>(
    `${API_BASE}/route/slug/${encodeURIComponent(clean)}`,
    { headers: { 'User-Agent': USER_AGENT } },
    { timeoutMs: 25_000, retries: 1 }
  )
  const raw = response.data
  if (!raw) throw new Error('MCPEDL did not return this project')
  const base = normalizeProject(raw, raw.type_id ?? 1)
  if (!base) throw new Error('MCPEDL returned an invalid project')
  const versions = normalizeDownloads(raw.downloads)
  const value: BedrockMarketDetail = {
    ...base,
    description: stripHtml(raw.description ?? raw.short_description ?? '').slice(0, 6000),
    versions
  }
  detailCache.set(clean, { at: Date.now(), value })
  if (detailCache.size > 80) {
    const oldest = [...detailCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) detailCache.delete(oldest[0])
  }
  return value
}

export async function installBedrockMarketProject(
  instanceId: string,
  slug: string,
  downloadId?: number
): Promise<BedrockMarketInstallResult> {
  const instance = store.bedrockInstance(instanceId)
  if (!instance) throw new Error('Bedrock instance not found')
  if (isBedrockSessionActive() || (await isBedrockGameRunning())) {
    throw new Error('Close Minecraft before installing Bedrock add-ons.')
  }
  const detail = await getBedrockMarketDetail(slug)
  const version =
    downloadId !== undefined
      ? detail.versions.find((entry) => entry.id === downloadId)
      : pickDownload(detail)
  if (!version) throw new Error('This project has no downloadable Bedrock file')
  if (!version.url.startsWith('https://')) throw new Error('Unsupported download URL')

  const head = await fetch(version.url, {
    method: 'HEAD',
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15_000)
  }).catch(() => null)
  const size = Number(head?.headers.get('content-length') ?? version.sizeBytes ?? 0)
  if (size > MAX_DOWNLOAD_BYTES) {
    throw new Error('This Bedrock download is larger than 1 GB')
  }

  const extension = path.extname(version.filename).toLowerCase() || '.mcaddon'
  const temp = path.join(paths.downloadsCache, `bedrock-${uniqueId('download')}${extension}`)
  await ensureDir(path.dirname(temp))
  try {
    await downloadFile(version.url, temp, {
      size: size > 0 ? size : undefined,
      retries: 2,
      headers: { 'User-Agent': USER_AGENT }
    })
    const result = await installBedrockArchive(
      instance.dataDir,
      temp,
      {
        provider: 'mcpedl',
        slug: detail.slug,
        title: detail.title,
        url: detail.url,
        imageUrl: detail.imageUrl
      },
      { filename: version.filename }
    )
    const content = await scanBedrockContent(instance.dataDir)
    const counts = await countBedrockContent(instance.dataDir)
    await store.updateBedrockInstance(instanceId, (current) => {
      current.contentCount = counts.contentCount
      current.worldCount = counts.worldCount
    })
    logger.info(
      'bedrock',
      `Installed ${detail.title} into Bedrock instance ${instance.name}: ${result.installed.length} item(s)`
    )
    return { installed: result.installed, content, ...counts }
  } finally {
    await fs.rm(temp, { force: true }).catch(() => undefined)
  }
}

export async function listBedrockInstanceContent(id: string): Promise<BedrockContentItem[]> {
  const instance = store.bedrockInstance(id)
  if (!instance) throw new Error('Bedrock instance not found')
  return scanBedrockContent(instance.dataDir)
}

export async function removeBedrockInstanceContent(
  instanceId: string,
  contentId: string
): Promise<BedrockMarketInstallResult> {
  const instance = store.bedrockInstance(instanceId)
  if (!instance) throw new Error('Bedrock instance not found')
  if (isBedrockSessionActive() || (await isBedrockGameRunning())) {
    throw new Error('Close Minecraft before removing Bedrock add-ons.')
  }
  await removeBedrockContent(instance.dataDir, contentId)
  const content = await scanBedrockContent(instance.dataDir)
  const counts = await countBedrockContent(instance.dataDir)
  await store.updateBedrockInstance(instanceId, (current) => {
    current.contentCount = counts.contentCount
    current.worldCount = counts.worldCount
  })
  return { installed: [], content, ...counts }
}

function normalizeProject(
  raw: RawProject,
  fallbackTypeId: number
): BedrockMarketProject | null {
  const slug = typeof raw.slug === 'string' ? raw.slug.trim() : ''
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!slug || !title) return null
  const typeId = Number(raw.type_id ?? fallbackTypeId)
  return {
    slug,
    title,
    summary: stripHtml(raw.summary ?? raw.short_description ?? ''),
    imageUrl: typeof raw.image === 'string' ? raw.image : undefined,
    author: typeof raw.display_name === 'string' ? raw.display_name : undefined,
    downloads: Number(raw.downloadCount ?? raw.download_count ?? 0) || 0,
    rating: parseRating(raw.average_rating),
    typeId,
    typeLabel: TYPE_LABELS[typeId] ?? 'Bedrock content',
    tags: Array.isArray(raw.cf_tags)
      ? raw.cf_tags.map((tag) => tag.name).filter((name): name is string => Boolean(name)).slice(0, 4)
      : [],
    updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
    url: `https://mcpedl.com/${slug}/`
  }
}

function normalizeDownloads(raw?: RawDownload[]): BedrockMarketDownload[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: BedrockMarketDownload[] = []
  for (const entry of raw) {
    const url = typeof entry.file === 'string' ? entry.file.replace(/\\\//g, '/').trim() : ''
    if (!url || !/^https:\/\//i.test(url) || seen.has(url)) continue
    seen.add(url)
    const filename = fileNameFromUrl(url)
    const label = (entry.display_name ?? entry.name ?? filename).replace(/\s+/g, ' ').trim()
    result.push({
      id: result.length,
      label,
      filename,
      url,
      sizeBytes: parseSize(label),
      publishedAt: entry.fileDate,
      kind: kindFromFilename(filename)
    })
  }
  return result
}

function pickDownload(detail: BedrockMarketDetail): BedrockMarketDownload | undefined {
  const versions = detail.versions
  if (detail.typeId === 2) {
    return (
      versions.find((entry) => entry.kind === 'world') ??
      versions.find((entry) => entry.kind === 'template') ??
      versions[0]
    )
  }
  if (detail.typeId === 3 || detail.typeId === 6) {
    return versions.find((entry) => /\.mcpack$/i.test(entry.filename)) ?? versions[0]
  }
  return (
    versions.find((entry) => /\.mcaddon$/i.test(entry.filename)) ??
    versions.find((entry) => /\.mcpack$/i.test(entry.filename)) ??
    versions[0]
  )
}

function kindFromFilename(filename: string): BedrockMarketDownload['kind'] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.mcaddon')) return 'addon'
  if (lower.endsWith('.mcworld')) return 'world'
  if (lower.endsWith('.mctemplate')) return 'template'
  if (lower.endsWith('.mcpack')) return 'unknown'
  return 'unknown'
}

function fileNameFromUrl(raw: string): string {
  try {
    const url = new URL(raw)
    const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
    return name || 'download'
  } catch {
    return 'download'
  }
}

function parseRating(value: number | string | undefined): number | undefined {
  const rating = Number(value)
  return Number.isFinite(rating) && rating > 0 ? Math.round(rating * 10) / 10 : undefined
}

function parseSize(label: string): number | undefined {
  const match = label.match(/\(([\d.]+)\s*(B|KB|MB|GB)\)/i)
  if (!match) return undefined
  const amount = Number(match[1])
  const unit = match[2]?.toUpperCase()
  const multiplier = unit === 'GB' ? 1024 ** 3 : unit === 'MB' ? 1024 ** 2 : unit === 'KB' ? 1024 : 1
  return Math.round(amount * multiplier)
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
