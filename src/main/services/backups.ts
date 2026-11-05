import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { BackupRecord, Instance } from '@shared/types'
import { paths } from './paths'
import { store } from './store'
import { zipDirectory } from '../util/archive'
import { ensureDir, pathExists } from '../util/fs'
import { logger } from '../util/log'

export async function maybeBackupWorlds(instance: Instance): Promise<BackupRecord | null> {
  const settings = store.settings().backups
  if (!settings.enabled) return null
  const saves = path.join(instance.gameDir, 'saves')
  if (!(await pathExists(saves))) return null
  const entries = await fs.readdir(saves).catch(() => [])
  if (entries.length === 0) return null

  if (settings.frequency === 'daily') {
    const today = new Date().toISOString().slice(0, 10)
    const existing = await listBackups(instance.id)
    if (existing.some((backup) => backup.filename.includes(today))) return null
  }

  await ensureDir(paths.worldBackups)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destination = path.join(paths.worldBackups, `${instance.id}-${stamp}.zip`)
  try {
    await zipDirectory(saves, destination)
    const stat = await fs.stat(destination)
    const record: BackupRecord = {
      filename: path.basename(destination),
      path: destination,
      size: stat.size,
      createdAt: new Date().toISOString()
    }
    await pruneBackups()
    logger.info('backup', `World backup created for ${instance.name} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`)
    return record
  } catch (error) {
    logger.warn('backup', `World backup failed for ${instance.name}`, error)
    return null
  }
}

export async function createBackupNow(instance: Instance): Promise<BackupRecord> {
  const saves = path.join(instance.gameDir, 'saves')
  if (!(await pathExists(saves))) throw new Error('This instance has no worlds folder yet')
  await ensureDir(paths.worldBackups)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destination = path.join(paths.worldBackups, `${instance.id}-${stamp}.zip`)
  await zipDirectory(saves, destination)
  const stat = await fs.stat(destination)
  await pruneBackups()
  return {
    filename: path.basename(destination),
    path: destination,
    size: stat.size,
    createdAt: new Date().toISOString()
  }
}

export async function listBackups(instanceId?: string): Promise<BackupRecord[]> {
  await ensureDir(paths.worldBackups)
  const files = await fs.readdir(paths.worldBackups).catch(() => [])
  const records: BackupRecord[] = []
  for (const file of files) {
    if (!file.endsWith('.zip')) continue
    if (instanceId && !file.startsWith(instanceId)) continue
    const full = path.join(paths.worldBackups, file)
    const stat = await fs.stat(full).catch(() => null)
    if (!stat) continue
    records.push({
      filename: file,
      path: full,
      size: stat.size,
      createdAt: stat.mtime.toISOString()
    })
  }
  return records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function pruneBackups(): Promise<void> {
  const settings = store.settings().backups
  const backups = await listBackups()
  const cutoff = Date.now() - Math.max(1, settings.keepDays) * 24 * 60 * 60 * 1000
  let kept: BackupRecord[] = []
  for (const backup of backups) {
    if (Date.parse(backup.createdAt) < cutoff) {
      await fs.rm(backup.path, { force: true }).catch(() => undefined)
    } else {
      kept.push(backup)
    }
  }
  let total = kept.reduce((sum, backup) => sum + backup.size, 0)
  const maxBytes = Math.max(256, settings.maxSizeMb) * 1024 * 1024
  kept.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  while (total > maxBytes && kept.length > 1) {
    const oldest = kept.shift()
    if (!oldest) break
    await fs.rm(oldest.path, { force: true }).catch(() => undefined)
    total -= oldest.size
  }
}
