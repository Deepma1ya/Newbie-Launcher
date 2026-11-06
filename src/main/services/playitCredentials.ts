import path from 'node:path'
import { promises as fs } from 'node:fs'
import { safeStorage } from 'electron'
import { paths } from './paths'
import { readJson, writeJsonAtomic } from '../util/fs'
import { logger } from '../util/log'

interface StoredPlayit {
  secretEnc?: string
}

function credentialsFile(): string {
  return path.join(paths.data, 'playit.json')
}

function encryptSecret(value: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(value).toString('base64')}`
    }
  } catch (error) {
    logger.warn('playit', 'safeStorage encryption unavailable', error)
  }
  return `plain:${Buffer.from(value, 'utf8').toString('base64')}`
}

function decryptSecret(value?: string): string | null {
  if (!value) return null
  try {
    if (value.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
    }
    if (value.startsWith('plain:')) {
      return Buffer.from(value.slice(4), 'base64').toString('utf8')
    }
    return value
  } catch (error) {
    logger.warn('playit', 'Could not decrypt the saved playit secret', error)
    return null
  }
}

export async function loadPlayitSecret(): Promise<string | null> {
  const stored = await readJson<StoredPlayit>(credentialsFile(), {})
  return decryptSecret(stored.secretEnc)
}

export async function savePlayitSecret(secret: string): Promise<void> {
  await writeJsonAtomic(credentialsFile(), { secretEnc: encryptSecret(secret) } satisfies StoredPlayit)
}

export async function clearPlayitSecret(): Promise<void> {
  await fs.rm(credentialsFile(), { force: true }).catch(() => undefined)
}
