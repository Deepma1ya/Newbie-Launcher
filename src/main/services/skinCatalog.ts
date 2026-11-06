import type { AccountSummary, SkinCatalogEntry, SkinCatalogPage } from '@shared/types'
import { fetchJson } from './http'
import { normalizeSkinImage } from './skins'
import { store } from './store'
import { logger } from '../util/log'

const CATALOG_API = 'https://app.photo2skin.com/api/library/skins'
const ALLOWED_HOST = 'app.photo2skin.com'
const MAX_SKIN_BYTES = 12 * 1024 * 1024

interface CatalogResponse {
  skins?: {
    id?: string
    name?: string
    model?: string
    author?: { username?: string; display_name?: string | null } | null
    skin_png_url?: string
    render_url?: string
    page_url?: string
  }[]
  page?: number
  pages?: number
  total?: number
}

export async function searchSkinCatalog(query: string, page = 1): Promise<SkinCatalogPage> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  params.set('page', String(Math.max(1, Math.floor(page))))
  const result = await fetchJson<CatalogResponse>(`${CATALOG_API}?${params.toString()}`, {
    headers: { Accept: 'application/json' }
  })
  const entries: SkinCatalogEntry[] = []
  for (const skin of result.skins ?? []) {
    if (!skin.id || !skin.name || !skin.skin_png_url || !skin.render_url) continue
    entries.push({
      id: skin.id,
      name: skin.name,
      model: skin.model === 'slim' ? 'slim' : 'classic',
      author: skin.author?.display_name ?? skin.author?.username,
      skinUrl: skin.skin_png_url,
      renderUrl: skin.render_url,
      pageUrl: skin.page_url
    })
  }
  return {
    entries,
    page: result.page ?? page,
    pages: result.pages ?? 1,
    total: result.total ?? entries.length
  }
}

export async function applyCatalogSkin(accountId: string, skinUrl: string): Promise<AccountSummary> {
  const account = store.account(accountId)
  if (!account) throw new Error('Account not found')
  if (account.type !== 'offline' && account.type !== 'tlauncher') {
    throw new Error('Catalog skins are only available for offline and TLauncher accounts')
  }
  let url: URL
  try {
    url = new URL(skinUrl)
  } catch {
    throw new Error('That skin link is invalid')
  }
  if (url.protocol !== 'https:' || url.hostname !== ALLOWED_HOST) {
    throw new Error('That skin does not come from the catalog provider')
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'image/png',
      'User-Agent': 'NewbieLauncher/1.0 (https://github.com/Deepma1ya/Newbie-Launcher)'
    },
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`The skin download failed (HTTP ${response.status})`)
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_SKIN_BYTES) throw new Error('That skin image is too large')
  const input = Buffer.from(await response.arrayBuffer())
  if (input.byteLength > MAX_SKIN_BYTES) throw new Error('That skin image is too large')
  const png = await normalizeSkinImage(input)
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`
  const summary = await store.upsertAccount({ ...account, skinUrl: dataUrl })
  logger.info('skins', `Applied catalog skin ${url.pathname} to ${account.username}`)
  return summary
}
