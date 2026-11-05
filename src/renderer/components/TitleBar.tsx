import { useEffect, useState } from 'react'
import { Minus, Square, X, Copy } from '@phosphor-icons/react'
import type { WindowState } from '@shared/types'
import { IconButton } from './ui/Button'

export function TitleBar() {
  const [state, setState] = useState<WindowState>({ maximized: false, focused: true })

  useEffect(() => {
    void window.newbie.app
      .info()
      .then(() => undefined)
      .catch(() => undefined)
    return window.newbie.app.onWindowState(setState)
  }, [])

  return (
    <header className="drag-region relative z-50 flex h-10 shrink-0 items-center justify-between border-b border-line/35 bg-canvas/55 pl-4">
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-grass/80 shadow-[0_0_10px_rgba(110,231,160,0.7)]" />
        <span className="font-display text-[11px] font-semibold tracking-[0.14em] text-muted">NEWBIE LAUNCHER</span>
        <span className="rounded border border-line/60 px-1.5 py-0.5 font-mono text-[9px] text-muted/70">JAVA + BEDROCK</span>
      </div>
      <div className="no-drag flex h-full items-center">
        <button
          aria-label="Minimize"
          onClick={() => void window.newbie.app.minimize()}
          className="flex h-10 w-11 items-center justify-center text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <Minus size={14} />
        </button>
        <button
          aria-label={state.maximized ? 'Restore' : 'Maximize'}
          onClick={() => void window.newbie.app.maximize()}
          className="flex h-10 w-11 items-center justify-center text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          {state.maximized ? <Copy size={13} /> : <Square size={12} />}
        </button>
        <button
          aria-label="Close"
          onClick={() => void window.newbie.app.close()}
          className="flex h-10 w-12 items-center justify-center text-muted transition-colors hover:bg-danger/80 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>
    </header>
  )
}
