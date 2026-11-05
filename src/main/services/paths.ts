import { app } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { ensureDir, readJson, writeJsonAtomic } from '../util/fs'
import { logger } from '../util/log'

interface BootstrapConfig {
  dataDir: string
}

let bootstrapPath = ''
let currentDataDir = ''

export function defaultDataDir(): string {
  const override = process.env.NEWBIE_DATA_DIR?.trim()
  return override ? path.resolve(override) : path.join(app.getPath('appData'), 'NewbieLauncher')
}

export async function initPaths(): Promise<string> {
  bootstrapPath = path.join(app.getPath('userData'), 'bootstrap.json')
  const existing = await readJson<BootstrapConfig | null>(bootstrapPath, null)
  currentDataDir = existing?.dataDir?.trim() || defaultDataDir()
  await ensureLayout(currentDataDir)
  if (!existing) {
    await writeJsonAtomic(bootstrapPath, { dataDir: currentDataDir } satisfies BootstrapConfig)
  }
  logger.setDataDir(currentDataDir)
  logger.info('paths', `Data directory: ${currentDataDir}`)
  return currentDataDir
}

export async function setDataDir(dir: string): Promise<string> {
  const resolved = path.resolve(dir)
  await ensureLayout(resolved)
  currentDataDir = resolved
  await writeJsonAtomic(bootstrapPath, { dataDir: currentDataDir } satisfies BootstrapConfig)
  logger.setDataDir(currentDataDir)
  logger.info('paths', `Data directory changed to: ${currentDataDir}`)
  return currentDataDir
}

export function dataDir(): string {
  if (!currentDataDir) throw new Error('Data directory has not been initialised')
  return currentDataDir
}

export const paths = {
  get data() {
    return dataDir()
  },
  get launcherFile() {
    return path.join(dataDir(), 'launcher.json')
  },
  get secretsFile() {
    return path.join(dataDir(), 'secrets.json')
  },
  get versions() {
    return path.join(dataDir(), 'versions')
  },
  get libraries() {
    return path.join(dataDir(), 'libraries')
  },
  get assets() {
    return path.join(dataDir(), 'assets')
  },
  get assetsObjects() {
    return path.join(dataDir(), 'assets', 'objects')
  },
  get assetsIndexes() {
    return path.join(dataDir(), 'assets', 'indexes')
  },
  get runtimes() {
    return path.join(dataDir(), 'runtimes')
  },
  get meta() {
    return path.join(dataDir(), 'meta')
  },
  get instances() {
    return path.join(dataDir(), 'instances')
  },
  get cache() {
    return path.join(dataDir(), 'cache')
  },
  get addonCache() {
    return path.join(dataDir(), 'cache', 'addons')
  },
  get downloadsCache() {
    return path.join(dataDir(), 'cache', 'downloads')
  },
  get backups() {
    return path.join(dataDir(), 'backups')
  },
  get worldBackups() {
    return path.join(dataDir(), 'backups', 'worlds')
  },
  get repairBackups() {
    return path.join(dataDir(), 'backups', 'repairs')
  },
  get modpackBackups() {
    return path.join(dataDir(), 'backups', 'modpacks')
  },
  get logs() {
    return path.join(dataDir(), 'logs')
  },
  get natives() {
    return path.join(dataDir(), 'natives')
  },
  instance(id: string) {
    return path.join(dataDir(), 'instances', id)
  },
  instanceGameDir(id: string) {
    return path.join(dataDir(), 'instances', id, 'minecraft')
  },
  instanceMeta(id: string) {
    return path.join(dataDir(), 'instances', id, 'instance.json')
  },
  instanceNatives(id: string) {
    return path.join(dataDir(), 'instances', id, 'natives')
  },
  instanceLogs(id: string) {
    return path.join(dataDir(), 'instances', id, 'logs')
  },
  addonCacheEntry(sha1: string, filename: string) {
    return path.join(dataDir(), 'cache', 'addons', sha1, filename)
  },
  versionJson(versionId: string) {
    return path.join(dataDir(), 'versions', versionId, `${versionId}.json`)
  },
  versionJar(versionId: string) {
    return path.join(dataDir(), 'versions', versionId, `${versionId}.jar`)
  }
}

export async function ensureLayout(dir: string): Promise<void> {
  await Promise.all([
    ensureDir(dir),
    ensureDir(path.join(dir, 'versions')),
    ensureDir(path.join(dir, 'libraries')),
    ensureDir(path.join(dir, 'assets', 'objects')),
    ensureDir(path.join(dir, 'assets', 'indexes')),
    ensureDir(path.join(dir, 'runtimes')),
    ensureDir(path.join(dir, 'meta')),
    ensureDir(path.join(dir, 'instances')),
    ensureDir(path.join(dir, 'cache', 'addons')),
    ensureDir(path.join(dir, 'cache', 'downloads')),
    ensureDir(path.join(dir, 'backups', 'worlds')),
    ensureDir(path.join(dir, 'backups', 'repairs')),
    ensureDir(path.join(dir, 'backups', 'modpacks')),
    ensureDir(path.join(dir, 'logs'))
  ])
}

export async function freeSpaceMb(target: string): Promise<number> {
  try {
    const stats = await fs.statfs(target)
    return Math.round((stats.bavail * stats.bsize) / 1024 / 1024)
  } catch {
    return 0
  }
}
