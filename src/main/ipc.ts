import { app, ipcMain, shell, nativeTheme } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { APP_NAME, GITHUB_URL } from '@shared/constants'
import { IPC } from '@shared/ipc'
import type {
  AccountSummary,
  AddonRecord,
  AddonType,
  AppInfo,
  BackupRecord,
  CreateInstanceInput,
  CreateServerInput,
  JavaRuntime,
  LauncherSettings,
  LoaderType,
  Loadout,
  SearchQuery,
  ServerAddonType,
  ServerSearchQuery,
  ServerResourcePackInput,
  ServerResourcePackSearchQuery,
  SystemInfo,
  UpdateInstanceInput
} from '@shared/types'
import { store } from './services/store'
import { getSettings, updateSettings, changeDataDir } from './services/settings'
import { paths } from './services/paths'
import { safeJoin } from './util/fs'
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
  listWorlds,
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
  removeAllAddons,
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
import { syncTlsCape } from './services/tlskincape'
import { copyInstanceSettings } from './services/instanceSettings'
import { getServer, listServers } from './services/serverStore'
import { getServerShareInfo, testServerAddress } from './services/serverShare'
import {
  createServer,
  removeServer,
  saveServerProperties,
  serverProperties,
  updateServer
} from './services/servers'
import {
  restartServer,
  sendServerCommand,
  serverLogs,
  serverRuntimeStatus,
  startServer,
  stopAllServers,
  stopServer
} from './services/serverProcess'
import {
  checkServerAddonUpdates,
  installServerAddon,
  removeServerAddon,
  searchServerAddons,
  toggleServerAddon,
  updateAllServerAddons
} from './services/serverAddons'
import {
  getServerResourcePack,
  importServerResourcePack,
  installServerResourcePack,
  removeServerResourcePack,
  saveServerResourcePack,
  searchServerResourcePacks
} from './services/serverResourcePack'
import { resetServerRestartSchedule, stopServerScheduler } from './services/serverScheduler'
import { getServerStats } from './services/serverStats'
import {
  addBedrockExclusion,
  cancelBedrockDownload,
  deleteBedrockDownload,
  downloadBedrockVersion,
  getBedrockState,
  installBedrockVersion,
  launchBedrock,
  openBedrockInstallFolder,
  uninstallBedrockVersion
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
const addonTypeSchema = z.enum(['mod', 'resourcepack', 'shader', 'modpack', 'datapack', 'world', 'plugin'])
const bulkAddonTypeSchema = z.enum(['mod', 'datapack', 'resourcepack', 'shader'])
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
    tlauncherCapePlugin: z.boolean().optional(),
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
  color: z.string().max(32).optional(),
  tlauncherCape: z.boolean().optional()
})

const copySettingsSchema = z.object({
  sourceId: z.string().max(200),
  targetIds: z.array(z.string().max(200)).min(1).max(200),
  categories: z
    .array(
      z.enum([
        'keybinds',
        'video',
        'audio',
        'controls',
        'chat',
        'accessibility',
        'language',
        'resourcePacks',
        'shaders',
        'other'
      ])
    )
    .min(1)
    .max(20)
})

const serverTypeSchema = z.enum(['vanilla', 'paper', 'fabric', 'quilt', 'forge', 'neoforge'])
const serverAddonTypeSchema = z.enum(['mod', 'plugin', 'datapack'])
const createServerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: serverTypeSchema,
  versionId: z.string().min(1).max(120),
  loaderVersion: z.string().max(120).optional(),
  port: z.number().int().min(1).max(65535),
  memoryMb: z.number().int().min(1024).max(65536),
  motd: z.string().max(256).optional(),
  onlineMode: z.boolean().optional(),
  levelName: z.string().max(80).optional(),
  javaPath: z.string().nullable().optional(),
  eulaAccepted: z.boolean()
})
const updateServerSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  memoryMb: z.number().int().min(1024).max(65536).optional(),
  restartSchedule: z
    .object({
      enabled: z.boolean(),
      mode: z.enum(['interval', 'daily']),
      intervalMinutes: z.number().int().min(15).max(10080),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      lastRestartAt: z.string().max(40).optional(),
      nextRestartAt: z.string().max(40).optional()
    })
    .optional()
})
const serverSearchSchema = z.object({
  serverId: z.string().max(200),
  type: serverAddonTypeSchema,
  query: z.string().max(200),
  sort: z.enum(['relevance', 'downloads', 'follows', 'newest', 'updated']).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(48).optional()
})
const serverAddonRefSchema = z.object({
  projectId: z.string().max(200),
  versionId: z.string().max(200).optional(),
  type: serverAddonTypeSchema.optional()
})
const serverResourcePackSearchSchema = z.object({
  serverId: z.string().max(200),
  query: z.string().max(200),
  sort: z.enum(['relevance', 'downloads', 'follows', 'newest', 'updated']).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(48).optional()
})
const serverResourcePackSchema = z.object({
  url: z.string().min(1).max(2048),
  sha1: z.string().max(40).optional(),
  required: z.boolean().optional(),
  prompt: z.string().max(256).optional(),
  name: z.string().max(120).optional(),
  filename: z.string().max(200).optional(),
  size: z.number().int().min(0).max(512 * 1024 * 1024).optional(),
  source: z.enum(['modrinth', 'file', 'url']).optional(),
  projectId: z.string().max(200).optional(),
  versionId: z.string().max(200).optional()
})
const serverPropertiesSchema = z.record(z.string().max(120), z.string().max(2000))

const searchSchema = z.object({
  query: z.string().max(200),  type: addonTypeSchema,
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
  ipcMain.handle(IPC.appRelaunch, async () => {
    stopServerScheduler()
    await stopAllServers()
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

  ipcMain.handle(IPC.serversList, () => listServers())
  ipcMain.handle(IPC.serversGet, (_event, id: string) => getServer(z.string().parse(id)))
  ipcMain.handle(IPC.serversCreate, async (_event, input: unknown) => {
    const value = createServerSchema.parse(input) as CreateServerInput
    return createServer(value)
  })
  ipcMain.handle(IPC.serversUpdate, async (_event, id: string, patch: unknown) =>
    updateServer(z.string().parse(id), updateServerSchema.parse(patch))
  )
  ipcMain.handle(IPC.serversRemove, async (_event, id: string, deleteFiles: boolean) => {
    await removeServer(z.string().parse(id), Boolean(deleteFiles))
  })
  ipcMain.handle(IPC.serversStart, async (_event, id: string) => {
    const server = await getServer(z.string().parse(id))
    if (!server) throw new Error('Server not found')
    await startServer(server)
    await resetServerRestartSchedule(server.id)
  })
  ipcMain.handle(IPC.serversStop, async (_event, id: string) => {
    await stopServer(z.string().parse(id))
  })
  ipcMain.handle(IPC.serversRestart, async (_event, id: string) => {
    const server = await getServer(z.string().parse(id))
    if (!server) throw new Error('Server not found')
    await restartServer(server)
    await resetServerRestartSchedule(server.id)
  })
  ipcMain.handle(IPC.serversStatus, async (_event, id: string) => {
    const server = await getServer(z.string().parse(id))
    if (!server) throw new Error('Server not found')
    return serverRuntimeStatus(server.id, server.port)
  })
  ipcMain.handle(IPC.serversStatuses, async () => {
    const servers = await listServers()
    return servers.map((server) => serverRuntimeStatus(server.id, server.port))
  })
  ipcMain.handle(IPC.serversStats, async (_event, id: string) =>
    getServerStats(z.string().parse(id))
  )
  ipcMain.handle(IPC.serversLogs, async (_event, id: string) => serverLogs(z.string().parse(id)))
  ipcMain.handle(IPC.serversCommand, async (_event, id: string, command: string) => {
    sendServerCommand(z.string().parse(id), z.string().max(1000).parse(command))
  })
  ipcMain.handle(IPC.serversShare, async (_event, id: string) =>
    getServerShareInfo(z.string().parse(id))
  )
  ipcMain.handle(IPC.serversTestAddress, async (_event, address: string) =>
    testServerAddress(z.string().min(1).max(300).parse(address))
  )
  ipcMain.handle(IPC.serversProperties, async (_event, id: string) =>
    serverProperties(z.string().parse(id))
  )
  ipcMain.handle(IPC.serversSaveProperties, async (_event, id: string, patch: unknown) =>
    saveServerProperties(z.string().parse(id), serverPropertiesSchema.parse(patch))
  )
  ipcMain.handle(IPC.serversSearchAddons, async (_event, query: unknown) =>
    searchServerAddons(serverSearchSchema.parse(query) as ServerSearchQuery)
  )
  ipcMain.handle(IPC.serversInstallAddon, async (_event, serverId: string, ref: unknown) => {
    const id = z.string().parse(serverId)
    const value = serverAddonRefSchema.parse(ref)
    const server = await getServer(id)
    const handle = tasks.start('server-addon', 'Installing server add-on', server?.name)
    try {
      const records = await installServerAddon(id, value, (message, percent) =>
        handle.progress({ stage: 'addons', message, current: percent ?? 0, total: 100, percent: percent ?? 20 })
      )
      await handle.done(`${records.length} add-on(s) installed`)
      return records
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })
  ipcMain.handle(IPC.serversRemoveAddon, async (_event, serverId: string, addonId: string, deleteFile: boolean) => {
    await removeServerAddon(
      z.string().parse(serverId),
      z.string().parse(addonId),
      Boolean(deleteFile)
    )
  })
  ipcMain.handle(IPC.serversToggleAddon, async (_event, serverId: string, addonId: string, enabled: boolean) =>
    toggleServerAddon(
      z.string().parse(serverId),
      z.string().parse(addonId),
      Boolean(enabled)
    )
  )
  ipcMain.handle(IPC.serversCheckAddonUpdates, async (_event, serverId: string) =>
    checkServerAddonUpdates(z.string().parse(serverId))
  )
  ipcMain.handle(IPC.serversUpdateAllAddons, async (_event, serverId: string) => {
    const id = z.string().parse(serverId)
    const server = await getServer(id)
    const handle = tasks.start('server-addon', 'Updating server add-ons', server?.name)
    try {
      const records = await updateAllServerAddons(id, (message, percent) =>
        handle.progress({ stage: 'addons', message, current: percent ?? 0, total: 100, percent: percent ?? 30 })
      )
      await handle.done('Server add-ons updated')
      return records
    } catch (error) {
      await handle.fail(error)
      throw error
    }
  })
  ipcMain.handle(IPC.serversResourcePack, async (_event, serverId: string) =>
    getServerResourcePack(z.string().parse(serverId))
  )
  ipcMain.handle(IPC.serversResourcePackSearch, async (_event, query: unknown) =>
    searchServerResourcePacks(
      serverResourcePackSearchSchema.parse(query) as ServerResourcePackSearchQuery
    )
  )
  ipcMain.handle(
    IPC.serversResourcePackInstall,
    async (_event, serverId: string, projectId: string, versionId?: string) => {
      const id = z.string().parse(serverId)
      const server = await getServer(id)
      const handle = tasks.start('server-addon', 'Installing resource pack', server?.name)
      try {
        const state = await installServerResourcePack(
          id,
          z.string().max(200).parse(projectId),
          versionId ? z.string().max(200).parse(versionId) : undefined
        )
        await handle.done('Resource pack installed')
        return state
      } catch (error) {
        await handle.fail(error)
        throw error
      }
    }
  )
  ipcMain.handle(IPC.serversResourcePackImport, async (_event, serverId: string, filePath: string) =>
    importServerResourcePack(
      z.string().parse(serverId),
      pathSchema.parse(filePath)
    )
  )
  ipcMain.handle(IPC.serversResourcePackSave, async (_event, serverId: string, input: unknown) =>
    saveServerResourcePack(
      z.string().parse(serverId),
      serverResourcePackSchema.parse(input) as ServerResourcePackInput
    )
  )
  ipcMain.handle(IPC.serversResourcePackRemove, async (_event, serverId: string, deleteFile: boolean) =>
    removeServerResourcePack(z.string().parse(serverId), Boolean(deleteFile))
  )
  ipcMain.handle(IPC.serversOpenFolder, async (_event, id: string, sub?: string) => {
    const serverId = z.string().parse(id)
    const target = safeJoin(paths.server(serverId), sub ? z.string().max(500).parse(sub) : '')
    await shell.openPath(target)
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
  ipcMain.handle(IPC.instancesWorlds, async (_event, id: string) => listWorlds(z.string().parse(id)))
  ipcMain.handle(IPC.instancesCopySettings, async (_event, raw: unknown) =>
    copyInstanceSettings(copySettingsSchema.parse(raw))
  )
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
  ipcMain.handle(
    IPC.instancesRepair,
    async (_event, id: string, apply: boolean, allowDisable?: boolean, reuseBackup?: string) => {
      const instanceId = z.string().parse(id)
      const mayDisable = allowDisable !== false
      if (!apply) return repair(instanceId, false)
      const handle = tasks.start(
        'repair',
        'Repairing instance',
        mayDisable ? 'Installing dependencies and resolving conflicts' : 'Installing dependencies',
        instanceId
      )
      try {
        const report = await repair(
          instanceId,
          true,
          mayDisable,
          reuseBackup ? z.string().parse(reuseBackup) : undefined
        )
        await handle.done(
          `${report.fixed} issue(s) fixed${report.failed ? `, ${report.failed} failed` : ''}${
            report.pendingDisables ? `, ${report.pendingDisables} need confirmation` : ''
          }`
        )
        return report
      } catch (error) {
        await handle.fail(error)
        throw error
      }
    }
  )
  ipcMain.handle(IPC.instancesClearRepairFailures, async (_event, id: string) => {
    await clearRepairFailures(z.string().parse(id))
  })
  ipcMain.handle(IPC.instancesSyncTlsCape, async (_event, id: string) => {
    const instance = store.instance(z.string().parse(id))
    if (!instance) throw new Error('Instance not found')
    return syncTlsCape(instance, store.activeAccount())
  })

  ipcMain.handle(IPC.addonsSearch, async (_event, raw: unknown) => {
    const query = searchSchema.parse(raw) as SearchQuery
    return searchModrinth(query)
  })
  ipcMain.handle(IPC.addonsProject, async (_event, id: string) => getModrinthProject(id))
  ipcMain.handle(
    IPC.addonsVersions,
    async (_event, projectId: string, gameVersion?: string, loader?: LoaderType, type?: AddonType) =>
      getModrinthVersions(
        projectId,
        gameVersion,
        loader,
        type ? addonTypeSchema.parse(type) : undefined
      )
  )
  ipcMain.handle(IPC.addonsInstall, async (_event, instanceId: string, ref: unknown) => {
    const value = z
      .object({
        projectId: z.string().max(200),
        versionId: z.string().max(200),
        type: addonTypeSchema.optional(),
        world: z.string().max(200).optional()
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
  ipcMain.handle(IPC.addonsRemoveAll, async (_event, instanceId: string, type?: string) =>
    removeAllAddons(
      z.string().parse(instanceId),
      type === undefined ? undefined : bulkAddonTypeSchema.parse(type)
    )
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
  ipcMain.handle(IPC.bedrockUninstall, (_event, channel: unknown) =>
    uninstallBedrockVersion(bedrockChannelSchema.parse(channel))
  )
  ipcMain.handle(IPC.bedrockLaunch, (_event, channel: unknown) =>
    launchBedrock(bedrockChannelSchema.parse(channel))
  )
  ipcMain.handle(IPC.bedrockDelete, (_event, id: unknown) => deleteBedrockDownload(bedrockIdSchema.parse(id)))
  ipcMain.handle(IPC.bedrockOpenFolder, (_event, channel: unknown) =>
    openBedrockInstallFolder(bedrockChannelSchema.parse(channel))
  )
  ipcMain.handle(IPC.bedrockAddExclusion, () => addBedrockExclusion())

  nativeTheme.themeSource = 'dark'
  logger.info('ipc', 'IPC handlers registered')
}

export { duplicateInstance }
