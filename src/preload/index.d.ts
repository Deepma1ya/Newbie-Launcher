import type { NewbieApi } from '@shared/ipc'

declare global {
  interface Window {
    newbie: NewbieApi
  }
}

export {}
