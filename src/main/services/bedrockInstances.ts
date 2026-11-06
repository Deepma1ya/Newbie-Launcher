import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  BedrockChannel,
  BedrockInstance,
  BedrockInstanceSummary,
  BedrockSwitchResult
} from '@shared/types'
import type { BedrockContentCounts } from './bedrockContent'
import { BEDROCK_PUBLISHER_ID, BEDROCK_RELEASE_IDENTITY, BEDROCK_PREVIEW_IDENTITY } from '@shared/bedrock'
import { store } from './store'
import { paths } from './paths'
import {
  ensureBedrockContentLayout,
  countBedrockContent,
  scanBedrockContent
} from './bedrockContent'
import {
  detectBedrockInstallations,
  isBedrockGameRunning,
  isBedrockSessionActive,
  launchBedrock
} from './bedrock'
import { ensureDir, pathExists, sanitizeFilename, uniqueId } from '../util/fs'
import { logger } from '../util/log'

const COLORS = ['#6EE7A0', '#7DD3FC', '#FDE68A', '#F9A8D4', '#C4B5FD', '#FCA5A5', '#A7F3D0', '#FDBA74']

interface CreateBedrockInstanceInput {
  name: string
  channel: BedrockChannel
  color?: string
}

function roamingAppData(): string {
  return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
}

function localAppData(): string {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
}

function dataRootOverride(): string | null {
  const value = process.env.NEWBIE_BEDROCK_DATA_ROOT?.trim()
  return value ? path.resolve(value) : null
}

function bedrockUserRoot(channel: BedrockChannel): string {
  const folder = channel === 'preview' ? 'Minecraft Bedrock Preview' : 'Minecraft Bedrock'
  const override = dataRootOverride()
  return override
    ? path.join(override, folder)
    : path.join(roamingAppData(), folder)
}

function oldPackageDataPath(channel: BedrockChannel): string {
  const identity = channel === 'preview' ? BEDROCK_PREVIEW_IDENTITY : BEDROCK_RELEASE_IDENTITY
  const override = dataRootOverride()
  if (override) {
    return path.join(override, 'old-package', channel, 'games', 'com.mojang')
  }
  return path.join(
    localAppData(),
    'Packages',
    `${identity}_${BEDROCK_PUBLISHER_ID}`,
    'LocalState',
    'games',
    'com.mojang'
  )
}

async function directoryAge(target: string): Promise<number> {
  const stat = await fs.stat(target).catch(() => null)
  return stat ? stat.mtimeMs : 0
}

/**
 * Bedrock keeps per-Xbox-account data under %APPDATA%. Older UWP builds used
 * the package LocalState folder. Prefer the newest real data folder.
 */
export async function resolveBedrockGameDataPath(channel: BedrockChannel): Promise<string | null> {
  const userRoot = path.join(bedrockUserRoot(channel), 'Users')
  const userCandidates: { path: string; age: number }[] = []
  const users = await fs.readdir(userRoot, { withFileTypes: true }).catch(() => [])
  for (const entry of users) {
    if (!entry.isDirectory() || entry.name === 'Shared') continue
    const folder = path.join(userRoot, entry.name)
    userCandidates.push({
      path: path.join(folder, 'games', 'com.mojang'),
      age: await directoryAge(folder)
    })
  }
  const existingUser = await newestExisting(userCandidates.map((entry) => entry.path))
  if (existingUser) return existingUser
  if (userCandidates.length > 0) {
    // The account folder exists but the game has not created com.mojang yet.
    // Link the expected per-account path instead of falling back to Shared.
    userCandidates.sort((a, b) => b.age - a.age)
    return userCandidates[0]!.path
  }

  // Shared data and the old package path are fallbacks for installs that have
  // not created a per-account folder yet.
  return newestExisting([
    path.join(bedrockUserRoot(channel), 'games', 'com.mojang'),
    path.join(userRoot, 'Shared', 'games', 'com.mojang'),
    oldPackageDataPath(channel)
  ])
}

async function newestExisting(candidates: string[]): Promise<string | null> {
  const existing: { path: string; age: number }[] = []
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      existing.push({ path: candidate, age: await directoryAge(candidate) })
    }
  }
  existing.sort((a, b) => b.age - a.age)
  return existing[0]?.path ?? null
}

function samePath(a: string, b: string): boolean {
  const left = path.resolve(a)
  const right = path.resolve(b)
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}

function cleanLinkTarget(target: string): string {
  return target.replace(/^\\\\\?\\/, '').replace(/^\\\?\?\\/, '')
}

async function linkTarget(link: string): Promise<string | null> {
  const stat = await fs.lstat(link).catch(() => null)
  if (!stat || !stat.isSymbolicLink()) return null
  const target = await fs.readlink(link).catch(() => null)
  return target ? cleanLinkTarget(target) : null
}

async function uniqueDirectory(base: string): Promise<string> {
  let candidate = base
  let index = 2
  while (await pathExists(candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }
  return candidate
}

async function instanceCounts(dataDir: string): Promise<BedrockContentCounts> {
  return countBedrockContent(dataDir).catch(() => ({ contentCount: 0, worldCount: 0 }))
}

async function summaryFor(
  instance: BedrockInstance,
  installations: Awaited<ReturnType<typeof detectBedrockInstallations>>,
  gameDataPaths: Map<BedrockChannel, string | null>
): Promise<BedrockInstanceSummary> {
  const counts = await instanceCounts(instance.dataDir)
  const gamePath = gameDataPaths.get(instance.channel) ?? null
  const target = gamePath ? await linkTarget(gamePath) : null
  const linked = Boolean(
    gamePath &&
      (samePath(gamePath, instance.dataDir) ||
        (target !== null && samePath(target, instance.dataDir)))
  )
  return {
    ...instance,
    ...counts,
    active: store.bedrockActiveInstanceId() === instance.id,
    linked,
    installed: installations.some((entry) => entry.channel === instance.channel),
    running: installations.some((entry) => entry.running)
  }
}

export async function listBedrockInstances(): Promise<BedrockInstanceSummary[]> {
  const [instances, installations] = await Promise.all([
    Promise.resolve(store.bedrockInstances()),
    detectBedrockInstallations().catch(() => [])
  ])
  const gameDataPaths = new Map<BedrockChannel, string | null>()
  for (const channel of ['release', 'preview'] as BedrockChannel[]) {
    gameDataPaths.set(channel, await resolveBedrockGameDataPath(channel).catch(() => null))
  }
  const result: BedrockInstanceSummary[] = []
  for (const instance of instances) {
    result.push(await summaryFor(instance, installations, gameDataPaths))
  }
  return result.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

export async function createBedrockInstance(
  input: CreateBedrockInstanceInput
): Promise<BedrockInstanceSummary> {
  const name = input.name.trim()
  if (!name) throw new Error('Give the Bedrock instance a name')
  const channel: BedrockChannel = input.channel === 'preview' ? 'preview' : 'release'
  const id = `${sanitizeFilename(name).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'bedrock'}-${uniqueId('x').slice(-8)}`
  const dataDir = paths.bedrockInstanceData(id)
  await ensureBedrockContentLayout(dataDir)
  const instance: BedrockInstance = {
    id,
    name,
    channel,
    color: input.color ?? COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#6EE7A0',
    createdAt: new Date().toISOString(),
    totalPlayTimeSec: 0,
    dataDir,
    contentCount: 0,
    worldCount: 0
  }
  await store.addBedrockInstance(instance)
  if (!store.bedrockActiveInstanceId()) await store.setActiveBedrockInstance(instance.id)
  logger.info('bedrock', `Created Bedrock instance ${name} (${channel})`)
  return (await listBedrockInstances()).find((entry) => entry.id === id) ?? {
    ...instance,
    active: store.bedrockActiveInstanceId() === id,
    linked: false,
    installed: false,
    running: false
  }
}

export async function updateBedrockInstance(
  id: string,
  patch: { name?: string; color?: string }
): Promise<BedrockInstanceSummary> {
  const instance = store.bedrockInstance(id)
  if (!instance) throw new Error('Bedrock instance not found')
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('Give the Bedrock instance a name')
    instance.name = name
  }
  if (patch.color !== undefined) instance.color = patch.color
  await store.updateBedrockInstance(id, (current) => Object.assign(current, instance))
  return (await listBedrockInstances()).find((entry) => entry.id === id)!
}

export async function removeBedrockInstance(id: string): Promise<void> {
  const instance = store.bedrockInstance(id)
  if (!instance) throw new Error('Bedrock instance not found')
  if (instance.adopted) {
    throw new Error(
      'This profile owns your original Bedrock worlds. Keep it so those worlds stay available.'
    )
  }
  const gamePath = await resolveBedrockGameDataPath(instance.channel)
  if (gamePath) {
    const target = await linkTarget(gamePath)
    if (samePath(gamePath, instance.dataDir) || (target && samePath(target, instance.dataDir))) {
      throw new Error('Switch to another Bedrock instance before deleting this one.')
    }
  }
  const root = path.resolve(paths.bedrockInstances)
  const own = path.resolve(instance.dataDir)
  const instanceRoot = path.dirname(own)
  if (
    own.toLowerCase() === root.toLowerCase() ||
    !own.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`) ||
    !instanceRoot.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)
  ) {
    throw new Error('This profile is not managed by Newbie and cannot be deleted here.')
  }
  await fs.rm(instanceRoot, { recursive: true, force: true }).catch((error) => {
    logger.warn('bedrock', `Could not remove Bedrock instance folder ${id}`, error)
  })
  await store.removeBedrockInstance(id)
  logger.info('bedrock', `Removed Bedrock instance ${instance.name}`)
}

export async function setActiveBedrockInstance(id: string | null): Promise<void> {
  await store.setActiveBedrockInstance(id)
}

export async function openBedrockInstanceFolder(id: string): Promise<void> {
  const instance = store.bedrockInstance(id)
  if (!instance) throw new Error('Bedrock instance not found')
  await ensureDir(instance.dataDir)
  const { shell } = await import('electron')
  const error = await shell.openPath(instance.dataDir)
  if (error) throw new Error(error)
}

/**
 * Point the game's com.mojang folder at an instance. The first switch keeps
 * the existing data as a protected Default profile instead of deleting it.
 */
export async function switchBedrockInstance(id: string): Promise<BedrockSwitchResult> {
  const instance = store.bedrockInstance(id)
  if (!instance) throw new Error('Bedrock instance not found')
  if (isBedrockSessionActive() || (await isBedrockGameRunning())) {
    throw new Error('Close Minecraft before switching Bedrock instances.')
  }
  const gamePath = await resolveBedrockGameDataPath(instance.channel)
  if (!gamePath) {
    throw new Error(
      'Minecraft has not created its data folder yet. Launch it once from the Bedrock page, then switch instances.'
    )
  }
  await ensureBedrockContentLayout(instance.dataDir)

  if (samePath(gamePath, instance.dataDir)) {
    await store.setActiveBedrockInstance(id)
    return {
      instance: (await listBedrockInstances()).find((entry) => entry.id === id)!,
      migrated: false
    }
  }

  const previousTarget = await linkTarget(gamePath)
  if (previousTarget && samePath(previousTarget, instance.dataDir)) {
    await store.setActiveBedrockInstance(id)
    return {
      instance: (await listBedrockInstances()).find((entry) => entry.id === id)!,
      migrated: false
    }
  }

  const previousExists = await pathExists(gamePath)
  let movedTo: string | null = null
  let defaultInstance: BedrockInstance | null = null
  let createdDefaultId: string | null = null
  let previousDefaultId: string | null = null
  let previousDefaultDataDir: string | null = null
  let linkCreated = false
  try {
    if (previousTarget) {
      await fs.unlink(gamePath)
    } else if (previousExists) {
      movedTo = await uniqueDirectory(`${gamePath}.newbie-default`)
      await fs.rename(gamePath, movedTo)
      const existingDefault = store
        .bedrockInstances()
        .find((entry) => entry.channel === instance.channel && entry.adopted)
      if (existingDefault) {
        previousDefaultId = existingDefault.id
        previousDefaultDataDir = existingDefault.dataDir
        await store.updateBedrockInstance(existingDefault.id, (current) => {
          current.dataDir = movedTo!
          current.adopted = true
        })
        defaultInstance = store.bedrockInstance(existingDefault.id)
      } else {
        const counts = await instanceCounts(movedTo)
        const created: BedrockInstance = {
          id: `default-${instance.channel}-${Date.now()}`,
          name: 'My Bedrock',
          channel: instance.channel,
          color: '#FDE68A',
          createdAt: new Date().toISOString(),
          totalPlayTimeSec: 0,
          dataDir: movedTo,
          adopted: true,
          ...counts
        }
        await store.addBedrockInstance(created)
        createdDefaultId = created.id
        defaultInstance = created
      }
      logger.info('bedrock', `Kept existing Bedrock data as ${movedTo}`)
    }

    await ensureDir(path.dirname(gamePath))
    await ensureDir(instance.dataDir)
    await fs.symlink(instance.dataDir, gamePath, 'junction')
    linkCreated = true
    await store.setActiveBedrockInstance(id)
    logger.info('bedrock', `Switched Bedrock data to instance ${instance.name}`)
  } catch (error) {
    try {
      if (linkCreated) await fs.unlink(gamePath).catch(() => undefined)
      if (movedTo && (await pathExists(movedTo)) && !(await pathExists(gamePath))) {
        await fs.rename(movedTo, gamePath)
      } else if (previousTarget) {
        await fs.symlink(previousTarget, gamePath, 'junction').catch(() => undefined)
      }
      if (createdDefaultId) {
        await store.removeBedrockInstance(createdDefaultId).catch(() => undefined)
      }
      if (previousDefaultId && previousDefaultDataDir) {
        await store
          .updateBedrockInstance(previousDefaultId, (current) => {
            current.dataDir = previousDefaultDataDir!
          })
          .catch(() => undefined)
      }
    } catch (rollbackError) {
      logger.error('bedrock', 'Could not roll back the Bedrock data switch', rollbackError)
    }
    throw error
  }

  const summaries = await listBedrockInstances()
  return {
    instance: summaries.find((entry) => entry.id === id)!,
    migrated: Boolean(movedTo),
    defaultInstance: defaultInstance
      ? summaries.find((entry) => entry.id === defaultInstance!.id)
      : undefined
  }
}

export async function prepareBedrockLaunch(channel: BedrockChannel): Promise<string | null> {
  const id = store.bedrockActiveInstanceId()
  if (!id) return null
  const instance = store.bedrockInstance(id)
  if (!instance || instance.channel !== channel) return null
  await switchBedrockInstance(id)
  return id
}

export async function launchBedrockInstance(id: string): Promise<void> {
  const instance = store.bedrockInstance(id)
  if (!instance) throw new Error('Bedrock instance not found')
  await switchBedrockInstance(id)
  await launchBedrock(instance.channel, id)
}

export async function bedrockInstanceContent(id: string) {
  const instance = store.bedrockInstance(id)
  if (!instance) throw new Error('Bedrock instance not found')
  return scanBedrockContent(instance.dataDir)
}

async function findLinkedBedrockInstance(): Promise<BedrockInstance | null> {
  for (const instance of store.bedrockInstances()) {
    const gamePath = await resolveBedrockGameDataPath(instance.channel).catch(() => null)
    if (!gamePath) continue
    const target = await linkTarget(gamePath)
    if (
      samePath(gamePath, instance.dataDir) ||
      (target !== null && samePath(target, instance.dataDir))
    ) {
      return instance
    }
  }
  return null
}

/**
 * A managed Bedrock instance inside the launcher data folder cannot survive a
 * data-dir move: the game's junction would keep pointing at the old copy.
 */
export async function assertBedrockDataDirMovable(): Promise<void> {
  if (isBedrockSessionActive() || (await isBedrockGameRunning())) {
    throw new Error('Close Minecraft before moving the launcher data folder.')
  }
  const linked = await findLinkedBedrockInstance()
  if (!linked) return
  const root = path.resolve(paths.data)
  const own = path.resolve(linked.dataDir)
  if (own === root || own.startsWith(`${root}${path.sep}`)) {
    throw new Error(
      `The “${linked.name}” Bedrock instance is linked to Minecraft. Switch to My Bedrock before moving the launcher data folder.`
    )
  }
}
