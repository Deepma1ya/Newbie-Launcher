import { app, dialog } from 'electron'
import { initPaths } from './services/paths'
import { store } from './services/store'
import { registerIpc } from './ipc'
import { bindEventWindow } from './services/events'
import { createMainWindow, getMainWindow, initTray, markQuitting, showWindow } from './window'
import { initUpdater } from './services/updater'
import { stopAllServers, runningServerIds } from './services/serverProcess'
import { initServerScheduler, stopServerScheduler } from './services/serverScheduler'
import { stopPackShare } from './services/packTransfer'
import { logger } from './util/log'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let shuttingDown = false
  let shutdownComplete = false

  app.on('second-instance', () => {
    const window = getMainWindow()
    if (window) {
      if (window.isMinimized()) window.restore()
      showWindow()
    }
  })

  app.whenReady().then(async () => {
    try {
      app.setAppUserModelId('com.newbielauncher.app')
      await initPaths()
      await store.init()
      registerIpc()
      const window = createMainWindow()
      bindEventWindow(window)
      initTray()
      initUpdater()
      initServerScheduler()
      logger.info('app', `Newbie Launcher ${app.getVersion()} ready`)
    } catch (error) {
      logger.error('app', 'Fatal start-up error', error)
      await dialog.showMessageBox({
        type: 'error',
        title: 'Newbie Launcher could not start',
        message: 'The launcher could not initialise its data folder.',
        detail: error instanceof Error ? error.message : String(error)
      })
      app.quit()
    }
  })

  app.on('activate', () => {
    if (getMainWindow() === null) {
      const window = createMainWindow()
      bindEventWindow(window)
    } else {
      showWindow()
    }
  })

  app.on('before-quit', (event) => {
    markQuitting()
    stopServerScheduler()
    void stopPackShare()
    if (shutdownComplete) return
    event.preventDefault()
    if (shuttingDown) return
    shuttingDown = true
    const finish = (): void => {
      void store.flush().finally(() => {
        shutdownComplete = true
        app.quit()
      })
    }
    if (runningServerIds().length === 0) {
      finish()
      return
    }
    void stopAllServers().finally(finish)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  process.on('uncaughtException', (error) => {
    logger.error('app', 'Uncaught exception', error)
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('app', 'Unhandled rejection', reason)
  })
}
