import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import type { GpuApplyResult, Instance, PerformanceProfile, SystemInfo } from '@shared/types'
import {
  applyPresetToOptions,
  compareOptionsToPreset,
  isPerformanceProfile,
  type OptionsPresetState
} from '@shared/performance'
import { detectJavaRuntimes } from './java'
import { directorySize, ensureDir, pathExists } from '../util/fs'
import { paths, freeSpaceMb } from './paths'
import { store } from './store'
import { emit } from './events'
import { logger } from '../util/log'

const execFileAsync = promisify(execFile)

export async function detectGpus(): Promise<string[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name'
      ],
      { timeout: 10_000, windowsHide: true }
    )
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch (error) {
    logger.warn('perf', 'GPU detection failed', error)
    return []
  }
}

export async function systemInfo(): Promise<SystemInfo> {
  const cpus = os.cpus()
  const java = await detectJavaRuntimes()
  return {
    platform: process.platform,
    arch: process.arch,
    totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
    freeMemMb: Math.round(os.freemem() / 1024 / 1024),
    cpuModel: cpus[0]?.model ?? 'Unknown CPU',
    cpuCores: cpus.length,
    gpus: await detectGpus(),
    dataDir: paths.data,
    dataDirFreeMb: await freeSpaceMb(paths.data),
    javaRuntimes: java,
    appVersion: ''
  }
}

export async function applyGpuPreference(instance?: Instance): Promise<GpuApplyResult> {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'GPU preference is only applicable on Windows.' }
  }
  const settings = store.settings()
  const javaPath =
    instance?.javaPath ??
    settings.java.manualPath ??
    (await detectJavaRuntimes())[0]?.path ??
    null
  if (!javaPath) return { ok: false, message: 'No Java runtime was found to register.' }

  try {
    if (settings.performance.gpuPreference === 'default') {
      await execFileAsync('reg.exe', [
        'delete',
        'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences',
        '/v',
        javaPath,
        '/f'
      ]).catch(() => undefined)
      return {
        ok: true,
        message: 'Windows is using its default GPU choice for Minecraft.',
        javaPath
      }
    }
    await execFileAsync('reg.exe', [
      'add',
      'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences',
      '/v',
      javaPath,
      '/t',
      'REG_SZ',
      '/d',
      'GpuPreference=2;',
      '/f'
    ])
    logger.info('perf', `Registered high-performance GPU preference for ${javaPath}`)
    return {
      ok: true,
      message: 'Windows will launch Minecraft on the high-performance GPU.',
      javaPath
    }
  } catch (error) {
    logger.warn('perf', 'Could not write GPU preference', error)
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not update the Windows GPU preference.',
      javaPath
    }
  }
}

export async function applyPerformanceProfile(
  instance: Instance,
  profile: PerformanceProfile
): Promise<void> {
  const file = path.join(instance.gameDir, 'options.txt')
  const backup = `${file}.newbie.bak`
  await ensureDir(instance.gameDir)
  if ((await pathExists(file)) && !(await pathExists(backup))) {
    await fs.copyFile(file, backup).catch(() => undefined)
  }
  let raw = ''
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch {
    raw = ''
  }
  await fs.writeFile(file, applyPresetToOptions(raw, profile), 'utf8')
  logger.info('perf', `Applied ${profile} performance profile to ${instance.name}`)
}

/** Applies an explicitly chosen preset to every Java instance. */
export async function applyPerformanceProfileToInstances(profile: PerformanceProfile): Promise<void> {
  for (const instance of store.instances()) {
    await applyPerformanceProfile(instance, profile).catch((error) => {
      logger.warn('perf', `Could not apply the ${profile} profile to ${instance.name}`, error)
    })
  }
}

async function compareInstanceOptions(
  instance: Instance,
  profile: PerformanceProfile
): Promise<OptionsPresetState> {
  let raw = ''
  try {
    raw = await fs.readFile(path.join(instance.gameDir, 'options.txt'), 'utf8')
  } catch {
    return 'missing'
  }
  return compareOptionsToPreset(raw, profile)
}

async function markPerformanceProfileCustom(instanceName: string): Promise<void> {
  if (store.settings().performance.profile === 'custom') return
  await store.updateSettings({ performance: { profile: 'custom' } })
  logger.info('perf', `Performance preset switched to Custom because ${instanceName} changed Minecraft settings`)
  emit({
    type: 'toast',
    payload: {
      kind: 'info',
      title: 'Performance preset set to Custom',
      message: `Newbie found changed Minecraft settings for ${instanceName} and will not overwrite them again.`
    }
  })
}

/**
 * The preset is only written when it is new (picked in Settings) or when the
 * instance has no options.txt yet. If the file no longer matches the preset,
 * Minecraft's own settings win and the preset becomes Custom instead of being
 * forced back on every launch.
 */
export async function prepareInstancePerformance(instance: Instance): Promise<void> {
  const settings = store.settings()
  if (!settings.performance.autoApply) return
  const chosen = settings.performance.profile
  if (isPerformanceProfile(chosen)) {
    const state = await compareInstanceOptions(instance, chosen)
    if (state === 'custom') {
      await markPerformanceProfileCustom(instance.name)
    } else if (state === 'missing') {
      await applyPerformanceProfile(instance, chosen)
    }
  }
  await applyGpuPreference(instance)
}

/** Called after Minecraft exits, once it has written options.txt. */
export async function syncPerformancePreset(instanceId: string): Promise<void> {
  const settings = store.settings()
  if (!settings.performance.autoApply) return
  const chosen = settings.performance.profile
  if (!isPerformanceProfile(chosen)) return
  const instance = store.instance(instanceId)
  if (!instance) return
  if ((await compareInstanceOptions(instance, chosen)) === 'custom') {
    await markPerformanceProfileCustom(instance.name)
  }
}

export async function diskUsage(): Promise<{
  dataDirMb: number
  cacheMb: number
  instances: { id: string; name: string; mb: number }[]
}> {
  const instances = store.instances()
  const instanceUsage = await Promise.all(
    instances.map(async (instance) => ({
      id: instance.id,
      name: instance.name,
      mb: Math.round((await directorySize(paths.instance(instance.id))) / 1024 / 1024)
    }))
  )
  return {
    dataDirMb: Math.round((await directorySize(paths.data)) / 1024 / 1024),
    cacheMb: Math.round((await directorySize(paths.cache)) / 1024 / 1024),
    instances: instanceUsage
  }
}
