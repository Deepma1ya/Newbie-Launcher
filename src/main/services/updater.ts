import { app } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { UpdateState } from '@shared/types'
import { GITHUB_OWNER, GITHUB_REPO, USER_AGENT } from '@shared/constants'
import { releaseNotesText } from '@shared/update'
import { emit } from './events'
import { logger } from '../util/log'
import { store } from './store'

const INITIAL_CHECK_DELAY_MS = 8_000
const CHECK_INTERVAL_MS = 30 * 60 * 1000

let state: UpdateState = { status: 'idle', currentVersion: app.getVersion() }
let initialised = false
let checkTimer: NodeJS.Timeout | null = null
const releaseNotesCache = new Map<string, Partial<UpdateState>>()
const releaseNotesRequests = new Map<string, Promise<void>>()

function setState(next: UpdateState): void {
  state = { ...next, currentVersion: app.getVersion() }
  emit({ type: 'update', payload: state })
}

export function updaterState(): UpdateState {
  return state
}

export function initUpdater(): void {
  if (initialised) return
  initialised = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoRunAppAfterInstall = true
  autoUpdater.allowPrerelease = store.settings().allowPrerelease
  autoUpdater.logger = {
    info: (message?: unknown) => logger.info('updater', String(message)),
    warn: (message?: unknown) => logger.warn('updater', String(message)),
    error: (message?: unknown) => logger.error('updater', String(message)),
    debug: (message?: unknown) => logger.debug('updater', String(message))
  } as never

  autoUpdater.on('checking-for-update', () =>
    setState({
      status: 'checking',
      message: 'Checking GitHub for a newer version…'
    })
  )

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setState({
      status: 'available',
      version: info.version,
      releaseName: info.releaseName ?? `Newbie Launcher ${info.version}`,
      releaseDate: info.releaseDate,
      releaseNotes: releaseNotesText(info.releaseNotes),
      message: `Newbie Launcher ${info.version} is available.`
    })
    if (!info.releaseNotes) void enrichReleaseNotes(info.version)
    logger.info('updater', `Update available: ${info.version}`)
  })

  autoUpdater.on('update-not-available', () =>
    setState({
      status: 'none',
      lastCheckedAt: new Date().toISOString(),
      message: 'You are running the latest version.'
    })
  )

  autoUpdater.on('download-progress', (progress: ProgressInfo) =>
    setState({
      ...state,
      status: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
      message: `Downloading update… ${Math.round(progress.percent)}%`
    })
  )

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setState({
      ...state,
      status: 'downloaded',
      version: info.version,
      percent: 100,
      lastCheckedAt: new Date().toISOString(),
      message: 'Restart to install the update.'
    })
    emit({
      type: 'toast',
      payload: {
        kind: 'success',
        title: `Update ${info.version} ready`,
        message: 'Restart Newbie Launcher to finish installing it.'
      }
    })
    logger.info('updater', `Update downloaded: ${info.version}`)
  })

  autoUpdater.on('error', (error: Error) => {
    logger.warn('updater', 'Update check/download failed', error)
    setState({
      ...state,
      status: 'error',
      lastCheckedAt: new Date().toISOString(),
      message: describeUpdateError(error)
    })
  })

  if (app.isPackaged) {
    if (store.settings().autoCheckUpdates) {
      const initial = setTimeout(() => void checkForUpdates().catch(() => undefined), INITIAL_CHECK_DELAY_MS)
      initial.unref?.()
    }
    // The setting can change at runtime, so check it each tick instead of
    // only when the launcher starts.
    checkTimer = setInterval(() => {
      if (store.settings().autoCheckUpdates) void checkForUpdates().catch(() => undefined)
    }, CHECK_INTERVAL_MS)
    checkTimer.unref?.()
  }
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) {
    setState({
      status: 'none',
      lastCheckedAt: new Date().toISOString(),
      message: 'Update checks are disabled in development builds.'
    })
    return state
  }
  if (
    state.status === 'checking' ||
    state.status === 'available' ||
    state.status === 'downloading' ||
    state.status === 'downloaded'
  ) {
    return state
  }

  autoUpdater.allowPrerelease = store.settings().allowPrerelease
  setState({ status: 'checking', message: 'Checking GitHub for a newer version…' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    logger.warn('updater', 'Update check failed', error)
    setState({
      status: 'error',
      lastCheckedAt: new Date().toISOString(),
      message: describeUpdateError(error)
    })
  }
  return state
}

export async function installUpdate(): Promise<void> {
  if (state.status !== 'downloaded') {
    throw new Error('The update is still downloading. Try again when it is ready.')
  }
  logger.info('updater', `Restarting to install ${state.version ?? 'the update'}`)
  autoUpdater.quitAndInstall(false, true)
}

/**
 * latest.yml from electron-builder does not include release notes, so fetch
 * the matching GitHub release body. The GitHub API is free and unauthenticated
 * for public repositories. Failure here never blocks the update itself.
 */
async function enrichReleaseNotes(version: string): Promise<void> {
  const cached = releaseNotesCache.get(version)
  if (cached) {
    applyReleaseNotes(version, cached)
    return
  }
  const existing = releaseNotesRequests.get(version)
  if (existing) return existing

  const request = (async () => {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${version.replace(/^v/i, '')}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': USER_AGENT
          },
          signal: AbortSignal.timeout(8_000)
        }
      )
      if (!response.ok) {
        logger.debug('updater', `Release notes request returned HTTP ${response.status}`)
        return
      }
      const release = (await response.json()) as {
        name?: string
        body?: string
        published_at?: string
      }
      const notes: Partial<UpdateState> = {}
      if (release.name) notes.releaseName = release.name
      if (release.published_at) notes.releaseDate = release.published_at
      const notesText = releaseNotesText(release.body)
      if (notesText) notes.releaseNotes = notesText
      releaseNotesCache.set(version, notes)
      applyReleaseNotes(version, notes)
    } catch (error) {
      logger.debug('updater', 'Could not fetch release notes', error)
    } finally {
      releaseNotesRequests.delete(version)
    }
  })()
  releaseNotesRequests.set(version, request)
  return request
}

function applyReleaseNotes(version: string, notes: Partial<UpdateState>): void {
  if (state.version !== version) return
  if (state.status !== 'available' && state.status !== 'downloading' && state.status !== 'downloaded') return
  setState({ ...state, ...notes })
}

function describeUpdateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/ENOTFOUND|EAI_AGAIN|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|net::/i.test(message)) {
    return 'Could not reach GitHub. Check your internet connection and try again.'
  }
  if (/404|latest\.yml|app-update\.yml/i.test(message)) {
    return 'The update feed is unavailable. Download the latest installer from GitHub instead.'
  }
  return message
}
