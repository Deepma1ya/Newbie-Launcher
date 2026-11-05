import { randomUUID } from 'node:crypto'
import type { AccountSummary, AuthAccount } from '@shared/types'
import { store } from '../services/store'
import { fetchJson } from '../services/http'
import { logger } from '../util/log'
import { validateUsername } from './offline'

interface AuthlibMeta {
  meta?: { serverName?: string; implementationName?: string; links?: Record<string, string> }
  skinDomains?: string[]
  signaturePublickey?: string
}

interface AuthlibAuthResponse {
  accessToken: string
  clientToken: string
  availableProfiles?: { id: string; name: string }[]
  selectedProfile?: { id: string; name: string }
  user?: { id: string; properties?: { name: string; value: string }[] }
}

export async function resolveAuthlibRoot(raw: string): Promise<{ apiRoot: string; meta: AuthlibMeta }> {
  let url = raw.trim()
  if (!url) throw new Error('Enter an authentication server URL')
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Authentication servers must use HTTPS (localhost is exempt for testing).')
  }
  const response = await fetch(parsed.toString(), {
    headers: { Accept: 'application/json' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`Authentication server returned HTTP ${response.status}`)
  const ali = response.headers.get('x-authlib-injector-api-location')
  const apiRoot = ali ? new URL(ali, parsed).toString().replace(/\/?$/, '/') : parsed.toString().replace(/\/?$/, '/')
  const meta = await fetchJson<AuthlibMeta>(apiRoot, {}, { timeoutMs: 20_000 }).catch(() => ({}))
  return { apiRoot, meta }
}

export async function addAuthlibAccount(input: {
  apiRoot: string
  username: string
  password: string
}): Promise<AccountSummary> {
  const name = validateUsername(input.username)
  if (!input.password) throw new Error('Enter the account password')
  const { apiRoot, meta } = await resolveAuthlibRoot(input.apiRoot)
  const clientToken = randomUUID()
  const auth = await fetchJson<AuthlibAuthResponse>(
    `${apiRoot}authserver/authenticate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: { name: 'Minecraft', version: 1 },
        username: name,
        password: input.password,
        clientToken,
        requestUser: true
      })
    },
    { timeoutMs: 30_000, retries: 0 }
  )
  const profile = auth.selectedProfile ?? auth.availableProfiles?.[0]
  if (!profile) throw new Error('The authentication server returned no Minecraft profile')

  const account: AuthAccount = {
    id: `authlib_${profile.id}`,
    type: 'authlib',
    username: profile.name,
    uuid: formatUuid(profile.id),
    active: false,
    createdAt: new Date().toISOString(),
    apiRoot,
    accessToken: auth.accessToken,
    clientToken: auth.clientToken,
    needsRefresh: false
  }
  const summary = await store.upsertAccount(account)
  logger.info('auth', `Added authlib account ${profile.name} on ${meta.meta?.serverName ?? apiRoot}`)
  return summary
}

export async function refreshAuthlibAccount(account: AuthAccount): Promise<AuthAccount> {
  if (!account.apiRoot || !account.accessToken) throw new Error('This authlib account cannot be refreshed')
  const auth = await fetchJson<AuthlibAuthResponse>(
    `${account.apiRoot}authserver/refresh`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: account.accessToken,
        clientToken: account.clientToken,
        requestUser: true
      })
    },
    { timeoutMs: 30_000, retries: 0 }
  )
  const profile = auth.selectedProfile ?? { id: account.uuid.replace(/-/g, ''), name: account.username }
  const updated: AuthAccount = {
    ...account,
    username: profile.name,
    uuid: formatUuid(profile.id),
    accessToken: auth.accessToken,
    clientToken: auth.clientToken
  }
  await store.upsertAccount(updated)
  return updated
}

function formatUuid(uuid: string): string {
  const clean = uuid.replace(/-/g, '').toLowerCase()
  if (clean.length !== 32) return uuid
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`
}
