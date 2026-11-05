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
    refresh: (id) => ipcRenderer.invoke(IPC.accountsRefresh, id)
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
    repair: (id, apply) => ipcRenderer.invoke(IPC.instancesRepair, id, apply)
  },
  addons: {
    search: (query) => ipcRenderer.invoke(IPC.addonsSearch, query),
    project: (id) => ipcRenderer.invoke(IPC.addonsProject, id),
    versions: (projectId, gameVersion, loader) =>
      ipcRenderer.invoke(IPC.addonsVersions, projectId, gameVersion, loader),
    install: (instanceId, ref) => ipcRenderer.invoke(IPC.addonsInstall, instanceId, ref),
    remove: (instanceId, addonId, deleteFile) => ipcRenderer.invoke(IPC.addonsRemove, instanceId, addonId, deleteFile),
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
  }
}

contextBridge.exposeInMainWorld('newbie', api)
