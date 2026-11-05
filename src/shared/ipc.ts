import type {
  AccountSummary,
  AddonRecord,
  AppEvent,
  AppInfo,
  BackupRecord,
  CreateInstanceInput,
  CurseForgeFile,
  CurseForgeMod,
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
  WindowState
} from './types'

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
  settingsSetCurseforgeKey: 'settings:set-curseforge-key',
  settingsTestCurseforgeKey: 'settings:test-curseforge-key',

  accountsList: 'accounts:list',
  accountsAddOffline: 'accounts:add-offline',
  accountsAddTlauncher: 'accounts:add-tlauncher',
  accountsAddAuthlib: 'accounts:add-authlib',
  accountsStartMicrosoft: 'accounts:start-microsoft',
  accountsCancelMicrosoft: 'accounts:cancel-microsoft',
  accountsRemove: 'accounts:remove',
  accountsSetActive: 'accounts:set-active',
  accountsRefresh: 'accounts:refresh',

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
  instancesRepair: 'instances:repair',

  addonsSearch: 'addons:search',
  addonsProject: 'addons:project',
  addonsVersions: 'addons:versions',
  addonsInstall: 'addons:install',
  addonsRemove: 'addons:remove',
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
  updaterState: 'updater:state'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export interface AddonVersionRef {
  provider: 'modrinth' | 'curseforge'
  projectId: string
  versionId: string
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
    setCurseforgeKey(key: string | null): Promise<LauncherSettings>
    testCurseforgeKey(key: string): Promise<boolean>
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
    repair(id: string, apply: boolean): Promise<RepairReport>
  }
  addons: {
    search(query: SearchQuery): Promise<SearchPage>
    project(provider: 'modrinth' | 'curseforge', id: string): Promise<ModrinthProject | CurseForgeMod>
    versions(
      provider: 'modrinth' | 'curseforge',
      projectId: string,
      gameVersion?: string,
      loader?: LoaderType
    ): Promise<(ModrinthVersion | CurseForgeFile)[]>
    install(instanceId: string, ref: AddonVersionRef): Promise<AddonRecord[]>
    remove(instanceId: string, addonId: string, deleteFile: boolean): Promise<void>
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
}
