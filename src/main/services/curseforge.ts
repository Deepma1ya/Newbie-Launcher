import { CURSEFORGE_API } from '@shared/constants'
import type { CurseForgeFile, CurseForgeMod, LoaderType, SearchPage, SearchQuery } from '@shared/types'
import { fetchJson } from './http'
import { store } from './store'
import { curseForgeClassId, curseForgeModLoaderType } from './addonTypes'

interface CurseForgeList<T> {
  data: T[]
  pagination?: { index: number; pageSize: number; resultCount: number; totalCount: number }
}

function requireKey(): string {
  const key = store.curseforgeApiKey()
  if (!key) throw new Error('Add a CurseForge API key in Settings → Downloads to browse CurseForge.')
  return key
}

function headers(key: string): Record<string, string> {
  return { 'x-api-key': key, Accept: 'application/json' }
}

export async function testCurseForgeKey(key: string): Promise<boolean> {
  if (!key.trim()) return false
  try {
    const response = await fetch(`${CURSEFORGE_API}/games/432`, {
      headers: { 'x-api-key': key.trim(), Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000)
    })
    return response.ok
  } catch {
    return false
  }
}

export async function searchCurseForge(query: SearchQuery): Promise<SearchPage> {
  const key = requireKey()
  const params = new URLSearchParams({
    gameId: '432',
    classId: String(curseForgeClassId(query.type)),
    searchFilter: query.query ?? '',
    sortField: query.sort === 'downloads' ? '6' : query.sort === 'newest' ? '11' : query.sort === 'updated' ? '3' : '2',
    sortOrder: 'desc',
    index: String(query.offset ?? 0),
    pageSize: String(Math.min(50, query.limit ?? 24))
  })
  if (query.gameVersion) params.set('gameVersion', query.gameVersion)
  const loader = query.loader ? curseForgeModLoaderType(query.loader) : undefined
  if (loader) params.set('modLoaderType', String(loader))
  const response = await fetchJson<CurseForgeList<CurseForgeMod>>(
    `${CURSEFORGE_API}/mods/search?${params.toString()}`,
    { headers: headers(key) },
    { timeoutMs: 30_000 }
  )
  return {
    provider: 'curseforge',
    hits: response.data,
    total: response.pagination?.totalCount ?? response.data.length,
    offset: response.pagination?.index ?? 0,
    limit: response.pagination?.pageSize ?? 24
  }
}

export async function getCurseForgeMod(id: string | number): Promise<CurseForgeMod> {
  const key = requireKey()
  const response = await fetchJson<{ data: CurseForgeMod }>(
    `${CURSEFORGE_API}/mods/${id}`,
    { headers: headers(key) },
    { timeoutMs: 30_000 }
  )
  return response.data
}

export async function getCurseForgeFile(modId: string | number, fileId: string | number): Promise<CurseForgeFile> {
  const key = requireKey()
  const response = await fetchJson<{ data: CurseForgeFile }>(
    `${CURSEFORGE_API}/mods/${modId}/files/${fileId}`,
    { headers: headers(key) },
    { timeoutMs: 30_000 }
  )
  return response.data
}

export async function getCurseForgeFiles(
  modId: string | number,
  gameVersion?: string,
  loader?: LoaderType
): Promise<CurseForgeFile[]> {
  const key = requireKey()
  const params = new URLSearchParams({ pageSize: '50', index: '0' })
  if (gameVersion) params.set('gameVersion', gameVersion)
  const loaderType = loader ? curseForgeModLoaderType(loader) : undefined
  if (loaderType) params.set('modLoaderType', String(loaderType))
  const response = await fetchJson<CurseForgeList<CurseForgeFile>>(
    `${CURSEFORGE_API}/mods/${modId}/files?${params.toString()}`,
    { headers: headers(key) },
    { timeoutMs: 30_000 }
  )
  return response.data
}

export function pickCurseForgeFile(files: CurseForgeFile[]): CurseForgeFile | null {
  if (files.length === 0) return null
  const sorted = [...files].sort((a, b) => {
    const releaseDiff = a.releaseType - b.releaseType
    if (releaseDiff !== 0) return releaseDiff
    return Date.parse(b.fileDate) - Date.parse(a.fileDate)
  })
  return sorted[0] ?? null
}

export function curseForgeDownloadUrl(file: CurseForgeFile): string {
  if (file.downloadUrl) return file.downloadUrl
  if (file.id && file.fileName) {
    return `https://edge.forgecdn.net/files/${String(Math.floor(file.id / 1000))}/${String(file.id % 1000).padStart(3, '0')}/${encodeURIComponent(file.fileName)}`
  }
  throw new Error('This CurseForge file does not expose a download URL')
}

export function curseForgeSha1(file: CurseForgeFile): string | undefined {
  return file.hashes?.find((hash) => hash.algo === 1)?.value
}
