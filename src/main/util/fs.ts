import { promises as fs } from 'node:fs'
import path from 'node:path'

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8')
    return JSON.parse(raw.replace(/^\uFEFF/, '')) as T
  } catch {
    return fallback
  }
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file))
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(temp, file)
}

export async function writeTextAtomic(file: string, value: string): Promise<void> {
  await ensureDir(path.dirname(file))
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temp, value, 'utf8')
  await fs.rename(temp, file)
}

export async function copyDir(source: string, destination: string): Promise<void> {
  await fs.cp(source, destination, { recursive: true, force: true, errorOnExist: false })
}

export async function removeDir(target: string): Promise<void> {
  await fs.rm(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 })
}

export async function listFilesRecursive(root: string): Promise<string[]> {
  const result: string[] = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) result.push(full)
    }
  }
  await walk(root)
  return result
}

export async function directorySize(root: string): Promise<number> {
  const files = await listFilesRecursive(root)
  let total = 0
  for (const file of files) {
    try {
      total += (await fs.stat(file)).size
    } catch {
      // File may disappear while scanning.
    }
  }
  return total
}

export async function existsWithSize(file: string, expectedSize?: number): Promise<boolean> {
  try {
    const stat = await fs.stat(file)
    if (!stat.isFile()) return false
    if (stat.size === 0) return false
    return expectedSize === undefined || stat.size === expectedSize
  } catch {
    return false
  }
}

export function safeJoin(root: string, relative: string): string {
  const normalized = relative.replace(/\\/g, '/').replace(/^\/+/, '')
  const target = path.resolve(root, normalized)
  const rootResolved = path.resolve(root)
  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) {
    throw new Error(`Path escapes root: ${relative}`)
  }
  return target
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}

export function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
