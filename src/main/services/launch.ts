import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { APP_VERSION, MAX_LOG_LINES } from '@shared/constants'
import type { Instance, LaunchExit, LaunchLog, LaunchState } from '@shared/types'
import { isCrashedExit } from '@shared/launch'
import { getVersionJson, resolveVersion, rulesAllow, currentRuleContext, nativeArtifact } from './mojang'
import { buildArguments, buildClasspath } from './launchArgs'
import { assetRootFor, clientJarPath, installGame, missingGameFiles } from './installer'
import { ensureJava } from './java'
import { sessionForLaunch } from '../auth/session'
import { store } from './store'
import { paths } from './paths'
import { emit } from './events'
import { tasks } from './tasks'
import { prepareInstancePerformance } from './perf'
import { maybeBackupWorlds } from './backups'
import { ensureActiveLoadout } from './loadouts'
import { applyOfflineSkin } from './skins'
import { syncTlsCape } from './tlskincape'
import { ensureDir, pathExists } from '../util/fs'
import { logger } from '../util/log'
import { extractZip } from '../util/zip'

interface RunningProcess {
  child: ChildProcessWithoutNullStreams
  instanceId: string
  startedAt: number
  logs: string[]
  logStream: ReturnType<typeof createWriteStream>
  stopping: boolean
  xmlBuffer: string
}

const running = new Map<string, RunningProcess>()
const launching = new Set<string>()

export function isInstanceBusy(instanceId: string): boolean {
  return running.has(instanceId) || launching.has(instanceId)
}

export function hasActiveInstances(): boolean {
  return running.size > 0 || launching.size > 0
}

export function runningStates(): LaunchState[] {
  return [...running.values()].map((entry) => ({
    instanceId: entry.instanceId,
    status: 'running',
    pid: entry.child.pid ?? undefined,
    startedAt: entry.startedAt
  }))
}

export function instanceLogs(instanceId: string): string[] {
  const entry = running.get(instanceId)
  return entry ? [...entry.logs] : []
}

export async function launchInstance(instanceId: string): Promise<void> {
  if (isInstanceBusy(instanceId)) {
    throw new Error('This instance is already running or starting')
  }
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const account = store.activeAccount()
  if (!account) throw new Error('Add or select an account before launching Minecraft')

  // Reserve the instance before the first await. This closes the race where
  // two launch requests both passed the running check while files were still
  // being verified or Java was being downloaded.
  launching.add(instanceId)
  const task = tasks.start('install-version', `Preparing ${instance.name}`, `${instance.versionId} · ${instance.loader}`, instance.id)
  try {
    emit({ type: 'launch-state', payload: { instanceId, status: 'starting', startedAt: Date.now() } })
    task.progress({
      stage: 'preparing',
      message: 'Checking game files',
      current: 0,
      total: 1,
      percent: 2,
      instanceId
    })

    const resolvedVersionId = instance.resolvedVersionId || instance.versionId
    if (await missingGameFiles(resolvedVersionId)) {
      await installGame(resolvedVersionId, {
        onProgress: (progress) => task.progress({ ...progress, instanceId })
      })
    }

    const version = await resolveVersion(resolvedVersionId)
    const javaMajor = version.javaVersion?.majorVersion ?? 8
    task.progress({
      stage: 'java',
      message: `Preparing Java ${javaMajor}`,
      current: 0,
      total: 1,
      percent: 10,
      instanceId
    })
    const jwt = store.settings().java
    const javaPath = instance.javaPath || jwt.manualPath || (await ensureJava(javaMajor, jwt.autoInstall)).path

    task.progress({
      stage: 'addons',
      message: 'Restoring loadout',
      current: 0,
      total: 1,
      percent: 18,
      instanceId
    })
    await ensureActiveLoadout(instance).catch((error) => {
      logger.warn('launch', 'Unable to restore some loadout files', error)
    })

    if (store.settings().backups.enabled) {
      task.progress({
        stage: 'preparing',
        message: 'Backing up worlds',
        current: 0,
        total: 1,
        percent: 22,
        instanceId
      })
      await maybeBackupWorlds(instance)
    }

    await prepareInstancePerformance(instance).catch((error) => {
      logger.warn('launch', 'Performance tuning failed', error)
    })

    const nativesDir = paths.instanceNatives(instance.id)
    await fs.rm(nativesDir, { recursive: true, force: true }).catch(() => undefined)
    await ensureDir(nativesDir)
    await extractNatives(version, nativesDir)

    const clientJar = await clientJarPath(resolvedVersionId)
    if (!(await pathExists(clientJar))) throw new Error('The Minecraft client jar is missing. Run Repair or reinstall the version.')
    const classpathEntries = buildClasspath(version, paths.libraries, clientJar)
    const classpath = classpathEntries.join(path.delimiter)
    const assetsDir = await assetRootFor(version)
    const loggingFile = version.logging?.client?.file
      ? path.join(
          paths.assets,
          'log_configs',
          version.logging.client.file.path ?? version.logging.client.file.id ?? 'client-logging.xml'
        )
      : undefined

    const session = await sessionForLaunch(account.id)
    await applyOfflineSkin(instance, session.account).catch((error) => {
      logger.warn('launch', 'Unable to apply the offline skin resource pack', error)
    })
    await syncTlsCape(instance, session.account).catch((error) => {
      logger.warn('launch', 'Unable to prepare the TLSkinCape plugin', error)
    })
    const args = buildArguments({
      version,
      profile: session.profile,
      instanceId: instance.id,
      versionName: instance.versionId,
      gameDir: instance.gameDir,
      assetsDir,
      nativesDir,
      libraryDir: paths.libraries,
      classpath,
      loggingFile,
      memoryMb: instance.memoryMb,
      width: instance.width,
      height: instance.height,
      fullscreen: instance.fullscreen,
      extraJvmArgs: [store.settings().java.jvmArgs, instance.jvmArgs].filter(Boolean).join(' '),
      launcherName: 'Newbie Launcher',
      launcherVersion: APP_VERSION,
      javaMajor
    })

    await ensureDir(instance.gameDir)
    await ensureDir(paths.instanceLogs(instance.id))
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logFile = path.join(paths.instanceLogs(instance.id), `launch-${stamp}.log`)
    const logStream = createWriteStream(logFile, { flags: 'a' })

    const env = { ...process.env }
    for (const key of ['_JAVA_OPTIONS', 'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS']) delete env[key]

    task.progress({
      stage: 'finalize',
      message: 'Starting Minecraft',
      current: 0,
      total: 1,
      percent: 30,
      instanceId
    })

    const child = spawn(javaPath, [...args.jvm, version.mainClass, ...args.game], {
      cwd: instance.gameDir,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }) as unknown as ChildProcessWithoutNullStreams

    const entry: RunningProcess = {
      child,
      instanceId,
      startedAt: Date.now(),
      logs: [],
      logStream,
      stopping: false,
      xmlBuffer: ''
    }
    running.set(instanceId, entry)
    appendLog(entry, 'system', `Launching ${instance.name} (${instance.versionId})`)
    appendLog(entry, 'system', `Java: ${javaPath}`)
    appendLog(entry, 'system', `Memory: ${instance.memoryMb} MB`)
    if (session.account.type !== 'microsoft') {
      appendLog(
        entry,
        'system',
        'Offline session: online-mode servers need a Microsoft account. Single-player and offline LAN work normally.'
      )
    }
    if (store.settings().java.jvmArgs.trim()) appendLog(entry, 'system', `Global JVM args: ${store.settings().java.jvmArgs}`)
    logStream.write(
      `# Newbie Launcher ${APP_VERSION}\n# ${new Date().toISOString()}\n# ${javaPath}\n# ${args.jvm.join(' ')} ${version.mainClass} ${redactArguments(args.game)}\n\n`
    )

    child.stdout.on('data', (chunk) => pump(entry, 'stdout', String(chunk)))
    child.stderr.on('data', (chunk) => pump(entry, 'stderr', String(chunk)))
    child.on('error', (error) => {
      appendLog(entry, 'system', `Process error: ${error.message}`)
      void finish(entry, null, null, true)
    })
    child.on('close', (code, signal) => {
      void finish(entry, code, signal, false)
    })

    emit({
      type: 'launch-state',
      payload: { instanceId, status: 'running', pid: child.pid ?? undefined, startedAt: entry.startedAt }
    })
    await task.done('Minecraft is running')
  } catch (error) {
    await task.fail(error)
    emit({ type: 'launch-state', payload: { instanceId, status: 'stopped', startedAt: Date.now() } })
    emit({
      type: 'toast',
      payload: {
        kind: 'error',
        title: 'Minecraft could not start',
        message: error instanceof Error ? error.message : String(error)
      }
    })
    throw error
  } finally {
    launching.delete(instanceId)
  }
}

async function finish(
  entry: RunningProcess,
  code: number | null,
  signal: string | null,
  spawnError: boolean
): Promise<void> {
  running.delete(entry.instanceId)
  const durationSec = Math.round((Date.now() - entry.startedAt) / 1000)
  const crashed = isCrashedExit(code, spawnError, entry.stopping)
  appendLog(entry, 'system', `Minecraft exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`)
  if (crashed) {
    const hint = diagnoseCrash(entry.logs)
    if (hint) appendLog(entry, 'system', `Hint: ${hint}`)
    emit({
      type: 'toast',
      payload: {
        kind: 'error',
        title: 'Minecraft exited unexpectedly',
        message: hint ?? `Exit code ${code ?? 'unknown'}. Open the console for details.`
      }
    })
  }
  entry.logStream.end()
  await store
    .updateInstance(entry.instanceId, (instance) => {
      instance.lastPlayedAt = new Date().toISOString()
      instance.totalPlayTimeSec = (instance.totalPlayTimeSec ?? 0) + durationSec
    })
    .catch(() => undefined)

  const payload: LaunchExit = {
    instanceId: entry.instanceId,
    code,
    signal,
    durationSec,
    crashed
  }
  emit({ type: 'launch-exit', payload })
  emit({ type: 'launch-state', payload: { instanceId: entry.instanceId, status: 'stopped', startedAt: Date.now() } })
  await store.flush()
}

function pump(entry: RunningProcess, stream: 'stdout' | 'stderr', chunk: string): void {
  if (stream === 'stderr') {
    for (const line of chunk.split(/\r?\n/)) {
      if (line.trim()) appendLog(entry, stream, line)
    }
    return
  }
  // Modern Minecraft uses a LegacyXMLLayout on stdout. Turn the XML events
  // back into the readable console lines players expect.
  entry.xmlBuffer += chunk
  let guard = 0
  while (entry.xmlBuffer.length > 0 && guard < 200) {
    guard += 1
    const start = entry.xmlBuffer.indexOf('<log4j:Event')
    if (start < 0) {
      const plain = entry.xmlBuffer
      entry.xmlBuffer = ''
      for (const line of plain.split(/\r?\n/)) {
        if (line.trim()) appendLog(entry, stream, line)
      }
      break
    }
    if (start > 0) {
      const prefix = entry.xmlBuffer.slice(0, start)
      entry.xmlBuffer = entry.xmlBuffer.slice(start)
      for (const line of prefix.split(/\r?\n/)) {
        if (line.trim()) appendLog(entry, stream, line)
      }
      continue
    }
    const end = entry.xmlBuffer.indexOf('</log4j:Event>')
    if (end < 0) {
      if (entry.xmlBuffer.length > 2 * 1024 * 1024) {
        appendLog(entry, stream, entry.xmlBuffer.slice(0, 4000))
        entry.xmlBuffer = ''
      }
      break
    }
    const xml = entry.xmlBuffer.slice(0, end + '</log4j:Event>'.length)
    entry.xmlBuffer = entry.xmlBuffer.slice(end + '</log4j:Event>'.length)
    const parsed = parseLog4jEvent(xml)
    if (parsed) appendLog(entry, stream, parsed)
  }
}

function parseLog4jEvent(xml: string): string | null {
  const attr = (name: string): string => {
    const match = xml.match(new RegExp(`${name}="([^"]*)"`))
    return match?.[1] ?? ''
  }
  const level = attr('level') || 'INFO'
  const thread = attr('thread') || 'main'
  const timestamp = Number(attr('timestamp'))
  const time = Number.isFinite(timestamp)
    ? new Date(timestamp).toTimeString().slice(0, 8)
    : new Date().toTimeString().slice(0, 8)
  const messageMatch = xml.match(/<log4j:Message>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/log4j:Message>/)
  const message = (messageMatch?.[1] ?? messageMatch?.[2] ?? '').trim()
  if (!message) return null
  const lines = message.split(/\r?\n/).filter(Boolean)
  const head = `[${time}] [${thread}/${level}] ${lines[0] ?? ''}`
  const throwable = xml.match(/<log4j:Throwable>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/log4j:Throwable>/)
  const stack = (throwable?.[1] ?? throwable?.[2] ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 18)
  return [head, ...lines.slice(1), ...stack.map((line) => `    ${line}`)].join('\n')
}

function redactArguments(args: string[]): string {
  const redacted: string[] = []
  let skip = false
  for (const arg of args) {
    if (skip) {
      redacted.push('***')
      skip = false
      continue
    }
    redacted.push(arg)
    if (arg === '--accessToken') skip = true
  }
  return redacted.join(' ')
}

function appendLog(entry: RunningProcess, stream: LaunchLog['stream'], line: string): void {
  entry.logs.push(line)
  if (entry.logs.length > MAX_LOG_LINES) entry.logs.shift()
  entry.logStream.write(line + '\n')
  emit({
    type: 'launch-log',
    payload: { instanceId: entry.instanceId, stream, line, ts: Date.now() }
  })
}

export async function stopInstance(instanceId: string): Promise<void> {
  const entry = running.get(instanceId)
  if (!entry) return
  entry.stopping = true
  appendLog(entry, 'system', 'Stopping Minecraft…')
  if (process.platform === 'win32' && entry.child.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(entry.child.pid), '/t', '/f'], { windowsHide: true })
      killer.on('close', () => resolve())
      killer.on('error', () => resolve())
    })
  } else {
    entry.child.kill('SIGTERM')
  }
}

async function extractNatives(version: Awaited<ReturnType<typeof resolveVersion>>, destination: string): Promise<void> {
  const osName = currentRuleContext().osName
  for (const library of version.libraries ?? []) {
    if (!library.natives) continue
    if (!rulesAllow(library.rules, currentRuleContext())) continue
    const artifact = nativeArtifact(library, osName)
    if (!artifact) continue
    if (!artifact.path) continue
    const jar = path.join(paths.libraries, artifact.path)
    if (!(await pathExists(jar))) continue
    try {
      await extractZip(jar, destination)
    } catch (error) {
      logger.warn('launch', `Unable to extract natives from ${artifact.path}`, error)
    }
  }
}

export function diagnoseCrash(lines: string[]): string | null {
  const text = lines.join('\n')
  if (/java\.lang\.OutOfMemoryError|Java heap space/i.test(text)) {
    return 'Minecraft ran out of memory. Lower the render distance or increase the instance memory in Settings.'
  }
  if (/UnsupportedClassVersionError|class file version/i.test(text)) {
    return 'This instance needs a newer Java runtime. Set a Java 17/21 path for the instance.'
  }
  if (/Missing or unsupported mandatory dependencies|Incompatible mod set/i.test(text)) {
    return 'A mod dependency is missing or incompatible. Run Repair in the instance menu.'
  }
  if (/Could not find or load main class/i.test(text)) {
    return 'The game files are incomplete. Force-update the version from the instance menu.'
  }
  if (/The game crashed whilst|Exit Code: -1|EXCEPTION_ACCESS_VIOLATION/i.test(text)) {
    return 'A graphics driver or mod crashed the game. Try the Performance profile and disable the newest mod.'
  }
  if (/Failed to download|Unable to access|UnknownHostException/i.test(text)) {
    return 'Minecraft could not reach the network. Check your connection and any firewall/VPN.'
  }
  if (/SessionInvalid|Invalid session|authentication/i.test(text)) {
    return 'The account session expired. Re-select your account, or sign in to Microsoft again.'
  }
  return null
}
