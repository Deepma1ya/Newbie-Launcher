import { app, ipcMain, shell, nativeTheme } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { APP_NAME, GITHUB_URL } from '@shared/constants'
import { IPC } from '@shared/ipc'
import type {
  AccountSummary,
  AddonRecord,
  AppInfo,
  BackupRecord,
  CreateInstanceInput,
  JavaRuntime,
  LauncherSettings,
  LoaderType,
  Loadout,
  SearchQuery,
  SystemInfo,
  UpdateInstanceInput
} from '@shared/types'
import { store } from './services/store'
import { getSettings, updateSettings, changeDataDir } from './services/settings'
import { paths } from './services/paths'
import {
  listMinecraftVersions,
  installedVersionIds
} from './services/mojang'
import { installLoader, listLoaderVersions } from './services/loaders'
import { installGame } from './services/installer'
import {
  createInstance,
  duplicateInstance,
  getInstance,
  listInstances,
  openInstanceFolder,
  removeInstance,
  repair,
  updateInstance
} from './services/instances'
import { launchInstance, runningStates, stopInstance, instanceLogs } from './services/launch'
import {
  checkAddonUpdates,
  installAddon,
  removeAddon,
  scanUnmanagedAddons,
  toggleAddon,
  updateAllAddons
} from './services/addons'
import { searchModrinth, getModrinthProject, getModrinthVersions } from './services/modrinth'
import {
  activateLoadout,
  backupLoadout,
  createLoadout,
  planLoadout,
  removeLoadout,
  updateLoadout
} from './services/loadouts'
import { installModpack, installModpackToInstance } from './services/modpacks'
import {
  applyGpuPreference,
  diskUsage,
  systemInfo
} from './services/perf'
import { detectJavaRuntimes, installJavaRuntime } from './services/java'
import { createBackupNow, listBackups } from './services/backups'
import { tasks } from './services/tasks'
import { checkForUpdates, installUpdate, updaterState } from './services/updater'
import { clearRepairFailures } from './services/repair'
import {
  addBedrockExclusion,
  cancelBedrockDownload,
  deleteBedrockDownload,
  downloadBedrockVersion,
  getBedrockState,
  installBedrockVersion,
  launchBedrock
} from './services/bedrock'
import { addOfflineAccount } from './auth/offline'
import { addTLauncherAccount, refreshTLauncherAccount } from './auth/tlauncher'
import { addAuthlibAccount, refreshAuthlibAccount } from './auth/authlib'
import { removeAccountSkin, setAccountSkin } from './services/skins'
import { cancelMicrosoftFlow, refreshMicrosoftAccount, startMicrosoftFlow } from './auth/microsoft'
import {
  getMainWindow,
  minimizeWindow,
  openExternalSafe,
  pickDirectory,
  pickFile,
  toggleMaximize,
  windowState
} from './window'
import { logger } from './util/log'

const usernameSchema = z.string().trim().min(3).max(16).regex(/^[A-Za-z0-9_]+$/)
const pathSchema = z.string().min(3).max(4096)
const loaderSchema = z.enum(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'])
const addonTypeSchema = z.enum(['mod', 'resourcepack', 'shader', 'modpack', 'datapack', 'world'])
const bedrockChannelSchema = z.enum(['release', 'preview'])
const bedrockIdSchema = z.string().min(3).max(200)

const settingsPatchSchema = z
  .object({
    language: z.literal('en').optional(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
    closeToTray: z.boolean().optional(),
    minimizeOnLaunch: z.boolean().optional(),
    autoCheckUpdates: z.boolean().optional(),
    allowPrerelease: z.boolean().optional(),
    downloadConcurrency: z.number().optional(),
    onboardingComplete: z.boolean().optional(),
    tlauncherSkins: z.boolean().optional(),
    java: z
      .object({
        autoInstall: z.boolean().optional(),
        manualPath: z.string().nullable().optional(),
        defaultMemoryMb: z.number().optional(),
        jvmArgs: z.string().max(8000).optional()
      })
      .partial()
      .optional(),
    performance: z
      .object({
        gpuPreference: z.enum(['default', 'high']).optional(),
        profile: z.enum(['balanced', 'performance', 'quality']).optional(),
        autoApply: z.boolean().optional()
      })
      .partial()
      .optional(),
    backups: z
      .object({
        enabled: z.boolean().optional(),
        frequency: z.enum(['always', 'daily']).optional(),
        keepDays: z.number().optional(),
        maxSizeMb: z.number().optional()
      })
      .partial()
      .optional()
  })
  .strict()

const createInstanceSchema = z.object({
  name: z.string().trim().min(1).max(60),
  versionId: z.string().min(1).max(120),
  loader: loaderSchema,
  loaderVersion: z.string().max(120).optional(),
  memoryMb: z.number().optional(),
  iconUrl: z.string().max(2048).optional(),
  color: z.string().max(32).optional(),
  modpack: z
    .object({
      projectId: z.string().min(1).max(200),
      versionId: z.string().min(1).max(200)
    })
    .optional()
})

const updateInstanceSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  versionId: z.string().min(1).max(120).optional(),
  loader: loaderSchema.optional(),
  loaderVersion: z.string().max(120).optional(),
  memoryMb: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fullscreen: z.boolean().optional(),
  javaPath: z.string().nullable().optional(),
  jvmArgs: z.string().max(8000).optional(),
  iconUrl: z.string().max(2048).optional(),
  color: z.string().max(32).optional()
})

const searchSchema = z.object({
  query: z.string().max(200),
  type: addonTypeSchema,
  gameVersion: z.string().max(120).optional(),
  loader: loaderSchema.optional(),
  categories: z.array(z.string().max(60)).max(12).optional(),
  sort: z.enum(['relevance', 'downloads', 'follows', 'newest', 'updated']).optional(),
  offset: z.number().min(0).max(10000).optional(),
  limit: z.number().min(1).max(50).optional()
})

export function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    name: APP_NAME,
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    dataDir: paths.data,
    githubUrl: GITHUB_URL,
    isPackaged: app.isPackaged
  }))

  ipcMain.handle(IPC.appWindowState, () => windowState())
  ipcMain.handle(IPC.appMinimize, () => minimizeWindow())
  ipcMain.handle(IPC.appMaximize, () => toggleMaximize())
  ipcMain.handle(IPC.appClose, () => getMainWindow()?.close())
  ipcMain.handle(IPC.appOpenExternal, async (_event, url: string) => {
    await openExternalSafe(z.string().url().parse(url))
  })
  ipcMain.handle(IPC.appShowItem, async (_event, target: string) => {
    const resolved = path.resolve(pathSchema.parse(target))
    const root = path.resolve(paths.data)
    if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('Only launcher files can be revealed')
    const stat = await fs.stat(resolved).catch(() => null)
    if (!stat) throw new Error('That file no longer exists')
    if (stat.isDirectory()) await shell.openPath(resolved)
    else shell.showItemInFolder(resolved)
  })
  ipcMain.handle(IPC.appPickDirectory, async (_event, defaultPath?: string) => pickDirectory(defaultPath))
  ipcMain.handle(IPC.appPickFile, async (_event, filters?: { name: string; extensions: string[] }[]) =>
    pickFile(filters)
  )
  ipcMain.handle(IPC.appRelaunch, () => {
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle(IPC.settingsGet, (): LauncherSettings => getSettings())
  ipcMain.handle(IPC.settingsUpdate, async (_event, patch: unknown) =>
    updateSettings(settingsPatchSchema.parse(patch) as never)
  )
  ipcMain.handle(IPC.settingsPickDataDir, async () => pickDirectory(paths.data))
  ipcMain.handle(IPC.settingsChangeDataDir, async (_event, dir: string) => changeDataDir(pathSchema.parse(dir)))
  ipcMain.handle(IPC.settingsRevealDataDir, async () => {
    await shell.openPath(paths.data)
  })

  ipcMain.handle(IPC.accountsList, (): AccountSummary[] => store.accounts())
  ipcMain.handle(IPC.accountsAddOffline, async (_event, username: string) =>
    addOfflineAccount(usernameSchema.parse(username))
  )
  ipcMain.handle(IPC.accountsAddTlauncher, async (_event, username: string) =>
    addTLauncherAccount(usernameSchema.parse(username))
  )
  ipcMain.handle(IPC.accountsAddAuthlib, async (_event, input: unknown) => {
    const value = z
      .object({ apiRoot: z.string().min(4).max(2048), username: usernameSchema, password: z.string().min(1).max(512) })
      .parse(input)
    return addAuthlibAccount(value)
  })
  ipcMain.handle(IPC.accountsStartMicrosoft, () => {
    void startMicrosoftFlow()
  })
  ipcMain.handle(IPC.accountsCancelMicrosoft, () => cancelMicrosoftFlow())
  ipcMain.handle(IPC.accountsRemove, async (_event, id: string) => store.removeAccount(z.string().parse(id)))
  ipcMain.handle(IPC.accountsSetActive, async (_event, id: string) => store.setActiveAccount(z.string().parse(id)))
  ipcMain.handle(IPC.accountsSetSkin, async (_event, id: string, filePath: string) =>
    setAccountSkin(z.string().parse(id), pathSchema.parse(filePath))
  )
  ipcMain.handle(IPC.accountsRemoveSkin, async (_event, id: string) =>
    removeAccountSkin(z.string().parse(id))
  )
  ipcMain.handle(IPC.accountsRefresh, async (_event, id: string): Promise<AccountSummary> => {
    const account = store.account(z.string().parse(id))
    if (!account) throw new Error('Account not found')
    if (account.type === 'microsoft') {
      await refreshMicrosoftAccount(account)
      const summary = store.accounts().find((entry) => entry.id === account.id)
      if (!summary) throw new Error('Account not found after refresh')
      return summary
    }
    if (account.type === 'tlauncher') return refreshTLauncherAccount(account.id)
    if (account.type === 'authlib') {
      await refreshAuthlibAccount(account)
      const summary = store.accounts().find((entry) => entry.id === account.id)
      if (!summary) throw new Error('Account not found after refresh')
      return summary
    }
    throw new Error('This account type does not need refreshing')
  })

  ipcMain.handle(IPC.versionsMinecraft, async (_event, force?: boolean) => listMinecraftVersions(Boolean(force)))
  ipcMain.handle(IPC.versionsLoaders, async (_event, type: LoaderType, gameVersion: string) =>
    listLoaderVersions(loaderSchema.parse(type), z.string().min(1).max(120).parse(gameVersion))
  )
  ipcMain.handle(IPC.versionsInstalled, () => installedVersionIds())
  ipcMain.handle(IPC.versionsInstall, async (_event, input: unknown) => {
    const value = z.object({ versionId: z.string(), loader: loaderSchema, loaderVersion: z.string().optional() }).parse(input)
    const handle = tasks.start('install-version', `Installing ${value.versionId}`, value.loader)
    try {
      let resolved = value.versionId
      if (value.loader !== 'vanilla') {
        resolved = await installLoader(value.loader, value.versionId, value.loaderVersion, (message) =>
          handle.progress({ stage: 'loader', message, current: 0, total: 1, percent: 8 })
        )
      }
      await installGame(resolved, { onProgress: (progress) => handle.progress(progress) })
      await handle.done('Version installed')
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })

  ipcMain.handle(IPC.instancesList, () => listInstances())
  ipcMain.handle(IPC.instancesGet, (_event, id: string) => getInstance(z.string().parse(id)))
  ipcMain.handle(IPC.instancesCreate, async (_event, input: unknown) =>
    createInstance(createInstanceSchema.parse(input) as CreateInstanceInput)
  )
  ipcMain.handle(IPC.instancesUpdate, async (_event, id: string, patch: unknown) =>
    updateInstance(z.string().parse(id), updateInstanceSchema.parse(patch) as UpdateInstanceInput)
  )
  ipcMain.handle(IPC.instancesRemove, async (_event, id: string, deleteFiles: boolean) =>
    removeInstance(z.string().parse(id), Boolean(deleteFiles))
  )
  ipcMain.handle(IPC.instancesLaunch, async (_event, id: string) => {
    await launchInstance(z.string().parse(id))
    if (getSettings().minimizeOnLaunch) minimizeWindow()
  })
  ipcMain.handle(IPC.instancesStop, async (_event, id: string) => stopInstance(z.string().parse(id)))
  ipcMain.handle(IPC.instancesRunning, () => runningStates())
  ipcMain.handle(IPC.instancesLogs, async (_event, id: string) => {
    const instanceId = z.string().parse(id)
    const live = instanceLogs(instanceId)
    if (live.length > 0) return live
    await fs.mkdir(paths.instanceLogs(instanceId), { recursive: true }).catch(() => undefined)
    const entries = await fs.readdir(paths.instanceLogs(instanceId)).catch(() => [])
    const latest = entries.filter((file) => file.endsWith('.log')).sort().at(-1)
    if (!latest) return []
    const text = await fs.readFile(path.join(paths.instanceLogs(instanceId), latest), 'utf8').catch(() => '')
    return text.split(/\r?\n/).filter(Boolean).slice(-800)
  })
  ipcMain.handle(IPC.instancesOpenFolder, async (_event, id: string, sub?: string) => {
    const target = await openInstanceFolder(z.string().parse(id), sub ? z.string().parse(sub) : undefined)
    await shell.openPath(target)
  })
  ipcMain.handle(IPC.instancesRepair, async (_event, id: string, apply: boolean) => {
    const instanceId = z.string().parse(id)
    if (!apply) return repair(instanceId, false)
    const handle = tasks.start('repair', 'Repairing instance', 'Scanning for conflicts', instanceId)
    try {
      const report = await repair(instanceId, true)
      await handle.done(
        `${report.fixed} issue(s) fixed${report.failed ? `, ${report.failed} failed` : ''}`
      )
      return report
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })
  ipcMain.handle(IPC.instancesClearRepairFailures, async (_event, id: string) => {
    await clearRepairFailures(z.string().parse(id))
  })

  ipcMain.handle(IPC.addonsSearch, async (_event, raw: unknown) => {
    const query = searchSchema.parse(raw) as SearchQuery
    return searchModrinth(query)
  })
  ipcMain.handle(IPC.addonsProject, async (_event, id: string) => getModrinthProject(id))
  ipcMain.handle(
    IPC.addonsVersions,
    async (_event, projectId: string, gameVersion?: string, loader?: LoaderType) =>
      getModrinthVersions(projectId, gameVersion, loader)
  )
  ipcMain.handle(IPC.addonsInstall, async (_event, instanceId: string, ref: unknown) => {
    const value = z
      .object({
        projectId: z.string().max(200),
        versionId: z.string().max(200)
      })
      .parse(ref)
    const instance = store.instance(instanceId)
    const handle = tasks.start('install-addon', `Installing add-on`, instance?.name, instanceId)
    try {
      const result = await installAddon(instanceId, value, (message, percent) =>
        handle.progress({ stage: 'addons', message, current: percent ?? 0, total: 100, percent: percent ?? 10, instanceId })
      )
      await handle.done(`${result.installed} add-on(s) installed`)
      return result.records
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })
  ipcMain.handle(IPC.addonsRemove, async (_event, instanceId: string, addonId: string, deleteFile: boolean) =>
    removeAddon(instanceId, addonId, Boolean(deleteFile))
  )
  ipcMain.handle(IPC.addonsToggle, async (_event, instanceId: string, addonId: string, enabled: boolean) =>
    toggleAddon(instanceId, addonId, Boolean(enabled))
  )
  ipcMain.handle(IPC.addonsCheckUpdates, async (_event, instanceId: string) =>
    checkAddonUpdates(z.string().parse(instanceId))
  )
  ipcMain.handle(IPC.addonsUpdateAll, async (_event, instanceId: string) => {
    const instance = store.instance(instanceId)
    const handle = tasks.start('update-addons', `Updating ${instance?.name ?? 'instance'}`, 'Checking for updates', instanceId)
    try {
      const records = await updateAllAddons(instanceId, (message, percent) =>
        handle.progress({ stage: 'addons', message, current: percent ?? 0, total: 100, percent: percent ?? 10, instanceId })
      )
      await handle.done('Add-ons are up to date')
      return records
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })
  ipcMain.handle(IPC.addonsScan, async (_event, instanceId: string) => {
    const handle = tasks.start('repair', 'Scanning add-ons', 'Matching local files', instanceId)
    try {
      const records = await scanUnmanagedAddons(instanceId)
      await handle.done(`${records.length} new add-on(s) found`)
      return records
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })

  ipcMain.handle(IPC.loadoutsCreate, async (_event, instanceId: string, input: unknown) =>
    createLoadout(
      instanceId,
      z
        .object({
          name: z.string().min(1).max(60),
          mode: z.enum(['offline', 'download']),
          addonIds: z.array(z.string()).max(500)
        })
        .parse(input)
    )
  )
  ipcMain.handle(IPC.loadoutsUpdate, async (_event, instanceId: string, loadoutId: string, patch: unknown) =>
    updateLoadout(
      instanceId,
      loadoutId,
      z
        .object({
          name: z.string().min(1).max(60).optional(),
          mode: z.enum(['offline', 'download']).optional(),
          addonIds: z.array(z.string()).max(500).optional()
        })
        .parse(patch)
    )
  )
  ipcMain.handle(IPC.loadoutsRemove, async (_event, instanceId: string, loadoutId: string) =>
    removeLoadout(instanceId, loadoutId)
  )
  ipcMain.handle(IPC.loadoutsActivate, async (_event, instanceId: string, loadoutId: string) => {
    const instance = store.instance(instanceId)
    const handle = tasks.start('install-addon', `Switching loadout`, instance?.name, instanceId)
    try {
      await activateLoadout(instanceId, loadoutId)
      await handle.done('Loadout active')
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })
  ipcMain.handle(IPC.loadoutsPlan, async (_event, instanceId: string, loadoutId: string) =>
    planLoadout(instanceId, loadoutId)
  )
  ipcMain.handle(IPC.loadoutsBackup, async (_event, instanceId: string, loadoutId: string) => {
    const handle = tasks.start('backup', 'Creating offline backup', 'Caching add-ons', instanceId)
    try {
      await backupLoadout(instanceId, loadoutId)
      await handle.done('Offline backup ready')
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })

  ipcMain.handle(IPC.modpacksInstall, async (_event, projectId: string, versionId: string) => {
    const handle = tasks.start('modpack', 'Installing modpack', 'Reading pack manifest')
    try {
      const instance = await installModpack(z.string().parse(projectId), z.string().parse(versionId))
      await handle.done('Modpack ready')
      return instance
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })
  ipcMain.handle(
    IPC.modpacksInstallToInstance,
    async (_event, instanceId: string, projectId: string, versionId: string) => {
      const target = store.instance(z.string().parse(instanceId))
      const handle = tasks.start('modpack', 'Adding modpack', target?.name, instanceId)
      try {
        const instance = await installModpackToInstance(
          instanceId,
          z.string().parse(projectId),
          z.string().parse(versionId),
          (message, percent) =>
            handle.progress({
              stage: 'addons',
              message,
              current: percent ?? 0,
              total: 100,
              percent: percent ?? 5,
              instanceId
            })
        )
        await handle.done('Modpack added')
        return instance
      } catch (error) {
        await handle.fail(error)
        throw error
      }
    }
  )

  ipcMain.handle(IPC.systemInfo, async (): Promise<SystemInfo> => {
    const info = await systemInfo()
    info.appVersion = app.getVersion()
    return info
  })
  ipcMain.handle(IPC.systemDetectJava, (): Promise<JavaRuntime[]> => detectJavaRuntimes(true))
  ipcMain.handle(IPC.systemInstallJava, async (_event, major: number): Promise<JavaRuntime> => {
    const handle = tasks.start('java', `Installing Java ${major}`, 'Temurin JRE')
    try {
      const runtime = await installJavaRuntime(major, (received, total) =>
        handle.progress({
          stage: 'java',
          message: `Downloading Java ${major}`,
          current: received,
          total,
          percent: total > 0 ? (received / total) * 100 : 0
        })
      )
      await handle.done(`Java ${runtime.major} ready`)
      return runtime
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })
  ipcMain.handle(IPC.systemApplyGpu, async (_event, instanceId?: string) =>
    applyGpuPreference(instanceId ? store.instance(instanceId) ?? undefined : undefined)
  )
  ipcMain.handle(IPC.systemBackups, async (_event, instanceId?: string) => listBackups(instanceId))
  ipcMain.handle(IPC.systemCreateBackup, async (_event, instanceId: string): Promise<BackupRecord> => {
    const instance = store.instance(instanceId)
    if (!instance) throw new Error('Instance not found')
    return createBackupNow(instance)
  })
  ipcMain.handle(IPC.systemDiskUsage, () => diskUsage())

  ipcMain.handle(IPC.tasksList, () => tasks.list())

  ipcMain.handle(IPC.updaterCheck, () => checkForUpdates())
  ipcMain.handle(IPC.updaterInstall, () => installUpdate())
  ipcMain.handle(IPC.updaterState, () => updaterState())

  ipcMain.handle(IPC.bedrockState, (_event, forceRefresh?: unknown) =>
    getBedrockState(z.boolean().optional().parse(forceRefresh) ?? false)
  )
  ipcMain.handle(IPC.bedrockDownload, (_event, id: unknown) =>
    downloadBedrockVersion(bedrockIdSchema.parse(id))
  )
  ipcMain.handle(IPC.bedrockCancel, (_event, id: unknown) => cancelBedrockDownload(bedrockIdSchema.parse(id)))
  ipcMain.handle(IPC.bedrockInstall, (_event, id: unknown, replaceInstalled?: unknown) =>
    installBedrockVersion(
      bedrockIdSchema.parse(id),
      z.boolean().optional().parse(replaceInstalled) ?? false
    )
  )
  ipcMain.handle(IPC.bedrockLaunch, (_event, channel: unknown) =>
    launchBedrock(bedrockChannelSchema.parse(channel))
  )
  ipcMain.handle(IPC.bedrockDelete, (_event, id: unknown) => deleteBedrockDownload(bedrockIdSchema.parse(id)))
  ipcMain.handle(IPC.bedrockAddExclusion, () => addBedrockExclusion())

  nativeTheme.themeSource = 'dark'
  logger.info('ipc', 'IPC handlers registered')
}

export { duplicateInstance }
