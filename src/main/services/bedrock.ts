import path from 'node:path'
import os from 'node:os'
import { shell } from 'electron'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { promisify } from 'node:util'
import type {
  BedrockChannel,
  BedrockExclusionResult,
  BedrockInstallation,
  BedrockProgress,
  BedrockSetup,
  BedrockState,
  BedrockVersion,
  BedrockWindowsAccount
} from '@shared/types'
import {
  BEDROCK_LINKS_URLS,
  USER_AGENT
} from '@shared/constants'
import {
  BEDROCK_PREVIEW_IDENTITY,
  BEDROCK_PUBLISHER_ID,
  BEDROCK_RELEASE_IDENTITY,
  isDefenderUnreadableExclusion,
  normalizeExclusionPath,
  parseBedrockCatalog,
  summarizeExclusion
} from '@shared/bedrock'
import { emit } from './events'
import { fetchJson } from './http'
import { paths, freeSpaceMb } from './paths'
import { ensureDir, pathExists, readJson, sanitizeFilename, writeJsonAtomic } from '../util/fs'
import { logger } from '../util/log'

const execFileAsync = promisify(execFile)
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
)
const CATALOG_MAX_AGE_MS = 6 * 60 * 60 * 1000
const DOWNLOAD_FREE_MB = 3000
const INSTALL_FREE_MB = 3000

interface CatalogCache {
  fetchedAt: string
  raw: unknown
}

interface CatalogResult {
  versions: BedrockVersion[]
  fetchedAt?: string
  error?: string
}

interface ExclusionMarker {
  addedAt: string
  paths: string[]
}

const activeDownloads = new Map<string, AbortController>()

function bedrockRoot(): string {
  return path.join(paths.data, 'bedrock')
}

function packagesDir(): string {
  return path.join(bedrockRoot(), 'packages')
}

function catalogFile(): string {
  return path.join(bedrockRoot(), 'catalog.json')
}

function exclusionMarkerFile(): string {
  return path.join(bedrockRoot(), 'defender-exclusion.json')
}

function packageFile(version: BedrockVersion): string {
  return path.join(packagesDir(), `${sanitizeFilename(version.id)}.msixvc`)
}

function localAppData(): string {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
}

function roamingAppData(): string {
  return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
}

function gameDataDirs(): string[] {
  return [
    path.join(localAppData(), 'Packages', `${BEDROCK_RELEASE_IDENTITY}_${BEDROCK_PUBLISHER_ID}`),
    path.join(localAppData(), 'Packages', `${BEDROCK_PREVIEW_IDENTITY}_${BEDROCK_PUBLISHER_ID}`),
    path.join(roamingAppData(), 'Minecraft Bedrock'),
    path.join(roamingAppData(), 'Minecraft Bedrock Preview')
  ]
}

/**
 * Every Bedrock install has its own WindowsApps package folder, so the
 * exclusion list has to be checked again after each version install.
 */
function requiredExclusionPaths(installations: BedrockInstallation[]): string[] {
  const candidates = [
    bedrockRoot(),
    ...gameDataDirs(),
    ...installations.map((entry) => entry.installLocation)
  ].filter(Boolean)
  const unique = new Map<string, string>()
  for (const entry of candidates) {
    const resolved = path.resolve(entry)
    unique.set(normalizeExclusionPath(resolved), resolved)
  }
  return [...unique.values()]
}

function emitProgress(payload: BedrockProgress): void {
  emit({ type: 'bedrock-progress', payload })
}

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''")
}

async function runPowerShell(script: string, timeout: number): Promise<{ code: number; stdout: string; stderr: string }> {
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

function cleanPowerShellError(result: { stdout: string; stderr: string }): string {
  const text = [result.stderr, result.stdout]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\r/g, '')
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.slice(-4).join(' ').slice(0, 700) || 'Windows reported an unknown error.'
}

export async function detectBedrockInstallations(): Promise<BedrockInstallation[]> {
  const script = `
$ErrorActionPreference = 'Stop'
$procPaths = @(Get-Process -Name Minecraft.Windows -ErrorAction SilentlyContinue | ForEach-Object {
  try { $_.Path } catch { $null }
} | Where-Object { $_ })
$names = @('${BEDROCK_RELEASE_IDENTITY}', '${BEDROCK_PREVIEW_IDENTITY}')
$items = @()
foreach ($name in $names) {
  $packages = @(Get-AppxPackage -Name $name -ErrorAction SilentlyContinue)
  foreach ($pkg in $packages) {
    try {
      $manifest = Get-AppxPackageManifest -Package $pkg.PackageFullName
      $apps = @($manifest.Package.Applications.Application)
      $app = $apps | Where-Object { $_.Id -eq 'Game' } | Select-Object -First 1
      if (-not $app) { $app = $apps | Select-Object -First 1 }
      $location = [string]$pkg.InstallLocation
      $running = [bool]($procPaths | Where-Object {
        $_.StartsWith($location, [System.StringComparison]::OrdinalIgnoreCase)
      })
      $channel = if ($pkg.Name -like '*WindowsBeta*') { 'preview' } else { 'release' }
      $items += [pscustomobject]@{
        channel = $channel
        packageFullName = $pkg.PackageFullName
        version = $pkg.Version.ToString()
        packageVersion = $pkg.Version.ToString()
        installLocation = $location
        familyName = $pkg.PackageFamilyName
        appId = if ($app) { [string]$app.Id } else { 'Game' }
        running = $running
      }
    } catch {}
  }
}
ConvertTo-Json -InputObject @($items) -Compress -Depth 4
`
  const result = await runPowerShell(script, 90_000)
  if (result.code !== 0) {
    throw new Error(`Could not inspect installed Bedrock packages. ${cleanPowerShellError(result)}`)
  }
  const raw = result.stdout.trim()
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  const list = Array.isArray(parsed) ? parsed : [parsed]
  return list
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => {
      const channel: BedrockChannel = entry.channel === 'preview' ? 'preview' : 'release'
      return {
        channel,
        packageFullName: String(entry.packageFullName ?? ''),
        version: String(entry.version ?? ''),
        packageVersion: String(entry.packageVersion ?? entry.version ?? ''),
        installLocation: String(entry.installLocation ?? ''),
        familyName: String(entry.familyName ?? ''),
        appId: String(entry.appId ?? 'Game'),
        running: Boolean(entry.running)
      }
    })
    .filter((entry) => entry.packageFullName && entry.familyName)
}

interface SetupBase {
  developerMode: boolean
  gamingServices: boolean
  windowsBuild: string
  defenderAvailable: boolean
  defenderTamperProtected: boolean
  defenderTamperExclusions: boolean
  exclusionPaths: string[]
}

async function detectSetup(): Promise<SetupBase> {
  const script = `
$dev = $false
try {
  $dev = ((Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock' -ErrorAction Stop).AllowDevelopmentWithoutDevLicense -eq 1)
} catch {}
$gaming = [bool](Get-AppxPackage -Name Microsoft.GamingServices -ErrorAction SilentlyContinue)
$build = [System.Environment]::OSVersion.Version.ToString()
$defenderAvailable = $false
$tamperProtected = $false
$tamperExclusions = $false
$exclusionPaths = @()
try {
  $null = Get-Command Get-MpPreference -ErrorAction Stop
  $preference = Get-MpPreference -ErrorAction Stop
  $defenderAvailable = $true
  $exclusionPaths = @($preference.ExclusionPath | Where-Object { $_ })
} catch {}
try { $tamperProtected = [bool](Get-MpComputerStatus).IsTamperProtected } catch {}
try { $tamperExclusions = ((Get-ItemPropertyValue -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows Defender\\Features' -Name TPExclusions -ErrorAction Stop) -eq 1) } catch {}
[pscustomobject]@{ developerMode = $dev; gamingServices = $gaming; windowsBuild = $build; defenderAvailable = $defenderAvailable; defenderTamperProtected = $tamperProtected; defenderTamperExclusions = $tamperExclusions; exclusionPaths = $exclusionPaths } | ConvertTo-Json -Compress -Depth 4
`
  const result = await runPowerShell(script, 60_000)
  if (result.code !== 0) {
    return {
      developerMode: false,
      gamingServices: false,
      windowsBuild: '',
      defenderAvailable: false,
      defenderTamperProtected: false,
      defenderTamperExclusions: false,
      exclusionPaths: []
    }
  }
  try {
    const parsed = JSON.parse(result.stdout.trim() || '{}') as Record<string, unknown>
    const detected = Array.isArray(parsed.exclusionPaths)
      ? parsed.exclusionPaths.filter((entry): entry is string => typeof entry === 'string')
      : []
    const unreadable = detected.some(isDefenderUnreadableExclusion)
    return {
      developerMode: Boolean(parsed.developerMode),
      gamingServices: Boolean(parsed.gamingServices),
      windowsBuild: String(parsed.windowsBuild ?? ''),
      defenderAvailable: Boolean(parsed.defenderAvailable) && !unreadable,
      defenderTamperProtected: Boolean(parsed.defenderTamperProtected),
      defenderTamperExclusions: Boolean(parsed.defenderTamperExclusions),
      exclusionPaths: unreadable ? [] : detected
    }
  } catch {
    return {
      developerMode: false,
      gamingServices: false,
      windowsBuild: '',
      defenderAvailable: false,
      defenderTamperProtected: false,
      defenderTamperExclusions: false,
      exclusionPaths: []
    }
  }
}

async function loadExclusionMarker(): Promise<ExclusionMarker | null> {
  return readJson<ExclusionMarker | null>(exclusionMarkerFile(), null)
}

async function getSetup(installations: BedrockInstallation[]): Promise<BedrockSetup> {
  const [base, marker] = await Promise.all([detectSetup(), loadExclusionMarker()])
  const required = requiredExclusionPaths(installations)
  const knownExclusions = base.defenderAvailable ? base.exclusionPaths : (marker?.paths ?? [])
  const summary = summarizeExclusion(required, knownExclusions)
  return {
    developerMode: base.developerMode,
    gamingServices: base.gamingServices,
    windowsBuild: base.windowsBuild,
    defenderExclusion: (base.defenderAvailable || marker) ? summary.state : 'unknown',
    defenderCheckedAt: base.defenderAvailable ? new Date().toISOString() : marker?.addedAt,
    defenderExcludedPaths: summary.excluded,
    defenderMissingPaths: summary.missing,
    defenderTamperProtected: base.defenderTamperProtected,
    defenderTamperExclusions: base.defenderTamperExclusions,
    dataDir: bedrockRoot(),
    gameDataDirs: gameDataDirs()
  }
}

async function loadCatalog(forceRefresh: boolean): Promise<CatalogResult> {
  const cached = await readJson<CatalogCache | null>(catalogFile(), null)
  const cacheAge = cached ? Date.now() - Date.parse(cached.fetchedAt) : Number.POSITIVE_INFINITY
  if (!forceRefresh && cached && Number.isFinite(cacheAge) && cacheAge < CATALOG_MAX_AGE_MS) {
    const versions = parseBedrockCatalog(cached.raw)
    if (versions.length > 0) return { versions, fetchedAt: cached.fetchedAt }
  }

  let lastError: unknown
  for (const url of BEDROCK_LINKS_URLS) {
    try {
      const raw = await fetchJson<unknown>(url, {}, { timeoutMs: 20_000, retries: 1 })
      const versions = parseBedrockCatalog(raw)
      if (versions.length === 0) throw new Error('The Bedrock catalog did not contain any full release packages.')
      const fetchedAt = new Date().toISOString()
      await writeJsonAtomic(catalogFile(), { fetchedAt, raw } satisfies CatalogCache)
      logger.info('bedrock', `Loaded ${versions.length} Bedrock versions from ${url}`)
      return { versions, fetchedAt }
    } catch (error) {
      lastError = error
      logger.warn('bedrock', `Could not load ${url}`, error)
    }
  }

  if (cached) {
    const versions = parseBedrockCatalog(cached.raw)
    if (versions.length > 0) {
      return {
        versions,
        fetchedAt: cached.fetchedAt,
        error: 'Could not refresh the Bedrock version list. Showing the cached list.'
      }
    }
  }
  throw new Error(
    lastError instanceof Error
      ? `Could not load the Bedrock version list. ${lastError.message}`
      : 'Could not load the Bedrock version list. Check your internet connection.'
  )
}

async function enrichVersions(
  versions: BedrockVersion[],
  installations: BedrockInstallation[]
): Promise<BedrockVersion[]> {
  const installed = new Set(
    installations.map((entry) => `${entry.channel}:${entry.packageVersion.toLowerCase()}`)
  )
  return Promise.all(
    versions.map(async (version) => {
      const file = packageFile(version)
      const part = `${file}.part`
      const [full, partial] = await Promise.all([
        fs.stat(file).catch(() => null),
        fs.stat(part).catch(() => null)
      ])
      return {
        ...version,
        downloaded: Boolean(full && full.isFile() && full.size > 0),
        partialBytes: partial && partial.isFile() && partial.size > 0 ? partial.size : undefined,
        installed: installed.has(`${version.channel}:${version.packageVersion.toLowerCase()}`)
      }
    })
  )
}

export async function getBedrockState(forceRefresh = false): Promise<BedrockState> {
  const [catalog, installations] = await Promise.all([
    loadCatalog(forceRefresh),
    detectBedrockInstallations()
  ])
  const setup = await getSetup(installations)
  return {
    setup,
    installations,
    versions: await enrichVersions(catalog.versions, installations),
    catalogUpdatedAt: catalog.fetchedAt,
    catalogError: catalog.error
  }
}

async function findVersion(id: string): Promise<BedrockVersion> {
  const catalog = await loadCatalog(false)
  const version = catalog.versions.find((entry) => entry.id.toLowerCase() === id.toLowerCase())
  if (!version) throw new Error('That Bedrock version is not in the catalog.')
  return version
}

export async function downloadBedrockVersion(id: string): Promise<void> {
  const version = await findVersion(id)
  const target = packageFile(version)
  const part = `${target}.part`

  const existing = await fs.stat(target).catch(() => null)
  if (existing && existing.isFile() && existing.size > 0) return
  if (activeDownloads.has(version.id)) throw new Error('That Bedrock download is already running.')

  const controller = new AbortController()
  activeDownloads.set(version.id, controller)
  const started = Date.now()
  try {
    await ensureDir(packagesDir())
    const free = await freeSpaceMb(packagesDir())
    if (free > 0 && free < DOWNLOAD_FREE_MB) {
      throw new Error(
        `The Bedrock download folder needs about ${DOWNLOAD_FREE_MB / 1024} GB free. Only ${Math.round(free / 1024)} GB is available.`
      )
    }

    emitProgress({
      id: version.id,
      version: version.version,
      stage: 'downloading',
      transferred: 0,
      total: 0,
      percent: 0,
      message: 'Starting download…'
    })

    let lastError: unknown
    for (const url of version.urls) {
      try {
        await downloadFromMirror(url, part, target, version, controller.signal, started)
        const finished = await fs.stat(target)
        emitProgress({
          id: version.id,
          version: version.version,
          stage: 'done',
          transferred: finished.size,
          total: finished.size,
          percent: 100,
          message: 'Download complete.'
        })
        logger.info('bedrock', `Downloaded ${version.id} (${finished.size} bytes)`)
        return
      } catch (error) {
        if (controller.signal.aborted) throw error
        lastError = error
        logger.warn('bedrock', `Bedrock mirror failed: ${url}`, error)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All Bedrock download mirrors failed.')
  } catch (error) {
    if (controller.signal.aborted) {
      emitProgress({
        id: version.id,
        version: version.version,
        stage: 'cancelled',
        transferred: await fs.stat(part).then((stat) => stat.size).catch(() => 0),
        total: 0,
        percent: 0,
        message: 'Download cancelled. It will resume when you try again.'
      })
      throw new Error('Bedrock download cancelled.')
    }
    emitProgress({
      id: version.id,
      version: version.version,
      stage: 'error',
      transferred: 0,
      total: 0,
      percent: 0,
      message: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    activeDownloads.delete(version.id)
  }
}

async function downloadFromMirror(
  url: string,
  part: string,
  target: string,
  version: BedrockVersion,
  signal: AbortSignal,
  started: number
): Promise<void> {
  let existing = await fs.stat(part).then((stat) => stat.size).catch(() => 0)
  let response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      ...(existing > 0 ? { Range: `bytes=${existing}-` } : {})
    },
    redirect: 'follow',
    signal
  })

  if (response.status === 416 && existing > 0) {
    await fs.rm(part, { force: true })
    existing = 0
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      redirect: 'follow',
      signal
    })
  }
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} while downloading Bedrock ${version.version}.`)
  }
  if (existing > 0 && response.status !== 206) {
    existing = 0
    await fs.rm(part, { force: true })
  }

  const total = Number(response.headers.get('content-length') ?? 0) + existing
  let transferred = existing
  let lastEmit = 0
  const handle = await fs.open(part, existing > 0 ? 'a' : 'w')
  try {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      await handle.write(value)
      transferred += value.byteLength
      const now = Date.now()
      if (now - lastEmit > 140) {
        lastEmit = now
        emitProgress({
          id: version.id,
          version: version.version,
          stage: 'downloading',
          transferred,
          total: total > 0 ? total : transferred,
          percent: total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0,
          bytesPerSecond: transferred / Math.max(0.001, (now - started) / 1000),
          message: total > 0 ? 'Downloading Minecraft for Windows…' : 'Downloading…'
        })
      }
    }
  } finally {
    await handle.close()
  }

  const stat = await fs.stat(part).catch(() => null)
  if (!stat || stat.size === 0) throw new Error('The Bedrock package download is empty.')
  if (total > 0 && stat.size !== total) {
    throw new Error(`The Bedrock download is incomplete (${stat.size} of ${total} bytes).`)
  }
  await fs.rm(target, { force: true })
  await fs.rename(part, target)
}

export function cancelBedrockDownload(id: string): boolean {
  const controller = activeDownloads.get(id)
  if (!controller) return false
  controller.abort()
  return true
}

export async function deleteBedrockDownload(id: string): Promise<void> {
  const version = await findVersion(id)
  const file = packageFile(version)
  await fs.rm(file, { force: true })
  await fs.rm(`${file}.part`, { force: true })
}

async function addBedrockPackage(file: string): Promise<void> {
  const script = `Add-AppxPackage -Path '${escapePowerShell(file)}' -ErrorAction Stop`
  const result = await runPowerShell(script, 30 * 60 * 1000)
  if (result.code === 0) return
  const message = cleanPowerShellError(result)
  if (/0x80073CFB/i.test(message)) return
  if (/0x80073CF0|0x80070570/i.test(message)) {
    await fs.rm(file, { force: true }).catch(() => undefined)
    throw new Error('Windows could not open that Bedrock package. The download was removed; please download it again.')
  }
  if (/0x80073CF3|0x80073D02|being used|in use/i.test(message)) {
    throw new Error('Minecraft is still running. Close it and try installing again.')
  }
  if (/0x80073CFF|0x800B0109|certificate|trust/i.test(message)) {
    throw new Error('Windows could not trust that package. Make sure Developer Mode and Gaming Services are enabled.')
  }
  if (/0x80070005|access is denied|administrator/i.test(message)) {
    throw new Error('Windows denied the installation. Run Newbie Launcher as administrator and try again.')
  }
  throw new Error(`Windows could not install that Bedrock package. ${message}`)
}

async function removeBedrockPackage(
  packageFullName: string,
  action: 'replace' | 'uninstall' = 'replace'
): Promise<void> {
  const script = `Remove-AppxPackage -Package '${escapePowerShell(packageFullName)}' -PreserveApplicationData -ErrorAction Stop`
  const result = await runPowerShell(script, 5 * 60 * 1000)
  if (result.code === 0) return
  throw new Error(
    `Windows could not ${
      action === 'uninstall' ? 'uninstall' : 'replace'
    } the installed Bedrock package. ${cleanPowerShellError(result)}`
  )
}

export async function uninstallBedrockVersion(channel: BedrockChannel): Promise<BedrockState> {
  const installations = await detectBedrockInstallations()
  const target = installations.find((entry) => entry.channel === channel)
  if (!target) {
    throw new Error(
      `${channel === 'preview' ? 'Minecraft Preview' : 'Minecraft'} is not installed.`
    )
  }
  if (target.running) {
    throw new Error('Minecraft is running. Close it before uninstalling.')
  }
  await removeBedrockPackage(target.packageFullName, 'uninstall')
  await waitForUninstall(channel)
  logger.info('bedrock', `Uninstalled ${target.packageFullName}`)
  return getBedrockState()
}

async function waitForUninstall(channel: BedrockChannel): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const installations = await detectBedrockInstallations()
    if (!installations.some((entry) => entry.channel === channel)) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

export async function openBedrockInstallFolder(channel: BedrockChannel): Promise<void> {
  const installations = await detectBedrockInstallations()
  const target = installations.find((entry) => entry.channel === channel)
  const dataDirs = gameDataDirs()
  const candidates = [
    target?.installLocation,
    channel === 'preview' ? dataDirs[1] : dataDirs[0],
    bedrockRoot()
  ].filter((entry): entry is string => Boolean(entry))

  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) continue
    const error = await shell.openPath(candidate)
    if (!error) {
      logger.info('bedrock', `Opened ${candidate}`)
      return
    }
    logger.warn('bedrock', `Could not open ${candidate}: ${error}`)
  }
  throw new Error('Could not open the Minecraft Bedrock folder.')
}

async function waitForInstallation(id: string, channel: BedrockChannel): Promise<BedrockInstallation | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const installations = await detectBedrockInstallations()
    const match = installations.find(
      (entry) => entry.channel === channel && entry.packageFullName.toLowerCase() === id.toLowerCase()
    )
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return null
}

export async function installBedrockVersion(id: string, replaceInstalled = false): Promise<BedrockState> {
  const version = await findVersion(id)
  const file = packageFile(version)
  const stat = await fs.stat(file).catch(() => null)
  if (!stat || !stat.isFile() || stat.size === 0) {
    throw new Error('Download this Bedrock version before installing it.')
  }

  const setup = await detectSetup()
  if (!setup.gamingServices) {
    throw new Error('Gaming Services is required to install Bedrock versions. Open the Microsoft Store and install Gaming Services.')
  }

  const installations = await detectBedrockInstallations()
  if (installations.some((entry) => entry.running)) {
    throw new Error('Minecraft is running. Close it before installing another Bedrock version.')
  }
  const current = installations.find((entry) => entry.channel === version.channel)
  if (current?.packageFullName.toLowerCase() === version.id.toLowerCase()) {
    return getBedrockState()
  }
  if (current && !replaceInstalled) {
    throw new Error(
      `Minecraft ${current.version} is already installed. Confirm replacing it before installing ${version.version}.`
    )
  }

  const systemFree = await freeSpaceMb(path.join(process.env.SystemDrive || 'C:', path.sep))
  if (systemFree > 0 && systemFree < INSTALL_FREE_MB) {
    throw new Error(
      `Windows needs about ${INSTALL_FREE_MB / 1024} GB free to install Bedrock. Only ${Math.round(systemFree / 1024)} GB is available on the system drive.`
    )
  }

  emitProgress({
    id: version.id,
    version: version.version,
    stage: 'installing',
    transferred: stat.size,
    total: stat.size,
    percent: 100,
    message: `Installing Minecraft ${version.version}…`
  })

  try {
    if (current) await removeBedrockPackage(current.packageFullName)
    await addBedrockPackage(file)
    const installed = await waitForInstallation(version.id, version.channel)
    if (!installed) {
      throw new Error('Windows finished the install but did not report the selected Bedrock package. Try reopening Newbie Launcher.')
    }
    emitProgress({
      id: version.id,
      version: version.version,
      stage: 'done',
      transferred: stat.size,
      total: stat.size,
      percent: 100,
      message: `Minecraft ${version.version} is installed.`
    })
    logger.info('bedrock', `Installed ${version.id}`)
    return getBedrockState()
  } catch (error) {
    emitProgress({
      id: version.id,
      version: version.version,
      stage: 'error',
      transferred: stat.size,
      total: stat.size,
      percent: 100,
      message: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

export async function launchBedrock(channel: BedrockChannel): Promise<void> {
  const installations = await detectBedrockInstallations()
  const target = installations.find((entry) => entry.channel === channel)
  if (!target) {
    throw new Error(`${channel === 'preview' ? 'Minecraft Preview' : 'Minecraft'} is not installed yet.`)
  }
  if (installations.some((entry) => entry.running)) {
    throw new Error('Minecraft is already running.')
  }
  const targetUri = `shell:appsFolder\\${target.familyName}!${target.appId}`
  const script = `Start-Process '${escapePowerShell(targetUri)}'`
  const result = await runPowerShell(script, 90_000)
  if (result.code !== 0) {
    throw new Error(`Windows could not start Minecraft. ${cleanPowerShellError(result)}`)
  }
  logger.info('bedrock', `Launched ${target.packageFullName}`)
}

/**
 * Minecraft for Windows signs in with the Microsoft account used by the Xbox
 * app on this PC. Newbie cannot inject its Java token, but it can show which
 * Windows account is present and open the Xbox app to sign in or switch.
 */
export async function bedrockWindowsAccount(): Promise<BedrockWindowsAccount> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$emails = @(Get-ChildItem 'HKCU:\\Software\\Microsoft\\IdentityCRL\\UserExtendedProperties' -ErrorAction SilentlyContinue |
  ForEach-Object { $_.PSChildName } | Where-Object { $_ -match '@' })
$xbox = [bool](Get-AppxPackage -Name 'Microsoft.GamingApp' -ErrorAction SilentlyContinue)
[pscustomobject]@{
  emails = @($emails)
  xboxAppInstalled = $xbox
} | ConvertTo-Json -Compress
`
  const result = await runPowerShell(script, 30_000)
  if (result.code !== 0) return { emails: [], xboxAppInstalled: false }
  try {
    const parsed = JSON.parse(result.stdout.trim()) as { emails?: unknown; xboxAppInstalled?: unknown }
    const emails = Array.isArray(parsed.emails)
      ? parsed.emails.filter((entry): entry is string => typeof entry === 'string' && entry.includes('@')).slice(0, 5)
      : []
    return { emails, xboxAppInstalled: Boolean(parsed.xboxAppInstalled) }
  } catch {
    return { emails: [], xboxAppInstalled: false }
  }
}

export async function openXboxApp(): Promise<void> {
  const script = `
$ErrorActionPreference = 'Stop'
$pkg = Get-AppxPackage -Name 'Microsoft.GamingApp' -ErrorAction Stop | Select-Object -First 1
if (-not $pkg) { throw 'The Xbox app is not installed.' }
$manifest = Get-AppxPackageManifest -Package $pkg.PackageFullName
$app = $manifest.Package.Applications.Application | Where-Object { $_.Id -eq 'Microsoft.Xbox.App' } | Select-Object -First 1
if (-not $app) { $app = $manifest.Package.Applications.Application | Select-Object -First 1 }
Start-Process "shell:appsFolder\\$($pkg.PackageFamilyName)!$($app.Id)"
`
  const result = await runPowerShell(script, 30_000)
  if (result.code !== 0) {
    throw new Error(`Windows could not open the Xbox app. ${cleanPowerShellError(result)}`)
  }
}

export async function addBedrockExclusion(): Promise<BedrockExclusionResult> {
  const root = bedrockRoot()
  await ensureDir(root)
  const installations = await detectBedrockInstallations().catch(() => [])
  const dataDirs = gameDataDirs()
  await Promise.all(dataDirs.map((entry) => ensureDir(entry).catch(() => undefined)))
  const required = requiredExclusionPaths(installations)
  const candidates = required.length > 0 ? required : [root]

  let workDir = exclusionWorkDir()
  try {
    await ensureDir(workDir)
  } catch {
    workDir = root
  }
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const scriptPath = path.join(workDir, `defender-exclusion-${nonce}.ps1`)
  const resultPath = path.join(workDir, `defender-exclusion-result-${nonce}.json`)
  const pathList = candidates.map((entry) => `'${escapePowerShell(entry)}'`).join(', ')
  const script = `
$ErrorActionPreference = 'Stop'
$paths = @(${pathList})
$kept = @()
$failed = @()
$current = @()
$readable = $false
$admin = $false
$tamperProtected = $false
$tamperExclusions = $false
try {
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} catch {}
try { $tamperProtected = [bool](Get-MpComputerStatus).IsTamperProtected } catch {}
try { $tamperExclusions = ((Get-ItemPropertyValue -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows Defender\\Features' -Name TPExclusions -ErrorAction Stop) -eq 1) } catch {}
try {
  $current = @((Get-MpPreference).ExclusionPath | Where-Object { $_ -and $_ -notlike 'N/A:*' })
  $readable = $true
} catch {}
foreach ($item in $paths) {
  $covered = $false
  $itemNorm = $item.TrimEnd([char]92)
  foreach ($existingPath in $current) {
    if ([string]::IsNullOrWhiteSpace($existingPath)) { continue }
    $existingNorm = $existingPath.TrimEnd([char]92)
    if ($itemNorm -eq $existingNorm -or $item.StartsWith($existingNorm + [char]92, [System.StringComparison]::OrdinalIgnoreCase)) {
      $covered = $true
      break
    }
  }
  if ($covered) {
    $kept += $item
    continue
  }
  try {
    New-Item -ItemType Directory -Force -Path $item -ErrorAction SilentlyContinue | Out-Null
    Add-MpPreference -ExclusionPath $item -ErrorAction Stop
    $readBack = @()
    try { $readBack = @((Get-MpPreference).ExclusionPath | Where-Object { $_ -and $_ -notlike 'N/A:*' }) } catch {}
    $verified = $false
    if ($readBack.Count -eq 0) {
      if ($tamperExclusions) {
        $failed += [pscustomobject]@{ path = $item; error = 'Windows Tamper Protection protects the exclusion list and did not confirm the change.' }
        continue
      }
      $verified = $true
    } else {
      foreach ($entry in $readBack) {
        if ([string]::IsNullOrWhiteSpace($entry)) { continue }
        $entryNorm = $entry.TrimEnd([char]92)
        if ($itemNorm -eq $entryNorm -or $item.StartsWith($entryNorm + [char]92, [System.StringComparison]::OrdinalIgnoreCase)) {
          $verified = $true
          break
        }
      }
    }
    if ($verified) {
      $current += $item
      $kept += $item
    } else {
      $failed += [pscustomobject]@{ path = $item; error = 'Windows did not apply the exclusion (policy or Tamper Protection).' }
    }
  } catch {
    $failed += [pscustomobject]@{ path = $item; error = $_.Exception.Message }
  }
}
[pscustomobject]@{ ok = ($kept.Count -gt 0); admin = $admin; tamperProtected = $tamperProtected; tamperExclusions = $tamperExclusions; readable = $readable; paths = $kept; failed = $failed } | ConvertTo-Json -Compress -Depth 4 |
  ForEach-Object { [System.IO.File]::WriteAllText('${escapePowerShell(resultPath)}', $_, (New-Object System.Text.UTF8Encoding($false))) }
`
  try {
    await fs.writeFile(scriptPath, script, 'utf8')
    await fs.rm(resultPath, { force: true })

    const runner = `
$ErrorActionPreference = 'Stop'
$process = Start-Process -FilePath '${escapePowerShell(POWERSHELL)}' -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', '${escapePowerShell(scriptPath)}') -Verb RunAs -WindowStyle Hidden -PassThru -Wait
exit $process.ExitCode
`
    const run = await runPowerShell(runner, 5 * 60 * 1000)
    const result = await readJson<{
      ok?: boolean
      admin?: boolean
      tamperProtected?: boolean
      tamperExclusions?: boolean
      readable?: boolean
      paths?: string[]
      failed?: { path?: string; error?: string }[]
      error?: string
    } | null>(resultPath, null)
    if (!result) {
      const output = `${run.stdout}\n${run.stderr}`.trim()
      const cancelled = run.code !== 0 && /cancel|1223/i.test(output)
      logger.warn('bedrock', 'Windows Security exclusion was not added', output || 'No result file')
      return {
        ok: false,
        cancelled,
        paths: candidates,
        allPaths: candidates,
        error: cancelled
          ? undefined
          : output
            ? cleanPowerShellError({ stdout: '', stderr: output })
            : 'Windows did not return an exclusion result. Run Newbie as administrator or add the folders manually in Windows Security.'
      }
    }

    const addedPaths =
      Array.isArray(result.paths) && result.paths.length > 0
        ? result.paths.filter((entry): entry is string => typeof entry === 'string')
        : []
    const failed = (Array.isArray(result.failed) ? result.failed : []).filter(
      (entry): entry is { path: string; error?: string } => Boolean(entry?.path)
    )
    if (addedPaths.length > 0) {
      await writeJsonAtomic(exclusionMarkerFile(), {
        addedAt: new Date().toISOString(),
        paths: addedPaths
      } satisfies ExclusionMarker)
      logger.info('bedrock', `Windows Security exclusions added: ${addedPaths.join(', ')}`)
    }

    if (failed.length > 0) {
      const detail = failed
        .map((entry) => `${entry.path ?? 'unknown'}: ${entry.error ?? 'unknown error'}`)
        .join('; ')
      logger.warn('bedrock', `Some Windows Security exclusions were skipped: ${detail}`)
      const tamper = Boolean(result.tamperExclusions || result.tamperProtected)
      const error = tamper
        ? 'Windows Tamper Protection is protecting the Defender exclusion list. Add the folders manually in Windows Security.'
        : `Windows rejected ${failed.length} Bedrock folder${
            failed.length === 1 ? '' : 's'
          }. ${failed[0]?.error ?? 'Add the folders manually in Windows Security.'}`
      return {
        ok: addedPaths.length > 0,
        partial: addedPaths.length > 0,
        manual: true,
        paths: addedPaths.length > 0 ? addedPaths : candidates,
        allPaths: candidates,
        failed,
        error
      }
    }

    if (!result.ok || addedPaths.length === 0) {
      return {
        ok: false,
        paths: candidates,
        allPaths: candidates,
        manual: Boolean(result.tamperExclusions || result.tamperProtected),
        error: result.error ?? 'Windows Security did not confirm the exclusion. Try again as administrator or add the folders manually.'
      }
    }

    return { ok: true, paths: addedPaths, allPaths: candidates }
  } finally {
    await fs.rm(scriptPath, { force: true }).catch(() => undefined)
    await fs.rm(resultPath, { force: true }).catch(() => undefined)
  }
}

export async function openWindowsSecurity(): Promise<void> {
  try {
    await shell.openExternal('windowsdefender://threatsettings')
  } catch {
    await shell.openExternal('ms-settings:windowsdefender')
  }
}

function exclusionWorkDir(): string {
  const publicDir = process.env.PUBLIC || path.join(os.homedir(), 'Public')
  return path.join(publicDir, 'NewbieLauncher', 'defender-exclusion')
}
