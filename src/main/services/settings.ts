import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { LauncherSettings } from '@shared/types'
import type { DeepPartial } from '@shared/ipc'
import { isPerformanceProfile } from '@shared/performance'
import { store } from './store'
import { ensureLayout, paths, setDataDir } from './paths'
import { directorySize, pathExists } from '../util/fs'
import { logger } from '../util/log'
import { runningStates } from './launch'
import { applyPerformanceProfileToInstances } from './perf'
import { assertBedrockDataDirMovable } from './bedrockInstances'

export function getSettings(): LauncherSettings {
  return store.settings()
}

export async function updateSettings(patch: DeepPartial<LauncherSettings>): Promise<LauncherSettings> {
  const sanitized = { ...patch } as DeepPartial<LauncherSettings>
  delete (sanitized as { dataDir?: string }).dataDir
  if (sanitized.downloadConcurrency !== undefined) {
    sanitized.downloadConcurrency = Math.max(1, Math.min(16, Math.round(Number(sanitized.downloadConcurrency) || 6)))
  }
  if (sanitized.java?.defaultMemoryMb !== undefined) {
    sanitized.java.defaultMemoryMb = Math.max(1024, Math.min(65536, Math.round(Number(sanitized.java.defaultMemoryMb))))
  }
  const next = await store.updateSettings(sanitized)
  // Picking a preset (or turning auto-apply on) writes it once. Launches never
  // overwrite Minecraft's own settings: a changed options.txt flips the preset
  // to Custom instead.
  const performancePatch = sanitized.performance
  const requestedPreset =
    performancePatch?.profile !== undefined || performancePatch?.autoApply === true
  if (next.performance.autoApply && requestedPreset && isPerformanceProfile(next.performance.profile)) {
    await applyPerformanceProfileToInstances(next.performance.profile).catch((error) => {
      logger.warn('settings', 'Could not apply the performance preset', error)
    })
  }
  return next
}

export async function changeDataDir(target: string): Promise<LauncherSettings> {
  const resolved = path.resolve(target)
  const current = path.resolve(paths.data)
  if (resolved.toLowerCase() === current.toLowerCase()) return store.settings()
  if (resolved.length < 4 || /^[a-zA-Z]:\\?$/.test(resolved)) {
    throw new Error('Choose a dedicated folder, not a drive root.')
  }
  if (resolved.startsWith(current + path.sep)) {
    throw new Error('The new folder cannot be inside the current launcher data folder.')
  }
  if (runningStates().length > 0) {
    throw new Error('Close Minecraft before moving the launcher data folder.')
  }
  await assertBedrockDataDirMovable()
  const existing = await fs.readdir(resolved).catch(() => [])
  const allowedBootstrap = existing.filter((entry) => entry !== 'bootstrap.json' && entry !== 'logs')
  if (allowedBootstrap.length > 0) {
    throw new Error('That folder is not empty. Choose an empty folder so existing game files are not overwritten.')
  }
  await ensureLayout(resolved)
  const oldDir = paths.data
  const size = await directorySize(oldDir)
  const stat = await fs.statfs(resolved)
  const free = stat.bavail * stat.bsize
  if (free < size + 256 * 1024 * 1024) {
    throw new Error('The selected folder does not have enough free space for the current launcher data.')
  }

  const entries = [
    'launcher.json',
    'secrets.json',
    'versions',
    'libraries',
    'assets',
    'runtimes',
    'meta',
    'instances',
    'cache',
    'backups'
  ]
  for (const entry of entries) {
    const source = path.join(oldDir, entry)
    if (!(await pathExists(source))) continue
    await fs.cp(source, path.join(resolved, entry), { recursive: true, force: false, errorOnExist: false })
  }

  await setDataDir(resolved)
  store.relocate(oldDir, resolved)
  await store.flush()
  logger.info('settings', `Data directory moved to ${resolved}. The previous copy remains at ${oldDir}.`)
  return store.settings()
}

export async function revealDataDir(): Promise<string> {
  return paths.data
}

