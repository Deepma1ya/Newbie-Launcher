import path from 'node:path'
import { promises as fs, createReadStream } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import AdmZip from 'adm-zip'
import type {
  AddonRecord,
  BulkAddonType,
  Instance,
  PackCopyOptions,
  PackCopyResult,
  PackExportResult,
  PackShareInfo
} from '@shared/types'
import { isBulkAddonType, BULK_ADDON_TYPES } from '@shared/addonBulk'
import { addonRecordFolder } from './addonTypes'
import { addonFilePath, persistInstance, scanUnmanagedAddons } from './addons'
import { createInstance, removeInstance } from './instances'
import { store } from './store'
import { paths } from './paths'
import { downloadFile } from './http'
import { addonCacheEntry } from './installer'
import { getServerShareAddresses } from './serverShare'
import { ensureDir, pathExists, safeJoin, sanitizeFilename, slugify } from '../util/fs'
import { zipEntries } from '../util/archive'
import { mapLimit } from '../util/async'
import { logger } from '../util/log'

const PACK_FILTER = [{ name: 'Modrinth modpack', extensions: ['mrpack'] }]

interface ModpackIndex {
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

interface ActiveShare {
  server: Server
  info: PackShareInfo
  file: string
}

let activeShare: ActiveShare | null = null

type Progress = (message: string, percent?: number) => void

export function packExportFilters(): { name: string; extensions: string[] }[] {
  return PACK_FILTER
}

export async function exportInstancePack(
  instanceId: string,
  destination: string,
  onProgress?: Progress
): Promise<PackExportResult> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const enabled = instance.addons.filter(
    (addon) => addon.enabled && isBulkAddonType(addon.type)
  )
  if (enabled.length === 0) {
    throw new Error('There are no enabled mods, resource packs, datapacks or shaders to export')
  }

  const entries: { name: string; file: string }[] = []
  const skipped: string[] = []
  const seen = new Set<string>()
  let bytes = 0

  onProgress?.('Collecting enabled add-ons', 8)
  for (const addon of enabled) {
    if (isWorldDatapack(addon)) {
      skipped.push(`${addon.name} (world-specific datapacks are not included)`)
      continue
    }
    const folder = addonRecordFolder(addon)
    if (folder.split('/').includes('..') || addon.filename.includes('..')) {
      skipped.push(`${addon.name} (invalid path)`)
      continue
    }
    const source = addonFilePath(instance, addon)
    if (!(await pathExists(source))) {
      skipped.push(`${addon.name} (file missing)`)
      continue
    }
    const name = `overrides/${folder}/${addon.filename}`.replace(/\\/g, '/')
    if (seen.has(name)) {
      skipped.push(`${addon.name} (duplicate filename)`)
      continue
    }
    seen.add(name)
    entries.push({ name, file: source })
    bytes += (await fs.stat(source)).size
  }

  if (entries.length === 0) {
    throw new Error('No enabled add-on files could be read for this pack')
  }

  const dependencies: Record<string, string> = { minecraft: instance.versionId }
  const loaderKey = loaderDependencyKey(instance.loader)
  if (loaderKey && instance.loaderVersion) dependencies[loaderKey] = instance.loaderVersion

  const index: ModpackIndex = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0.0',
    name: instance.name,
    summary: `Enabled add-ons exported from ${instance.name}`,
    files: [],
    dependencies
  }

  const target = /\.mrpack$/i.test(destination) ? destination : `${destination}.mrpack`
  onProgress?.(`Packing ${entries.length} add-on${entries.length === 1 ? '' : 's'}`, 28)
  await zipEntries(
    [
      {
        name: 'modrinth.index.json',
        data: JSON.stringify(index, null, 2)
      },
      ...entries
    ],
    target
  )
  const stat = await fs.stat(target)
  onProgress?.('Pack ready', 100)
  logger.info('packs', `Exported ${entries.length} add-on(s) from ${instance.name} to ${target}`)
  return {
    path: target,
    filename: path.basename(target),
    addons: entries.length,
    bytes: stat.size,
    skipped
  }
}

export async function importInstancePack(
  archivePath: string,
  onProgress?: Progress
): Promise<Instance> {
  const source = path.resolve(archivePath)
  const stat = await fs.stat(source).catch(() => null)
  if (!stat?.isFile()) throw new Error('Choose a modpack .mrpack file')
  const index = readPackIndex(source)
  const dependencies = index.dependencies ?? {}
  const gameVersion = dependencies.minecraft
  if (!gameVersion) throw new Error('This modpack does not declare a Minecraft version')
  const loader = detectPackLoader(dependencies)
  const fallbackName = path.basename(source).replace(/\.(mrpack|zip)$/i, '')
  const name = (index.name || fallbackName || 'Imported pack').trim().slice(0, 60)

  onProgress?.('Creating a matching instance', 5)
  let instance: Instance | null = null
  try {
    instance = await createInstance({
      name,
      versionId: gameVersion,
      loader: loader.type,
      loaderVersion: loader.version
    })
    await extractPack(source, instance.gameDir, index, onProgress)
    onProgress?.('Reading imported add-ons', 93)
    await scanUnmanagedAddons(instance.id)
    const refreshed = store.instance(instance.id) ?? instance
    onProgress?.('Pack imported', 100)
    logger.info('packs', `Imported ${name} from ${source}`)
    return refreshed
  } catch (error) {
    if (instance) {
      await removeInstance(instance.id, true).catch((failure) => {
        logger.warn('packs', 'Could not clean up a failed pack import', failure)
      })
    }
    throw error
  }
}

export async function copyAddonsToInstance(
  sourceId: string,
  targetId: string,
  options: PackCopyOptions
): Promise<PackCopyResult> {
  const source = store.instance(sourceId)
  const target = store.instance(targetId)
  if (!source) throw new Error('Source instance not found')
  if (!target) throw new Error('Target instance not found')
  if (source.id === target.id) throw new Error('Choose a different target instance')
  const { isInstanceBusy } = await import('./launch')
  if (isInstanceBusy(target.id)) {
    throw new Error('Close the target instance before copying add-ons')
  }

  const types = new Set<BulkAddonType>(
    (options.types ?? [...BULK_ADDON_TYPES]).filter((type): type is BulkAddonType =>
      isBulkAddonType(type)
    )
  )
  const records = source.addons.filter(
    (addon) => types.has(addon.type as BulkAddonType) && (options.includeDisabled || addon.enabled)
  )
  const warnings: string[] = []
  if (
    types.has('mod') &&
    (target.versionId !== source.versionId || target.loader !== source.loader)
  ) {
    warnings.push(
      `The target is ${target.versionId} with ${target.loader}; mods may not load unless the version and loader match.`
    )
  }

  let copied = 0
  let skipped = 0
  const conflicts: string[] = []
  const now = new Date().toISOString()

  for (const record of records) {
    if (isWorldDatapack(record)) {
      const worldDir = path.dirname(
        safeJoin(target.gameDir, record.relativeFolder ?? '')
      )
      if (!(await pathExists(path.join(worldDir, 'level.dat')))) {
        skipped += 1
        conflicts.push(`${record.name} (world not present in target)`)
        continue
      }
    }

    const sourceFile = addonFilePath(source, record, !record.enabled)
    if (!(await pathExists(sourceFile))) {
      skipped += 1
      conflicts.push(`${record.name} (source file missing)`)
      continue
    }

    const relative = path
      .join(addonRecordFolder(record), record.filename)
      .replace(/\\/g, '/')
    let destination: string
    try {
      destination = safeJoin(target.gameDir, relative)
    } catch {
      skipped += 1
      conflicts.push(`${record.name} (invalid path)`)
      continue
    }
    if (await pathExists(destination)) {
      if (!options.replace) {
        skipped += 1
        conflicts.push(`${record.name} (already exists)`)
        continue
      }
      await fs.rm(destination, { force: true }).catch(() => undefined)
      await fs.rm(`${destination}.disabled`, { force: true }).catch(() => undefined)
    } else if (!options.replace && (await pathExists(`${destination}.disabled`))) {
      skipped += 1
      conflicts.push(`${record.name} (already exists)`)
      continue
    } else if (options.replace) {
      await fs.rm(`${destination}.disabled`, { force: true }).catch(() => undefined)
    }

    await ensureDir(path.dirname(destination))
    await fs.copyFile(sourceFile, destination)
    if (!record.enabled) {
      await fs.rename(destination, `${destination}.disabled`)
    }

    const existing = target.addons.find(
      (addon) =>
        addon.id === record.id ||
        (addon.filename === record.filename &&
          addon.type === record.type &&
          (addon.relativeFolder ?? '') === (record.relativeFolder ?? ''))
    )
    const next: AddonRecord = {
      ...record,
      id: existing?.id ?? record.id,
      installedAt: existing?.installedAt ?? now,
      updatedAt: now
    }
    target.addons = target.addons.filter(
      (addon) =>
        addon.id !== next.id &&
        !(
          addon.filename === next.filename &&
          addon.type === next.type &&
          (addon.relativeFolder ?? '') === (next.relativeFolder ?? '')
        )
    )
    target.addons.push(next)
    const loadout = target.loadouts.find((entry) => entry.id === target.activeLoadoutId)
    if (loadout && !loadout.addonIds.includes(next.id)) {
      loadout.addonIds.push(next.id)
      loadout.updatedAt = now
    }
    copied += 1
  }

  await persistInstance(target)
  logger.info('packs', `Copied ${copied} add-on(s) from ${source.name} to ${target.name}`)
  return {
    targetId: target.id,
    targetName: target.name,
    copied,
    skipped,
    conflicts,
    warnings
  }
}

export async function startPackShare(
  instanceId: string,
  onProgress?: Progress
): Promise<PackShareInfo> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  await stopPackShare()

  const dir = path.join(paths.cache, 'pack-shares')
  await ensureDir(dir)
  await cleanupPackShares(dir)
  const filename = `${slugify(instance.name) || 'newbie-pack'}-${instance.versionId}.mrpack`
  const file = path.join(dir, `${Date.now()}-${sanitizeFilename(filename)}`)
  const exported = await exportInstancePack(instance.id, file, onProgress)
  const token = randomBytes(24).toString('hex')
  const pathName = `/${token}/${encodeURIComponent(filename)}`

  const server = createServer((request, response) => {
    let requestPath: string
    try {
      requestPath = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')
    } catch {
      response.writeHead(400)
      response.end()
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end()
      return
    }
    if (requestPath !== pathName) {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': exported.bytes,
      'Cache-Control': 'no-store'
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    const stream = createReadStream(file)
    stream.on('error', () => {
      if (!response.headersSent) response.writeHead(500)
      response.end()
    })
    stream.pipe(response)
  })

  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '0.0.0.0', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  })
  if (!port) {
    server.close()
    await fs.rm(exported.path, { force: true }).catch(() => undefined)
    throw new Error('Could not start the pack download server')
  }

  const addresses = await getServerShareAddresses().catch(() => [])
  const urls = [
    `http://localhost:${port}${pathName}`,
    ...addresses.map((entry) => `http://${entry.address}:${port}${pathName}`)
  ]
  const info: PackShareInfo = {
    instanceId: instance.id,
    filename,
    bytes: exported.bytes,
    port,
    urls: [...new Set(urls)],
    startedAt: new Date().toISOString()
  }
  activeShare = { server, info, file: exported.path }
  logger.info('packs', `Sharing ${filename} on port ${port}`)
  return info
}

export async function stopPackShare(): Promise<void> {
  const share = activeShare
  activeShare = null
  if (!share) return
  share.server.closeAllConnections?.()
  await new Promise<void>((resolve) => share.server.close(() => resolve()))
  await fs.rm(share.file, { force: true }).catch(() => undefined)
}

export function packShareInfo(): PackShareInfo | null {
  return activeShare?.info ?? null
}

function readPackIndex(archive: string): ModpackIndex {
  const zip = new AdmZip(archive)
  const entry = zip.getEntry('modrinth.index.json')
  if (!entry) throw new Error('This file is not a Modrinth modpack')
  try {
    return JSON.parse(entry.getData().toString('utf8')) as ModpackIndex
  } catch {
    throw new Error('The modpack manifest is not valid JSON')
  }
}

async function extractPack(
  archive: string,
  gameDir: string,
  index: ModpackIndex,
  onProgress?: Progress
): Promise<void> {
  const zip = new AdmZip(archive)
  const files = (index.files ?? []).filter((file) => file.env?.client !== 'unsupported')
  let completed = 0
  await mapLimit(files, 6, async (file) => {
    if (!file.downloads[0]) return
    const relative = file.path.replace(/\\/g, '/')
    let target: string
    try {
      target = safeJoin(gameDir, relative)
    } catch {
      return
    }
    const filename = path.basename(relative)
    try {
      const cache = addonCacheEntry(file.hashes.sha1, filename)
      await downloadFile(file.downloads[0], cache, {
        sha1: file.hashes.sha1,
        size: file.fileSize,
        retries: 4
      })
      await ensureDir(path.dirname(target))
      await fs.copyFile(cache, target)
    } catch (error) {
      logger.warn('packs', `Could not download pack file ${relative}`, error)
    } finally {
      completed += 1
      onProgress?.(
        `Downloading pack files (${completed}/${files.length})`,
        18 + Math.round((completed / Math.max(1, files.length)) * 64)
      )
    }
  })

  onProgress?.('Extracting overrides', 86)
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const name = entry.entryName.replace(/\\/g, '/')
    const prefix = ['overrides', 'client-overrides'].find((candidate) =>
      name.startsWith(`${candidate}/`)
    )
    if (!prefix) continue
    const relative = name.slice(prefix.length + 1)
    if (!relative || relative.split('/').includes('..')) continue
    let target: string
    try {
      target = safeJoin(gameDir, relative)
    } catch {
      continue
    }
    await ensureDir(path.dirname(target))
    await fs.writeFile(target, entry.getData())
  }
  onProgress?.('Pack files ready', 92)
}

async function cleanupPackShares(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  for (const entry of entries) {
    if (!entry.isFile() || !/\.mrpack$/i.test(entry.name)) continue
    const file = path.join(dir, entry.name)
    const stat = await fs.stat(file).catch(() => null)
    if (stat && stat.mtimeMs < cutoff) await fs.rm(file, { force: true }).catch(() => undefined)
  }
}

function isWorldDatapack(record: Pick<AddonRecord, 'type' | 'relativeFolder'>): boolean {
  return record.type === 'datapack' && Boolean(record.relativeFolder?.startsWith('saves/'))
}

function loaderDependencyKey(loader: Instance['loader']): string | null {
  if (loader === 'fabric') return 'fabric-loader'
  if (loader === 'quilt') return 'quilt-loader'
  if (loader === 'forge') return 'forge'
  if (loader === 'neoforge') return 'neoforge'
  return null
}

function detectPackLoader(dependencies: Record<string, string>): {
  type: Instance['loader']
  version: string
} {
  if (dependencies['fabric-loader']) {
    return { type: 'fabric', version: dependencies['fabric-loader'] }
  }
  if (dependencies['quilt-loader']) {
    return { type: 'quilt', version: dependencies['quilt-loader'] }
  }
  if (dependencies.forge) return { type: 'forge', version: dependencies.forge }
  if (dependencies.neoforge) return { type: 'neoforge', version: dependencies.neoforge }
  return { type: 'vanilla', version: '' }
}
