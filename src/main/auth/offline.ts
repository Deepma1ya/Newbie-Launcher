import { randomBytes } from 'node:crypto'
import type { AccountSummary, AuthAccount } from '@shared/types'
import { offlineUuid } from '../util/hash'
import { store } from '../services/store'
import { logger } from '../util/log'

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/

export function validateUsername(username: string): string {
  const trimmed = username.trim()
  if (!USERNAME_PATTERN.test(trimmed)) {
    throw new Error('Usernames must be 3–16 characters using letters, numbers or underscores.')
  }
  return trimmed
}

export async function addOfflineAccount(username: string): Promise<AccountSummary> {
  const name = validateUsername(username)
  const uuid = offlineUuid(name)
  const account: AuthAccount = {
    id: `offline_${uuid}`,
    type: 'offline',
    username: name,
    uuid,
    active: false,
    createdAt: new Date().toISOString(),
    accessToken: randomBytes(16).toString('hex')
  }
  const summary = await store.upsertAccount(account)
  logger.info('auth', `Added offline account ${name}`)
  return summary
}
