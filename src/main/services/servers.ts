import path from 'node:path'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import type { CreateServerInput, ServerRecord, UpdateServerInput } from '@shared/types'
import { FABRIC_META, QUILT_META } from '@shared/constants'
import { SERVER_PROPERTY_FIELDS } from '@shared/serverProperties'
import { DEFAULT_RESTART_SCHEDULE, nextRestartAt, normalizeRestartSchedule } from '@shared/serverSchedule'
import { serverTypeLabel } from '@shared/serverTypes'
import { getVersionJson, type VersionJson } from './mojang'
import { listLoaderVersions } from './loaders'
import { ensureJava } from './java'
import { downloadFile, fetchJson, fetchText } from './http'
import { paths } from './paths'
import { tasks } from './tasks'
import { getServer, saveServer, uniqueServerId } from './serverStore'
import {
  defaultProperties,
  ensureEula,
  levelName as propertyLevelName,
  readProperties,
  writeProperties
} from './serverProperties'
import { isServerRunning, stopServer } from './serverProcess'
import { ensureDir, pathExists, sanitizeFilename } from '../util/fs'
import { logger } from '../util/log'

interface PaperBuild {
  id: number
  channel: string
  downloads?: Record<
    string,
    {
      name: string
      size: number
      checksums?: { sha256?: string }
      url: string
    }
  >
}

interface InstallResult {
  launchKind: 'jar' | 'script' | 'args'
  launchFile: string
  paperBuild?: number
}

export async function createServer(input: CreateServerInput): Promise<ServerRecord> {
  if (!input.eulaAccepted) throw new Error('You must accept the Minecraft EULA before creating a server')
  const name = input.name.trim()
  if (!name) throw new Error('Give the server a name')
  if (!Number.isFinite(input.port) || input.port < 1 || input.port > 65535) {
    throw new Error('Choose a server port between 1 and 65535')
  }
  const versionId = input.versionId.trim()
  if (!versionId) throw new Error('Choose a Minecraft version')
  const memoryMb = Math.max(1024, Math.min(65536, Math.round(input.memoryMb || 4096)))
  const levelName = sanitizeFilename(input.levelName?.trim() || 'world') || 'world'
  if (levelName === '.' || levelName === '..') throw new Error('Choose a valid world folder name')

  const id = await uniqueServerId(name)
  const dir = paths.server(id)
  const task = tasks.start('server', `Creating ${name}`, `${serverTypeLabel(input.type)} ${versionId}`)
  try {
    await ensureDir(dir)
    task.progress({ stage: 'metadata', message: 'Resolving Minecraft metadata', current: 0, total: 1, percent: 5 })
    const versionJson = await getVersionJson(versionId)
    const javaMajor = versionJson.javaVersion?.majorVersion ?? 21

    task.progress({ stage: 'java', message: `Preparing Java ${javaMajor}`, current: 0, total: 1, percent: 10 })
    await ensureJava(javaMajor, true)

    task.progress({ stage: 'client', message: `Downloading ${serverTypeLabel(input.type)}`, current: 0, total: 1, percent: 20 })
    const installer = await installServerSoftware(dir, input, versionJson, (message, percent) =>
      task.progress({ stage: 'client', message, current: 0, total: 1, percent })
    )

    task.progress({ stage: 'finalize', message: 'Writing server settings', current: 0, total: 1, percent: 88 })
    await ensureEula(dir, true)
    const properties = defaultProperties({
      motd: input.motd?.trim() || `${name} · Newbie`,
      'server-port': String(input.port),
      'online-mode': String(input.onlineMode ?? true),
      'level-name': levelName,
      'max-players': '20',
      'level-seed': ''
    })
    await writeProperties(dir, properties)

    const record: ServerRecord = {
      id,
      name,
      type: input.type,
      versionId,
      loaderVersion: input.loaderVersion?.trim() ?? '',
      port: input.port,
      memoryMb,
      javaPath: input.javaPath?.trim() || null,
      javaMajor,
      eulaAccepted: true,
      createdAt: new Date().toISOString(),
      levelName,
      launchKind: installer.launchKind,
      launchFile: installer.launchFile,
      paperBuild: installer.paperBuild,
      addons: [],
      restartSchedule: { ...DEFAULT_RESTART_SCHEDULE }
    }
    await saveServer(record)
    await task.done('Server ready')
    logger.info('server', `Created ${serverTypeLabel(input.type)} ${versionId} server ${name}`)
    return record
  } catch (error) {
    await task.fail(error)
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

export async function updateServer(
  id: string,
  patch: UpdateServerInput
): Promise<ServerRecord> {
  const server = await getServer(id)
  if (!server) throw new Error('Server not found')
  const next = { ...server }
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('Give the server a name')
    next.name = name.slice(0, 60)
  }
  if (patch.memoryMb !== undefined && Number.isFinite(patch.memoryMb)) {
    next.memoryMb = Math.max(1024, Math.min(65536, Math.round(patch.memoryMb)))
  }
  if (patch.restartSchedule !== undefined) {
    const schedule = normalizeRestartSchedule(patch.restartSchedule)
    next.restartSchedule = {
      ...schedule,
      nextRestartAt: nextRestartAt(schedule) ?? undefined
    }
  }
  return saveServer(next)
}

export async function removeServer(id: string, deleteFiles = true): Promise<void> {
  const server = await getServer(id)
  if (!server) return
  if (isServerRunning(id)) await stopServer(id)
  if (!deleteFiles) {
    await fs.rm(paths.serverMeta(id), { force: true }).catch(() => undefined)
    return
  }
  await ensureDir(paths.serverTrash)
  const target = path.join(paths.serverTrash, `${sanitizeFilename(id)}-${Date.now()}`)
  await fs.rename(paths.server(id), target).catch(async () => {
    await fs.rm(paths.server(id), { recursive: true, force: true })
  })
  void fs.rm(target, { recursive: true, force: true }).catch((error) =>
    logger.warn('server', `Could not finish deleting ${target}`, error)
  )
}

export async function serverProperties(id: string): Promise<Record<string, string>> {
  const server = await getServer(id)
  if (!server) throw new Error('Server not found')
  return Object.fromEntries(await readProperties(paths.server(id)))
}

export async function saveServerProperties(
  id: string,
  patch: Record<string, string>
): Promise<Record<string, string>> {
  const server = await getServer(id)
  if (!server) throw new Error('Server not found')
  const current = await readProperties(paths.server(id))
  for (const [key, rawValue] of Object.entries(patch)) {
    const field = SERVER_PROPERTY_FIELDS.find((entry) => entry.key === key)
    if (!field) continue
    if (field.kind === 'boolean') {
      current.set(key, String(rawValue === 'true'))
      continue
    }
    if (field.kind === 'number') {
      const numeric = Number(rawValue)
      if (!Number.isFinite(numeric)) continue
      current.set(key, String(Math.max(field.min ?? -Infinity, Math.min(field.max ?? Infinity, numeric))))
      continue
    }
    if (field.kind === 'select') {
      if (!field.options?.some((option) => option.value === rawValue)) continue
      current.set(key, rawValue)
      continue
    }
    const value = field.key === 'level-name' ? sanitizeFilename(rawValue.trim()) : rawValue.slice(0, 256)
    current.set(key, value)
  }
  await writeProperties(paths.server(id), current)
  if (current.has('level-name')) {
    const nextLevel = await propertyLevelName(paths.server(id))
    if (nextLevel !== server.levelName) {
      await saveServer({ ...server, levelName: nextLevel })
    }
  }
  return Object.fromEntries(current)
}

async function installServerSoftware(
  dir: string,
  input: CreateServerInput,
  versionJson: VersionJson,
  onStage: (message: string, percent: number) => void
): Promise<InstallResult> {
  if (input.type === 'vanilla') {
    const artifact = versionJson.downloads?.server
    if (!artifact?.url) throw new Error(`Minecraft ${input.versionId} has no official server download`)
    onStage(`Downloading official server ${input.versionId}`, 30)
    await downloadFile(artifact.url, path.join(dir, 'server.jar'), {
      sha1: artifact.sha1,
      size: artifact.size,
      retries: 4
    })
    return { launchKind: 'jar', launchFile: 'server.jar' }
  }

  if (input.type === 'paper') {
    const build = await fetchPaperBuild(input.versionId)
    const download = build.downloads?.['server:default']
    if (!download?.url) throw new Error(`Paper has no server download for ${input.versionId}`)
    onStage(`Downloading Paper ${input.versionId} build ${build.id}`, 35)
    await downloadFile(download.url, path.join(dir, 'server.jar'), {
      sha256: download.checksums?.sha256,
      size: download.size,
      retries: 4
    })
    return { launchKind: 'jar', launchFile: 'server.jar', paperBuild: build.id }
  }

  if (input.type === 'fabric') {
    const loaderVersion =
      input.loaderVersion?.trim() || (await pickLoader('fabric', input.versionId))
    const installerVersion = await latestFabricInstaller()
    const url = `${FABRIC_META}/versions/loader/${encodeURIComponent(
      input.versionId
    )}/${encodeURIComponent(loaderVersion)}/${encodeURIComponent(installerVersion)}/server/jar`
    onStage(`Downloading Fabric ${loaderVersion} server launcher`, 35)
    await downloadFile(url, path.join(dir, 'server.jar'), { retries: 4 })
    return { launchKind: 'jar', launchFile: 'server.jar' }
  }

  if (input.type === 'quilt') {
    const loaderVersion =
      input.loaderVersion?.trim() || (await pickLoader('quilt', input.versionId))
    const installerVersion = await latestQuiltInstaller()
    const installerJar = path.join(paths.downloadsCache, `quilt-installer-${installerVersion}.jar`)
    onStage(`Downloading Quilt installer ${installerVersion}`, 25)
    await downloadFile(
      `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/${installerVersion}/quilt-installer-${installerVersion}.jar`,
      installerJar,
      { retries: 4 }
    )
    const javaExe = await javaForInstall(input.versionId)
    onStage('Installing Quilt server', 45)
    // The Quilt installer splits --install-dir on spaces, so run it inside the
    // server folder with a relative path. This keeps data directories with spaces working.
    const installerOutput = await runJavaProcess(javaExe, installerJar, [
      'install',
      'server',
      input.versionId,
      loaderVersion,
      '--download-server',
      '--create-scripts',
      '--install-dir=.'
    ], dir)
    if (/Usage: quilt-installer|Invalid option/i.test(installerOutput)) {
      throw new Error('Quilt installer rejected the install request. Use a data folder without special characters or try again.')
    }
    await fs.rm(installerJar, { force: true }).catch(() => undefined)
    if (await pathExists(path.join(dir, 'quilt-server-launch.jar'))) {
      return { launchKind: 'jar', launchFile: 'quilt-server-launch.jar' }
    }
    if (await pathExists(path.join(dir, 'server.jar'))) {
      return { launchKind: 'jar', launchFile: 'server.jar' }
    }
    return scriptLaunch(dir)
  }

  const loaderVersion =
    input.loaderVersion?.trim() || (await pickLoader(input.type, input.versionId))
  const installerUrl =
    input.type === 'forge'
      ? `https://maven.minecraftforge.net/net/minecraftforge/forge/${input.versionId}-${loaderVersion}/forge-${input.versionId}-${loaderVersion}-installer.jar`
      : `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVersion}/neoforge-${loaderVersion}-installer.jar`
  const installerJar = path.join(paths.downloadsCache, path.basename(installerUrl))
  onStage(`Downloading ${serverTypeLabel(input.type)} installer`, 25)
  await downloadFile(installerUrl, installerJar, { retries: 4 })
  const javaExe = await javaForInstall(input.versionId)
  onStage(`Installing ${serverTypeLabel(input.type)} server`, 55)
  await runJavaProcess(javaExe, installerJar, ['--installServer', '.'], dir)
  await fs.rm(installerJar, { force: true }).catch(() => undefined)

  const argsFile = await findLaunchArgs(dir)
  if (argsFile) {
    return {
      launchKind: 'args',
      launchFile: path.relative(dir, argsFile).replace(/\\/g, '/')
    }
  }
  return scriptLaunch(dir)
}

async function fetchPaperBuild(version: string): Promise<PaperBuild> {
  const response = await fetchJson<PaperBuild | { ok?: boolean; message?: string }>(
    `https://fill.papermc.io/v3/projects/paper/versions/${encodeURIComponent(version)}/builds/latest`,
    { headers: { Accept: 'application/json' } },
    { timeoutMs: 30_000 }
  )
  if ('ok' in response && response.ok === false) {
    throw new Error(response.message ?? `Paper has no build for Minecraft ${version}`)
  }
  const build = response as PaperBuild
  if (!build.id) throw new Error(`Paper has no build for Minecraft ${version}`)
  return build
}

async function pickLoader(type: 'fabric' | 'quilt' | 'forge' | 'neoforge', versionId: string): Promise<string> {
  const versions = await listLoaderVersions(type, versionId)
  const chosen = versions.find((entry) => entry.stable) ?? versions[0]
  if (!chosen) throw new Error(`No ${serverTypeLabel(type)} loader is available for Minecraft ${versionId}`)
  return chosen.version
}

async function latestFabricInstaller(): Promise<string> {
  const installers = await fetchJson<{ version: string; stable: boolean }[]>(
    `${FABRIC_META}/versions/installer`,
    {},
    { timeoutMs: 30_000 }
  )
  const chosen = installers.find((entry) => entry.stable) ?? installers[0]
  if (!chosen) throw new Error('Fabric installer metadata is unavailable')
  return chosen.version
}

async function latestQuiltInstaller(): Promise<string> {
  const xml = await fetchText(
    'https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/maven-metadata.xml',
    {},
    { timeoutMs: 30_000 }
  )
  const release = /<release>([^<]+)<\/release>/.exec(xml)?.[1]
  if (!release) throw new Error('Quilt installer metadata is unavailable')
  return release
}

async function javaForInstall(versionId: string): Promise<string> {
  const json = await getVersionJson(versionId)
  const runtime = await ensureJava(json.javaVersion?.majorVersion ?? 21, true)
  return runtime.path.replace(/javaw\.exe$/i, 'java.exe')
}

function runJavaProcess(javaExe: string, jar: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(javaExe, ['-jar', jar, ...args], { cwd, windowsHide: true })
    let output = ''
    const collect = (chunk: Buffer): void => {
      output += String(chunk)
      if (output.length > 100_000) output = output.slice(-100_000)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output)
        return
      }
      const tail = output.split(/\r?\n/).filter(Boolean).slice(-20).join('\n')
      reject(new Error(`Installer exited with code ${code}\n${tail}`))
    })
  })
}

async function findLaunchArgs(dir: string): Promise<string | null> {
  const preferred = process.platform === 'win32' ? 'win_args.txt' : 'unix_args.txt'
  const found = await findNamedFile(dir, preferred, 7)
  if (found) return found
  return findNamedFile(dir, process.platform === 'win32' ? 'unix_args.txt' : 'win_args.txt', 7)
}

async function findNamedFile(dir: string, filename: string, depth: number): Promise<string | null> {
  if (depth < 0) return null
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isFile() && entry.name === filename) return path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = await findNamedFile(path.join(dir, entry.name), filename, depth - 1)
      if (found) return found
    }
  }
  return null
}

async function scriptLaunch(dir: string): Promise<InstallResult> {
  const script = process.platform === 'win32' ? 'run.bat' : 'run.sh'
  if (!(await pathExists(path.join(dir, script)))) {
    throw new Error(`Server installer finished but ${script} was not created`)
  }
  return { launchKind: 'script', launchFile: script }
}
