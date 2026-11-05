import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountSummary, AuthAccount } from '@shared/types'

const accountState = vi.hoisted(() => ({
  accounts: [] as AuthAccount[],
  activeId: null as string | null
}))

vi.mock('@main/services/http', () => ({
  fetchJson: vi.fn()
}))

vi.mock('@main/services/store', () => {
  const toSummary = (account: AuthAccount): AccountSummary => ({
    id: account.id,
    type: account.type,
    username: account.username,
    uuid: account.uuid,
    active: account.id === accountState.activeId,
    skinUrl: account.skinUrl,
    capeUrl: account.capeUrl,
    createdAt: account.createdAt,
    expiresAt: account.expiresAt,
    xuid: account.xuid,
    gamertag: account.gamertag
  })
  return {
    store: {
      upsertAccount: vi.fn(async (account: AuthAccount) => {
        accountState.accounts = accountState.accounts.filter((entry) => entry.id !== account.id)
        accountState.accounts.push(account)
        if (!accountState.activeId) accountState.activeId = account.id
        return toSummary(account)
      }),
      setActiveAccount: vi.fn(async (id: string) => {
        accountState.activeId = id
      })
    }
  }
})

import { completeLogin } from '@main/auth/microsoft'
import { fetchJson } from '@main/services/http'
import { store } from '@main/services/store'

const token = {
  access_token: 'microsoft-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'Bearer'
}

function queueResponses(): void {
  const mocked = vi.mocked(fetchJson)
  mocked.mockResolvedValueOnce({
    Token: 'xbl-token',
    DisplayClaims: { xui: [{ uhs: 'user-hash', xid: 'xbox-user-id' }] }
  } as never)
  mocked.mockResolvedValueOnce({
    Token: 'xsts-token',
    DisplayClaims: { xui: [{ uhs: 'user-hash', xid: 'xbox-user-id', gtg: 'NotchGamer' }] }
  } as never)
  mocked.mockResolvedValueOnce({
    username: 'Notch',
    access_token: 'minecraft-token',
    expires_in: 86_400,
    token_type: 'Bearer'
  } as never)
  mocked.mockResolvedValueOnce({ id: 'minecraft-uuid', name: 'Notch', skins: [], capes: [] } as never)
}

describe('Microsoft account activation', () => {
  beforeEach(() => {
    accountState.accounts = [
      {
        id: 'offline_1',
        type: 'offline',
        username: 'LocalPlayer',
        uuid: 'offline-uuid',
        active: true,
        createdAt: new Date().toISOString()
      }
    ]
    accountState.activeId = 'offline_1'
    vi.clearAllMocks()
  })

  it('makes a freshly signed-in Microsoft account the active player', async () => {
    queueResponses()
    const summary = await completeLogin(token, true)

    expect(store.setActiveAccount).toHaveBeenCalledWith('msa_minecraft-uuid')
    expect(accountState.activeId).toBe('msa_minecraft-uuid')
    expect(summary.active).toBe(true)
    expect(summary.username).toBe('Notch')
    expect(summary.xuid).toBe('xbox-user-id')
    expect(summary.gamertag).toBe('NotchGamer')
  })

  it('keeps the selected account when an existing Microsoft session is refreshed', async () => {
    queueResponses()
    const summary = await completeLogin(token)

    expect(store.setActiveAccount).not.toHaveBeenCalled()
    expect(accountState.activeId).toBe('offline_1')
    expect(summary.active).toBe(false)
  })
})
