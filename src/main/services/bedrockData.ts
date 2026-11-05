import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { BedrockChannel } from '@shared/types'
import { ensureDir, pathExists } from '../util/fs'
import { logger } from '../util/log'

export interface PreservedPackageData {
  source: string
  backup: string
}

/**
 * Store-installed packages reject Remove-AppxPackage -PreserveApplicationData.
 * Move the player data outside the package folder before removal and put it
 * back afterwards, so worlds survive uninstall and version replacement.
 */
export async function preservePackageData(
  localAppData: string,
  target: { familyName: string; channel: BedrockChannel }
): Promise<PreservedPackageData[]> {
  const packageRoot = path.join(localAppData, 'Packages', target.familyName)
  const backupRoot = path.join(
    localAppData,
    'NewbieLauncher',
    'bedrock-uninstall',
    `${target.channel}-${Date.now()}-${process.pid}`
  )
  const preserved: PreservedPackageData[] = []
  for (const name of ['LocalState', 'RoamingState']) {
    const source = path.join(packageRoot, name)
    if (!(await pathExists(source))) continue
    const backup = path.join(backupRoot, name)
    await ensureDir(backupRoot)
    try {
      await fs.rename(source, backup)
      preserved.push({ source, backup })
    } catch (error) {
      if (name === 'LocalState') {
        await restorePreservedData(preserved).catch(() => undefined)
        throw new Error(
          `Could not preserve the Minecraft data folder before uninstalling. Close Minecraft and try again. ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
      logger.warn('bedrock', `Could not preserve ${name} during package removal`, error)
    }
  }
  return preserved
}

export async function restorePreservedData(preserved: PreservedPackageData[]): Promise<void> {
  for (const item of preserved) {
    await fs.rm(item.source, { recursive: true, force: true }).catch(() => undefined)
    await ensureDir(path.dirname(item.source))
    try {
      await fs.rename(item.backup, item.source)
    } catch {
      await fs.cp(item.backup, item.source, { recursive: true, force: true })
      await fs.rm(item.backup, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}
