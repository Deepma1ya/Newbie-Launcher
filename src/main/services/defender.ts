import path from 'node:path'
import os from 'node:os'
import { existsSync, promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { DefenderExclusionsState } from '@shared/types'
import { paths } from './paths'
import { readJson } from '../util/fs'
import { logger } from '../util/log'

const execFileAsync = promisify(execFile)
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
)

interface DefenderStamp {
  appliedAt?: string
  paths?: string[]
}

interface HelperResult {
  ok?: boolean
  cancelled?: boolean
  error?: string
  paths?: unknown
}

function stampFile(): string {
  return path.join(paths.data, 'defender-exclusions.json')
}

/** The helper ships as an extra resource so the installer and the app share it. */
function helperScript(): string | null {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'defender-exclusions.ps1'),
        path.join(path.dirname(app.getPath('exe')), 'resources', 'defender-exclusions.ps1')
      ]
    : [
        path.join(app.getAppPath(), 'resources', 'defender-exclusions.ps1'),
        path.join(process.resourcesPath, 'defender-exclusions.ps1')
      ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return path.resolve(candidate)
  }
  return null
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

function uniquePaths(values: string[]): string[] {
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (result.some((entry) => samePath(entry, trimmed))) continue
    result.push(trimmed)
  }
  return result
}

/**
 * Folders that should not be scanned: the installed app, the launcher data
 * folder (downloads, caches, instances, runtimes) and the updater cache where
 * electron-updater stages the next installer.
 */
export function defenderTargets(): string[] {
  const targets: string[] = []
  if (app.isPackaged) targets.push(path.dirname(app.getPath('exe')))
  targets.push(paths.data)
  const localAppData =
    process.env.LOCALAPPDATA?.trim() || path.join(os.homedir(), 'AppData', 'Local')
  targets.push(path.join(localAppData, app.getName()))
  return uniquePaths(targets)
}

export async function defenderState(): Promise<DefenderExclusionsState> {
  const targets = defenderTargets()
  const stamp = await readJson<DefenderStamp | null>(stampFile(), null)
  const stamped = Array.isArray(stamp?.paths)
    ? stamp.paths.filter((entry): entry is string => typeof entry === 'string')
    : []
  return {
    supported: process.platform === 'win32' && helperScript() !== null,
    applied: stamped.length > 0 && targets.every((target) => stamped.some((entry) => samePath(entry, target))),
    appliedAt: typeof stamp?.appliedAt === 'string' ? stamp.appliedAt : null,
    paths: targets,
    installDir: app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath(),
    dataDir: paths.data
  }
}

async function runHelper(mode: 'add' | 'remove', targets: string[]): Promise<void> {
  const script = helperScript()
  if (!script) throw new Error('The Windows Defender helper is missing from this build.')
  const resultFile = path.join(app.getPath('temp'), `newbie-defender-${process.pid}-${Date.now()}.json`)
  let failure: unknown = null
  try {
    await execFileAsync(
      POWERSHELL,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-Mode',
        mode,
        '-Paths',
        targets.join('|'),
        '-Stamp',
        mode === 'add' ? stampFile() : '',
        '-Result',
        resultFile
      ],
      { windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 }
    )
  } catch (error) {
    // Non-zero exits still leave a result file with the reason.
    failure = error
  }

  const result = await readJson<HelperResult | null>(resultFile, null)
  await fs.rm(resultFile, { force: true }).catch(() => undefined)

  if (!result) {
    const detail = failure instanceof Error ? failure.message : String(failure ?? '')
    throw new Error(
      detail
        ? `Windows Defender did not run: ${detail}`
        : 'Windows Defender did not report a result. Administrator approval may have been cancelled.'
    )
  }
  if (!result.ok) {
    if (result.cancelled) {
      throw new Error('Administrator approval was cancelled, so Windows Defender was not changed.')
    }
    throw new Error(result.error?.trim() || 'Windows Defender rejected the change.')
  }
}

export async function applyDefenderExclusions(): Promise<DefenderExclusionsState> {
  if (process.platform !== 'win32') {
    throw new Error('Windows Defender exclusions are only available on Windows.')
  }
  const targets = defenderTargets()
  await runHelper('add', targets)
  logger.info('defender', `Added Defender exclusions for ${targets.join(', ')}`)
  return defenderState()
}

export async function removeDefenderExclusions(): Promise<DefenderExclusionsState> {
  if (process.platform !== 'win32') {
    throw new Error('Windows Defender exclusions are only available on Windows.')
  }
  const stamp = await readJson<DefenderStamp | null>(stampFile(), null)
  const stamped = Array.isArray(stamp?.paths)
    ? stamp.paths.filter((entry): entry is string => typeof entry === 'string')
    : []
  const targets = uniquePaths([...stamped, ...defenderTargets()])
  await runHelper('remove', targets)
  await fs.rm(stampFile(), { force: true }).catch(() => undefined)
  logger.info('defender', 'Removed the Windows Defender exclusions added by the launcher')
  return defenderState()
}
