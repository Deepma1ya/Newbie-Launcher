import type { ChildProcess } from 'node:child_process'
import type {
  ServerInternetProvider,
  ServerInternetState,
  ServerInternetStatus,
  ServerRecord
} from '@shared/types'
import { getServer } from './serverStore'
import { isServerRunning } from './serverProcess'
import { startBoreRelay, stopBoreRelay } from './boreRelay'
import {
  createPlayitTunnel,
  deletePlayitTunnel,
  exchangePlayitClaim,
  newPlayitClaim,
  playitAgentRunning,
  pollPlayitClaim,
  stopPlayitAgent
} from './playit'
import { clearPlayitSecret, loadPlayitSecret, savePlayitSecret } from './playitCredentials'
import { logger } from '../util/log'

interface ActiveRelay {
  serverId: string
  provider: ServerInternetProvider
  protocol: 'tcp' | 'udp'
  status: ServerInternetStatus
  address?: string
  claimCode?: string
  claimUrl?: string
  message?: string
  secret?: string
  tunnelId?: string
  boreChild?: ChildProcess
  claimTimer?: NodeJS.Timeout
  claimedAt?: number
  startedAt: number
}

const relays = new Map<string, ActiveRelay>()
let playitSecretCache: string | null | undefined
const CLAIM_TIMEOUT_MS = 10 * 60_000

async function getPlayitSecret(): Promise<string | null> {
  if (playitSecretCache !== undefined) return playitSecretCache
  playitSecretCache = await loadPlayitSecret()
  return playitSecretCache
}

async function forgetPlayitSecret(): Promise<void> {
  playitSecretCache = null
  await clearPlayitSecret()
}

function protocolFor(server: ServerRecord): 'tcp' | 'udp' {
  return server.type === 'bedrock' ? 'udp' : 'tcp'
}

function stateFor(server: ServerRecord, relay?: ActiveRelay, connected = false): ServerInternetState {
  return {
    serverId: server.id,
    provider: relay?.provider ?? null,
    protocol: relay?.protocol ?? protocolFor(server),
    status: relay?.status ?? 'offline',
    address: relay?.address,
    claimUrl: relay?.claimUrl,
    claimCode: relay?.claimCode,
    message: relay?.message,
    playitConnected: connected
  }
}

export async function getServerInternetState(serverId: string): Promise<ServerInternetState> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const connected = Boolean(await getPlayitSecret())
  return stateFor(server, relays.get(serverId), connected)
}

export async function startServerInternet(
  serverId: string,
  provider: ServerInternetProvider
): Promise<ServerInternetState> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  if (!isServerRunning(serverId)) throw new Error('Start the server before opening internet access.')
  if (provider !== 'playit' && provider !== 'bore') throw new Error('Unknown relay provider.')
  if (provider === 'bore' && server.type === 'bedrock') {
    throw new Error('The quick relay supports Java TCP only. Use playit.gg for Bedrock UDP.')
  }

  const existing = relays.get(serverId)
  if (existing) {
    if (existing.status === 'online' || existing.status === 'starting' || existing.status === 'claiming') {
      return stateFor(server, existing, Boolean(await getPlayitSecret()))
    }
    await stopServerInternet(serverId)
  }

  const relay: ActiveRelay = {
    serverId,
    provider,
    protocol: protocolFor(server),
    status: 'starting',
    startedAt: Date.now()
  }
  relays.set(serverId, relay)

  if (provider === 'playit') {
    const secret = await getPlayitSecret()
    if (secret) {
      relay.secret = secret
      void runPlayitTunnel(relay, server)
    } else {
      const claim = newPlayitClaim()
      relay.status = 'claiming'
      relay.claimCode = claim.code
      relay.claimUrl = claim.url
      relay.claimedAt = Date.now()
      scheduleClaimPoll(relay, server)
    }
  } else {
    void runBoreRelay(relay, server)
  }

  return stateFor(server, relay, Boolean(await getPlayitSecret()))
}

function scheduleClaimPoll(relay: ActiveRelay, server: ServerRecord): void {
  relay.claimTimer = setTimeout(() => {
    void pollClaim(relay, server)
  }, 1_500)
}

async function pollClaim(relay: ActiveRelay, server: ServerRecord): Promise<void> {
  if (relays.get(relay.serverId) !== relay || relay.status !== 'claiming' || !relay.claimCode) return
  if (relay.claimedAt && Date.now() - relay.claimedAt > CLAIM_TIMEOUT_MS) {
    relay.status = 'error'
    relay.message = 'The playit.gg claim expired. Start the setup again.'
    relay.claimUrl = undefined
    return
  }
  try {
    const state = await pollPlayitClaim(relay.claimCode)
    if (relays.get(relay.serverId) !== relay) return
    if (state === 'rejected') {
      relay.status = 'error'
      relay.message = 'The playit.gg agent claim was rejected.'
      relay.claimUrl = undefined
      return
    }
    if (state === 'accepted') {
      relay.status = 'starting'
      relay.claimUrl = undefined
      relay.message = 'Claim approved. Creating the tunnel…'
      try {
        const secret = await exchangePlayitClaim(relay.claimCode)
        relay.claimCode = undefined
        relay.secret = secret
        playitSecretCache = secret
        await savePlayitSecret(secret)
        await runPlayitTunnel(relay, server)
      } catch (error) {
        if (relays.get(relay.serverId) === relay) {
          relay.status = 'error'
          relay.message = error instanceof Error ? error.message : String(error)
        }
      }
      return
    }
    relay.message = 'Waiting for playit.gg approval…'
  } catch (error) {
    relay.message = error instanceof Error ? error.message : String(error)
  }
  scheduleClaimPoll(relay, server)
}

async function runPlayitTunnel(relay: ActiveRelay, server: ServerRecord): Promise<void> {
  const secret = relay.secret
  if (!secret) {
    relay.status = 'error'
    relay.message = 'playit.gg is not connected.'
    return
  }
  try {
    const tunnel = await createPlayitTunnel(secret, {
      name: `Newbie ${server.name}`,
      protocol: relay.protocol,
      port: server.port
    })
    if (relays.get(relay.serverId) !== relay) {
      await deletePlayitTunnel(secret, tunnel.id)
      return
    }
    relay.tunnelId = tunnel.id
    relay.address = tunnel.address
    relay.status = 'online'
    relay.message = undefined
    logger.info('relay', `playit tunnel online for ${server.name}: ${tunnel.address}`)
  } catch (error) {
    if (relays.get(relay.serverId) !== relay) return
    const message = error instanceof Error ? error.message : String(error)
    relay.status = 'error'
    relay.message = message
    if (/auth|secret|unauthorized|invalid/i.test(message)) {
      await forgetPlayitSecret()
    }
    logger.warn('relay', `playit tunnel failed for ${server.name}`, error)
  } finally {
    if (![...relays.values()].some((entry) => entry.provider === 'playit' && entry.status !== 'error')) {
      await stopPlayitAgent().catch(() => undefined)
    }
  }
}

async function runBoreRelay(relay: ActiveRelay, server: ServerRecord): Promise<void> {
  try {
    const result = await startBoreRelay(server.port)
    if (relays.get(relay.serverId) !== relay) {
      await stopBoreRelay(result.child)
      return
    }
    relay.boreChild = result.child
    relay.address = result.address
    relay.status = 'online'
    relay.message = undefined
    logger.info('relay', `bore relay online for ${server.name}: ${result.address}`)
  } catch (error) {
    if (relays.get(relay.serverId) !== relay) return
    relay.status = 'error'
    relay.message = error instanceof Error ? error.message : String(error)
    logger.warn('relay', `bore relay failed for ${server.name}`, error)
  }
}

export async function stopServerInternet(serverId: string): Promise<ServerInternetState> {
  const server = await getServer(serverId)
  if (!server) throw new Error('Server not found')
  const relay = relays.get(serverId)
  if (!relay) return stateFor(server, undefined, Boolean(await getPlayitSecret()))

  if (relay.claimTimer) {
    clearTimeout(relay.claimTimer)
    relay.claimTimer = undefined
  }
  relays.delete(serverId)

  if (relay.provider === 'playit' && relay.secret && relay.tunnelId) {
    await deletePlayitTunnel(relay.secret, relay.tunnelId)
  }
  if (relay.boreChild) await stopBoreRelay(relay.boreChild)
  if (
    relay.provider === 'playit' &&
    ![...relays.values()].some((entry) => entry.provider === 'playit' && entry.status !== 'error') &&
    playitAgentRunning()
  ) {
    await stopPlayitAgent().catch(() => undefined)
  }
  return stateFor(server, undefined, Boolean(await getPlayitSecret()))
}

export async function stopAllServerInternet(): Promise<void> {
  const ids = [...relays.keys()]
  await Promise.all(ids.map((id) => stopServerInternet(id).catch(() => undefined)))
  await stopPlayitAgent().catch(() => undefined)
}
