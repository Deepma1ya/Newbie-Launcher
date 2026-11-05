import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  ServerAddressTest,
  ServerShareAddress,
  ServerShareInfo
} from '@shared/types'
import { USER_AGENT } from '@shared/constants'
import { getServer } from './serverStore'
import { isServerRunning } from './serverProcess'
import { logger } from '../util/log'

const execFileAsync = promisify(execFile)
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
)
const NETWORK_CACHE_MS = 60_000
const PUBLIC_IP_CACHE_MS = 10 * 60_000

interface NetworkInfo {
  gateway?: string
  lan: ServerShareAddress[]
  radminAddress?: string
}

let networkCache: { at: number; value: NetworkInfo } | null = null
let publicIpCache: { at: number; value?: string } | null = null

export async function getServerShareInfo(serverId: string): Promise<ServerShareInfo> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const [network, resolvedPublicIp] = await Promise.all([detectNetwork(), resolvePublicIp()])
  const lan = network.lan.map((entry) => ({
    interface: entry.interface,
    address: withPort(entry.address, server.port)
  }))
  return {
    serverId,
    port: server.port,
    running: isServerRunning(serverId),
    localAddress: `localhost:${server.port}`,
    lan,
    radminAddress: network.radminAddress
      ? withPort(network.radminAddress, server.port)
      : undefined,
    publicIp: resolvedPublicIp,
    publicAddress: resolvedPublicIp ? `${resolvedPublicIp}:${server.port}` : undefined,
    gateway: network.gateway
  }
}

/** Plain LAN addresses, reused by pack sharing for temporary download links. */
export async function getServerShareAddresses(): Promise<ServerShareAddress[]> {
  const network = await detectNetwork()
  return [
    ...network.lan,
    ...(network.radminAddress
      ? [{ interface: 'Radmin VPN', address: network.radminAddress }]
      : [])
  ]
}

export async function testServerAddress(raw: string): Promise<ServerAddressTest> {
  const address = normaliseAddress(raw)
  if (!address) throw new Error('Enter a server address like play.example.com or 1.2.3.4:25565')
  const parsed = splitAddress(address)
  if (isLocalHost(parsed.host)) {
    const reachable = await probeTcp(parsed.host, parsed.port)
    return {
      address,
      online: reachable,
      note: reachable
        ? 'The server accepts a TCP connection on this address. Internet reachability is not tested here.'
        : undefined,
      error: reachable
        ? undefined
        : 'Nothing is accepting connections on this address. Start the server and check the port.'
    }
  }
  try {
    const response = await fetch(
      `https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000)
      }
    )
    if (!response.ok) throw new Error(`Status service returned HTTP ${response.status}`)
    const data = (await response.json()) as {
      online?: boolean
      players?: { online?: number; max?: number }
      version?: string | { name?: string }
    }
    if (!data.online) {
      return {
        address,
        online: false,
        error: 'No response. Check that the server is running and the address or tunnel is active.'
      }
    }
    return {
      address,
      online: true,
      playersOnline: data.players?.online,
      playersMax: data.players?.max,
      version:
        typeof data.version === 'string'
          ? data.version
          : data.version?.name ?? undefined
    }
  } catch (error) {
    logger.warn('server-share', `Could not test ${address}`, error)
    return {
      address,
      online: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function normaliseAddress(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^tcp:\/\//i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
  if (!cleaned) return null
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(cleaned)) return null
  const port = cleaned.includes(':')
    ? Number(cleaned.slice(cleaned.lastIndexOf(':') + 1))
    : undefined
  if (port !== undefined && (port < 1 || port > 65535)) return null
  return cleaned
}

function withPort(address: string, port: number): string {
  return `${address}:${port}`
}

function splitAddress(address: string): { host: string; port: number } {
  const index = address.lastIndexOf(':')
  if (index === -1) return { host: address, port: 25565 }
  const host = address.slice(0, index)
  const port = Number(address.slice(index + 1))
  return { host, port: Number.isFinite(port) ? port : 25565 }
}

export function isLocalHost(host: string): boolean {
  const lower = host.toLowerCase()
  if (lower === 'localhost' || lower === '::1') return true
  return (
    /^127\./.test(lower) ||
    /^10\./.test(lower) ||
    /^192\.168\./.test(lower) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(lower) ||
    /^169\.254\./.test(lower) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(lower) ||
    /^26\./.test(lower)
  )
}

function probeTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    let settled = false
    const finish = (reachable: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(reachable)
    }
    socket.setTimeout(5_000, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

async function detectNetwork(): Promise<NetworkInfo> {
  if (networkCache && Date.now() - networkCache.at < NETWORK_CACHE_MS) {
    return networkCache.value
  }
  let value = await detectNetworkPowerShell()
  if (!value) value = detectNetworkNode()
  networkCache = { at: Date.now(), value }
  return value
}

async function detectNetworkPowerShell(): Promise<NetworkInfo | null> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$config = Get-NetIPConfiguration | Where-Object { $_.InterfaceAlias -notmatch 'Radmin|VPN|Tailscale|WireGuard' -and $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1
$gateway = if ($config -and $config.IPv4DefaultGateway) { [string]$config.IPv4DefaultGateway.NextHop } else { '' }
$items = @()
foreach ($addr in (Get-NetIPAddress -AddressFamily IPv4)) {
  $ip = [string]$addr.IPAddress
  if ($ip -like '127.*' -or $ip -like '169.254.*') { continue }
  $adapter = Get-NetAdapter -InterfaceIndex $addr.InterfaceIndex -ErrorAction SilentlyContinue
  $name = if ($adapter) { "$($adapter.Name) ($($adapter.InterfaceDescription))" } else { "Adapter $($addr.InterfaceIndex)" }
  $items += [pscustomobject]@{ name = $name; address = $ip }
}
[pscustomobject]@{ gateway = $gateway; addresses = @($items) } | ConvertTo-Json -Depth 4 -Compress
`
  try {
    const { stdout } = await execFileAsync(
      POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 10_000 }
    )
    const raw = stdout.trim()
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      gateway?: string
      addresses?: { name?: string; address?: string }[]
    }
    const entries = Array.isArray(parsed.addresses) ? parsed.addresses : []
    return buildNetworkInfo(
      parsed.gateway,
      entries.map((entry) => ({
        interface: String(entry.name ?? 'Network'),
        address: String(entry.address ?? '')
      }))
    )
  } catch (error) {
    logger.debug('server-share', 'PowerShell network detection failed', error)
    return null
  }
}

function detectNetworkNode(): NetworkInfo {
  const entries: { interface: string; address: string }[] = []
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue
      if (address.address.startsWith('169.254.')) continue
      entries.push({ interface: name, address: address.address })
    }
  }
  return buildNetworkInfo(undefined, entries)
}

function buildNetworkInfo(
  gateway: string | undefined,
  entries: { interface: string; address: string }[]
): NetworkInfo {
  const unique = new Map<string, { interface: string; address: string }>()
  const radmin: string[] = []
  for (const entry of entries) {
    if (!entry.address) continue
    if (/radmin/i.test(entry.interface)) {
      radmin.push(entry.address)
      continue
    }
    if (/virtual|vmware|virtualbox|hyper-v|vethernet|tailscale|wsl|bluetooth|loopback|vpn|wireguard|openvpn|nordlynx|proton|zerotier|hamachi/i.test(entry.interface)) {
      continue
    }
    unique.set(`${entry.interface}:${entry.address}`, entry)
  }
  const lan = [...unique.values()].sort((a, b) => {
    const score = (address: string): number => {
      if (/^192\.168\./.test(address)) return 0
      if (/^10\./.test(address)) return 1
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2
      return 3
    }
    return score(a.address) - score(b.address)
  })
  return {
    gateway: gateway || undefined,
    lan,
    radminAddress: radmin[0]
  }
}

async function resolvePublicIp(): Promise<string | undefined> {
  if (publicIpCache && Date.now() - publicIpCache.at < PUBLIC_IP_CACHE_MS) {
    return publicIpCache.value
  }
  try {
    const response = await fetch('https://api.ipify.org', {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6_000)
    })
    const value = response.ok ? (await response.text()).trim() : ''
    const valid = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) ? value : undefined
    publicIpCache = { at: Date.now(), value: valid }
    return valid
  } catch (error) {
    logger.debug('server-share', 'Could not resolve public IP', error)
    publicIpCache = { at: Date.now(), value: undefined }
    return undefined
  }
}
