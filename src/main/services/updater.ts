import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '@shared/types'
import { emit } from './events'
import { logger } from '../util/log'
import { store } from './store'

let state: UpdateState = { status: 'idle' }
let initialised = false

function setState(next: UpdateState): void {
  state = next
  emit({ type: 'update', payload: next })
}

export function updaterState(): UpdateState {
  return state
}

export function initUpdater(): void {
  if (initialised) return
  initialised = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = store.settings().allowPrerelease
  autoUpdater.logger = {
    info: (message?: unknown) => logger.info('updater', String(message)),
    warn: (message?: unknown) => logger.warn('updater', String(message)),
    error: (message?: unknown) => logger.error('updater', String(message)),
    debug: (message?: unknown) => logger.debug('updater', String(message))
  } as never

  autoUpdater.on('checking-for-update', () => setState({ status: 'checking', message: 'Checking for updates…' }))
  autoUpdater.on('update-available', (info) =>
    setState({ status: 'available', version: info.version, message: `Newbie Launcher ${info.version} is available.` })
  )
  autoUpdater.on('update-not-available', () => setState({ status: 'none', message: 'You are up to date.' }))
  autoUpdater.on('download-progress', (progress) =>
    setState({
      status: 'downloading',
      version: state.version,
      percent: Math.round(progress.percent),
      message: `Downloading update… ${Math.round(progress.percent)}%`
    })
  )
  autoUpdater.on('update-downloaded', (info) =>
    setState({ status: 'downloaded', version: info.version, message: 'Restart to install the update.' })
  )
  autoUpdater.on('error', (error) =>
    setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  )

  if (app.isPackaged && store.settings().autoCheckUpdates) {
    setTimeout(() => void checkForUpdates().catch(() => undefined), 12_000)
  }
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) {
    setState({ status: 'none', message: 'Update checks are disabled in development builds.' })
    return state
  }
  setState({ status: 'checking', message: 'Checking for updates…' })
  try {
    await autoUpdater.checkForUpdates()
    return state
  } catch (error) {
    setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    return state
  }
}

export async function installUpdate(): Promise<void> {
  if (state.status !== 'downloaded') {
    await autoUpdater.downloadUpdate()
  }
  autoUpdater.quitAndInstall(false, true)
}
