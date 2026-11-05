import type {
  AccountSummary,
  AddonRecord,
  AddonType,
  AppEvent,
  AppInfo,
  BackupRecord,
  BedrockChannel,
  BedrockExclusionResult,
  BedrockState,
  CreateInstanceInput,
  GpuApplyResult,
  Instance,
  JavaRuntime,
  LaunchState,
  LauncherSettings,
  LoaderType,
  LoaderVersion,
  Loadout,
  LoadoutPlan,
  MinecraftVersionSummary,
  ModrinthProject,
  ModrinthVersion,
  RepairReport,
  SearchPage,
  SearchQuery,
  SystemInfo,
  TaskRecord,
  UpdateInstanceInput,
  UpdateState,
  WindowState,
  WorldSummary,
  BulkAddonType,
  ServerRecord,
  ServerRuntimeStatus,
  ServerStats,
  ServerAddonRecord,
  ServerAddonType,
  ServerSearchQuery,
  CreateServerInput,
  ServerShareInfo,
  ServerAddressTest,
  UpdateServerInput,
  ServerResourcePackState,
  ServerResourcePackSearchQuery,
  ServerResourcePackImport,
  ServerResourcePackInput
} from './types'
import type { TlsCapeSyncResult } from './tlskincape'
import type { CopyInstanceSettingsInput, CopyInstanceSettingsResult } from './instanceSettings'

export const IPC = {
  appInfo: 'app:info',
  appWindowState: 'app:window-state',
  appMinimize: 'app:minimize',
  appMaximize: 'app:maximize',
  appClose: 'app:close',
  appOpenExternal: 'app:open-external',
  appShowItem: 'app:show-item',
  appPickDirectory: 'app:pick-directory',
  appPickFile: 'app:pick-file',
  appRelaunch: 'app:relaunch',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsPickDataDir: 'settings:pick-data-dir',
  settingsChangeDataDir: 'settings:change-data-dir',
  settingsRevealDataDir: 'settings:reveal-data-dir',

  accountsList: 'accounts:list',
  accountsAddOffline: 'accounts:add-offline',
  accountsAddTlauncher: 'accounts:add-tlauncher',
  accountsAddAuthlib: 'accounts:add-authlib',
  accountsStartMicrosoft: 'accounts:start-microsoft',
  accountsCancelMicrosoft: 'accounts:cancel-microsoft',
  accountsRemove: 'accounts:remove',
  accountsSetActive: 'accounts:set-active',
  accountsRefresh: 'accounts:refresh',
  accountsSetSkin: 'accounts:set-skin',
  accountsRemoveSkin: 'accounts:remove-skin',

  versionsMinecraft: 'versions:minecraft',
  versionsLoaders: 'versions:loaders',
  versionsInstalled: 'versions:installed',
  versionsInstall: 'versions:install',

  instancesList: 'instances:list',
  instancesGet: 'instances:get',
  instancesCreate: 'instances:create',
  instancesUpdate: 'instances:update',
  instancesRemove: 'instances:remove',
  instancesLaunch: 'instances:launch',
  instancesStop: 'instances:stop',
  instancesRunning: 'instances:running',
  instancesLogs: 'instances:logs',
  instancesOpenFolder: 'instances:open-folder',
  instancesWorlds: 'instances:worlds',
  instancesCopySettings: 'instances:copy-settings',
  instancesRepair: 'instances:repair',
  instancesClearRepairFailures: 'instances:clear-repair-failures',
  instancesSyncTlsCape: 'instances:sync-tls-cape',
  serversList: 'servers:list',
  serversGet: 'servers:get',
  serversCreate: 'servers:create',
  serversUpdate: 'servers:update',
  serversRemove: 'servers:remove',
  serversStart: 'servers:start',
  serversStop: 'servers:stop',
  serversRestart: 'servers:restart',
  serversStatus: 'servers:status',
  serversStatuses: 'servers:statuses',
  serversStats: 'servers:stats',
  serversLogs: 'servers:logs',
  serversCommand: 'servers:command',
  serversShare: 'servers:share',
  serversTestAddress: 'servers:test-address',
  serversProperties: 'servers:properties',
  serversSaveProperties: 'servers:save-properties',
  serversSearchAddons: 'servers:search-addons',
  serversInstallAddon: 'servers:install-addon',
  serversRemoveAddon: 'servers:remove-addon',
  serversToggleAddon: 'servers:toggle-addon',
  serversCheckAddonUpdates: 'servers:check-addon-updates',
  serversUpdateAllAddons: 'servers:update-all-addons',
  serversResourcePack: 'servers:resource-pack',
  serversResourcePackSearch: 'servers:resource-pack-search',
  serversResourcePackInstall: 'servers:resource-pack-install',
  serversResourcePackImport: 'servers:resource-pack-import',
  serversResourcePackSave: 'servers:resource-pack-save',
  serversResourcePackRemove: 'servers:resource-pack-remove',
  serversOpenFolder: 'servers:open-folder',

  addonsSearch: 'addons:search',
  addonsProject: 'addons:project',
  addonsVersions: 'addons:versions',
  addonsInstall: 'addons:install',
  addonsRemove: 'addons:remove',
  addonsRemoveAll: 'addons:remove-all',
  addonsToggle: 'addons:toggle',
  addonsCheckUpdates: 'addons:check-updates',
  addonsUpdateAll: 'addons:update-all',
  addonsScan: 'addons:scan',

  loadoutsCreate: 'loadouts:create',
  loadoutsUpdate: 'loadouts:update',
  loadoutsRemove: 'loadouts:remove',
  loadoutsActivate: 'loadouts:activate',
  loadoutsPlan: 'loadouts:plan',
  loadoutsBackup: 'loadouts:backup',

  modpacksInstall: 'modpacks:install',
  modpacksInstallToInstance: 'modpacks:install-to-instance',

  systemInfo: 'system:info',
  systemDetectJava: 'system:detect-java',
  systemInstallJava: 'system:install-java',
  systemApplyGpu: 'system:apply-gpu',
  systemBackups: 'system:backups',
  systemCreateBackup: 'system:create-backup',
  systemDiskUsage: 'system:disk-usage',

  tasksList: 'tasks:list',

  updaterCheck: 'updater:check',
  updaterInstall: 'updater:install',
  updaterState: 'updater:state',

  bedrockState: 'bedrock:state',
  bedrockDownload: 'bedrock:download',
  bedrockCancel: 'bedrock:cancel',
  bedrockInstall: 'bedrock:install',
  bedrockUninstall: 'bedrock:uninstall',
  bedrockLaunch: 'bedrock:launch',
  bedrockDelete: 'bedrock:delete',
  bedrockOpenFolder: 'bedrock:open-folder',
  bedrockAddExclusion: 'bedrock:add-exclusion'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export interface AddonVersionRef {
  projectId: string
  versionId: string
  /** Force the add-on type for projects published as both mods and datapacks. */
  type?: AddonType
  /** World folder under saves/ for a world-specific datapack install. */
  world?: string
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export interface NewbieApi {
  app: {
    info(): Promise<AppInfo>
    minimize(): Promise<void>
    maximize(): Promise<void>
    close(): Promise<void>
    openExternal(url: string): Promise<void>
    showItem(path: string): Promise<void>
    pickDirectory(defaultPath?: string): Promise<string | null>
    pickFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null>
    relaunch(): Promise<void>
    onEvent(listener: (event: AppEvent) => void): () => void
    onWindowState(listener: (state: WindowState) => void): () => void
  }
  settings: {
    get(): Promise<LauncherSettings>
    update(patch: DeepPartial<LauncherSettings>): Promise<LauncherSettings>
    pickDataDir(): Promise<string | null>
    changeDataDir(dir: string): Promise<LauncherSettings>
    revealDataDir(): Promise<void>
  }
  accounts: {
    list(): Promise<AccountSummary[]>
    addOffline(username: string): Promise<AccountSummary>
    addTlauncher(username: string): Promise<AccountSummary>
    addAuthlib(input: { apiRoot: string; username: string; password: string }): Promise<AccountSummary>
    startMicrosoft(): Promise<void>
    cancelMicrosoft(): Promise<void>
    remove(id: string): Promise<void>
    setActive(id: string): Promise<void>
    refresh(id: string): Promise<AccountSummary>
    setSkin(id: string, filePath: string): Promise<AccountSummary>
    removeSkin(id: string): Promise<AccountSummary>
  }
  servers: {
    list(): Promise<ServerRecord[]>
    get(id: string): Promise<ServerRecord | null>
    create(input: CreateServerInput): Promise<ServerRecord>
    update(id: string, patch: UpdateServerInput): Promise<ServerRecord>
    remove(id: string, deleteFiles: boolean): Promise<void>
    start(id: string): Promise<void>
    stop(id: string): Promise<void>
    restart(id: string): Promise<void>
    status(id: string): Promise<ServerRuntimeStatus>
    statuses(): Promise<ServerRuntimeStatus[]>
    stats(id: string): Promise<ServerStats>
    logs(id: string): Promise<string[]>
    command(id: string, command: string): Promise<void>
    share(id: string): Promise<ServerShareInfo>
    testAddress(address: string): Promise<ServerAddressTest>
    properties(id: string): Promise<Record<string, string>>
    saveProperties(id: string, patch: Record<string, string>): Promise<Record<string, string>>
    searchAddons(query: ServerSearchQuery): Promise<SearchPage>
    installAddon(
      serverId: string,
      ref: { projectId: string; versionId?: string; type?: ServerAddonType }
    ): Promise<ServerAddonRecord[]>
    removeAddon(serverId: string, addonId: string, deleteFile: boolean): Promise<void>
    toggleAddon(serverId: string, addonId: string, enabled: boolean): Promise<ServerAddonRecord>
    checkAddonUpdates(serverId: string): Promise<ServerAddonRecord[]>
    updateAllAddons(serverId: string): Promise<ServerAddonRecord[]>
    resourcePack(serverId: string): Promise<ServerResourcePackState>
    searchResourcePacks(query: ServerResourcePackSearchQuery): Promise<SearchPage>
    installResourcePack(
      serverId: string,
      projectId: string,
      versionId?: string
    ): Promise<ServerResourcePackState>
    importResourcePack(serverId: string, filePath: string): Promise<ServerResourcePackImport>
    saveResourcePack(serverId: string, input: ServerResourcePackInput): Promise<ServerResourcePackState>
    removeResourcePack(serverId: string, deleteFile: boolean): Promise<ServerResourcePackState>
    openFolder(id: string, sub?: string): Promise<void>
  }
  versions: {
    minecraft(force?: boolean): Promise<MinecraftVersionSummary[]>
    loaders(type: LoaderType, gameVersion: string): Promise<LoaderVersion[]>
    installed(): Promise<string[]>
    install(input: { versionId: string; loader: LoaderType; loaderVersion?: string }): Promise<void>
  }
  instances: {
    list(): Promise<Instance[]>
    get(id: string): Promise<Instance | null>
    create(input: CreateInstanceInput): Promise<Instance>
    update(id: string, patch: UpdateInstanceInput): Promise<Instance>
    remove(id: string, deleteFiles: boolean): Promise<void>
    launch(id: string): Promise<void>
    stop(id: string): Promise<void>
    running(): Promise<LaunchState[]>
    logs(id: string): Promise<string[]>
    openFolder(id: string, sub?: string): Promise<void>
    worlds(id: string): Promise<WorldSummary[]>
    copySettings(input: CopyInstanceSettingsInput): Promise<CopyInstanceSettingsResult>
    repair(id: string, apply: boolean, allowDisable?: boolean, reuseBackup?: string): Promise<RepairReport>
    clearRepairFailures(id: string): Promise<void>
    syncTlsCape(id: string): Promise<TlsCapeSyncResult>
  }
  addons: {
    search(query: SearchQuery): Promise<SearchPage>
    project(id: string): Promise<ModrinthProject>
    versions(projectId: string, gameVersion?: string, loader?: LoaderType, type?: AddonType): Promise<ModrinthVersion[]>
    install(instanceId: string, ref: AddonVersionRef): Promise<AddonRecord[]>
    remove(instanceId: string, addonId: string, deleteFile: boolean): Promise<void>
    removeAll(instanceId: string, type?: BulkAddonType): Promise<number>
    toggle(instanceId: string, addonId: string, enabled: boolean): Promise<AddonRecord>
    checkUpdates(instanceId: string): Promise<AddonRecord[]>
    updateAll(instanceId: string): Promise<AddonRecord[]>
    scan(instanceId: string): Promise<AddonRecord[]>
  }
  loadouts: {
    create(instanceId: string, input: { name: string; mode: Loadout['mode']; addonIds: string[] }): Promise<Loadout>
    update(
      instanceId: string,
      loadoutId: string,
      patch: { name?: string; mode?: Loadout['mode']; addonIds?: string[] }
    ): Promise<Loadout>
    remove(instanceId: string, loadoutId: string): Promise<void>
    activate(instanceId: string, loadoutId: string): Promise<void>
    plan(instanceId: string, loadoutId: string): Promise<LoadoutPlan>
    backup(instanceId: string, loadoutId: string): Promise<void>
  }
  modpacks: {
    install(projectId: string, versionId: string): Promise<Instance>
    installToInstance(instanceId: string, projectId: string, versionId: string): Promise<Instance>
  }
  system: {
    info(): Promise<SystemInfo>
    detectJava(): Promise<JavaRuntime[]>
    installJava(major: number): Promise<JavaRuntime>
    applyGpu(instanceId?: string): Promise<GpuApplyResult>
    backups(instanceId?: string): Promise<BackupRecord[]>
    createBackup(instanceId: string): Promise<BackupRecord>
    diskUsage(): Promise<{
      dataDirMb: number
      cacheMb: number
      instances: { id: string; name: string; mb: number }[]
    }>
  }
  tasks: {
    list(): Promise<TaskRecord[]>
  }
  updater: {
    check(): Promise<UpdateState>
    install(): Promise<void>
    state(): Promise<UpdateState>
  }
  bedrock: {
    state(forceRefresh?: boolean): Promise<BedrockState>
    download(id: string): Promise<void>
    cancel(id: string): Promise<boolean>
    install(id: string, replaceInstalled?: boolean): Promise<BedrockState>
    uninstall(channel: BedrockChannel): Promise<BedrockState>
    launch(channel: BedrockChannel): Promise<void>
    delete(id: string): Promise<void>
    openFolder(channel: BedrockChannel): Promise<void>
    addExclusion(): Promise<BedrockExclusionResult>
  }
}
