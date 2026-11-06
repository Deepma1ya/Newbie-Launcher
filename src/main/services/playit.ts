import path from 'node:path'
import { promises as fs } from 'node:fs'
import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import { APP_VERSION, USER_AGENT } from '@shared/constants'
import { downloadFile } from './http'
import { paths } from './paths'
import { ensureDir, pathExists } from '../util/fs'
import { logger } from '../util/log'

const execFileAsync = promisify(execFile)
const API_BASE = 'https://api.playit.gg'
const CLAIM_BASE = 'https://playit.gg/claim'
const PLAYIT_AGENT_VERSION = '2.0.0-r1'
const PLAYIT_DAEMON_URL = `https://github.com/playit-cloud/playit-agent/releases/download/v${PLAYIT_AGENT_VERSION}/playitd-windows-x86_64-signed.exe`
const PLAYIT_DIR = () => path.join(paths.data, 'tools', 'playit')

const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
)

interface ApiSuccess<T> {
  status: 'success'
  data: T
}
interface ApiFailure {
  status: 'fail' | 'error'
  data: unknown
}
type ApiResult<T> = ApiSuccess<T> | ApiFailure

export interface PlayitClaim {
  code: string
  url: string
}

export interface PlayitTunnel {
  id: string
  address: string
}

export interface PlayitTunnelOptions {
  name: string
  protocol: 'tcp' | 'udp'
  port: number
}

let playitBinary: Promise<string> | null = null
let agentProcess: ChildProcess | null = null
let agentSecret: string | null = null
let agentVersion: string | null = null
let agentSecretFile: string | null = null
let agentStart: Promise<void> | null = null

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''")
}

async function api<T>(
  endpoint: string,
  body: Record<string, unknown>,
  secret?: string,
  timeoutMs = 20_000
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...(secret ? { Authorization: `agent-key ${secret}` } : {})
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (text.includes('AgentVersionTooOld')) {
      throw new Error('playit.gg requires a newer agent build. Update Newbie Launcher, then try again.')
    }
    throw new Error(`playit.gg returned HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ''}`)
  }
  const result = (await response.json()) as ApiResult<T>
  if (result.status !== 'success') {
    throw new Error(`playit.gg: ${JSON.stringify(result.data).slice(0, 300)}`)
  }
  return result.data
}

async function signatureValid(file: string): Promise<boolean> {
  try {
    const script = `
$sig = Get-AuthenticodeSignature -LiteralPath '${escapePowerShell(file)}'
if ($sig.Status -eq 'Valid') { $sig.SignerCertificate.Subject } else { '' }
`
    const { stdout } = await execFileAsync(
      POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 20_000, maxBuffer: 1024 * 1024 }
    )
    const subject = String(stdout ?? '')
    return /Developed Methods|playit/i.test(subject)
  } catch (error) {
    logger.warn('playit', 'Could not verify the playit agent signature', error)
    return false
  }
}

async function ensurePlayitBinary(): Promise<string> {
  if (playitBinary) return playitBinary
  playitBinary = (async () => {
    const dir = PLAYIT_DIR()
    const file = path.join(dir, 'playitd.exe')
    const versionFile = path.join(dir, 'agent.version')
    await ensureDir(dir)
    const installedVersion = (await fs.readFile(versionFile, 'utf8').catch(() => '')).trim()
    if (
      (await pathExists(file)) &&
      installedVersion === PLAYIT_AGENT_VERSION &&
      (await signatureValid(file))
    ) {
      return file
    }
    await fs.rm(file, { force: true }).catch(() => undefined)
    await fs.rm(versionFile, { force: true }).catch(() => undefined)
    logger.info('playit', `Downloading playit.gg agent ${PLAYIT_AGENT_VERSION}`)
    await downloadFile(PLAYIT_DAEMON_URL, file, { retries: 4 })
    if (!(await signatureValid(file))) {
      await fs.rm(file, { force: true }).catch(() => undefined)
      throw new Error('The downloaded playit.gg agent did not have a valid signature.')
    }
    await fs.writeFile(versionFile, PLAYIT_AGENT_VERSION, 'utf8')
    logger.info('playit', `playit.gg agent ${PLAYIT_AGENT_VERSION} downloaded and verified`)
    return file
  })().catch((error) => {
    playitBinary = null
    throw error
  })
  return playitBinary
}

export function newPlayitClaim(): PlayitClaim {
  const code = randomBytes(5).toString('hex')
  return { code, url: `${CLAIM_BASE}/${code}` }
}

export async function pollPlayitClaim(code: string): Promise<'waiting' | 'accepted' | 'rejected'> {
  const state = await api<string>('/claim/setup', {
    code,
    agent_type: 'self-managed',
    version: `Newbie Launcher ${APP_VERSION}`
  })
  if (state === 'UserAccepted') return 'accepted'
  if (state === 'UserRejected') return 'rejected'
  return 'waiting'
}

export async function exchangePlayitClaim(code: string): Promise<string> {
  const result = await api<{ secret_key?: string }>('/claim/exchange', { code })
  const secret = result.secret_key?.trim()
  if (!secret) throw new Error('playit.gg did not return an agent secret.')
  return secret
}

export async function playitAgentId(secret: string): Promise<string> {
  const result = await api<{ agent_id?: string }>('/agents/rundata', {}, secret)
  const agentId = result.agent_id?.trim()
  if (!agentId) throw new Error('playit.gg did not return an agent ID.')
  return agentId
}

async function waitForAgent(secret: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      return await playitAgentId(secret)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (/auth|invalid.*key|unauthorized/i.test(message)) throw error
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
  }
  throw new Error(
    `The playit.gg agent did not come online. ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  )
}

export async function ensurePlayitAgent(secret: string): Promise<void> {
  if (
    agentProcess &&
    agentProcess.exitCode === null &&
    agentSecret === secret &&
    agentVersion === PLAYIT_AGENT_VERSION
  ) {
    return
  }
  if (agentStart) return agentStart
  agentStart = (async () => {
    await stopPlayitAgent()
    const binary = await ensurePlayitBinary()
    const dir = PLAYIT_DIR()
    const secretFile = path.join(dir, 'agent.secret')
    const logFile = path.join(dir, 'playitd.log')
    await fs.writeFile(secretFile, secret, 'utf8')
    const child = spawn(binary, ['--secret-path', secretFile, '--log-path', logFile], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    })
    agentProcess = child
    agentSecret = secret
    agentVersion = PLAYIT_AGENT_VERSION
    agentSecretFile = secretFile
    child.stderr.on('data', (chunk) => {
      const text = String(chunk).trim()
      if (text) logger.debug('playit', text.slice(0, 500))
    })
    child.on('error', (error) => {
      logger.error('playit', 'playit agent process failed', error)
    })
    child.on('exit', (code) => {
      if (agentProcess === child) {
        agentProcess = null
        agentSecret = null
        agentVersion = null
        agentSecretFile = null
      }
      if (code !== 0 && code !== null) logger.warn('playit', `playit agent exited with code ${code}`)
    })
    try {
      await waitForAgent(secret)
    } catch (error) {
      await stopPlayitAgent()
      throw error
    }
  })().finally(() => {
    agentStart = null
  })
  return agentStart
}

export async function stopPlayitAgent(): Promise<void> {
  const child = agentProcess
  agentProcess = null
  agentSecret = null
  agentVersion = null
  if (agentSecretFile) {
    await fs.rm(agentSecretFile, { force: true }).catch(() => undefined)
    agentSecretFile = null
  }
  if (!child || child.exitCode !== null) return
  child.kill()
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
  if (child.exitCode === null && child.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
      killer.on('close', () => resolve())
      killer.on('error', () => resolve())
    })
  }
}

export async function createPlayitTunnel(
  secret: string,
  options: PlayitTunnelOptions
): Promise<PlayitTunnel> {
  await ensurePlayitAgent(secret)
  const agentId = await playitAgentId(secret)
  const tunnelType = options.protocol === 'tcp' ? 'minecraft-java' : 'minecraft-bedrock'
  const created = await api<{ id?: string }>(
    '/tunnels/create',
    {
      name: options.name.slice(0, 60),
      tunnel_type: tunnelType,
      port_type: options.protocol,
      port_count: 1,
      origin: {
        type: 'agent',
        data: {
          agent_id: agentId,
          local_ip: '127.0.0.1',
          local_port: options.port
        }
      },
      enabled: true,
      alloc: null,
      firewall_id: null,
      proxy_protocol: null
    },
    secret,
    30_000
  )
  const tunnelId = created.id?.trim()
  if (!tunnelId) throw new Error('playit.gg did not return a tunnel ID.')
  try {
    const address = await waitForTunnelAddress(secret, tunnelId, options.protocol)
    return { id: tunnelId, address }
  } catch (error) {
    await deletePlayitTunnel(secret, tunnelId)
    throw error
  }
}

interface PlayitTunnelListEntry {
  id: string
  alloc?: {
    status?: string
    data?: {
      assigned_domain?: string
      assigned_srv?: string | null
      port_start?: number
    }
  }
}

export function playitTunnelAddress(
  protocol: 'tcp' | 'udp',
  alloc: PlayitTunnelListEntry['alloc']
): string | null {
  if (alloc?.status !== 'allocated' || !alloc.data) return null
  const data = alloc.data
  if (protocol === 'tcp' && data.assigned_srv) return data.assigned_srv
  if (!data.assigned_domain) return null
  return data.port_start ? `${data.assigned_domain}:${data.port_start}` : data.assigned_domain
}

async function waitForTunnelAddress(
  secret: string,
  tunnelId: string,
  protocol: 'tcp' | 'udp'
): Promise<string> {
  const deadline = Date.now() + 60_000
  let lastStatus = 'pending'
  while (Date.now() < deadline) {
    const result = await api<{ tunnels?: PlayitTunnelListEntry[] }>(
      '/tunnels/list',
      { tunnel_id: tunnelId, agent_id: null },
      secret
    )
    const tunnel = result.tunnels?.find((entry) => entry.id === tunnelId)
    const alloc = tunnel?.alloc
    lastStatus = alloc?.status ?? 'pending'
    const address = playitTunnelAddress(protocol, alloc)
    if (address) return address
    if (alloc?.status === 'failed') throw new Error('playit.gg could not allocate a tunnel address.')
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  throw new Error(`playit.gg is still allocating the tunnel (${lastStatus}). Try again in a moment.`)
}

export async function deletePlayitTunnel(secret: string, tunnelId: string): Promise<void> {
  await api('/tunnels/delete', { tunnel_id: tunnelId }, secret).catch((error) => {
    logger.warn('playit', 'Could not delete the playit tunnel', error)
  })
}

export function playitAgentRunning(): boolean {
  return Boolean(agentProcess && agentProcess.exitCode === null)
}
