import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast, useUi } from '../store/ui'
import { qk } from './queries'

export function useAppEvents(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = window.newbie.app.onEvent((event) => {
      const ui = useUi.getState()
      switch (event.type) {
        case 'task':
          ui.setTask(event.payload)
          if (event.payload.status === 'done' || event.payload.status === 'error') {
            void queryClient.invalidateQueries({ queryKey: qk.disk })
            void queryClient.invalidateQueries({ queryKey: qk.instances })
          }
          if (event.payload.status === 'error') {
            toast('error', `${event.payload.title} failed`, event.payload.error)
          }
          break
        case 'install-progress':
          ui.setProgress(event.payload)
          break
        case 'launch-log':
          ui.appendLog(event.payload.instanceId, event.payload.line)
          break
        case 'launch-state':
          ui.setRunning(event.payload)
          break
        case 'launch-exit':
          void queryClient.invalidateQueries({ queryKey: qk.instances })
          if (event.payload.crashed) {
            ui.openModal('console', { instanceId: event.payload.instanceId })
          }
          break
        case 'microsoft-auth':
          ui.setAuth(event.payload)
          if (event.payload.status === 'success') {
            void queryClient.invalidateQueries({ queryKey: qk.accounts })
            toast('success', 'Signed in to Microsoft', event.payload.account?.username)
            ui.closeModal('addAccount')
          }
          if (event.payload.status === 'error') {
            toast('error', 'Microsoft sign-in failed', event.payload.message)
          }
          break
        case 'update': {
          const previous = useUi.getState().update.status
          ui.setUpdate(event.payload)
          if (event.payload.status === 'available' && previous !== 'available' && previous !== 'downloading') {
            toast('info', 'Update available', event.payload.message)
          }
          break
        }
        case 'toast':
          toast(event.payload.kind, event.payload.title, event.payload.message)
          break
        case 'server-schedule':
          void queryClient.invalidateQueries({ queryKey: qk.server(event.payload.serverId) })
          void queryClient.invalidateQueries({ queryKey: qk.servers })
          void queryClient.invalidateQueries({ queryKey: qk.serverStatus(event.payload.serverId) })
          break
        default:
          break
      }
    })
    return unsubscribe
  }, [queryClient])
}
