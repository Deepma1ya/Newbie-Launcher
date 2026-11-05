import type { AuthAccount } from '@shared/types'
import { MICROSOFT_CLIENT_ID } from '@shared/constants'
import { store } from '../services/store'
import { ensureMicrosoftFresh, refreshMicrosoftAccount } from './microsoft'
import { refreshAuthlibAccount } from './authlib'
import type { LaunchProfile } from '../services/launchArgs'

export interface LaunchSession {
  account: AuthAccount
  profile: LaunchProfile
}

export async function sessionForLaunch(accountId: string): Promise<LaunchSession> {
  const account = store.account(accountId)
  if (!account) throw new Error('Select an account before launching')

  if (account.type === 'microsoft') {
    const fresh = await ensureMicrosoftFresh(account).catch(async (error) => {
      if (account.refreshToken) {
        const refreshed = await refreshMicrosoftAccount(account).catch(() => null)
        if (refreshed) return refreshed
      }
      throw error
    })
    return {
      account: fresh,
      profile: {
        username: fresh.username,
        uuid: fresh.uuid,
        accessToken: fresh.accessToken ?? '',
        userType: 'msa',
        xuid: fresh.xuid,
        clientId: MICROSOFT_CLIENT_ID
      }
    }
  }

  if (account.type === 'authlib') {
    const fresh = account.accessToken ? account : await refreshAuthlibAccount(account)
    return {
      account: fresh,
      profile: {
        username: fresh.username,
        uuid: fresh.uuid,
        accessToken: fresh.accessToken ?? '',
        userType: 'legacy'
      }
    }
  }

  return {
    account,
    profile: {
      username: account.username,
      uuid: account.uuid,
      accessToken: account.accessToken ?? account.uuid.replace(/-/g, ''),
      userType: 'legacy'
    }
  }
}
