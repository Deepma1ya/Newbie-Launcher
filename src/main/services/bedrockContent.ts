import path from 'node:path'
import { promises as fs } from 'node:fs'
import AdmZip from 'adm-zip'
import type {
  BedrockContentItem,
  BedrockContentKind,
  BedrockContentSource
} from '@shared/types'
import {
  ensureDir,
  pathExists,
  readJson,
  safeJoin,
  sanitizeFilename,
  writeJsonAtomic
} from '../util/fs'

export const BEDROCK_CONTENT_DIRS: Record<BedrockContentKind, string> = {
  resourcepack: 'resource_packs',
  behaviorpack: 'behavior_packs',
  skinpack: 'skin_packs',
  world: 'minecraftWorlds',
  template: 'world_templates'
}

export const BEDROCK_PACK_KINDS: BedrockContentKind[] = [
  'resourcepack',
  'behaviorpack',
  'skinpack'
]

export interface BedrockContentCounts {
  contentCount: number
  worldCount: number
}

interface PackManifest {
  header?: {
    name?: string
    uuid?: string
    version?: number[] | string
  }
  modules?: { type?: string }[]
}

interface NewbieContentMeta {
  source?: BedrockContentSource
  installedAt?: string
  title?: string
}

export function contentDir(dataDir: string, kind: BedrockContentKind): string {
  return path.join(dataDir, BEDROCK_CONTENT_DIRS[kind])
}

export async function ensureBedrockContentLayout(dataDir: string): Promise<void> {
  await Promise.all([
    ensureDir(dataDir),
    ...Object.values(BEDROCK_CONTENT_DIRS).map((folder) => ensureDir(path.join(dataDir, folder))),
    ensureDir(path.join(dataDir, 'development_resource_packs')),
    ensureDir(path.join(dataDir, 'development_behavior_packs')),
    ensureDir(path.join(dataDir, 'development_skin_packs'))
  ])
}

export async function scanBedrockContent(dataDir: string): Promise<BedrockContentItem[]> {
  const items: BedrockContentItem[] = []
  for (const kind of Object.keys(BEDROCK_CONTENT_DIRS) as BedrockContentKind[]) {
    const root = contentDir(dataDir, kind)
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const folderPath = path.join(root, entry.name)
      if (kind === 'world' || kind === 'template') {
        if (!(await pathExists(path.join(folderPath, 'level.dat')))) continue
        const meta = await readJson<NewbieContentMeta | null>(
          path.join(folderPath, '.newbie.json'),
          null
        )
        const levelName = await fs
          .readFile(path.join(folderPath, 'levelname.txt'), 'utf8')
          .then((value) => value.trim())
          .catch(() => '')
        items.push({
          id: `${kind}:${entry.name}`,
          kind,
          name: meta?.title?.trim() || levelName || entry.name,
          folder: entry.name,
          installedAt: meta?.installedAt,
          source: meta?.source
        })
        continue
      }

      const manifest = await readPackManifest(folderPath)
      const meta = await readJson<NewbieContentMeta | null>(
        path.join(folderPath, '.newbie.json'),
        null
      )
      if (!manifest && !meta) continue
      items.push({
        id: `${kind}:${entry.name}`,
        kind,
        name:
          cleanBedrockName(meta?.title) ||
          cleanBedrockName(manifest?.header?.name) ||
          entry.name,
        folder: entry.name,
        uuid: manifest?.header?.uuid,
        version: formatVersion(manifest?.header?.version),
        installedAt: meta?.installedAt,
        source: meta?.source
      })
    }
  }
  const order: BedrockContentKind[] = [
    'resourcepack',
    'behaviorpack',
    'skinpack',
    'world',
    'template'
  ]
  return items.sort((a, b) => {
    const kind = order.indexOf(a.kind) - order.indexOf(b.kind)
    if (kind !== 0) return kind
    return a.name.localeCompare(b.name)
  })
}

export async function countBedrockContent(dataDir: string): Promise<BedrockContentCounts> {
  const items = await scanBedrockContent(dataDir)
  return {
    contentCount: items.filter((item) => item.kind !== 'world' && item.kind !== 'template').length,
    worldCount: items.filter((item) => item.kind === 'world' || item.kind === 'template').length
  }
}

export async function removeBedrockContent(
  dataDir: string,
  id: string
): Promise<BedrockContentItem[]> {
  const separator = id.indexOf(':')
  if (separator <= 0) throw new Error('Invalid Bedrock content id')
  const kind = id.slice(0, separator) as BedrockContentKind
  const folder = id.slice(separator + 1)
  if (!(kind in BEDROCK_CONTENT_DIRS) || !folder || /[\\/]/.test(folder) || folder.startsWith('.')) {
    throw new Error('Invalid Bedrock content id')
  }
  const root = contentDir(dataDir, kind)
  const target = safeJoin(root, folder)
  const stat = await fs.lstat(target).catch(() => null)
  if (!stat) throw new Error('That Bedrock item is no longer installed')
  if (stat.isSymbolicLink()) await fs.unlink(target)
  else await fs.rm(target, { recursive: true, force: true })
  return scanBedrockContent(dataDir)
}

export interface InstallArchiveResult {
  installed: BedrockContentItem[]
  skipped: string[]
}

export async function installBedrockArchive(
  dataDir: string,
  archive: Buffer | string,
  source: BedrockContentSource,
  options: { filename?: string } = {}
): Promise<InstallArchiveResult> {
  const zip = new AdmZip(archive)
  const entries = zip.getEntries()
  if (entries.length === 0) throw new Error('This Bedrock file is empty')
  if (entries.length > 20_000) throw new Error('This Bedrock file contains too many files')
  let uncompressed = 0
  for (const entry of entries) {
    const name = normalizeEntryName(entry.entryName)
    if (!isSafeEntry(name)) throw new Error(`Unsafe path in Bedrock archive: ${entry.entryName}`)
    const size = Number(entry.header.size ?? 0)
    if (Number.isFinite(size) && size > 0) uncompressed += size
  }
  if (uncompressed > 4 * 1024 * 1024 * 1024) {
    throw new Error('This Bedrock file is larger than 4 GB when unpacked')
  }

  const filename = options.filename ?? ''
  const hintedKind = kindFromFilename(filename)
  const installed: BedrockContentItem[] = []
  const skipped: string[] = []

  const manifests = entries.filter(
    (entry) => !entry.isDirectory && /(^|\/)manifest\.json$/i.test(normalizeEntryName(entry.entryName))
  )
  for (const manifestEntry of manifests) {
    const manifestName = normalizeEntryName(manifestEntry.entryName)
    const prefix = path.posix.dirname(manifestName)
    const manifest = parseManifest(manifestEntry.getData().toString('utf8'))
    if (!manifest) {
      skipped.push(manifestName)
      continue
    }
    const kinds = packKinds(manifest, hintedKind)
    if (kinds.length === 0) {
      skipped.push(manifestName)
      continue
    }
    for (const kind of kinds) {
      const item = await extractPack(zip, prefix, dataDir, kind, manifest, source)
      if (item) installed.push(item)
    }
  }

  if (installed.length === 0) {
    const worldEntry = entries.find(
      (entry) => !entry.isDirectory && /(^|\/)level\.dat$/i.test(normalizeEntryName(entry.entryName))
    )
    if (worldEntry) {
      const kind = hintedKind === 'template' ? 'template' : 'world'
      const item = await extractWorld(
        zip,
        path.posix.dirname(normalizeEntryName(worldEntry.entryName)),
        dataDir,
        kind,
        source,
        filename
      )
      installed.push(item)
    }
  }

  if (installed.length === 0) {
    // Some .mcaddon files contain .mcpack files instead of unpacked pack folders.
    for (const entry of entries) {
      if (entry.isDirectory) continue
      const name = normalizeEntryName(entry.entryName)
      if (!/\.(mcpack|mcaddon)$/i.test(name)) continue
      const nested = await installBedrockArchive(dataDir, entry.getData(), source, {
        filename: name
      }).catch(() => null)
      if (nested) installed.push(...nested.installed)
    }
  }

  if (installed.length === 0) {
    throw new Error(
      'This file does not contain a Bedrock resource pack, behavior pack, skin pack or world.'
    )
  }
  return { installed, skipped }
}

async function extractPack(
  zip: AdmZip,
  prefix: string,
  dataDir: string,
  kind: BedrockContentKind,
  manifest: PackManifest,
  source: BedrockContentSource
): Promise<BedrockContentItem | null> {
  const root = contentDir(dataDir, kind)
  await ensureDir(root)
  const uuid = manifest.header?.uuid?.trim()
  if (uuid) {
    const existing = await findPackFolderByUuid(root, uuid)
    if (existing) await fs.rm(path.join(root, existing), { recursive: true, force: true })
  }
  const packName =
    cleanBedrockName(manifest.header?.name) ||
    cleanBedrockName(path.posix.basename(prefix)) ||
    'pack'
  const desired = sanitizeFilename(packName) || 'pack'
  const folder = await uniqueFolder(root, desired, uuid)
  const target = path.join(root, folder)
  await ensureDir(target)
  await extractPrefix(zip, prefix, target)
  await writeJsonAtomic(path.join(target, '.newbie.json'), {
    source,
    installedAt: new Date().toISOString(),
    title: cleanBedrockName(manifest.header?.name) || source.title
  } satisfies NewbieContentMeta)
  return {
    id: `${kind}:${folder}`,
    kind,
    name: cleanBedrockName(manifest.header?.name) || source.title,
    folder,
    uuid,
    version: formatVersion(manifest.header?.version),
    installedAt: new Date().toISOString(),
    source
  }
}

async function extractWorld(
  zip: AdmZip,
  prefix: string,
  dataDir: string,
  kind: 'world' | 'template',
  source: BedrockContentSource,
  filename: string
): Promise<BedrockContentItem> {
  const root = contentDir(dataDir, kind)
  await ensureDir(root)
  const desired =
    sanitizeFilename(source.title || path.basename(filename, path.extname(filename)) || 'world') ||
    'world'
  const folder = await uniqueFolder(root, desired)
  const target = path.join(root, folder)
  await ensureDir(target)
  await extractPrefix(zip, prefix, target)
  await writeJsonAtomic(path.join(target, '.newbie.json'), {
    source,
    installedAt: new Date().toISOString(),
    title: source.title
  } satisfies NewbieContentMeta)
  const levelName = await fs
    .readFile(path.join(target, 'levelname.txt'), 'utf8')
    .then((value) => value.trim())
    .catch(() => '')
  return {
    id: `${kind}:${folder}`,
    kind,
    name: source.title || levelName || folder,
    folder,
    installedAt: new Date().toISOString(),
    source
  }
}

function packKinds(
  manifest: PackManifest,
  hint: BedrockContentKind | 'addon' | 'unknown' | null
): BedrockContentKind[] {
  const types = new Set((manifest.modules ?? []).map((module) => module.type))
  const kinds: BedrockContentKind[] = []
  if (types.has('resources')) kinds.push('resourcepack')
  if (types.has('data') || types.has('script')) kinds.push('behaviorpack')
  if (types.has('skin')) kinds.push('skinpack')
  if (kinds.length > 0) return kinds
  if (hint === 'resourcepack' || hint === 'behaviorpack' || hint === 'skinpack') return [hint]
  return []
}

function parseManifest(raw: string): PackManifest | null {
  try {
    const value = JSON.parse(raw) as PackManifest
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

async function readPackManifest(folder: string): Promise<PackManifest | null> {
  const raw = await fs.readFile(path.join(folder, 'manifest.json'), 'utf8').catch(() => null)
  return raw ? parseManifest(raw) : null
}

async function findPackFolderByUuid(root: string, uuid: string): Promise<string | null> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifest = await readPackManifest(path.join(root, entry.name))
    if (manifest?.header?.uuid?.toLowerCase() === uuid.toLowerCase()) return entry.name
  }
  return null
}

async function uniqueFolder(root: string, desired: string, uuid?: string): Promise<string> {
  const clean = sanitizeFilename(desired) || 'pack'
  const suffix = uuid ? uuid.replace(/-/g, '').slice(0, 6) : ''
  const first = suffix ? `${clean}-${suffix}` : clean
  let candidate = first
  let index = 2
  while (await pathExists(path.join(root, candidate))) {
    candidate = `${first}-${index}`
    index += 1
  }
  return candidate
}

async function extractPrefix(zip: AdmZip, prefix: string, target: string): Promise<void> {
  const normalized = prefix && prefix !== '.' ? `${prefix.replace(/\\/g, '/').replace(/\/$/, '')}/` : ''
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const name = normalizeEntryName(entry.entryName)
    if (!name.startsWith(normalized)) continue
    const relative = name.slice(normalized.length)
    if (!relative) continue
    const destination = safeJoin(target, relative)
    await ensureDir(path.dirname(destination))
    await fs.writeFile(destination, entry.getData())
  }
}

function cleanBedrockName(value: string | undefined): string {
  return (value ?? '').replace(/§[0-9a-fk-or]/gi, '').trim()
}

function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\/+/, '')
}

function isSafeEntry(name: string): boolean {
  if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name)) return false
  return !name.split('/').some((part) => part === '..')
}

function formatVersion(value: number[] | string | undefined): string | undefined {
  if (Array.isArray(value)) return value.join('.')
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function kindFromFilename(filename: string): BedrockContentKind | 'addon' | 'unknown' {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.mcworld')) return 'world'
  if (lower.endsWith('.mctemplate')) return 'template'
  if (lower.endsWith('.mcaddon')) return 'addon'
  if (lower.endsWith('.mcpack')) return 'unknown'
  return 'unknown'
}
