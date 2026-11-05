import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { AccountSummary, AuthAccount } from '@shared/types'
import { offlineUuid } from '../util/hash'
import { store } from '../services/store'
import { fetchJson } from '../services/http'
import { paths } from '../services/paths'
import { sanitizeFilename } from '../util/fs'
import { logger } from '../util/log'
import { validateUsername } from './offline'

interface TLauncherTextureResponse {
  SKIN?: { url?: string; metadata?: { model?: string } }
  CAPE?: { url?: string }
  skin?: { url?: string; metadata?: { model?: string } }
  cape?: { url?: string }
}

export async function addTLauncherAccount(username: string): Promise<AccountSummary> {
  const name = validateUsername(username)
  const uuid = offlineUuid(name)
  const textures = store.settings().tlauncherSkins ? await fetchTLauncherTextures(name) : {}
  const account: AuthAccount = {
    id: `tl_${uuid}`,
    type: 'tlauncher',
    username: name,
    uuid,
    active: false,
    createdAt: new Date().toISOString(),
    skinUrl: textures.skinUrl,
    capeUrl: textures.capeUrl,
    accessToken: offlineUuid(`tl:${uuid}`).replace(/-/g, '')
  }
  const summary = await store.upsertAccount(account)
  logger.info('auth', `Added TLauncher account ${name}${textures.skinUrl ? ' with skin' : ''}`)
  return summary
}

export async function refreshTLauncherAccount(id: string): Promise<AccountSummary> {
  const account = store.account(id)
  if (!account || account.type !== 'tlauncher') throw new Error('TLauncher account not found')
  const textures = store.settings().tlauncherSkins
    ? await fetchTLauncherTextures(account.username)
    : { skinUrl: undefined, capeUrl: undefined }
  const hasCustomSkin = Boolean(account.skinUrl?.startsWith('data:image/'))
  const updated: AuthAccount = {
    ...account,
    skinUrl: hasCustomSkin ? account.skinUrl : textures.skinUrl,
    capeUrl: textures.capeUrl
  }
  await fs
    .rm(path.join(paths.cache, 'skins', `${sanitizeFilename(account.id)}.png`), { force: true })
    .catch(() => undefined)
  return store.upsertAccount(updated)
}

export async function fetchTLauncherTextures(
  username: string
): Promise<{ skinUrl?: string; capeUrl?: string }> {
  try {
    const data = await fetchJson<TLauncherTextureResponse>(
      `https://auth.tlauncher.org/skin/profile/texture/login/${encodeURIComponent(username)}`,
      {},
      { timeoutMs: 15_000, retries: 1 }
    )
    const skin = data.SKIN ?? data.skin
    const cape = data.CAPE ?? data.cape
    return {
      skinUrl: normalizeTextureUrl(skin?.url),
      capeUrl: normalizeTextureUrl(cape?.url)
    }
  } catch (error) {
    logger.warn('auth', `TLauncher skin lookup failed for ${username}`, error)
    return {}
  }
}

function normalizeTextureUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('http://')) return `https://${url.slice(7)}`
  return url
}
