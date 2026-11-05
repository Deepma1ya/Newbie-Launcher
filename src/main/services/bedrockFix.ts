import path from 'node:path'
import os from 'node:os'
import { constants as fsConstants, existsSync, promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import type {
  BedrockFixFailure,
  BedrockFixFile,
  BedrockFixManifestEntry,
  BedrockFixResult,
  BedrockInstallation
} from '@shared/types'
import { BEDROCK_FIX_FOLDER_NAME, isFixFilePending, isIgnoredFixEntry, normalizeFixRelativePath } from '@shared/bedrockFix'
import { paths } from './paths'
import { ensureDir, readJson, writeJsonAtomic } from '../util/fs'
import { logger } from '../util/log'

const execFileAsync = promisify(execFile)
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
)

interface FixManifest {
  updatedAt: string
  target: string
  packageFullName: string
  entries: Record<string, BedrockFixManifestEntry>
}

interface ElevatedCopyResult {
  copied: string[]
  failures: BedrockFixFailure[]
  cancelled?: boolean
}

function bedrockRoot(): string {
  return path.join(paths.data, 'bedrock')
}

function manifestFile(): string {
  return path.join(bedrockRoot(), 'fix-manifest.json')
}

/**
 * The fix folder ships inside the launcher resources and is replaced by the
 * installer or auto-update. Development builds read it from the repository.
 */
export function bedrockFixFolder(): string {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, BEDROCK_FIX_FOLDER_NAME),
        path.join(path.dirname(app.getPath('exe')), 'resources', BEDROCK_FIX_FOLDER_NAME)
      ]
    : [
        path.join(app.getAppPath(), BEDROCK_FIX_FOLDER_NAME),
        path.join(process.resourcesPath, BEDROCK_FIX_FOLDER_NAME)
      ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return path.resolve(candidate)
  }
  return path.resolve(candidates[0]!)
}

function sameTarget(manifest: FixManifest | null, target: BedrockInstallation | undefined): boolean {
  if (!manifest || !target?.installLocation) return false
  return (
    manifest.target.toLowerCase() === target.installLocation.toLowerCase() &&
    manifest.packageFullName.toLowerCase() === target.packageFullName.toLowerCase()
  )
}

async function loadManifest(): Promise<FixManifest | null> {
  const value = await readJson<Partial<FixManifest> | null>(manifestFile(), null)
  if (!value || typeof value.target !== 'string' || typeof value.packageFullName !== 'string') return null
  return {
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    target: value.target,
    packageFullName: value.packageFullName,
    entries:
      value.entries && typeof value.entries === 'object' && !Array.isArray(value.entries)
        ? (value.entries as Record<string, BedrockFixManifestEntry>)
        : {}
  }
}

async function saveManifest(target: BedrockInstallation, entries: Record<string, BedrockFixManifestEntry>): Promise<void> {
  try {
    await writeJsonAtomic(manifestFile(), {
      updatedAt: new Date().toISOString(),
      target: target.installLocation,
      packageFullName: target.packageFullName,
      entries
    } satisfies FixManifest)
  } catch (error) {
    // A bookkeeping failure must not stop the game from starting.
    logger.warn('bedrock-fix', 'Could not save the Bedrock fix manifest', error)
  }
}

async function listFixFiles(root: string): Promise<BedrockFixFile[]> {
  const result: BedrockFixFile[] = []

  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      if (isIgnoredFixEntry(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.isFile()) continue
      const stat = await fs.stat(full).catch(() => null)
      if (!stat?.isFile()) continue
      const relative = normalizeFixRelativePath(path.relative(root, full))
      if (!relative) continue
      result.push({ path: relative, size: stat.size, mtimeMs: stat.mtimeMs })
    }
  }

  await walk(root)
  return result.sort((left, right) => left.path.localeCompare(right.path))
}

function destinationPath(root: string, relative: string): string {
  return path.join(root, ...relative.split('/'))
}

async function destinationSize(file: string): Promise<number | null | undefined> {
  try {
    const stat = await fs.stat(file)
    return stat.isFile() ? stat.size : null
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return null
    // Windows refused to inspect the package. Trust the manifest rather than
    // forcing an administrator prompt on every launch.
    return undefined
  }
}

async function copyWithNode(
  sourceRoot: string,
  targetRoot: string,
  files: BedrockFixFile[]
): Promise<ElevatedCopyResult> {
  const copied: string[] = []
  const failures: BedrockFixFailure[] = []
  for (const file of files) {
    const source = destinationPath(sourceRoot, file.path)
    const destination = destinationPath(targetRoot, file.path)
    try {
      await ensureDir(path.dirname(destination))
      await fs.copyFile(source, destination)
      const stat = await fs.stat(destination)
      if (stat.size !== file.size) throw new Error('The copied file size does not match.')
      copied.push(file.path)
    } catch (error) {
      failures.push({
        path: file.path,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return { copied, failures }
}

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''")
}

function cleanPowerShellError(stdout: string, stderr: string): string {
  const text = `${stderr}\n${stdout}`
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const meaningful = text.filter(
    (line) =>
      !line.startsWith('+') &&
      !line.startsWith('At line:') &&
      !line.startsWith('CategoryInfo') &&
      !line.startsWith('FullyQualifiedErrorId') &&
      !line.startsWith('PSMessageDetails')
  )
  return (meaningful.slice(-4).join(' ') || text.slice(-4).join(' ') || 'Windows reported an unknown error.').slice(
    0,
    700
  )
}

async function runPowerShell(
  script: string,
  timeout: number
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout }
    )
    return { code: 0, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') }
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string; message?: string }
    return {
      code: typeof failure.code === 'number' ? failure.code : 1,
      stdout: String(failure.stdout ?? ''),
      stderr: String(failure.stderr ?? failure.message ?? '')
    }
  }
}

function fixWorkDir(): string {
  const publicDir = process.env.PUBLIC || path.join(os.homedir(), 'Public')
  return path.join(publicDir, 'NewbieLauncher', 'bedrock-fix')
}

async function copyElevated(
  sourceRoot: string,
  targetRoot: string,
  files: BedrockFixFile[]
): Promise<ElevatedCopyResult> {
  let workDir = fixWorkDir()
  try {
    await ensureDir(workDir)
  } catch {
    workDir = bedrockRoot()
    await ensureDir(workDir)
  }

  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const payloadPath = path.join(workDir, `fix-payload-${nonce}.json`)
  const scriptPath = path.join(workDir, `fix-copy-${nonce}.ps1`)
  const resultPath = path.join(workDir, `fix-result-${nonce}.json`)

  const script = `
$ErrorActionPreference = 'Stop'
$payload = Get-Content -LiteralPath '${escapePowerShell(payloadPath)}' -Raw -Encoding UTF8 | ConvertFrom-Json
$source = [string]$payload.source
$dest = [string]$payload.dest
$items = @($payload.files)
$copied = @()
$failed = @()

function Grant-AdminAccess([string]$targetPath) {
  try {
    if (-not (Test-Path -LiteralPath $targetPath)) { return }
    & "$env:SystemRoot\\System32\\takeown.exe" /F $targetPath /A 2>$null | Out-Null
    & "$env:SystemRoot\\System32\\icacls.exe" $targetPath /grant '*S-1-5-32-544:F' 2>$null | Out-Null
  } catch {}
}

function Ensure-Directory([string]$dir) {
  if (Test-Path -LiteralPath $dir) { return }
  try {
    New-Item -ItemType Directory -Force -Path $dir -ErrorAction Stop | Out-Null
  } catch {
    $ancestor = Split-Path -Parent $dir
    while ($ancestor -and -not (Test-Path -LiteralPath $ancestor)) { $ancestor = Split-Path -Parent $ancestor }
    if ($ancestor) { Grant-AdminAccess $ancestor }
    New-Item -ItemType Directory -Force -Path $dir -ErrorAction Stop | Out-Null
  }
}

foreach ($rel in $items) {
  $src = Join-Path $source $rel
  $dst = Join-Path $dest $rel
  try {
    if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { throw 'The source file no longer exists.' }
    $parent = Split-Path -Parent $dst
    Ensure-Directory $parent
    try {
      Copy-Item -LiteralPath $src -Destination $dst -Force -ErrorAction Stop
    } catch {
      if (Test-Path -LiteralPath $dst) {
        try { (Get-Item -LiteralPath $dst -Force).IsReadOnly = $false } catch {}
        Grant-AdminAccess $dst
      } else {
        Grant-AdminAccess $parent
      }
      Copy-Item -LiteralPath $src -Destination $dst -Force -ErrorAction Stop
    }
    $sourceLength = (Get-Item -LiteralPath $src -Force).Length
    $targetLength = (Get-Item -LiteralPath $dst -Force).Length
    if ($sourceLength -ne $targetLength) { throw 'The copied file size does not match.' }
    $copied += $rel
  } catch {
    $failed += [pscustomobject]@{ path = $rel; error = $_.Exception.Message }
  }
}

[pscustomobject]@{ copied = @($copied); failed = @($failed) } | ConvertTo-Json -Compress -Depth 4 |
  ForEach-Object { [System.IO.File]::WriteAllText('${escapePowerShell(resultPath)}', $_, (New-Object System.Text.UTF8Encoding($false))) }
`

  try {
    await writeJsonAtomic(payloadPath, {
      source: sourceRoot,
      dest: targetRoot,
      files: files.map((file) => file.path.replace(/\//g, '\\'))
    })
    await fs.writeFile(scriptPath, `\uFEFF${script}`, 'utf8')
    await fs.rm(resultPath, { force: true })

    const runner = `
$ErrorActionPreference = 'Stop'
$process = Start-Process -FilePath '${escapePowerShell(POWERSHELL)}' -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', '${escapePowerShell(scriptPath)}') -Verb RunAs -WindowStyle Hidden -PassThru -Wait
exit $process.ExitCode
`
    const run = await runPowerShell(runner, 10 * 60 * 1000)
    const result = await readJson<{
      copied?: unknown
      failed?: unknown
    } | null>(resultPath, null)

    if (!result) {
      const output = `${run.stdout}\n${run.stderr}`.trim()
      if (/cancel|1223|operation was canceled/i.test(output)) {
        logger.info('bedrock-fix', 'The administrator prompt for copying fix files was cancelled')
        return { copied: [], failures: [], cancelled: true }
      }
      throw new Error(cleanPowerShellError(run.stdout, run.stderr))
    }

    const copied = Array.isArray(result.copied)
      ? result.copied.filter((entry): entry is string => typeof entry === 'string')
      : []
    const failures = (Array.isArray(result.failed) ? result.failed : []).filter(
      (entry): entry is { path: string; error?: string } =>
        Boolean(entry) && typeof entry === 'object' && typeof (entry as { path?: unknown }).path === 'string'
    )
    return {
      copied,
      failures: failures.map((entry) => ({
        path: entry.path,
        error: entry.error ?? 'Windows could not copy this file.'
      }))
    }
  } catch (error) {
    if (error instanceof Error && /cancel|1223|operation was canceled/i.test(error.message)) {
      return { copied: [], failures: [], cancelled: true }
    }
    throw error
  } finally {
    await fs.rm(payloadPath, { force: true }).catch(() => undefined)
    await fs.rm(scriptPath, { force: true }).catch(() => undefined)
    await fs.rm(resultPath, { force: true }).catch(() => undefined)
  }
}

/**
 * Copies every new or changed file from the fix folder into the installed
 * Bedrock package. Nothing is copied when the manifest already matches.
 */
export async function applyBedrockFix(target: BedrockInstallation): Promise<BedrockFixResult> {
  const folder = bedrockFixFolder()
  const result: BedrockFixResult = {
    folder,
    target: target.installLocation,
    copied: 0,
    skipped: 0,
    pending: 0,
    files: [],
    failures: []
  }

  const folderStat = await fs.stat(folder).catch(() => null)
  if (!folderStat?.isDirectory()) return result
  if (!target.installLocation) {
    throw new Error('Windows did not report where Minecraft is installed. Repair or reinstall the Bedrock package.')
  }

  const sourceRoot = path.resolve(folder).toLowerCase()
  const targetRoot = path.resolve(target.installLocation).toLowerCase()
  if (
    sourceRoot === targetRoot ||
    sourceRoot.startsWith(`${targetRoot}${path.sep}`) ||
    targetRoot.startsWith(`${sourceRoot}${path.sep}`)
  ) {
    throw new Error(
      'The Bedrock fix folder cannot be the Minecraft package folder, or a folder that contains it. Choose a separate folder.'
    )
  }

  const files = await listFixFiles(folder)
  result.files = files.map((file) => file.path)
  if (files.length === 0) return result

  const manifest = await loadManifest()
  const synced = sameTarget(manifest, target)
  const previousEntries = synced ? (manifest?.entries ?? {}) : {}
  const pending: BedrockFixFile[] = []
  for (const file of files) {
    const existing = await destinationSize(destinationPath(target.installLocation, file.path))
    if (isFixFilePending(file, previousEntries[file.path], existing)) pending.push(file)
  }
  result.pending = pending.length
  result.skipped = files.length - pending.length
  if (pending.length === 0) return result

  const writable = await fs
    .access(target.installLocation, fsConstants.W_OK)
    .then(() => true)
    .catch(() => false)
  const copy = writable
    ? await copyWithNode(folder, target.installLocation, pending)
    : await copyElevated(folder, target.installLocation, pending)

  result.copied = copy.copied.length
  result.failures = copy.failures
  result.cancelled = copy.cancelled
  if (copy.cancelled) return result

  const copiedPaths = new Set(copy.copied)
  const entries: Record<string, BedrockFixManifestEntry> = {}
  for (const file of files) {
    if (copiedPaths.has(file.path) || !pending.some((item) => item.path === file.path)) {
      entries[file.path] = { size: file.size, mtimeMs: file.mtimeMs }
    }
  }
  await saveManifest(target, entries)
  logger.info(
    'bedrock-fix',
    `Copied ${result.copied} of ${pending.length} fix file(s) into ${target.packageFullName}`
  )
  return result
}
