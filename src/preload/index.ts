import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { NewbieApi } from '@shared/ipc'
import type { AppEvent, WindowState } from '@shared/types'

const api: NewbieApi = {
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    minimize: () => ipcRenderer.invoke(IPC.appMinimize),
    maximize: () => ipcRenderer.invoke(IPC.appMaximize),
    close: () => ipcRenderer.invoke(IPC.appClose),
    openExternal: (url) => ipcRenderer.invoke(IPC.appOpenExternal, url),
    showItem: (path) => ipcRenderer.invoke(IPC.appShowItem, path),
    pickDirectory: (defaultPath) => ipcRenderer.invoke(IPC.appPickDirectory, defaultPath),
    pickFile: (filters) => ipcRenderer.invoke(IPC.appPickFile, filters),
    relaunch: () => ipcRenderer.invoke(IPC.appRelaunch),
    onEvent: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: AppEvent): void => listener(payload)
      ipcRenderer.on('app:event', wrapped)
      return () => ipcRenderer.removeListener('app:event', wrapped)
    },
    onWindowState: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: WindowState): void => listener(payload)
      ipcRenderer.on('app:window-state', wrapped)
      return () => ipcRenderer.removeListener('app:window-state', wrapped)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
    pickDataDir: () => ipcRenderer.invoke(IPC.settingsPickDataDir),
    changeDataDir: (dir) => ipcRenderer.invoke(IPC.settingsChangeDataDir, dir),
    revealDataDir: () => ipcRenderer.invoke(IPC.settingsRevealDataDir)
  },
  accounts: {
    list: () => ipcRenderer.invoke(IPC.accountsList),
    addOffline: (username) => ipcRenderer.invoke(IPC.accountsAddOffline, username),
    addTlauncher: (username) => ipcRenderer.invoke(IPC.accountsAddTlauncher, username),
    addAuthlib: (input) => ipcRenderer.invoke(IPC.accountsAddAuthlib, input),
    startMicrosoft: () => ipcRenderer.invoke(IPC.accountsStartMicrosoft),
    cancelMicrosoft: () => ipcRenderer.invoke(IPC.accountsCancelMicrosoft),
    remove: (id) => ipcRenderer.invoke(IPC.accountsRemove, id),
    setActive: (id) => ipcRenderer.invoke(IPC.accountsSetActive, id),
    refresh: (id) => ipcRenderer.invoke(IPC.accountsRefresh, id),
    manageTlauncher: (id) => ipcRenderer.invoke(IPC.accountsManageTlauncher, id),
    setSkin: (id, filePath) => ipcRenderer.invoke(IPC.accountsSetSkin, id, filePath),
    removeSkin: (id) => ipcRenderer.invoke(IPC.accountsRemoveSkin, id)
  },
  skins: {
    search: (query, page) => ipcRenderer.invoke(IPC.skinsSearch, query, page),
    applyCatalog: (accountId, skinUrl) =>
      ipcRenderer.invoke(IPC.skinsApplyCatalog, accountId, skinUrl)
  },
  servers: {
    list: () => ipcRenderer.invoke(IPC.serversList),
    get: (id) => ipcRenderer.invoke(IPC.serversGet, id),
    bedrockVersions: () => ipcRenderer.invoke(IPC.serversBedrockVersions),
    create: (input) => ipcRenderer.invoke(IPC.serversCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.serversUpdate, id, patch),
    remove: (id, deleteFiles) => ipcRenderer.invoke(IPC.serversRemove, id, deleteFiles),
    start: (id) => ipcRenderer.invoke(IPC.serversStart, id),
    stop: (id) => ipcRenderer.invoke(IPC.serversStop, id),
    restart: (id) => ipcRenderer.invoke(IPC.serversRestart, id),
    status: (id) => ipcRenderer.invoke(IPC.serversStatus, id),
    statuses: () => ipcRenderer.invoke(IPC.serversStatuses),
    stats: (id) => ipcRenderer.invoke(IPC.serversStats, id),
    logs: (id) => ipcRenderer.invoke(IPC.serversLogs, id),
    command: (id, command) => ipcRenderer.invoke(IPC.serversCommand, id, command),
    share: (id) => ipcRenderer.invoke(IPC.serversShare, id),
    testAddress: (address) => ipcRenderer.invoke(IPC.serversTestAddress, address),
    properties: (id) => ipcRenderer.invoke(IPC.serversProperties, id),
    saveProperties: (id, patch) => ipcRenderer.invoke(IPC.serversSaveProperties, id, patch),
    internetState: (id) => ipcRenderer.invoke(IPC.serversInternetState, id),
    internetStart: (id, provider) => ipcRenderer.invoke(IPC.serversInternetStart, id, provider),
    internetStop: (id) => ipcRenderer.invoke(IPC.serversInternetStop, id),
    allowlist: (id) => ipcRenderer.invoke(IPC.serversAllowlist, id),
    allowlistAdd: (id, entry) => ipcRenderer.invoke(IPC.serversAllowlistAdd, id, entry),
    allowlistRemove: (id, xuid) => ipcRenderer.invoke(IPC.serversAllowlistRemove, id, xuid),
    searchAddons: (query) => ipcRenderer.invoke(IPC.serversSearchAddons, query),
    installAddon: (serverId, ref) => ipcRenderer.invoke(IPC.serversInstallAddon, serverId, ref),
    removeAddon: (serverId, addonId, deleteFile) =>
      ipcRenderer.invoke(IPC.serversRemoveAddon, serverId, addonId, deleteFile),
    toggleAddon: (serverId, addonId, enabled) =>
      ipcRenderer.invoke(IPC.serversToggleAddon, serverId, addonId, enabled),
    checkAddonUpdates: (serverId) => ipcRenderer.invoke(IPC.serversCheckAddonUpdates, serverId),
    updateAllAddons: (serverId) => ipcRenderer.invoke(IPC.serversUpdateAllAddons, serverId),
    resourcePack: (serverId) => ipcRenderer.invoke(IPC.serversResourcePack, serverId),
    searchResourcePacks: (query) => ipcRenderer.invoke(IPC.serversResourcePackSearch, query),
    installResourcePack: (serverId, projectId, versionId) =>
      ipcRenderer.invoke(IPC.serversResourcePackInstall, serverId, projectId, versionId),
    importResourcePack: (serverId, filePath) =>
      ipcRenderer.invoke(IPC.serversResourcePackImport, serverId, filePath),
    saveResourcePack: (serverId, input) =>
      ipcRenderer.invoke(IPC.serversResourcePackSave, serverId, input),
    removeResourcePack: (serverId, deleteFile) =>
      ipcRenderer.invoke(IPC.serversResourcePackRemove, serverId, deleteFile),
    openFolder: (id, sub) => ipcRenderer.invoke(IPC.serversOpenFolder, id, sub)
  },
  versions: {
    minecraft: (force) => ipcRenderer.invoke(IPC.versionsMinecraft, force),
    loaders: (type, gameVersion) => ipcRenderer.invoke(IPC.versionsLoaders, type, gameVersion),
    installed: () => ipcRenderer.invoke(IPC.versionsInstalled),
    install: (input) => ipcRenderer.invoke(IPC.versionsInstall, input)
  },
  instances: {
    list: () => ipcRenderer.invoke(IPC.instancesList),
    get: (id) => ipcRenderer.invoke(IPC.instancesGet, id),
    create: (input) => ipcRenderer.invoke(IPC.instancesCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.instancesUpdate, id, patch),
    remove: (id, deleteFiles) => ipcRenderer.invoke(IPC.instancesRemove, id, deleteFiles),
    launch: (id) => ipcRenderer.invoke(IPC.instancesLaunch, id),
    stop: (id) => ipcRenderer.invoke(IPC.instancesStop, id),
    running: () => ipcRenderer.invoke(IPC.instancesRunning),
    logs: (id) => ipcRenderer.invoke(IPC.instancesLogs, id),
    openFolder: (id, sub) => ipcRenderer.invoke(IPC.instancesOpenFolder, id, sub),
    worlds: (id) => ipcRenderer.invoke(IPC.instancesWorlds, id),
    copySettings: (input) => ipcRenderer.invoke(IPC.instancesCopySettings, input),
    repair: (id, apply, allowDisable, reuseBackup) =>
      ipcRenderer.invoke(IPC.instancesRepair, id, apply, allowDisable, reuseBackup),
    clearRepairFailures: (id) => ipcRenderer.invoke(IPC.instancesClearRepairFailures, id),
    syncTlsCape: (id) => ipcRenderer.invoke(IPC.instancesSyncTlsCape, id),
    exportPack: (id) => ipcRenderer.invoke(IPC.instancesExportPack, id),
    importPack: (filePath) => ipcRenderer.invoke(IPC.instancesImportPack, filePath),
    copyAddons: (sourceId, targetId, options) =>
      ipcRenderer.invoke(IPC.instancesCopyAddons, sourceId, targetId, options),
    sharePack: (id) => ipcRenderer.invoke(IPC.instancesSharePackStart, id),
    stopPackShare: () => ipcRenderer.invoke(IPC.instancesSharePackStop),
    packShare: () => ipcRenderer.invoke(IPC.instancesSharePackStatus)
  },
  addons: {
    search: (query) => ipcRenderer.invoke(IPC.addonsSearch, query),
    project: (id) => ipcRenderer.invoke(IPC.addonsProject, id),
    versions: (projectId, gameVersion, loader, type) =>
      ipcRenderer.invoke(IPC.addonsVersions, projectId, gameVersion, loader, type),
    install: (instanceId, ref) => ipcRenderer.invoke(IPC.addonsInstall, instanceId, ref),
    remove: (instanceId, addonId, deleteFile) => ipcRenderer.invoke(IPC.addonsRemove, instanceId, addonId, deleteFile),
    removeAll: (instanceId, type) => ipcRenderer.invoke(IPC.addonsRemoveAll, instanceId, type),
    toggle: (instanceId, addonId, enabled) => ipcRenderer.invoke(IPC.addonsToggle, instanceId, addonId, enabled),
    checkUpdates: (instanceId) => ipcRenderer.invoke(IPC.addonsCheckUpdates, instanceId),
    updateAll: (instanceId) => ipcRenderer.invoke(IPC.addonsUpdateAll, instanceId),
    scan: (instanceId) => ipcRenderer.invoke(IPC.addonsScan, instanceId)
  },
  loadouts: {
    create: (instanceId, input) => ipcRenderer.invoke(IPC.loadoutsCreate, instanceId, input),
    update: (instanceId, loadoutId, patch) => ipcRenderer.invoke(IPC.loadoutsUpdate, instanceId, loadoutId, patch),
    remove: (instanceId, loadoutId) => ipcRenderer.invoke(IPC.loadoutsRemove, instanceId, loadoutId),
    activate: (instanceId, loadoutId) => ipcRenderer.invoke(IPC.loadoutsActivate, instanceId, loadoutId),
    plan: (instanceId, loadoutId) => ipcRenderer.invoke(IPC.loadoutsPlan, instanceId, loadoutId),
    backup: (instanceId, loadoutId) => ipcRenderer.invoke(IPC.loadoutsBackup, instanceId, loadoutId)
  },
  modpacks: {
    install: (projectId, versionId) => ipcRenderer.invoke(IPC.modpacksInstall, projectId, versionId),
    installToInstance: (instanceId, projectId, versionId) =>
      ipcRenderer.invoke(IPC.modpacksInstallToInstance, instanceId, projectId, versionId)
  },
  system: {
    info: () => ipcRenderer.invoke(IPC.systemInfo),
    detectJava: () => ipcRenderer.invoke(IPC.systemDetectJava),
    installJava: (major) => ipcRenderer.invoke(IPC.systemInstallJava, major),
    applyGpu: (instanceId) => ipcRenderer.invoke(IPC.systemApplyGpu, instanceId),
    backups: (instanceId) => ipcRenderer.invoke(IPC.systemBackups, instanceId),
    createBackup: (instanceId) => ipcRenderer.invoke(IPC.systemCreateBackup, instanceId),
    diskUsage: () => ipcRenderer.invoke(IPC.systemDiskUsage)
  },
  tasks: {
    list: () => ipcRenderer.invoke(IPC.tasksList)
  },
  updater: {
    check: () => ipcRenderer.invoke(IPC.updaterCheck),
    install: () => ipcRenderer.invoke(IPC.updaterInstall),
    state: () => ipcRenderer.invoke(IPC.updaterState)
  },
  bedrock: {
    state: (forceRefresh) => ipcRenderer.invoke(IPC.bedrockState, forceRefresh),
    download: (id) => ipcRenderer.invoke(IPC.bedrockDownload, id),
    cancel: (id) => ipcRenderer.invoke(IPC.bedrockCancel, id),
    install: (id, replaceInstalled) => ipcRenderer.invoke(IPC.bedrockInstall, id, replaceInstalled),
    uninstall: (channel) => ipcRenderer.invoke(IPC.bedrockUninstall, channel),
    launch: (channel) => ipcRenderer.invoke(IPC.bedrockLaunch, channel),
    delete: (id) => ipcRenderer.invoke(IPC.bedrockDelete, id),
    openFolder: (channel) => ipcRenderer.invoke(IPC.bedrockOpenFolder, channel),
    addExclusion: () => ipcRenderer.invoke(IPC.bedrockAddExclusion),
    openSecurity: () => ipcRenderer.invoke(IPC.bedrockOpenSecurity),
    windowsAccount: () => ipcRenderer.invoke(IPC.bedrockWindowsAccount),
    openXbox: () => ipcRenderer.invoke(IPC.bedrockOpenXbox)
  }
}

contextBridge.exposeInMainWorld('newbie', api)
