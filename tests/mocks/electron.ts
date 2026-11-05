import os from 'node:os'
import path from 'node:path'

export const app = {
  getPath: (name: string): string => {
    if (name === 'appData') return path.join(os.tmpdir(), 'newbie-test-appdata')
    if (name === 'userData') return path.join(os.tmpdir(), 'newbie-test-userdata')
    return os.tmpdir()
  }
}

export const safeStorage = {
  isEncryptionAvailable: (): boolean => false,
  encryptString: (value: string): Buffer => Buffer.from(value, 'utf8'),
  decryptString: (value: Buffer): string => value.toString('utf8')
}

export const appReady = true

export default { app, safeStorage }
