import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { USER_AGENT } from '@shared/constants'
import { ensureDir, pathExists } from '../util/fs'
import { sha1File, sha256File } from '../util/hash'
import { logger } from '../util/log'
import { sleep } from '../util/async'

export interface DownloadOptions {
  sha1?: string
  sha256?: string
  size?: number
  signal?: AbortSignal
  onProgress?: (received: number, total: number, speedBps: number) => void
  retries?: number
  headers?: Record<string, string>
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: '*/*'
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number } = {}
): Promise<T> {
  const { timeoutMs = 30_000, retries = 3 } = options
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { ...DEFAULT_HEADERS, Accept: 'application/json', ...(init.headers ?? {}) },
        signal: init.signal ?? AbortSignal.timeout(timeoutMs)
      })
      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status} for ${url}`, response.status, url)
      }
      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (error instanceof Error && error.name === 'AbortError' && init.signal?.aborted) throw error
      if (attempt < retries) {
        const delay = 600 * 2 ** attempt + Math.random() * 300
        logger.warn('http', `GET ${url} failed (attempt ${attempt + 1}), retrying in ${Math.round(delay)}ms`, error)
        await sleep(delay)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number } = {}
): Promise<string> {
  const { timeoutMs = 30_000, retries = 3 } = options
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { ...DEFAULT_HEADERS, ...(init.headers ?? {}) },
        signal: init.signal ?? AbortSignal.timeout(timeoutMs)
      })
      if (!response.ok) throw new HttpError(`HTTP ${response.status} for ${url}`, response.status, url)
      return await response.text()
    } catch (error) {
      lastError = error
      if (error instanceof Error && error.name === 'AbortError' && init.signal?.aborted) throw error
      if (attempt < retries) await sleep(700 * 2 ** attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function fileMatches(file: string, options: DownloadOptions): Promise<boolean> {
  if (!(await pathExists(file))) return false
  const stat = await fs.stat(file).catch(() => null)
  if (!stat || stat.size === 0) return false
  if (options.size !== undefined && stat.size !== options.size) return false
  if (options.sha256) {
    const digest = await sha256File(file)
    return digest.toLowerCase() === options.sha256.toLowerCase()
  }
  if (options.sha1) {
    const digest = await sha1File(file)
    return digest.toLowerCase() === options.sha1.toLowerCase()
  }
  return true
}

export async function downloadFile(url: string, destination: string, options: DownloadOptions = {}): Promise<number> {
  if (await fileMatches(destination, options)) return (await fs.stat(destination)).size

  await ensureDir(path.dirname(destination))
  const temp = `${destination}.${process.pid}.${Date.now()}.part`
  const retries = options.retries ?? 3
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...(options.headers ?? {}) },
        signal: options.signal,
        redirect: 'follow'
      })
      if (!response.ok || !response.body) {
        throw new HttpError(`HTTP ${response.status} for ${url}`, response.status, url)
      }
      const total = Number(response.headers.get('content-length') ?? options.size ?? 0)
      let received = 0
      let lastEmit = 0
      const started = Date.now()
      const body = Readable.fromWeb(response.body as never)
      body.on('data', (chunk: Buffer) => {
        received += chunk.length
        const now = Date.now()
        if (options.onProgress && now - lastEmit > 120) {
          lastEmit = now
          const seconds = Math.max(0.001, (now - started) / 1000)
          options.onProgress(received, total, received / seconds)
        }
      })
      await pipeline(body, createWriteStream(temp))
      if (options.onProgress) options.onProgress(received, total || received, received / Math.max(0.001, (Date.now() - started) / 1000))
      if (options.size && received !== options.size) {
        throw new Error(`Size mismatch for ${path.basename(destination)}: expected ${options.size}, got ${received}`)
      }
      if (options.sha256) {
        const digest = await sha256File(temp)
        if (digest.toLowerCase() !== options.sha256.toLowerCase()) {
          throw new Error(`SHA-256 mismatch for ${path.basename(destination)}`)
        }
      }
      if (options.sha1) {
        const digest = await sha1File(temp)
        if (digest.toLowerCase() !== options.sha1.toLowerCase()) {
          throw new Error(`SHA-1 mismatch for ${path.basename(destination)}`)
        }
      }
      await fs.rename(temp, destination)
      return received
    } catch (error) {
      lastError = error
      await fs.rm(temp, { force: true }).catch(() => undefined)
      if (options.signal?.aborted) throw error
      if (attempt < retries) {
        const delay = 800 * 2 ** attempt + Math.random() * 500
        logger.warn('http', `Download failed (attempt ${attempt + 1}): ${url}`, error)
        await sleep(delay)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
