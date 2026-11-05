import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  InstallProgress,
  LaunchState,
  MicrosoftAuthState,
  TaskRecord,
  UpdateState
} from '@shared/types'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  title: string
  message?: string
}

interface ModalState {
  createInstance: boolean
  createInstanceSeed?: { versionId?: string; loader?: string; projectId?: string; modpackVersionId?: string }
  addAccount: boolean
  addAccountTab: 'microsoft' | 'tlauncher' | 'offline' | 'authlib'
  modDetail: { id: string } | null
  loadout: { instanceId: string; loadoutId?: string } | null
  repair: { instanceId: string } | null
  console: { instanceId: string } | null
  command: boolean
}

export interface ConfirmRequest {
  title: string
  description?: string
  body?: string
  confirmLabel?: string
  danger?: boolean
  action: () => Promise<void> | void
}

interface UiStore {
  activeInstanceId: string | null
  setActiveInstance: (id: string | null) => void
  modal: ModalState
  openModal: <K extends keyof ModalState>(key: K, value: ModalState[K]) => void
  closeModal: (key: keyof ModalState) => void
  toasts: Toast[]
  pushToast: (kind: Toast['kind'], title: string, message?: string) => void
  dismissToast: (id: string) => void
  auth: MicrosoftAuthState
  setAuth: (auth: MicrosoftAuthState) => void
  update: UpdateState
  setUpdate: (state: UpdateState) => void
  progress: Record<string, InstallProgress>
  setProgress: (progress: InstallProgress) => void
  tasks: Record<string, TaskRecord>
  setTask: (task: TaskRecord) => void
  running: LaunchState[]
  setRunning: (state: LaunchState) => void
  logs: Record<string, string[]>
  appendLog: (instanceId: string, line: string) => void
  clearLogs: (instanceId: string) => void
  confirm: ConfirmRequest | null
  askConfirm: (request: ConfirmRequest) => void
  closeConfirm: () => void
}

let toastCounter = 0

export const useUi = create<UiStore>()(
  persist(
    (set, get) => ({
      activeInstanceId: null,
      setActiveInstance: (id) => set({ activeInstanceId: id }),
      modal: {
        createInstance: false,
        addAccount: false,
        addAccountTab: 'microsoft',
        modDetail: null,
        loadout: null,
        repair: null,
        console: null,
        command: false
      },
      openModal: (key, value) => set((state) => ({ modal: { ...state.modal, [key]: value } })),
      closeModal: (key) =>
        set((state) => ({
          modal: {
            ...state.modal,
            [key]: key === 'addAccountTab' ? 'microsoft' : key === 'createInstance' ? false : null
          }
        })),
      toasts: [],
      pushToast: (kind, title, message) => {
        const id = `toast_${Date.now()}_${toastCounter++}`
        set((state) => ({ toasts: [...state.toasts, { id, kind, title, message }].slice(-4) }))
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
        }, kind === 'error' ? 7000 : 4500)
      },
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
      auth: { status: 'idle' },
      setAuth: (auth) => set({ auth }),
      update: { status: 'idle' },
      setUpdate: (update) => set({ update }),
      progress: {},
      setProgress: (progress) =>
        set((state) => ({ progress: { ...state.progress, [progress.taskId]: progress } })),
      tasks: {},
      setTask: (task) => set((state) => ({ tasks: { ...state.tasks, [task.id]: task } })),
      running: [],
      setRunning: (payload) =>
        set((state) => {
          if (payload.status === 'stopped') {
            return { running: state.running.filter((entry) => entry.instanceId !== payload.instanceId) }
          }
          const rest = state.running.filter((entry) => entry.instanceId !== payload.instanceId)
          return { running: [...rest, payload] }
        }),
      logs: {},
      appendLog: (instanceId, line) =>
        set((state) => {
          const current = state.logs[instanceId] ?? []
          const next = [...current, line]
          if (next.length > 1600) next.splice(0, next.length - 1600)
          return { logs: { ...state.logs, [instanceId]: next } }
        }),
      clearLogs: (instanceId) => set((state) => ({ logs: { ...state.logs, [instanceId]: [] } })),
      confirm: null,
      askConfirm: (request) => set({ confirm: request }),
      closeConfirm: () => set({ confirm: null })
    }),
    {
      name: 'newbie-ui',
      partialize: (state) => ({ activeInstanceId: state.activeInstanceId })
    }
  )
)


export function toast(kind: Toast['kind'], title: string, message?: string): void {
  useUi.getState().pushToast(kind, title, message)
}
