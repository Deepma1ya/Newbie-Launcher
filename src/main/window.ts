import { app, BrowserWindow, dialog, shell, Tray, Menu, nativeImage } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'
import type { WindowState } from '@shared/types'
import { emitWindowState } from './services/events'
import { store } from './services/store'
import { logger } from './util/log'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

function appIconPath(): string {
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icon.png')
    if (existsSync(unpacked)) return unpacked
  }
  return path.join(app.getAppPath(), 'resources', 'icon.png')
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
      preload: path.join(__dirname, '../preload/index.js'),
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
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
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
          click: () => {
            mainWindow?.show()
            mainWindow?.focus()
          }
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
    tray.on('double-click', () => {
      mainWindow?.show()
      mainWindow?.focus()
    })
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

export function toggleMaximize(): void {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
}

export function hideWindow(): void {
  mainWindow?.hide()
}

export function showWindow(): void {
  mainWindow?.show()
  mainWindow?.focus()
}
