import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export function sha1File(path: string): Promise<string> {
  return hashFile(path, 'sha1')
}

export function sha256File(path: string): Promise<string> {
  return hashFile(path, 'sha256')
}

export function hashFile(path: string, algorithm: 'sha1' | 'sha256' | 'sha512'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm)
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export function sha1Buffer(buffer: Buffer): string {
  return createHash('sha1').update(buffer).digest('hex')
}

export function offlineUuid(username: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest()
  hash[6] = (hash[6]! & 0x0f) | 0x30
  hash[8] = (hash[8]! & 0x3f) | 0x80
  const hex = hash.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
