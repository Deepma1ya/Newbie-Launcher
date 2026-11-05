import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { AuthAccount, Instance } from '@shared/types'
import { findTlsCapeArtifact, type TlsCapeArtifact, type TlsCapeSyncResult } from '@shared/tlskincape'
import { downloadFile } from './http'
import { paths } from './paths'
import { store } from './store'
import { ensureDir, pathExists, safeJoin } from '../util/fs'
import { sha1File } from '../util/hash'
import { logger } from '../util/log'

const CAPE_FILE_PATTERN = /^tl_?skin_?cape.*\.jar$/i

/**
 * Places the official TLSkinCape mod into the instance mods folder before
 * launch. The jar is downloaded from TLauncher's repository, verified against
 * its published size and SHA-1, and only removed when Newbie owns the file.
 */
export async function syncTlsCape(instance: Instance, account: AuthAccount | null): Promise<TlsCapeSyncResult> {
  const settings = store.settings()
  const artifact = findTlsCapeArtifact(instance.loader, instance.versionId)
  const enabled = settings.tlauncherCapePlugin && instance.tlauncherCape !== false

  if (!enabled) {
    await removeManagedFile(instance)
    return { active: false, installed: false, reason: 'disabled' }
  }
  if (!account || account.type !== 'tlauncher') {
    await removeManagedFile(instance)
    return { active: false, installed: false, reason: 'account' }
  }
  if (!artifact) {
    await removeManagedFile(instance)
    return { active: false, installed: false, reason: 'unsupported' }
  }

  const modsDir = path.join(instance.gameDir, 'mods')
  const target = path.join(modsDir, artifact.fileName)
  const managedFileName = instance.tlsCapeFile ? path.basename(instance.tlsCapeFile) : undefined

  // A different build was installed earlier (for example after a version change).
  if (managedFileName && managedFileName !== artifact.fileName) {
    await removeManagedFile(instance, false)
  }

  const entries = await fs.readdir(modsDir).catch(() => [] as string[])
  const capeFiles = entries.filter((entry) => CAPE_FILE_PATTERN.test(entry))
  const targetIsManaged = managedFileName === artifact.fileName
  if (capeFiles.length > 0 && !targetIsManaged) {
    // The user already supplied a TLSkinCape build (or a previous untracked one).
    // Never create a duplicate; leave their file alone and do not claim ownership.
    await setManagedFile(instance, undefined)
    return {
      active: true,
      installed: true,
      reason: 'existing',
      fileName: capeFiles[0],
      modVersion: artifact.modVersion
    }
  }

  await ensureDir(modsDir)
  const disabledCopy = `${target}.disabled`
  if (await pathExists(disabledCopy)) await fs.rm(disabledCopy, { force: true })

  let targetReady = false
  if (await pathExists(target)) {
    const stat = await fs.stat(target).catch(() => null)
    targetReady =
      stat?.size === artifact.size && (await sha1File(target).catch(() => '')) === artifact.sha1
  }
  if (!targetReady) {
    const cached = await ensureCachedArtifact(artifact)
    await fs.copyFile(cached, target)
    logger.info('tlskincape', `Installed ${artifact.fileName} for ${instance.name}`)
  }

  await setManagedFile(instance, `mods/${artifact.fileName}`)
  return {
    active: true,
    installed: true,
    fileName: artifact.fileName,
    modVersion: artifact.modVersion
  }
}

async function ensureCachedArtifact(artifact: TlsCapeArtifact): Promise<string> {
  const cacheDir = path.join(paths.cache, 'tlskincape')
  const cached = path.join(cacheDir, artifact.fileName)
  await downloadFile(artifact.url, cached, {
    sha1: artifact.sha1,
    size: artifact.size,
    retries: 4
  })
  return cached
}

async function removeManagedFile(instance: Instance, clearRecord = true): Promise<void> {
  const relative = instance.tlsCapeFile
  if (!relative) return
  try {
    const active = safeJoin(instance.gameDir, relative)
    await Promise.all([
      fs.rm(active, { force: true }),
      fs.rm(`${active}.disabled`, { force: true })
    ])
    logger.info('tlskincape', `Removed ${path.basename(relative)} from ${instance.name}`)
  } catch (error) {
    logger.warn('tlskincape', `Could not remove ${relative}`, error)
  }
  if (clearRecord) await setManagedFile(instance, undefined)
}

async function setManagedFile(instance: Instance, relative: string | undefined): Promise<void> {
  if (instance.tlsCapeFile === relative) return
  instance.tlsCapeFile = relative
  await store.updateInstance(instance.id, (current) => {
    current.tlsCapeFile = relative
  })
}
