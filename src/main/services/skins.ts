import path from 'node:path'
import { promises as fs } from 'node:fs'
import { nativeImage } from 'electron'
import AdmZip from 'adm-zip'
import Jimp from 'jimp'
import type { AccountSummary, AuthAccount, Instance } from '@shared/types'
import { paths } from './paths'
import { store } from './store'
import { fetchTLauncherTextures } from '../auth/tlauncher'
import { sanitizeFilename } from '../util/fs'
import { logger } from '../util/log'

const SKIN_PACK_PREFIX = 'NewbieSkin-'
const TEXTURE_PATHS = [
  'assets/minecraft/textures/entity/steve.png',
  'assets/minecraft/textures/entity/alex.png',
  'assets/minecraft/textures/entity/player/wide/steve.png',
  'assets/minecraft/textures/entity/player/slim/alex.png'
]
const MAX_SKIN_BYTES = 12 * 1024 * 1024

/**
 * Accepts real Minecraft skin layouts (64x64 or 64x32, including HD multiples)
 * and turns every other image into a simple face-based skin. This means users
 * can pick a PNG, JPEG, BMP or GIF without knowing the skin UV layout.
 */
export async function normalizeSkinImage(input: Buffer, sourcePath?: string): Promise<Buffer> {
  let image: Jimp
  try {
    image = await Jimp.read(input)
  } catch (error) {
    if (!sourcePath) throw new Error('This image format could not be read')
    const fallback = nativeImage.createFromPath(sourcePath)
    if (fallback.isEmpty()) throw new Error('This image format could not be read')
    const { width, height } = fallback.getSize()
    const resized = fallback.resize({ width: 64, height: 64, quality: 'best' })
    logger.warn('skins', `Used native image fallback for ${width}x${height} skin source`, error)
    return resized.toPNG()
  }

  const width = image.bitmap.width
  const height = image.bitmap.height
  if (width <= 0 || height <= 0) throw new Error('The image is empty')

  if (isSkinLayout(width, height)) {
    const target = width / height >= 1.5 ? { width: 64, height: 32 } : { width: 64, height: 64 }
    if (width !== target.width || height !== target.height) {
      image.resize(target.width, target.height, Jimp.RESIZE_BICUBIC)
    }
    return image.getBufferAsync(Jimp.MIME_PNG)
  }

  return generateFaceSkin(image)
}

function isSkinLayout(width: number, height: number): boolean {
  if (width === 64 && (height === 64 || height === 32)) return true
  if (width !== height && width !== height * 2) return false
  return width % 64 === 0 && height % 64 === 0 && width <= 512 && height <= 512
}

async function generateFaceSkin(source: Jimp): Promise<Buffer> {
  const width = source.bitmap.width
  const height = source.bitmap.height
  const side = Math.max(1, Math.min(width, height))
  const face = source
    .clone()
    .crop(Math.floor((width - side) / 2), Math.floor((height - side) / 2), side, side)
    .resize(8, 8, Jimp.RESIZE_BICUBIC)

  const average = source.clone().resize(1, 1, Jimp.RESIZE_BICUBIC).getPixelColor(0, 0)
  const base = new Jimp(64, 64, average)
  // Subtle shading so the body has some depth instead of a flat silhouette.
  base.scan(0, 0, 64, 64, function (x, y, idx) {
    const shade = y < 16 ? -14 : (x + y) % 9 === 0 ? -8 : 0
    this.bitmap.data[idx] = clamp(this.bitmap.data[idx]! + shade)
    this.bitmap.data[idx + 1] = clamp(this.bitmap.data[idx + 1]! + shade)
    this.bitmap.data[idx + 2] = clamp(this.bitmap.data[idx + 2]! + shade)
    this.bitmap.data[idx + 3] = 255
  })
  base.composite(face, 8, 8)
  return base.getBufferAsync(Jimp.MIME_PNG)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value))
}

export async function setAccountSkin(accountId: string, filePath: string): Promise<AccountSummary> {
  const account = store.account(accountId)
  if (!account) throw new Error('Account not found')
  if (account.type !== 'offline' && account.type !== 'tlauncher') {
    throw new Error('Custom skins are only available for offline and TLauncher accounts')
  }
  const stat = await fs.stat(filePath)
  if (stat.size > MAX_SKIN_BYTES) throw new Error('That image is too large (maximum 12 MB)')
  const input = await fs.readFile(filePath)
  const png = await normalizeSkinImage(input, filePath)
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`
  return store.upsertAccount({ ...account, skinUrl: dataUrl })
}

export async function removeAccountSkin(accountId: string): Promise<AccountSummary> {
  const account = store.account(accountId)
  if (!account) throw new Error('Account not found')
  if (account.type !== 'offline' && account.type !== 'tlauncher') {
    throw new Error('This account does not support a custom skin')
  }
  let skinUrl: string | undefined
  if (account.type === 'tlauncher' && store.settings().tlauncherSkins) {
    const textures = await fetchTLauncherTextures(account.username).catch(() => ({
      skinUrl: undefined,
      capeUrl: undefined
    }))
    skinUrl = textures.skinUrl
  }
  const summary = await store.upsertAccount({ ...account, skinUrl })
  await fs
    .rm(path.join(paths.cache, 'skins', `${sanitizeFilename(account.id)}.png`), { force: true })
    .catch(() => undefined)
  return summary
}

/**
 * Applies the offline/TLauncher skin through a client-side resource pack. The
 * pack overrides the default player textures, so it works in vanilla and
 * modded instances without a skin server. Other players still see the normal
 * offline default skin.
 */
export async function applyOfflineSkin(instance: Instance, account: AuthAccount): Promise<void> {
  if (account.type !== 'offline' && account.type !== 'tlauncher') {
    await clearOfflineSkin(instance)
    return
  }

  const png = await resolveSkinPng(account)
  if (!png) {
    await clearOfflineSkin(instance)
    return
  }

  const resourcepacks = path.join(instance.gameDir, 'resourcepacks')
  await fs.mkdir(resourcepacks, { recursive: true })
  const filename = `${SKIN_PACK_PREFIX}${sanitizeFilename(account.id)}.zip`
  const target = path.join(resourcepacks, filename)
  const format = packFormatForVersion(instance.versionId)

  const zip = new AdmZip()
  zip.addFile(
    'pack.mcmeta',
    Buffer.from(
      JSON.stringify({
        pack: {
          pack_format: format,
          description: `Newbie custom skin for ${account.username}`,
          supported_formats: { min_inclusive: 1, max_inclusive: 999 }
        }
      })
    )
  )
  for (const texturePath of TEXTURE_PATHS) {
    zip.addFile(texturePath, png)
  }
  await fs.writeFile(target, zip.toBuffer())

  await updateOptions(instance.gameDir, filename)
  logger.info('skins', `Applied offline skin pack for ${account.username} (${format})`)
}

async function resolveSkinPng(account: AuthAccount): Promise<Buffer | null> {
  const url = account.skinUrl
  if (!url) return null
  if (url.startsWith('data:image/')) {
    const comma = url.indexOf(',')
    if (comma < 0) return null
    try {
      return Buffer.from(url.slice(comma + 1), 'base64')
    } catch {
      return null
    }
  }
  if (!/^https?:/i.test(url)) return null

  const cacheDir = path.join(paths.cache, 'skins')
  const cached = path.join(cacheDir, `${sanitizeFilename(account.id)}.png`)
  try {
    return await fs.readFile(cached)
  } catch {
    // No cache yet; fetch the public texture below.
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const input = Buffer.from(await response.arrayBuffer())
    const png = await normalizeSkinImage(input)
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(cached, png)
    return png
  } catch (error) {
    logger.warn('skins', 'Could not download the TLauncher skin; trying the cached copy', error)
    try {
      return await fs.readFile(cached)
    } catch {
      return null
    }
  }
}

async function clearOfflineSkin(instance: Instance): Promise<void> {
  const resourcepacks = path.join(instance.gameDir, 'resourcepacks')
  try {
    const entries = await fs.readdir(resourcepacks)
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith(SKIN_PACK_PREFIX) && entry.endsWith('.zip'))
        .map((entry) => fs.rm(path.join(resourcepacks, entry), { force: true }))
    )
  } catch {
    // A missing resourcepacks folder means there is nothing to clean up.
  }
  await updateOptions(instance.gameDir, null)
}

async function updateOptions(gameDir: string, packFilename: string | null): Promise<void> {
  const file = path.join(gameDir, 'options.txt')
  let lines: string[]
  try {
    lines = (await fs.readFile(file, 'utf8')).split(/\r?\n/)
  } catch {
    lines = []
  }
  const map = new Map<string, string>()
  for (const line of lines) {
    const index = line.indexOf(':')
    if (index > 0) map.set(line.slice(0, index), line.slice(index + 1))
  }

  const packs = parseList(map.get('resourcePacks')).filter(
    (entry) => !isOurPack(entry)
  )
  if (packFilename) packs.unshift(`file/${packFilename}`)
  map.set('resourcePacks', JSON.stringify(packs))

  const incompatible = parseList(map.get('incompatibleResourcePacks')).filter(
    (entry) => !isOurPack(entry)
  )
  if (packFilename) incompatible.push(`file/${packFilename}`)
  map.set('incompatibleResourcePacks', JSON.stringify(incompatible))

  const output = [...map.entries()].map(([key, value]) => `${key}:${value}`).join('\n') + '\n'
  await fs.mkdir(gameDir, { recursive: true })
  await fs.writeFile(file, output, 'utf8')
}

function parseList(value?: string): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function isOurPack(entry: string): boolean {
  return entry.includes(SKIN_PACK_PREFIX)
}

export function packFormatForVersion(versionId: string): number {
  const parts = versionId.split('.').map((part) => Number(part))
  if (parts[0] !== 1) return 15
  const minor = parts[1] ?? 0
  const patch = parts[2] ?? 0
  if (minor <= 8) return 1
  if (minor <= 10) return 2
  if (minor <= 12) return 3
  if (minor <= 14) return 4
  if (minor === 15) return 5
  if (minor === 16) return patch <= 1 ? 5 : 6
  if (minor === 17) return 7
  if (minor === 18) return 8
  if (minor === 19) return patch <= 2 ? 9 : patch === 3 ? 12 : 13
  if (minor === 20) {
    if (patch <= 1) return 15
    if (patch === 2) return 18
    if (patch <= 4) return 22
    if (patch <= 6) return 32
    return 15
  }
  if (minor === 21) {
    if (patch <= 1) return 34
    if (patch <= 3) return 42
    if (patch === 4) return 46
    if (patch <= 5) return 55
    if (patch <= 8) return 64
    if (patch <= 10) return 69
    return 75
  }
  return 15
}
