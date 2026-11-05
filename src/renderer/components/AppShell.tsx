import type { ReactNode } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { Background } from './Background'
import { ConsoleDrawer } from './ConsoleDrawer'
import { Toasts } from './Toasts'
import { ConfirmDialog } from './ConfirmDialog'
import { UpdateBanner } from './UpdateBanner'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-bg flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1">
          <Background />
          <div className="relative h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-[1180px] px-8 pb-28 pt-7">
              <UpdateBanner />
              {children}
            </div>
          </div>
        </main>
      </div>
      <ConsoleDrawer />
      <ConfirmDialog />
      <Toasts />
    </div>
  )
}
