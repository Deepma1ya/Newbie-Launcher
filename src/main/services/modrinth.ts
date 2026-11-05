import { MODRINTH_API } from '@shared/constants'
import type {
  AddonType,
  LoaderType,
  ModrinthHit,
  ModrinthProject,
  ModrinthSearchResponse,
  ModrinthVersion,
  SearchPage,
  SearchQuery
} from '@shared/types'
import { fetchJson } from './http'
import { loaderTypeToModrinth } from './addonTypes'

const modrinthUsage = {
  lastRequest: 0
}

async function polite(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, 120 - (now - modrinthUsage.lastRequest))
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  modrinthUsage.lastRequest = Date.now()
}

export async function searchModrinth(query: SearchQuery): Promise<SearchPage> {
  await polite()
  const facets: string[][] = [[`project_type:${query.type === 'shader' ? 'shader' : query.type}`]]
  if (query.gameVersion) facets.push([`versions:${query.gameVersion}`])
  if (query.loader && query.loader !== 'vanilla') facets.push([`categories:${loaderTypeToModrinth(query.loader)}`])
  for (const category of query.categories ?? []) {
    if (category) facets.push([`categories:${category}`])
  }
  const params = new URLSearchParams({
    query: query.query ?? '',
    facets: JSON.stringify(facets),
    index: query.sort === 'downloads' ? 'downloads' : query.sort === 'follows' ? 'follows' : query.sort === 'newest' ? 'newest' : query.sort === 'updated' ? 'updated' : 'relevance',
    limit: String(query.limit ?? 24),
    offset: String(query.offset ?? 0)
  })
  const response = await fetchJson<ModrinthSearchResponse>(`${MODRINTH_API}/search?${params.toString()}`, {}, { timeoutMs: 30_000 })
  return {
    provider: 'modrinth',
    hits: response.hits,
    total: response.total_hits,
    offset: response.offset,
    limit: response.limit
  }
}

export async function getModrinthProject(id: string): Promise<ModrinthProject> {
  await polite()
  return fetchJson<ModrinthProject>(`${MODRINTH_API}/project/${encodeURIComponent(id)}`, {}, { timeoutMs: 30_000 })
}

export async function getModrinthVersions(
  projectId: string,
  gameVersion?: string,
  loader?: LoaderType
): Promise<ModrinthVersion[]> {
  await polite()
  const params = new URLSearchParams()
  if (gameVersion) params.set('game_versions', JSON.stringify([gameVersion]))
  if (loader && loader !== 'vanilla') params.set('loaders', JSON.stringify([loaderTypeToModrinth(loader)]))
  return fetchJson<ModrinthVersion[]>(
    `${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version?${params.toString()}`,
    {},
    { timeoutMs: 30_000 }
  )
}

export async function getModrinthVersion(versionId: string): Promise<ModrinthVersion> {
  await polite()
  return fetchJson<ModrinthVersion>(`${MODRINTH_API}/version/${encodeURIComponent(versionId)}`, {}, { timeoutMs: 30_000 })
}

export async function getModrinthVersionsByHashes(hashes: string[]): Promise<Record<string, ModrinthVersion>> {
  if (hashes.length === 0) return {}
  await polite()
  const chunkSize = 100
  const result: Record<string, ModrinthVersion> = {}
  for (let index = 0; index < hashes.length; index += chunkSize) {
    const chunk = hashes.slice(index, index + chunkSize)
    try {
      const data = await fetchJson<Record<string, ModrinthVersion>>(
        `${MODRINTH_API}/version_files`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashes: chunk, algorithm: 'sha1' })
        },
        { timeoutMs: 30_000, retries: 2 }
      )
      Object.assign(result, data)
    } catch {
      // Scanning is best-effort; unknown jars remain local records.
    }
  }
  return result
}

export async function getModrinthUpdatesByHashes(hashes: string[], gameVersion: string, loader: LoaderType): Promise<Record<string, ModrinthVersion>> {
  if (hashes.length === 0) return {}
  await polite()
  try {
    return await fetchJson<Record<string, ModrinthVersion>>(
      `${MODRINTH_API}/version_files/update`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashes,
          algorithm: 'sha1',
          loaders: loader === 'vanilla' ? ['minecraft'] : [loaderTypeToModrinth(loader)],
          game_versions: [gameVersion]
        })
      },
      { timeoutMs: 30_000, retries: 2 }
    )
  } catch {
    return {}
  }
}

export function pickPrimaryFile(version: ModrinthVersion): ModrinthVersion['files'][number] | null {
  const primary = version.files.find((file) => file.primary)
  return primary ?? version.files[0] ?? null
}

export function selectBestVersion(
  versions: ModrinthVersion[],
  gameVersion: string,
  loader: LoaderType,
  type: AddonType
): ModrinthVersion | null {
  const compatible = versions.filter((version) => {
    if (!version.game_versions.includes(gameVersion)) return false
    if (type === 'mod' || type === 'modpack') {
      if (loader === 'vanilla') return true
      return version.loaders.includes(loaderTypeToModrinth(loader))
    }
    return true
  })
  if (compatible.length === 0) return null
  const rank = (version: ModrinthVersion): number =>
    version.version_type === 'release' ? 0 : version.version_type === 'beta' ? 1 : 2
  compatible.sort((a, b) => {
    const releaseDiff = rank(a) - rank(b)
    if (releaseDiff !== 0) return releaseDiff
    return Date.parse(b.date_published) - Date.parse(a.date_published)
  })
  return compatible[0] ?? null
}

export function projectTypeToAddonType(type: string): AddonType {
  if (type === 'modpack' || type === 'resourcepack' || type === 'shader' || type === 'datapack' || type === 'world') {
    return type
  }
  return 'mod'
}

export function modrinthHitToFriendly(hit: ModrinthHit): ModrinthHit {
  return {
    ...hit,
    description: hit.description || '',
    categories: hit.display_categories ?? hit.categories ?? []
  }
}
