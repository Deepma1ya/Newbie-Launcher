import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import type { GpuApplyResult, Instance, PerformanceProfile, SystemInfo } from '@shared/types'
import { detectJavaRuntimes } from './java'
import { directorySize, ensureDir, pathExists } from '../util/fs'
import { paths, freeSpaceMb } from './paths'
import { store } from './store'
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

export const PERFORMANCE_PRESETS: Record<
  PerformanceProfile,
  Record<string, string>
> = {
  balanced: {
    renderDistance: '12',
    simulationDistance: '10',
    maxFps: '120',
    enableVsync: 'true',
    graphicsMode: '1',
    ao: 'true',
    entityShadows: 'true',
    particles: '1',
    mipmapLevels: '4'
  },
  performance: {
    renderDistance: '8',
    simulationDistance: '6',
    maxFps: '144',
    enableVsync: 'false',
    graphicsMode: '0',
    ao: 'false',
    entityShadows: 'false',
    particles: '2',
    mipmapLevels: '2'
  },
  quality: {
    renderDistance: '16',
    simulationDistance: '12',
    maxFps: '0',
    enableVsync: 'true',
    graphicsMode: '2',
    ao: 'true',
    entityShadows: 'true',
    particles: '0',
    mipmapLevels: '4'
  }
}

export async function applyPerformanceProfile(instance: Instance, profile?: PerformanceProfile): Promise<void> {
  const chosen = profile ?? store.settings().performance.profile
  const preset = PERFORMANCE_PRESETS[chosen] ?? PERFORMANCE_PRESETS.balanced
  const file = path.join(instance.gameDir, 'options.txt')
  const backup = `${file}.newbie.bak`
  await ensureDir(instance.gameDir)
  if ((await pathExists(file)) && !(await pathExists(backup))) {
    await fs.copyFile(file, backup).catch(() => undefined)
  }
  let lines: string[] = []
  try {
    lines = (await fs.readFile(file, 'utf8')).split(/\r?\n/)
  } catch {
    lines = []
  }
  const map = new Map<string, string>()
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf(':')
    if (index > 0) map.set(line.slice(0, index), line.slice(index + 1))
  }
  for (const [key, value] of Object.entries(preset)) map.set(key, value)
  const output = [...map.entries()].map(([key, value]) => `${key}:${value}`).join('\n') + '\n'
  await fs.writeFile(file, output, 'utf8')
  logger.info('perf', `Applied ${chosen} performance profile to ${instance.name}`)
}

export async function prepareInstancePerformance(instance: Instance): Promise<void> {
  const settings = store.settings()
  if (!settings.performance.autoApply) return
  await applyPerformanceProfile(instance)
  await applyGpuPreference(instance)
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
