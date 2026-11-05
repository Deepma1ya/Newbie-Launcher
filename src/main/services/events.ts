import type { BrowserWindow } from 'electron'
import type { AppEvent, WindowState } from '@shared/types'
import { logger } from '../util/log'

let target: BrowserWindow | null = null

export function bindEventWindow(window: BrowserWindow): void {
  target = window
}

export function emit(event: AppEvent): void {
  if (!target || target.isDestroyed()) return
  try {
    target.webContents.send('app:event', event)
  } catch (error) {
    logger.warn('events', 'Failed to deliver event to renderer', error)
  }
}

export function emitWindowState(state: WindowState): void {
  if (!target || target.isDestroyed()) return
  target.webContents.send('app:window-state', state)
}
