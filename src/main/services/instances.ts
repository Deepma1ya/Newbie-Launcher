import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  CreateInstanceInput,
  Instance,
  Loadout,
  RepairReport,
  UpdateInstanceInput
} from '@shared/types'
import { store } from './store'
import { paths } from './paths'
import { installGame } from './installer'
import { installLoader, versionIdForLoader } from './loaders'
import { getVersionJson } from './mojang'
import { tasks } from './tasks'
import { repairInstance } from './repair'
import { isInstanceBusy, launchInstance, runningStates, stopInstance } from './launch'
import { ensureDir, pathExists, removeDir, sanitizeFilename, slugify, uniqueId } from '../util/fs'
import { logger } from '../util/log'

const COLORS = ['#6EE7A0', '#7DD3FC', '#FDE68A', '#F9A8D4', '#C4B5FD', '#FCA5A5', '#A7F3D0', '#FDBA74']

export function listInstances(): Instance[] {
  return store.instances().sort((a, b) => {
    const aTime = a.lastPlayedAt ? Date.parse(a.lastPlayedAt) : 0
    const bTime = b.lastPlayedAt ? Date.parse(b.lastPlayedAt) : 0
    if (aTime !== bTime) return bTime - aTime
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

export function getInstance(id: string): Instance | null {
  return store.instance(id)
}

export async function createInstance(input: CreateInstanceInput): Promise<Instance> {
  const name = input.name.trim()
  if (!name) throw new Error('Give the instance a name')
  const version = await getVersionJson(input.versionId)
  if (!version) throw new Error('Unknown Minecraft version')

  const id = await uniqueInstanceId(name)
  const now = new Date().toISOString()
  const loadout: Loadout = {
    id: uniqueId('loadout'),
    name: 'Default',
    mode: 'offline',
    addonIds: [],
    createdAt: now,
    updatedAt: now
  }
  const instance: Instance = {
    id,
    name,
    versionId: input.versionId,
    resolvedVersionId: input.versionId,
    loader: input.loader,
    loaderVersion: input.loaderVersion ?? '',
    iconUrl: input.iconUrl,
    color: input.color ?? COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#6EE7A0',
    createdAt: now,
    totalPlayTimeSec: 0,
    memoryMb: clampMemory(input.memoryMb ?? store.settings().java.defaultMemoryMb),
    width: 1280,
    height: 720,
    fullscreen: false,
    javaPath: null,
    jvmArgs: '',
    gameDir: paths.instanceGameDir(id),
    activeLoadoutId: loadout.id,
    loadouts: [loadout],
    addons: []
  }

  await ensureDir(instance.gameDir)
  await ensureDir(paths.instanceLogs(id))
  await store.addInstance(instance)

  const handle = tasks.start('install-version', `Installing ${name}`, `${input.versionId} · ${input.loader}`, id)
  try {
    let gameVersionId = input.versionId
    if (input.loader !== 'vanilla') {
      handle.progress({
        stage: 'loader',
        message: `Installing ${input.loader}`,
        current: 0,
        total: 1,
        percent: 4,
        instanceId: id
      })
      gameVersionId = await installLoader(input.loader, input.versionId, input.loaderVersion, (message) =>
        handle.progress({
          stage: 'loader',
          message,
          current: 0,
          total: 1,
          percent: 8,
          instanceId: id
        })
      )
      await store.updateInstance(id, (current) => {
        current.resolvedVersionId = gameVersionId
        current.loaderVersion = extractLoaderVersion(input.loader, gameVersionId, input.loaderVersion)
      })
    }

    await installGame(gameVersionId, {
      onProgress: (progress) =>
        handle.progress({
          ...progress,
          percent: 10 + progress.percent * 0.82,
          instanceId: id
        })
    })

    if (input.modpack) {
      handle.progress({
        stage: 'addons',
        message: 'Installing modpack',
        current: 0,
        total: 1,
        percent: 92,
        instanceId: id
      })
      const { installModpackIntoInstance } = await import('./modpacks')
      await installModpackIntoInstance(instance.id, input.modpack.projectId, input.modpack.versionId)
    }

    await handle.done('Ready to play')
    return store.instance(id) ?? instance
  } catch (error) {
    await handle.fail(error)
    await store.removeInstance(id)
    await removeDir(paths.instance(id)).catch(() => undefined)
    throw error
  }
}

export async function updateInstance(id: string, patch: UpdateInstanceInput): Promise<Instance> {
  const instance = store.instance(id)
  if (!instance) throw new Error('Instance not found')
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('Give the instance a name')
    instance.name = name
  }
  if (patch.memoryMb !== undefined) instance.memoryMb = clampMemory(patch.memoryMb)
  if (patch.width !== undefined) instance.width = Math.max(320, Math.min(7680, Math.round(patch.width)))
  if (patch.height !== undefined) instance.height = Math.max(240, Math.min(4320, Math.round(patch.height)))
  if (patch.fullscreen !== undefined) instance.fullscreen = Boolean(patch.fullscreen)
  if (patch.javaPath !== undefined) instance.javaPath = patch.javaPath?.trim() || null
  if (patch.jvmArgs !== undefined) instance.jvmArgs = patch.jvmArgs.trim()
  if (patch.iconUrl !== undefined) instance.iconUrl = patch.iconUrl
  if (patch.color !== undefined) instance.color = patch.color
  await store.updateInstance(id, (current) => Object.assign(current, instance))

  const versionChanged = Boolean(patch.versionId && patch.versionId !== instance.versionId)
  const loaderChanged =
    Boolean(patch.loader && patch.loader !== instance.loader) ||
    (patch.loaderVersion !== undefined && patch.loaderVersion !== instance.loaderVersion)
  if (versionChanged || loaderChanged) {
    await changeInstanceVersion(
      id,
      patch.versionId ?? instance.versionId,
      patch.loader ?? instance.loader,
      patch.loaderVersion ?? instance.loaderVersion
    )
  }
  return store.instance(id)!
}

export async function changeInstanceVersion(
  id: string,
  versionId: string,
  loader: Instance['loader'],
  loaderVersion?: string
): Promise<Instance> {
  const instance = store.instance(id)
  if (!instance) throw new Error('Instance not found')
  if (isInstanceBusy(id)) {
    throw new Error('Close Minecraft before changing its version')
  }
  const handle = tasks.start('install-version', `Updating ${instance.name}`, `${versionId} · ${loader}`, id)
  try {
    let gameVersionId = versionId
    if (loader !== 'vanilla') {
      gameVersionId = await installLoader(loader, versionId, loaderVersion, (message) =>
        handle.progress({ stage: 'loader', message, current: 0, total: 1, percent: 8, instanceId: id })
      )
    }
    await installGame(gameVersionId, {
      onProgress: (progress) => handle.progress({ ...progress, percent: 10 + progress.percent * 0.8, instanceId: id })
    })
    await store.updateInstance(id, (current) => {
      current.versionId = versionId
      current.resolvedVersionId = gameVersionId
      current.loader = loader
      current.loaderVersion = extractLoaderVersion(loader, gameVersionId, loaderVersion)
    })
    // Bring add-ons forward to versions that support the new game version.
    const { updateAllAddons } = await import('./addons')
    await updateAllAddons(id, (message, percent) =>
      handle.progress({ stage: 'addons', message, current: percent ?? 0, total: 100, percent: 90, instanceId: id })
    ).catch(() => undefined)
    await handle.done('Version updated')
    return store.instance(id)!
  } catch (error) {
    await handle.fail(error)
    throw error
  }
}

export async function removeInstance(id: string, deleteFiles: boolean): Promise<void> {
  const instance = store.instance(id)
  if (!instance) return
  if (isInstanceBusy(id)) {
    const running = runningStates().some((state) => state.instanceId === id)
    if (!running) throw new Error('Wait for Minecraft to finish starting before deleting this instance')
    await stopInstance(id)
  }

  let trashPath: string | null = null
  if (deleteFiles) trashPath = await moveInstanceToTrash(id)

  // Remove the instance from the launcher immediately. The renamed folder is
  // cleaned in the background, so a large world or modpack cannot freeze the UI.
  await store.removeInstance(id)
  await store.flush()

  if (deleteFiles) {
    if (trashPath) {
      void removeDir(trashPath).catch((error) =>
        logger.warn('instances', `Could not finish deleting ${trashPath}`, error)
      )
    } else {
      void removeDir(paths.instance(id)).catch((error) =>
        logger.warn('instances', `Could not finish deleting ${id}`, error)
      )
    }
  }
  logger.info('instances', `Removed ${instance.name}${deleteFiles ? ' with files' : ''}`)
}

async function moveInstanceToTrash(id: string): Promise<string | null> {
  const source = paths.instance(id)
  if (!(await pathExists(source))) return null
  await ensureDir(paths.instanceTrash)
  const target = path.join(
    paths.instanceTrash,
    `${sanitizeFilename(id)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  )
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.rename(source, target)
      return target
    } catch (error) {
      if (attempt === 7) {
        logger.warn('instances', `Could not move ${source} to trash; deleting in place`, error)
        return null
      }
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
  return null
}

export async function openInstanceFolder(id: string, sub?: string): Promise<string> {
  const instance = store.instance(id)
  if (!instance) throw new Error('Instance not found')
  const target = sub ? path.resolve(instance.gameDir, sub) : instance.gameDir
  if (!target.startsWith(path.resolve(instance.gameDir))) throw new Error('Invalid folder')
  await ensureDir(target)
  return target
}

export async function repair(
  id: string,
  apply: boolean,
  allowDisable = true,
  reuseBackup?: string
): Promise<RepairReport> {
  return repairInstance(id, apply, allowDisable, reuseBackup)
}

export async function instanceExists(id: string): Promise<boolean> {
  return pathExists(paths.instance(id))
}

async function uniqueInstanceId(name: string): Promise<string> {
  const base = slugify(name) || 'instance'
  let candidate = base
  let index = 1
  while (await pathExists(paths.instance(candidate))) {
    index += 1
    candidate = `${base}-${index}`
  }
  return candidate
}

function clampMemory(value: number): number {
  const total = Math.round(os.totalmem() / 1024 / 1024)
  const max = Math.max(2048, Math.floor(total * 0.75))
  const min = 1024
  const rounded = Math.round(Number(value) / 256) * 256
  return Math.max(min, Math.min(max, Number.isFinite(rounded) ? rounded : 4096))
}

function extractLoaderVersion(loader: Instance['loader'], versionId: string, fallback?: string): string {
  if (fallback) return fallback
  if (loader === 'fabric') {
    const match = versionId.match(/^fabric-loader-(.+)-[^-]+$/)
    return match?.[1] ?? ''
  }
  if (loader === 'quilt') {
    const match = versionId.match(/^quilt-loader-(.+)-[^-]+$/)
    return match?.[1] ?? ''
  }
  if (loader === 'forge') {
    const match = versionId.match(/^forge-(.+)-(.+)$/)
    return match?.[2] ?? ''
  }
  if (loader === 'neoforge') return versionId.replace(/^neoforge-/, '')
  return ''
}

export function instanceVersionId(instance: Instance): string {
  return versionIdForLoader(instance.loader, instance.versionId, instance.loaderVersion)
}

export async function duplicateInstance(id: string): Promise<Instance> {
  const source = store.instance(id)
  if (!source) throw new Error('Instance not found')
  const newId = await uniqueInstanceId(`${source.name} Copy`)
  const target = paths.instance(newId)
  await fs.cp(paths.instance(id), target, { recursive: true, force: false, errorOnExist: false })
  const copy: Instance = {
    ...structuredClone(source),
    id: newId,
    name: `${source.name} Copy`,
    gameDir: paths.instanceGameDir(newId),
    createdAt: new Date().toISOString(),
    lastPlayedAt: undefined,
    totalPlayTimeSec: 0,
    loadouts: source.loadouts.map((loadout) => ({ ...loadout, id: uniqueId('loadout') })),
    activeLoadoutId: '',
    addons: source.addons.map((addon) => ({ ...addon, id: addon.id })),
    repairFailures: {}
  }
  copy.activeLoadoutId = copy.loadouts[0]?.id ?? ''
  await store.addInstance(copy)
  await fs.rm(paths.instanceMeta(newId), { force: true }).catch(() => undefined)
  await fs.writeFile(paths.instanceMeta(newId), JSON.stringify(copy, null, 2), 'utf8')
  return copy
}

export async function launch(id: string): Promise<void> {
  await launchInstance(id)
}

export async function stop(id: string): Promise<void> {
  await stopInstance(id)
}

export { sanitizeFilename }
