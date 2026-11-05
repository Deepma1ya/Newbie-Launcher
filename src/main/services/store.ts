import { safeStorage } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  AccountSummary,
  AuthAccount,
  Instance,
  LauncherSettings,
  Loadout,
  TaskRecord
} from '@shared/types'
import type { DeepPartial } from '@shared/ipc'
import { readJson, writeJsonAtomic, uniqueId } from '../util/fs'
import { logger } from '../util/log'
import { paths } from './paths'

interface StoredAccount extends Omit<AuthAccount, 'accessToken' | 'refreshToken' | 'clientToken' | 'active'> {
  accessTokenEnc?: string
  refreshTokenEnc?: string
  clientTokenEnc?: string
}

interface PersistedState {
  schemaVersion: 1
  settings: LauncherSettings
  accounts: StoredAccount[]
  activeAccountId: string | null
  instances: Instance[]
  recentTasks: TaskRecord[]
}

export const DEFAULT_SETTINGS: LauncherSettings = {
  language: 'en',
  theme: 'dark',
  dataDir: '',
  closeToTray: true,
  minimizeOnLaunch: true,
  autoCheckUpdates: true,
  allowPrerelease: false,
  downloadConcurrency: 6,
  java: {
    autoInstall: true,
    manualPath: null,
    defaultMemoryMb: 4096,
    jvmArgs: ''
  },
  performance: {
    gpuPreference: 'high',
    profile: 'balanced',
    autoApply: true
  },
  backups: {
    enabled: true,
    frequency: 'daily',
    keepDays: 14,
    maxSizeMb: 4096
  },
  onboardingComplete: false,
  tlauncherSkins: true,
  tlauncherCapePlugin: true
}

const EMPTY_STATE: PersistedState = {
  schemaVersion: 1,
  settings: DEFAULT_SETTINGS,
  accounts: [],
  activeAccountId: null,
  instances: [],
  recentTasks: []
}

class AppStore {
  private state: PersistedState = structuredClone(EMPTY_STATE)
  private saveTimer: NodeJS.Timeout | null = null
  private saveChain: Promise<void> = Promise.resolve()
  private initialised = false

  async init(): Promise<void> {
    await this.load()
    this.initialised = true
  }

  private async load(): Promise<void> {
    const loaded = await readJson<Partial<PersistedState> | null>(paths.launcherFile, null)
    if (!loaded) {
      this.state = structuredClone(EMPTY_STATE)
    } else {
      this.state = {
        schemaVersion: 1,
        settings: mergeSettings(loaded.settings),
        accounts: Array.isArray(loaded.accounts) ? loaded.accounts : [],
        activeAccountId: loaded.activeAccountId ?? null,
        instances: Array.isArray(loaded.instances) ? loaded.instances.map(normaliseInstance) : [],
        recentTasks: Array.isArray(loaded.recentTasks) ? loaded.recentTasks.slice(-60) : []
      }
    }
    this.state.settings.dataDir = paths.data
    logger.info('store', `Loaded ${this.state.instances.length} instance(s), ${this.state.accounts.length} account(s)`)
  }

  settings(): LauncherSettings {
    return {
      ...structuredClone(this.state.settings),
      dataDir: paths.data
    }
  }

  async updateSettings(patch: DeepPartial<LauncherSettings>): Promise<LauncherSettings> {
    const next = mergeSettings({ ...this.state.settings, ...patch } as Partial<LauncherSettings>)
    next.dataDir = paths.data
    this.state.settings = next
    this.scheduleSave()
    return this.settings()
  }

  accounts(): AccountSummary[] {
    return this.state.accounts.map((account) => ({
      ...sanitizeAccount(account),
      active: account.id === this.state.activeAccountId
    }))
  }

  internalAccounts(): AuthAccount[] {
    return this.state.accounts.map((account) => ({
      ...sanitizeAccount(account),
      active: account.id === this.state.activeAccountId,
      accessToken: decryptSecret(account.accessTokenEnc),
      refreshToken: decryptSecret(account.refreshTokenEnc),
      clientToken: decryptSecret(account.clientTokenEnc)
    }))
  }

  activeAccount(): AuthAccount | null {
    const account = this.state.accounts.find((candidate) => candidate.id === this.state.activeAccountId)
    return account ? (this.internalAccounts().find((candidate) => candidate.id === account.id) ?? null) : null
  }

  account(id: string): AuthAccount | null {
    return this.internalAccounts().find((account) => account.id === id) ?? null
  }

  async upsertAccount(account: AuthAccount): Promise<AccountSummary> {
    this.state.accounts = this.state.accounts.filter((candidate) => candidate.id !== account.id)
    this.state.accounts.push({
      ...sanitizeAccount(account),
      accessTokenEnc: encryptSecret(account.accessToken),
      refreshTokenEnc: encryptSecret(account.refreshToken),
      clientTokenEnc: encryptSecret(account.clientToken)
    })
    if (!this.state.activeAccountId) this.state.activeAccountId = account.id
    this.scheduleSave()
    return { ...sanitizeAccount(account), active: account.id === this.state.activeAccountId }
  }

  async removeAccount(id: string): Promise<void> {
    this.state.accounts = this.state.accounts.filter((account) => account.id !== id)
    if (this.state.activeAccountId === id) {
      this.state.activeAccountId = this.state.accounts[0]?.id ?? null
    }
    this.scheduleSave()
  }

  async setActiveAccount(id: string): Promise<void> {
    if (!this.state.accounts.some((account) => account.id === id)) {
      throw new Error('Account not found')
    }
    this.state.activeAccountId = id
    this.scheduleSave()
  }

  instances(): Instance[] {
    return structuredClone(this.state.instances)
  }

  instance(id: string): Instance | null {
    const found = this.state.instances.find((candidate) => candidate.id === id)
    return found ? structuredClone(found) : null
  }

  async addInstance(instance: Instance): Promise<Instance> {
    this.state.instances.push(instance)
    this.scheduleSave()
    return structuredClone(instance)
  }

  async updateInstance(id: string, mutator: (instance: Instance) => void): Promise<Instance> {
    const instance = this.state.instances.find((candidate) => candidate.id === id)
    if (!instance) throw new Error('Instance not found')
    mutator(instance)
    this.scheduleSave()
    return structuredClone(instance)
  }

  async removeInstance(id: string): Promise<void> {
    this.state.instances = this.state.instances.filter((candidate) => candidate.id !== id)
    this.scheduleSave()
  }

  recentTasks(): TaskRecord[] {
    return structuredClone(this.state.recentTasks)
  }

  async recordTask(task: TaskRecord): Promise<void> {
    const index = this.state.recentTasks.findIndex((candidate) => candidate.id === task.id)
    if (index >= 0) this.state.recentTasks[index] = structuredClone(task)
    else this.state.recentTasks.push(structuredClone(task))
    this.state.recentTasks = this.state.recentTasks.slice(-60)
    this.scheduleSave()
  }

  nextLoadoutId(): string {
    return uniqueId('loadout')
  }

  relocate(oldDir: string, newDir: string): void {
    this.state.settings.dataDir = newDir
    for (const instance of this.state.instances) {
      if (instance.gameDir.startsWith(oldDir)) {
        instance.gameDir = instance.gameDir.replace(oldDir, newDir)
      }
    }
    this.scheduleSave()
  }

  private scheduleSave(): void {
    if (!this.initialised) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.flush()
    }, 180)
  }

  async flush(): Promise<void> {
    if (!this.initialised) return
    const snapshot = structuredClone(this.state)
    this.saveChain = this.saveChain.then(async () => {
      await writeJsonAtomic(paths.launcherFile, snapshot)
    })
    await this.saveChain
  }
}

function mergeSettings(patch?: Partial<LauncherSettings> | DeepPartial<LauncherSettings>): LauncherSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(patch ?? {}),
    java: { ...DEFAULT_SETTINGS.java, ...(patch?.java ?? {}) },
    performance: { ...DEFAULT_SETTINGS.performance, ...(patch?.performance ?? {}) },
    backups: { ...DEFAULT_SETTINGS.backups, ...(patch?.backups ?? {}) }
  }
  return merged
}

function normaliseInstance(instance: Instance): Instance {
  const loadouts = Array.isArray(instance.loadouts) ? instance.loadouts : []
  if (loadouts.length === 0) {
    const loadout: Loadout = {
      id: uniqueId('loadout'),
      name: 'Default',
      mode: 'offline',
      addonIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    loadouts.push(loadout)
  }
  return {
    ...instance,
    resolvedVersionId: instance.resolvedVersionId || instance.versionId,
    color: instance.color || '#6EE7A0',
    memoryMb: instance.memoryMb || 4096,
    width: instance.width || 1280,
    height: instance.height || 720,
    fullscreen: Boolean(instance.fullscreen),
    jvmArgs: instance.jvmArgs ?? '',
    javaPath: instance.javaPath ?? null,
    gameDir: instance.gameDir || paths.instanceGameDir(instance.id),
    loadouts,
    activeLoadoutId: instance.activeLoadoutId || loadouts[0]!.id,
    addons: Array.isArray(instance.addons)
      ? instance.addons.map((addon) =>
          // Legacy records from the removed CurseForge provider stay usable as local files.
          (addon.provider as string) === 'curseforge'
            ? { ...addon, provider: 'local' as const, projectId: addon.projectId || `cf_${addon.id}` }
            : addon
        )
      : [],
    totalPlayTimeSec: instance.totalPlayTimeSec ?? 0,
    repairFailures: instance.repairFailures ?? {},
    tlauncherCape: instance.tlauncherCape ?? true
  }
}

function sanitizeAccount(account: StoredAccount | AuthAccount): AccountSummary {
  return {
    id: account.id,
    type: account.type,
    username: account.username,
    uuid: account.uuid,
    active: false,
    skinUrl: account.skinUrl,
    capeUrl: account.capeUrl,
    createdAt: account.createdAt,
    expiresAt: account.expiresAt,
    needsRefresh: account.needsRefresh,
    apiRoot: account.apiRoot,
    xuid: account.xuid,
    gamertag: account.gamertag
  }
}

function encryptSecret(value?: string): string | undefined {
  if (!value) return undefined
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(value).toString('base64')}`
    }
  } catch (error) {
    logger.warn('store', 'safeStorage encryption unavailable', error)
  }
  return `plain:${Buffer.from(value, 'utf8').toString('base64')}`
}

function decryptSecret(value?: string): string | undefined {
  if (!value) return undefined
  try {
    if (value.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
    }
    if (value.startsWith('plain:')) {
      return Buffer.from(value.slice(4), 'base64').toString('utf8')
    }
    return value
  } catch (error) {
    logger.warn('store', 'Failed to decrypt a stored secret', error)
    return undefined
  }
}

export const store = new AppStore()
