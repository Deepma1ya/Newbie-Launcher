import path from 'node:path'
import { promises as fs } from 'node:fs'
import AdmZip from 'adm-zip'

export function listZipEntries(file: string): string[] {
  const zip = new AdmZip(file)
  return zip.getEntries().map((entry) => entry.entryName)
}

export function readZipText(file: string, entryName: string): string | null {
  const zip = new AdmZip(file)
  const entry = zip.getEntry(entryName)
  if (!entry) return null
  return entry.getData().toString('utf8')
}

export function readZipJson<T>(file: string, entryName: string): T | null {
  const text = readZipText(file, entryName)
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function extractZip(file: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true })
  const zip = new AdmZip(file)
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const target = path.resolve(destination, entry.entryName)
    const root = path.resolve(destination)
    if (target !== root && !target.startsWith(root + path.sep)) continue
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, entry.getData())
  }
}

export function extractZipEntryTo(file: string, entryName: string, destination: string): boolean {
  const zip = new AdmZip(file)
  const entry = zip.getEntry(entryName)
  if (!entry) return false
  const fsSync = require('node:fs') as typeof import('node:fs')
  fsSync.mkdirSync(path.dirname(destination), { recursive: true })
  fsSync.writeFileSync(destination, entry.getData())
  return true
}

export function findZipEntry(file: string, predicate: (name: string) => boolean): string | null {
  const zip = new AdmZip(file)
  const entry = zip.getEntries().find((candidate) => predicate(candidate.entryName))
  return entry?.entryName ?? null
}
