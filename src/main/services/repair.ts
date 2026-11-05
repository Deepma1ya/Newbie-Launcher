import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Instance, RepairIssue, RepairReport } from '@shared/types'
import { store } from './store'
import { addonFolder } from './addonTypes'
import { metadataLoaderMatches, readJarMeta, type JarMeta } from './jarMeta'
import { compareVersions } from './loaders'
import { installAddon, persistInstance, toggleAddon } from './addons'
import { searchModrinth } from './modrinth'
import { zipPaths } from '../util/archive'
import { paths } from './paths'
import { pathExists, uniqueId } from '../util/fs'
import { logger } from '../util/log'

interface ScannedJar {
  filename: string
  path: string
  meta: JarMeta
}

export async function repairInstance(instanceId: string, apply: boolean): Promise<RepairReport> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  const jars = await scanJars(instance)
  const issues: RepairIssue[] = []
  const byModId = new Map<string, ScannedJar[]>()

  for (const jar of jars) {
    const key = jar.meta.modId
    const list = byModId.get(key) ?? []
    list.push(jar)
    byModId.set(key, list)
  }

  for (const [modId, duplicates] of byModId) {
    if (duplicates.length <= 1) continue
    const managed = new Set(instance.addons.map((addon) => addon.filename))
    const sorted = [...duplicates].sort((a, b) => {
      const aManaged = managed.has(a.filename) ? 0 : 1
      const bManaged = managed.has(b.filename) ? 0 : 1
      if (aManaged !== bManaged) return aManaged - bManaged
      const versionDiff = compareVersions(b.meta.version, a.meta.version)
      if (versionDiff !== 0) return versionDiff
      return a.filename.localeCompare(b.filename)
    })
    const keep = sorted[0]!
    const remove = sorted.slice(1)
    issues.push({
      id: uniqueId('issue'),
      severity: 'error',
      kind: 'duplicate',
      title: `Duplicate ${keep.meta.name}`,
      detail: `${duplicates.length} copies of ${modId} are installed. Keeping ${keep.meta.version}, disabling ${remove.map((item) => item.meta.version).join(', ')}.`,
      files: remove.map((item) => item.filename),
      autoFixable: true,
      fixLabel: 'Keep newest, disable the rest'
    })
  }

  for (const jar of jars) {
    if (!metadataLoaderMatches(jar.meta, instance.loader)) {
      issues.push({
        id: uniqueId('issue'),
        severity: 'error',
        kind: 'loader-mismatch',
        title: `${jar.meta.name} is built for ${jar.meta.loader}`,
        detail: `This ${instance.loader} instance cannot load a ${jar.meta.loader} mod. It will be disabled.`,
        files: [jar.filename],
        autoFixable: true,
        fixLabel: 'Disable incompatible mod'
      })
    }
  }

  const installedIds = new Set(jars.flatMap((jar) => [jar.meta.modId, ...jar.meta.provided]))
  for (const jar of jars) {
    for (const dependency of jar.meta.dependencies) {
      if (dependency.incompatible && installedIds.has(dependency.id)) {
        const offender = jars.find((candidate) => candidate.meta.modId === dependency.id)
        if (offender) {
          issues.push({
            id: uniqueId('issue'),
            severity: 'error',
            kind: 'incompatible',
            title: `${jar.meta.name} conflicts with ${offender.meta.name}`,
            detail: `${jar.meta.name} declares ${offender.meta.name} as incompatible. Disabling the conflicting mod.`,
            files: [offender.filename],
            autoFixable: true,
            fixLabel: 'Disable conflicting mod'
          })
        }
      } else if (dependency.required && !installedIds.has(dependency.id) && !isIgnoredDependency(dependency.id)) {
        issues.push({
          id: uniqueId('issue'),
          severity: 'warning',
          kind: 'missing-dependency',
          title: `${jar.meta.name} needs ${dependency.id}`,
          detail: `Required dependency ${dependency.id}${dependency.versionRange ? ` ${dependency.versionRange}` : ''} is missing. Newbie Launcher can try to install it from Modrinth.`,
          files: [jar.filename],
          autoFixable: true,
          fixLabel: 'Install missing dependency'
        })
      }
    }
  }

  for (const record of instance.addons) {
    if (record.type !== 'mod') continue
    const active = path.join(instance.gameDir, 'mods', record.filename)
    const disabled = `${active}.disabled`
    if (!(await pathExists(active)) && !(await pathExists(disabled))) {
      issues.push({
        id: uniqueId('issue'),
        severity: 'warning',
        kind: 'corrupt',
        title: `${record.name} is missing its file`,
        detail: 'The add-on record exists but the file is gone. Reinstall it to restore the loadout.',
        files: [record.filename],
        autoFixable: false
      })
    }
  }

  let fixed = 0
  let skipped = 0
  let backupPath: string | undefined
  if (apply && issues.some((issue) => issue.autoFixable)) {
    const modsDir = path.join(instance.gameDir, 'mods')
    backupPath = path.join(
      paths.repairBackups,
      `${instance.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
    )
    try {
      await zipPaths(instance.gameDir, ['mods', 'resourcepacks', 'shaderpacks'], backupPath)
    } catch (error) {
      logger.warn('repair', 'Could not create repair backup', error)
      backupPath = undefined
    }

    for (const issue of issues) {
      if (!issue.autoFixable) {
        skipped += 1
        continue
      }
      try {
        if (issue.kind === 'duplicate' || issue.kind === 'loader-mismatch' || issue.kind === 'incompatible') {
          for (const filename of issue.files) {
            await disableFile(instance, filename)
          }
          fixed += 1
        } else if (issue.kind === 'missing-dependency') {
          const depId = issue.title.split(' needs ')[1]?.trim()
          if (depId && (await tryInstallDependency(instance, depId))) fixed += 1
          else skipped += 1
        }
      } catch (error) {
        logger.warn('repair', `Failed to apply repair: ${issue.title}`, error)
        skipped += 1
      }
    }

    // Keep records in sync with the files that were disabled above.
    for (const record of instance.addons) {
      if (record.type !== 'mod') continue
      const active = path.join(instance.gameDir, 'mods', record.filename)
      const disabled = `${active}.disabled`
      record.enabled = (await pathExists(active)) && !(await pathExists(disabled))
    }
    await persistInstance(instance)
    void modsDir
  }

  logger.info('repair', `Repair scan for ${instance.name}: ${issues.length} issue(s), ${fixed} fixed, ${skipped} skipped`)
  return {
    instanceId,
    scannedAt: new Date().toISOString(),
    issues,
    fixed,
    skipped,
    backupPath
  }
}

async function scanJars(instance: Instance): Promise<ScannedJar[]> {
  const result: ScannedJar[] = []
  for (const folder of new Set([addonFolder('mod'), addonFolder('resourcepack'), addonFolder('shader')])) {
    const dir = path.join(instance.gameDir, folder)
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(jar|zip)$/i.test(entry.name)) continue
      const file = path.join(dir, entry.name)
      const meta = readJarMeta(file)
      if (meta) result.push({ filename: entry.name, path: file, meta })
    }
  }
  return result
}

async function disableFile(instance: Instance, filename: string): Promise<void> {
  const folder = filename.endsWith('.zip') ? 'resourcepacks' : 'mods'
  const candidates = [path.join(instance.gameDir, 'mods', filename), path.join(instance.gameDir, 'resourcepacks', filename), path.join(instance.gameDir, 'shaderpacks', filename)]
  for (const active of candidates) {
    if (!(await pathExists(active))) continue
    const disabled = `${active}.disabled`
    if (!(await pathExists(disabled))) await fs.rename(active, disabled)
    return
  }
  void folder
}

async function tryInstallDependency(instance: Instance, dependencyId: string): Promise<boolean> {
  try {
    const page = await searchModrinth({
      query: dependencyId,
      type: 'mod',
      gameVersion: instance.versionId,
      loader: instance.loader,
      limit: 8
    })
    const hit = page.hits.find(
      (candidate) =>
        candidate.slug.toLowerCase() === dependencyId.toLowerCase() ||
        candidate.title.toLowerCase() === dependencyId.toLowerCase()
    )
    if (!hit || !('project_id' in hit)) return false
    await installAddon(instance.id, {
      projectId: hit.project_id,
      versionId: ''
    })
    return true
  } catch (error) {
    logger.warn('repair', `Could not auto-install dependency ${dependencyId}`, error)
    return false
  }
}

function isIgnoredDependency(id: string): boolean {
  return ['minecraft', 'java', 'fabricloader', 'fabric', 'quilt_loader', 'forge', 'neoforge', 'cloth-config'].includes(
    id.toLowerCase()
  )
}
