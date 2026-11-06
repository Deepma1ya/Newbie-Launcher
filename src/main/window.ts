import { app, BrowserWindow, dialog, shell, Tray, Menu, nativeImage } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'
import type { WindowState } from '@shared/types'
import { emitWindowState } from './services/events'
import { resolveBundleDir } from './services/bundlePaths'
import { store } from './services/store'
import { logger } from './util/log'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let hiddenForGame = false
let activeGameSessions = 0

const TLAUNCHER_HOME_URL = 'https://tlauncher.org/en/'
const TLAUNCHER_PARTITION = 'persist:newbie-tlauncher'
const TLAUNCHER_WINDOW_TITLE = 'TLauncher account — Newbie Launcher'
let tlauncherWindow: BrowserWindow | null = null
let tlauncherWindowResolvers: (() => void)[] = []

function appIconPath(): string {
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icon.png')
    if (existsSync(unpacked)) return unpacked
  }
  return path.join(app.getAppPath(), 'resources', 'icon.png')
}

/**
 * Vite may place the window code in out/main or out/main/chunks. Never resolve
 * the renderer/preload relative to __dirname alone or packaged builds open a
 * blank window.
 */
function bundleDir(): string {
  return (
    resolveBundleDir([
      path.join(__dirname, '..'),
      path.join(__dirname, '..', '..'),
      app.getAppPath(),
      process.cwd()
    ]) ?? path.join(app.getAppPath(), 'out')
  )
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function windowState(): WindowState {
  return {
    maximized: mainWindow?.isMaximized() ?? false,
    focused: mainWindow?.isFocused() ?? false
  }
}

export function createMainWindow(): BrowserWindow {
  const icon = appIconPath()
  const outDir = bundleDir()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#0B0F0C',
    title: 'Newbie Launcher',
    icon,
    autoHideMenuBar: true,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(outDir, 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    emitWindowState(windowState())
  })
  mainWindow.on('maximize', () => emitWindowState(windowState()))
  mainWindow.on('unmaximize', () => emitWindowState(windowState()))
  mainWindow.on('focus', () => emitWindowState(windowState()))
  mainWindow.on('blur', () => emitWindowState(windowState()))

  mainWindow.on('close', (event) => {
    if (!quitting && store.settings().closeToTray && tray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalSafe(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL()
    if (current && url !== current) {
      event.preventDefault()
      void openExternalSafe(url)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(path.join(outDir, 'renderer', 'index.html'))
  }

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('window', `Renderer process gone: ${details.reason}`, details)
  })
  return mainWindow
}

export async function openExternalSafe(raw: string): Promise<void> {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      logger.warn('window', `Blocked external protocol ${url.protocol}`)
      return
    }
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      logger.warn('window', `Blocked insecure external URL ${raw}`)
      return
    }
    await shell.openExternal(url.toString())
  } catch {
    logger.warn('window', `Invalid external URL: ${raw}`)
  }
}

function isTlauncherPage(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    return (
      url.hostname === 'tlauncher.org' ||
      url.hostname.endsWith('.tlauncher.org') ||
      url.hostname === 'challenges.cloudflare.com'
    )
  } catch {
    return false
  }
}

/**
 * TLauncher owns the captcha-protected sign-in and profile editor, so use
 * their real page in a sandboxed Newbie window. The persistent partition keeps
 * the session between visits without Newbie ever seeing the password.
 */
export function openTlauncherManager(): Promise<void> {
  if (tlauncherWindow && !tlauncherWindow.isDestroyed()) {
    if (tlauncherWindow.isMinimized()) tlauncherWindow.restore()
    tlauncherWindow.show()
    tlauncherWindow.focus()
    return new Promise((resolve) => tlauncherWindowResolvers.push(resolve))
  }

  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
  const win = new BrowserWindow({
    width: 1040,
    height: 820,
    minWidth: 860,
    minHeight: 620,
    parent,
    modal: Boolean(parent),
    show: false,
    autoHideMenuBar: true,
    title: TLAUNCHER_WINDOW_TITLE,
    icon: appIconPath(),
    backgroundColor: '#ECF4F7',
    webPreferences: {
      partition: TLAUNCHER_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })
  tlauncherWindow = win
  win.removeMenu()
  win.webContents.setUserAgent(
    win.webContents.getUserAgent().replace(/\sElectron\/[\d.]+/i, '')
  )
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )

  win.on('page-title-updated', (event) => {
    event.preventDefault()
    win.setTitle(TLAUNCHER_WINDOW_TITLE)
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isTlauncherPage(url)) void win.loadURL(url)
    else void openExternalSafe(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isTlauncherPage(url)) return
    event.preventDefault()
    void openExternalSafe(url)
  })
  win.webContents.on('will-redirect', (event, url) => {
    if (isTlauncherPage(url)) return
    event.preventDefault()
    void openExternalSafe(url)
  })

  let loginShown = false
  win.webContents.on('did-finish-load', () => {
    if (!win.isVisible()) win.show()
    if (loginShown) return
    void win.webContents
      .executeJavaScript(`
        (() => {
          const link = document.querySelector('a[href="#login"]')
          if (link instanceof HTMLElement) {
            link.click()
            return true
          }
          return false
        })()
      `)
      .then((opened: unknown) => {
        if (opened === true) loginShown = true
      })
      .catch(() => undefined)
  })
  win.webContents.on('did-fail-load', (_event, code, description) => {
    logger.warn('tlauncher', `TLauncher page failed to load: ${code} ${description}`)
  })
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (tlauncherWindow === win) tlauncherWindow = null
    const resolvers = tlauncherWindowResolvers
    tlauncherWindowResolvers = []
    for (const resolve of resolvers) resolve()
    logger.info('tlauncher', 'TLauncher account window closed')
  })

  logger.info('tlauncher', 'Opened TLauncher account window')
  void win.loadURL(TLAUNCHER_HOME_URL)
  return new Promise((resolve) => tlauncherWindowResolvers.push(resolve))
}

export async function pickDirectory(defaultPath?: string): Promise<string | null> {
  const options: Electron.OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'], defaultPath }
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0] ?? null
}

export async function pickFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: filters ?? [{ name: 'All files', extensions: ['*'] }]
  }
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0] ?? null
}

export async function pickSaveFile(
  defaultPath: string,
  filters?: { name: string; extensions: string[] }[]
): Promise<string | null> {
  const options: Electron.SaveDialogOptions = {
    defaultPath,
    filters: filters ?? [{ name: 'All files', extensions: ['*'] }]
  }
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options)
  return result.canceled ? null : result.filePath ?? null
}

function revealMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

export function initTray(): void {
  try {
    const iconPath = appIconPath()
    const image = nativeImage.createFromPath(iconPath)
    tray = new Tray(
      image.isEmpty()
        ? nativeImage.createEmpty()
        : image.resize({ width: 32, height: 32, quality: 'best' })
    )
    tray.setToolTip('Newbie Launcher')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Open Newbie Launcher',
          click: () => revealMainWindow()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            quitting = true
            app.quit()
          }
        }
      ])
    )
    tray.on('double-click', () => revealMainWindow())
  } catch (error) {
    logger.warn('window', 'Tray unavailable', error)
    tray = null
  }
}

export function markQuitting(): void {
  quitting = true
}

export function minimizeWindow(): void {
  mainWindow?.minimize()
}

/**
 * Hide the launcher while a game is running. The tray icon stays available,
 * and gameSessionEnded restores the window when the last game exits.
 */
export function gameSessionStarted(): void {
  activeGameSessions += 1
  if (activeGameSessions > 1) return
  if (!store.settings().minimizeOnLaunch) return
  if (!mainWindow || mainWindow.isDestroyed()) return
  hiddenForGame = true
  if (tray) {
    mainWindow.hide()
  } else {
    // Tray creation failed: keep the old minimize fallback.
    mainWindow.minimize()
  }
  logger.info('window', 'Launcher hidden while a game is running')
}

export function gameSessionEnded(allowRestore = true): void {
  activeGameSessions = Math.max(0, activeGameSessions - 1)
  if (!allowRestore) return
  if (activeGameSessions > 0 || !hiddenForGame) return
  hiddenForGame = false
  if (quitting) return
  revealMainWindow()
  logger.info('window', 'Launcher restored after the game exited')
}

export function toggleMaximize(): void {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
}

export function hideWindow(): void {
  mainWindow?.hide()
}

export function showWindow(): void {
  revealMainWindow()
}
