import path from 'node:path'
import { createWriteStream, promises as fs } from 'node:fs'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { ServerRecord, ServerRuntimeStatus } from '@shared/types'
import { ensureJava } from './java'
import { ensureDir, pathExists } from '../util/fs'
import { paths } from './paths'
import { getServer, saveServer } from './serverStore'
import { ensureEula } from './serverProperties'
import { logger } from '../util/log'

interface RunningServer {
  id: string
  child: ChildProcessWithoutNullStreams
  status: 'starting' | 'running' | 'stopping'
  pid?: number
  startedAt: number
  logs: string[]
  stream: ReturnType<typeof createWriteStream>
  stopping: boolean
  finished: boolean
  runTimer?: NodeJS.Timeout
  exited: Promise<void>
  resolveExited: () => void
  exitSave?: Promise<unknown>
}

const running = new Map<string, RunningServer>()
const pendingSaves = new Set<Promise<unknown>>()

function trackSave(promise: Promise<unknown>): Promise<unknown> {
  pendingSaves.add(promise)
  void promise.finally(() => pendingSaves.delete(promise))
  return promise
}

export function serverRuntimeStatus(serverId: string, port?: number): ServerRuntimeStatus {
  const entry = running.get(serverId)
  if (!entry) return { serverId, status: 'stopped' }
  return {
    serverId,
    status: entry.status,
    pid: entry.pid,
    startedAt: entry.startedAt,
    address: port ? `localhost:${port}` : undefined
  }
}

export function isServerRunning(serverId: string): boolean {
  return running.has(serverId)
}

export function runningServerIds(): string[] {
  return [...running.keys()]
}

export async function startServer(server: ServerRecord): Promise<ServerRuntimeStatus> {
  if (running.has(server.id)) throw new Error('This server is already running or starting')
  await ensureDir(paths.server(server.id))
  await ensureDir(paths.serverLogs(server.id))
  await ensureEula(paths.server(server.id), server.eulaAccepted)
  if (!server.eulaAccepted) throw new Error('Accept the Minecraft EULA before starting the server')

  const runtime = server.javaPath
    ? { path: server.javaPath }
    : await ensureJava(server.javaMajor || 21, true)
  const javaExe = runtime.path.replace(/javaw\.exe$/i, 'java.exe')
  const logsDir = paths.serverLogs(server.id)
  // Minecraft writes logs/latest.log itself. Keep the launcher's captured console
  // in a separate file so the two writers never corrupt each other.
  const stream = createWriteStream(path.join(logsDir, 'launcher-console.log'), { flags: 'w' })
  stream.on('error', (error) => logger.warn('server', 'Server console log stream failed', error))
  const logs = [`Starting ${server.name} (${server.type} ${server.versionId})`]
  stream.write(`# Newbie Launcher server ${new Date().toISOString()}\n`)

  let command = javaExe
  let args: string[]
  if (server.launchKind === 'script') {
    command = process.platform === 'win32' ? 'cmd.exe' : 'bash'
    args =
      process.platform === 'win32'
        ? ['/d', '/s', '/c', server.launchFile, 'nogui']
        : [server.launchFile, 'nogui']
  } else if (server.launchKind === 'args') {
    args = [
      `-Xms${Math.min(server.memoryMb, 1024)}M`,
      `-Xmx${Math.max(1024, server.memoryMb)}M`,
      '-Dfile.encoding=UTF-8',
      `@${server.launchFile}`,
      'nogui'
    ]
  } else {
    args = [
      `-Xms${Math.min(server.memoryMb, 1024)}M`,
      `-Xmx${Math.max(1024, server.memoryMb)}M`,
      '-Dfile.encoding=UTF-8',
      '-jar',
      server.launchFile,
      'nogui'
    ]
  }

  const javaDir = path.dirname(javaExe)
  const env = {
    ...process.env,
    JAVA_HOME: path.dirname(javaDir),
    PATH: `${javaDir}${path.delimiter}${process.env.PATH ?? ''}`
  }

  const child = spawn(command, args, {
    cwd: paths.server(server.id),
    env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  }) as unknown as ChildProcessWithoutNullStreams

  let resolveExited!: () => void
  const exited = new Promise<void>((resolve) => {
    resolveExited = resolve
  })
  const entry: RunningServer = {
    id: server.id,
    child,
    status: 'starting',
    pid: child.pid ?? undefined,
    startedAt: Date.now(),
    logs,
    stream,
    stopping: false,
    finished: false,
    exited,
    resolveExited
  }
  running.set(server.id, entry)
  append(entry, 'system', logs[0]!)
  entry.runTimer = setTimeout(() => {
    if (entry.status === 'starting') entry.status = 'running'
  }, 30_000)

  child.stdout.on('data', (chunk) => appendChunk(entry, 'stdout', String(chunk)))
  child.stderr.on('data', (chunk) => appendChunk(entry, 'stderr', String(chunk)))
  const finish = (code: number | null, signal: NodeJS.Signals | null): void => {
    if (entry.finished) return
    entry.finished = true
    if (entry.runTimer) clearTimeout(entry.runTimer)
    running.delete(server.id)
    append(entry, 'system', `Server stopped (${signal ?? code ?? 'exit'})`)
    stream.end()
    entry.exitSave = trackSave(
      getServer(server.id)
        .then((current) =>
          current
            ? saveServer({ ...current, lastStoppedAt: new Date().toISOString() }).then(() => undefined)
            : undefined
        )
        .catch((error) => logger.warn('server', 'Could not save server stop time', error))
    )
    entry.resolveExited()
    logger.info('server', `${server.name} stopped (${signal ?? code ?? 'exit'})`)
  }
  child.on('error', (error) => {
    append(entry, 'system', `Process error: ${error.message}`)
    logger.warn('server', `Server ${server.name} process error`, error)
    finish(null, null)
  })
  child.on('exit', finish)
  child.on('close', finish)

  await saveServer({ ...server, lastStartedAt: new Date().toISOString() })
  logger.info('server', `Started ${server.name} on port ${server.port}`)
  return serverRuntimeStatus(server.id, server.port)
}

export async function stopServer(serverId: string, force = false): Promise<void> {
  const entry = running.get(serverId)
  if (!entry) return
  entry.stopping = true
  entry.status = 'stopping'
  if (!force) {
    try {
      entry.child.stdin.write('stop\n')
    } catch {
      // The process may already be gone.
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        entry.child.removeListener('exit', onExit)
        resolve()
      }, 15_000)
      const onExit = (): void => {
        clearTimeout(timer)
        resolve()
      }
      entry.child.once('exit', onExit)
      if (!running.has(serverId)) {
        clearTimeout(timer)
        resolve()
      }
    })
  }
  if (running.has(serverId)) {
    await killTree(entry)
    running.delete(serverId)
  }
  await Promise.race([
    entry.exited,
    new Promise<void>((resolve) => setTimeout(resolve, 1_000))
  ])
  await entry.exitSave
}

export async function restartServer(server: ServerRecord): Promise<ServerRuntimeStatus> {
  await stopServer(server.id)
  return startServer(server)
}

export function sendServerCommand(serverId: string, command: string): void {
  const entry = running.get(serverId)
  if (!entry) throw new Error('Server is not running')
  const cleaned = command.replace(/\r?\n/g, ' ').trim()
  if (!cleaned) return
  entry.child.stdin.write(`${cleaned}\n`)
  append(entry, 'command', `> ${cleaned}`)
}

export async function serverLogs(serverId: string): Promise<string[]> {
  const entry = running.get(serverId)
  if (entry) return [...entry.logs]
  const file = path.join(paths.serverLogs(serverId), 'launcher-console.log')
  if (!(await pathExists(file))) return []
  const text = await fs.readFile(file, 'utf8').catch(() => '')
  return text.split(/\r?\n/).filter(Boolean).slice(-1000)
}

export function stopAllServers(): Promise<void> {
  return Promise.allSettled(runningServerIds().map((id) => stopServer(id)))
    .then(() => Promise.allSettled([...pendingSaves]))
    .then(() => undefined)
}

function appendChunk(entry: RunningServer, source: string, chunk: string): void {
  for (const line of chunk.split(/\r?\n/)) {
    if (line) append(entry, source, line)
  }
}

function append(entry: RunningServer, source: string, line: string): void {
  if (entry.stream.writableEnded) return
  const timestamp = new Date().toISOString().slice(11, 19)
  const output = `[${timestamp}] [${source}] ${line}`
  entry.logs.push(output)
  if (entry.logs.length > 2000) entry.logs.splice(0, entry.logs.length - 2000)
  entry.stream.write(`${output}\n`)
  if (
    entry.status === 'starting' &&
    (/Done \([\d.]+s\)!/.test(line) || /For help, type "help"/.test(line))
  ) {
    entry.status = 'running'
    if (entry.runTimer) clearTimeout(entry.runTimer)
  }
}

function killTree(entry: RunningServer): Promise<void> {
  return new Promise((resolve) => {
    const pid = entry.child.pid
    if (!pid) {
      entry.child.kill('SIGKILL')
      resolve()
      return
    }
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true })
      killer.on('close', () => resolve())
      killer.on('error', () => resolve())
      return
    }
    entry.child.kill('SIGKILL')
    resolve()
  })
}
