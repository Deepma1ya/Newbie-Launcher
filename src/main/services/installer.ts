import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { InstallProgress, LauncherSettings } from '@shared/types'
import {
  currentRuleContext,
  getVersionJson,
  libraryArtifact,
  nativeArtifact,
  resolveVersion,
  rulesAllow,
  type Library,
  type LibraryArtifact,
  type VersionJson
} from './mojang'
import { downloadFile, fetchJson } from './http'
import { ensureDir, existsWithSize, pathExists } from '../util/fs'
import { mapLimit } from '../util/async'
import { paths } from './paths'
import { logger } from '../util/log'
import { store } from './store'

export interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>
  virtual?: boolean
  map_to_resources?: boolean
}

interface InstallOptions {
  onProgress?: (progress: Omit<InstallProgress, 'taskId'>) => void
  force?: boolean
}

const ASSET_CDN = 'https://resources.download.minecraft.net'

export async function installGame(versionId: string, options: InstallOptions = {}): Promise<void> {
  const settings = store.settings()
  const concurrency = Math.max(1, Math.min(16, settings.downloadConcurrency || 6))
  const version = await resolveVersion(versionId)
  const topVersion = await getVersionJson(versionId)
  const baseVersionId = await findRootVersion(versionId)
  const report = makeReporter(options.onProgress)

  report('metadata', `Preparing ${versionId}`, 0, 1)
  await ensureDir(path.dirname(paths.versionJson(baseVersionId)))

  // Client jar
  const clientJarTarget = topVersion.downloads?.client
    ? paths.versionJar(versionId)
    : paths.versionJar(baseVersionId)
  if (version.downloads?.client) {
    report('client', `Downloading game jar for ${baseVersionId}`, 0, 1)
    await ensureArtifact(version.downloads.client, clientJarTarget, options.force)
  }

  // Logging configuration
  if (version.logging?.client?.file) {
    const logName = version.logging.client.file.path ?? version.logging.client.file.id ?? 'client-logging.xml'
    const logFile = path.join(paths.assets, 'log_configs', logName)
    await ensureArtifact({ ...version.logging.client.file, path: logName }, logFile, options.force)
  }

  // Libraries + natives
  const libraries = (version.libraries ?? []).filter((library) => rulesAllow(library.rules, currentRuleContext()))
  report('libraries', `Libraries (${libraries.length})`, 0, libraries.length)
  let libraryDone = 0
  await mapLimit(libraries, concurrency, async (library) => {
    await installLibrary(library, options.force)
    libraryDone += 1
    report('libraries', `Libraries (${libraryDone}/${libraries.length})`, libraryDone, libraries.length)
  })

  // Assets
  if (version.assetIndex) {
    const indexFile = path.join(paths.assetsIndexes, `${version.assetIndex.id}.json`)
    await ensureArtifact({ ...version.assetIndex, path: `${version.assetIndex.id}.json` }, indexFile, options.force)
    const index = JSON.parse(await fs.readFile(indexFile, 'utf8')) as AssetIndex
    const objects = Object.entries(index.objects ?? {})
    report('assets', `Assets (0/${objects.length})`, 0, objects.length)
    let done = 0
    let bytes = 0
    await mapLimit(objects, Math.max(concurrency, 8), async ([name, object]) => {
      const target = assetObjectPath(object.hash)
      const ok = await existsWithSize(target, object.size)
      if (!ok || options.force) {
        await downloadFile(`${ASSET_CDN}/${object.hash.slice(0, 2)}/${object.hash}`, target, {
          size: object.size,
          retries: 3
        })
      }
      done += 1
      bytes += object.size
      if (done % 8 === 0 || done === objects.length) {
        report(
          'assets',
          `Assets (${done}/${objects.length})`,
          done,
          objects.length,
          `${(bytes / 1024 / 1024).toFixed(1)} MB`
        )
      }
    })

    if (index.virtual) {
      const virtualRoot = path.join(paths.assets, 'virtual', version.assetIndex.id)
      report('extract', 'Building virtual asset tree', 0, objects.length)
      let virtualDone = 0
      await mapLimit(objects, 12, async ([name, object]) => {
        const source = assetObjectPath(object.hash)
        const target = path.join(virtualRoot, name)
        if (!(await pathExists(target))) {
          await ensureDir(path.dirname(target))
          await fs.copyFile(source, target).catch(async () => {
            await ensureDir(path.dirname(target))
            await fs.copyFile(source, target)
          })
        }
        virtualDone += 1
        if (virtualDone % 50 === 0) report('extract', 'Building virtual asset tree', virtualDone, objects.length)
      })
    }

  }

  report('finalize', `${versionId} is ready`, 1, 1, undefined, 100)
  logger.info('installer', `Version ${versionId} is installed`)
}

async function installLibrary(library: Library, force = false): Promise<void> {
  const artifact = libraryArtifact(library)
  if (artifact?.url && !artifact.url.endsWith('/') && artifact.path) {
    const target = path.join(paths.libraries, artifact.path)
    if (force || !(await existsWithSize(target, artifact.size || undefined))) {
      await downloadFile(artifact.url, target, {
        sha1: artifact.sha1 || undefined,
        size: artifact.size || undefined,
        retries: 3
      })
    }
  }
  const osName = currentRuleContext().osName
  const native = nativeArtifact(library, osName)
  if (native?.path) {
    const target = path.join(paths.libraries, native.path)
    if (force || !(await existsWithSize(target, native.size || undefined))) {
      await downloadFile(native.url, target, {
        sha1: native.sha1 || undefined,
        size: native.size || undefined,
        retries: 3
      })
    }
  }
}

async function ensureArtifact(artifact: LibraryArtifact, destination: string, force = false): Promise<void> {
  if (!force && (await existsWithSize(destination, artifact.size || undefined))) {
    if (!artifact.sha1) return
    const { sha1File } = await import('../util/hash')
    if ((await sha1File(destination)) === artifact.sha1) return
  }
  await downloadFile(artifact.url, destination, {
    sha1: artifact.sha1 || undefined,
    size: artifact.size || undefined,
    retries: 4
  })
}

export function assetObjectPath(hash: string): string {
  return path.join(paths.assetsObjects, hash.slice(0, 2), hash)
}

export async function findRootVersion(versionId: string): Promise<string> {
  let current = await getVersionJson(versionId)
  let depth = 0
  while (current.inheritsFrom && depth < 12) {
    current = await getVersionJson(current.inheritsFrom)
    depth += 1
  }
  return current.id
}

export async function clientJarPath(versionId: string): Promise<string> {
  const top = await getVersionJson(versionId)
  if (top.downloads?.client) return paths.versionJar(versionId)
  const base = await findRootVersion(versionId)
  return paths.versionJar(base)
}

export async function assetRootFor(version: VersionJson): Promise<string> {
  if (!version.assetIndex) return paths.assets
  const indexFile = path.join(paths.assetsIndexes, `${version.assetIndex.id}.json`)
  if (await pathExists(indexFile)) {
    try {
      const index = JSON.parse(await fs.readFile(indexFile, 'utf8')) as AssetIndex
      if (index.virtual) return path.join(paths.assets, 'virtual', version.assetIndex.id)
    } catch {
      // Fall through to the normal asset root.
    }
  }
  return paths.assets
}

export async function missingGameFiles(versionId: string): Promise<boolean> {
  const version = await resolveVersion(versionId)
  const jar = await clientJarPath(versionId)
  if (!(await pathExists(jar))) return true
  if (version.assetIndex) {
    const indexFile = path.join(paths.assetsIndexes, `${version.assetIndex.id}.json`)
    if (!(await pathExists(indexFile))) return true
  }
  return false
}

function makeReporter(onProgress: InstallOptions['onProgress']) {
  return (
    stage: Omit<InstallProgress, 'taskId'>['stage'],
    message: string,
    current: number,
    total: number,
    detail?: string,
    percent?: number
  ): void => {
    if (!onProgress) return
    const computed = percent ?? (total > 0 ? (current / total) * 100 : 0)
    onProgress({
      stage,
      message,
      current,
      total,
      percent: Math.max(0, Math.min(100, computed)),
      detail
    } as Omit<InstallProgress, 'taskId'>)
  }
}

export function addonCacheEntry(sha1: string, filename: string): string {
  return paths.addonCacheEntry(sha1, filename)
}

export async function cacheFileFromUrl(
  url: string,
  sha1: string | undefined,
  filename: string,
  onProgress?: (received: number, total: number) => void
): Promise<string> {
  const destination = sha1
    ? paths.addonCacheEntry(sha1, filename)
    : path.join(paths.downloadsCache, filename)
  await downloadFile(url, destination, {
    sha1,
    onProgress: (received, total) => onProgress?.(received, total),
    retries: 4
  })
  return destination
}

export async function copyIntoInstance(source: string, target: string): Promise<void> {
  await ensureDir(path.dirname(target))
  await fs.copyFile(source, target)
}

export function contentPathForType(type: string, filename: string): string {
  switch (type) {
    case 'resourcepack':
      return path.join('resourcepacks', filename)
    case 'shader':
      return path.join('shaderpacks', filename)
    case 'datapack':
      return path.join('datapacks', filename)
    default:
      return path.join('mods', filename)
  }
}

export async function fetchAssetIndex(version: VersionJson): Promise<AssetIndex | null> {
  if (!version.assetIndex) return null
  const indexFile = path.join(paths.assetsIndexes, `${version.assetIndex.id}.json`)
  try {
    return JSON.parse(await fs.readFile(indexFile, 'utf8')) as AssetIndex
  } catch {
    const fetched = await fetchJson<AssetIndex>(version.assetIndex.url, {}, { timeoutMs: 60_000 })
    await ensureDir(path.dirname(indexFile))
    await fs.writeFile(indexFile, JSON.stringify(fetched), 'utf8')
    return fetched
  }
}
