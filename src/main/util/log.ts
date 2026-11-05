import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDir } from './fs'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

class Logger {
  private dataDir = ''
  private ring: string[] = []
  private writeChain: Promise<void> = Promise.resolve()

  setDataDir(dir: string): void {
    this.dataDir = dir
  }

  private line(level: LogLevel, scope: string, message: string, extra?: unknown): string {
    const timestamp = new Date().toISOString()
    const suffix =
      extra === undefined ? '' : ` ${extra instanceof Error ? extra.stack ?? extra.message : safeStringify(extra)}`
    return `[${timestamp}] [${level.toUpperCase()}] [${scope}] ${message}${suffix}`
  }

  log(level: LogLevel, scope: string, message: string, extra?: unknown): void {
    const text = this.line(level, scope, message, extra)
    this.ring.push(text)
    if (this.ring.length > 2000) this.ring.shift()
    if (level === 'error') console.error(text)
    else if (level === 'warn') console.warn(text)
    else console.log(text)
    if (!this.dataDir) return
    const file = path.join(this.dataDir, 'logs', 'launcher.log')
    this.writeChain = this.writeChain
      .then(async () => {
        await ensureDir(path.dirname(file))
        await fs.appendFile(file, text + '\n', 'utf8')
        const stat = await fs.stat(file).catch(() => null)
        if (stat && stat.size > 5 * 1024 * 1024) {
          await fs.rename(file, path.join(this.dataDir, 'logs', `launcher-${Date.now()}.log`)).catch(() => undefined)
        }
      })
      .catch(() => undefined)
  }

  info(scope: string, message: string, extra?: unknown): void {
    this.log('info', scope, message, extra)
  }

  warn(scope: string, message: string, extra?: unknown): void {
    this.log('warn', scope, message, extra)
  }

  error(scope: string, message: string, extra?: unknown): void {
    this.log('error', scope, message, extra)
  }

  debug(scope: string, message: string, extra?: unknown): void {
    if (process.env.NODE_ENV !== 'production') this.log('debug', scope, message, extra)
  }

  recent(): string[] {
    return [...this.ring]
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const logger = new Logger()
