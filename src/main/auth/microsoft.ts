import { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { MICROSOFT_CLIENT_ID, MICROSOFT_SCOPE } from '@shared/constants'
import type { AccountSummary, AuthAccount, MicrosoftAuthState } from '@shared/types'
import { emit } from '../services/events'
import { fetchJson } from '../services/http'
import { logger } from '../util/log'
import { store } from '../services/store'
import { getMainWindow } from '../window'

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

interface XboxResponse {
  Token: string
  DisplayClaims: { xui: { uhs: string; xid?: string }[] }
}

interface MinecraftProfile {
  id: string
  name: string
  skins?: { id: string; state: string; url: string; variant?: string }[]
  capes?: { id: string; state: string; url: string; alias?: string }[]
}

interface ActiveFlow {
  cancelled: boolean
  window: BrowserWindow | null
  completed: boolean
}

let activeFlow: ActiveFlow | null = null

const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf'
const AUTHORIZE_URL =
  'https://login.live.com/oauth20_authorize.srf' +
  `?client_id=${encodeURIComponent(MICROSOFT_CLIENT_ID)}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(MICROSOFT_SCOPE)}` +
  `&prompt=select_account`
const LIVE_TOKEN_URL = 'https://login.live.com/oauth20_token.srf'

function notify(state: MicrosoftAuthState): void {
  emit({ type: 'microsoft-auth', payload: state })
}

export async function startMicrosoftFlow(): Promise<void> {
  if (activeFlow) {
    activeFlow.cancelled = true
    activeFlow.window?.close()
  }
  const flow: ActiveFlow = { cancelled: false, window: null, completed: false }
  activeFlow = flow

  try {
    const parent = getMainWindow() ?? undefined
    const authWindow = new BrowserWindow({
      width: 520,
      height: 720,
      parent,
      modal: Boolean(parent),
      show: true,
      autoHideMenuBar: true,
      title: 'Sign in with Microsoft',
      backgroundColor: '#0B0F0C',
      webPreferences: {
        partition: 'persist:newbie-microsoft',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    })
    flow.window = authWindow
    authWindow.removeMenu()
    authWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    const handleUrl = (rawUrl: string): void => {
      if (flow.completed) return
      if (!rawUrl.startsWith('https://login.live.com/oauth20_desktop.srf')) return
      flow.completed = true
      try {
        const parsed = new URL(rawUrl)
        const code = parsed.searchParams.get('code')
        const error = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error')
        if (!code) {
          notify({ status: 'error', message: error ?? 'Microsoft sign-in was cancelled.' })
          authWindow.close()
          return
        }
        notify({ status: 'waiting', message: 'Exchanging Microsoft sign-in…' })
        authWindow.close()
        void completeCodeLogin(code, flow)
      } catch (error) {
        notify({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        authWindow.close()
      }
    }

    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith('https://login.live.com/oauth20_desktop.srf')) {
        event.preventDefault()
        handleUrl(url)
      }
    })
    authWindow.webContents.on('will-navigate', (_event, url) => handleUrl(url))
    authWindow.webContents.on('did-navigate', (_event, url) => handleUrl(url))
    authWindow.on('closed', () => {
      if (!flow.completed && !flow.cancelled) {
        flow.cancelled = true
        notify({ status: 'cancelled' })
      }
      if (activeFlow === flow) activeFlow = null
    })
    authWindow.webContents.on('did-fail-load', (_event, code, description) => {
      logger.warn('microsoft', `Sign-in window failed to load: ${code} ${description}`)
    })

    notify({ status: 'waiting', message: 'Complete the sign-in in the Microsoft window.' })
    await authWindow.loadURL(AUTHORIZE_URL)
    setTimeout(() => {
      if (!flow.completed && !flow.cancelled) {
        notify({ status: 'error', message: 'Microsoft sign-in timed out. Please try again.' })
        flow.cancelled = true
        authWindow.close()
      }
    }, 10 * 60 * 1000)
  } catch (error) {
    logger.error('microsoft', 'Microsoft sign-in failed', error)
    notify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Microsoft sign-in failed'
    })
  }
}

async function completeCodeLogin(code: string, flow: ActiveFlow): Promise<void> {
  try {
    const token = await exchangeCode(code)
    if (flow.cancelled) return
    const account = await completeLogin(token)
    notify({ status: 'success', account })
  } catch (error) {
    logger.error('microsoft', 'Microsoft code exchange failed', error)
    notify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Microsoft sign-in failed'
    })
  } finally {
    if (activeFlow === flow) activeFlow = null
  }
}

async function exchangeCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    scope: MICROSOFT_SCOPE
  })
  const response = await fetch(LIVE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error_description?: string; error?: string }
    throw new Error(payload.error_description ?? payload.error ?? 'Microsoft token exchange failed')
  }
  return (await response.json()) as TokenResponse
}

export function cancelMicrosoftFlow(): void {
  if (activeFlow) {
    activeFlow.cancelled = true
    activeFlow.window?.close()
    activeFlow = null
  }
  notify({ status: 'cancelled' })
}

export async function completeLogin(token: TokenResponse): Promise<AccountSummary> {
  const xbl = await fetchJson<XboxResponse>(
    'https://user.auth.xboxlive.com/user/authenticate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${token.access_token}`
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      })
    },
    { timeoutMs: 30_000 }
  )

  const xsts = await fetchJson<XboxResponse>(
    'https://xsts.auth.xboxlive.com/xsts/authorize',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
        RelyingParty: 'rp://api.minecraftservices.com/',
        TokenType: 'JWT'
      })
    },
    { timeoutMs: 30_000 }
  )

  const uhs = xsts.DisplayClaims.xui[0]?.uhs
  const xid = xsts.DisplayClaims.xui[0]?.xid
  if (!uhs) throw new Error('Xbox Live did not return a user hash')

  const minecraft = await fetchJson<{
    username: string
    access_token: string
    expires_in: number
    token_type: string
  }>(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xsts.Token}` })
    },
    { timeoutMs: 30_000 }
  )

  const profile = await fetchJson<MinecraftProfile>(
    'https://api.minecraftservices.com/minecraft/profile',
    { headers: { Authorization: `Bearer ${minecraft.access_token}` } },
    { timeoutMs: 30_000, retries: 1 }
  ).catch((error: unknown) => {
    throw new Error(
      `This Microsoft account does not own Minecraft: Java Edition, or the profile is unavailable. ${error instanceof Error ? error.message : ''}`
    )
  })

  const now = new Date().toISOString()
  const account: AuthAccount = {
    id: `msa_${profile.id}`,
    type: 'microsoft',
    username: profile.name,
    uuid: profile.id,
    active: false,
    createdAt: now,
    expiresAt: new Date(Date.now() + Math.max(60, minecraft.expires_in) * 1000).toISOString(),
    skinUrl: profile.skins?.find((skin: { state: string; url: string }) => skin.state === 'ACTIVE')?.url ?? profile.skins?.[0]?.url,
    capeUrl: profile.capes?.[0]?.url,
    accessToken: minecraft.access_token,
    refreshToken: token.refresh_token,
    clientToken: undefined,
    xuid: xid
  }

  const summary = await store.upsertAccount(account)
  logger.info('microsoft', `Signed in as ${profile.name}`)
  return summary
}

export async function refreshMicrosoftAccount(account: AuthAccount): Promise<AuthAccount> {
  if (!account.refreshToken) throw new Error('This account has no Microsoft refresh token')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: MICROSOFT_CLIENT_ID,
    refresh_token: account.refreshToken,
    redirect_uri: REDIRECT_URI,
    scope: MICROSOFT_SCOPE
  })
  const response = await fetch(LIVE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error_description?: string }
    throw new Error(payload.error_description ?? 'Microsoft token refresh failed. Sign in again.')
  }
  const token = (await response.json()) as TokenResponse
  const summary = await completeLogin(token)
  const refreshed = store.account(summary.id)
  if (!refreshed) throw new Error('Account vanished during refresh')
  return refreshed
}

export async function ensureMicrosoftFresh(account: AuthAccount): Promise<AuthAccount> {
  const expiresAt = account.expiresAt ? Date.parse(account.expiresAt) : 0
  if (expiresAt && expiresAt - Date.now() > 3 * 60 * 1000) return account
  return refreshMicrosoftAccount(account)
}

export function newClientToken(): string {
  return randomUUID()
}
