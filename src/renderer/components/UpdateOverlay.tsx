import { ArrowClockwise, CheckCircle } from '@phosphor-icons/react'
import { useUi } from '../store/ui'
import { LogoMark } from './Sidebar'

export function UpdateOverlay() {
  const update = useUi((state) => state.update)
  if (update.status !== 'installing') return null

  const version = update.version ? ` ${update.version}` : ''

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070b08]/95 px-6 backdrop-blur-xl"
      role="status"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="w-full max-w-[430px] rounded-3xl border border-grass/20 bg-card/95 p-7 text-center shadow-lift">
        <LogoMark size={56} className="mx-auto" />
        <div className="mt-4 text-[9px] font-semibold uppercase tracking-[0.22em] text-grass/80">
          Launcher update
        </div>
        <h1 className="mt-2 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">
          Installing Newbie Launcher{version}
        </h1>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
          {update.message ?? 'Installing update… Newbie Launcher will reopen automatically.'}
        </p>

        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.075] ring-1 ring-inset ring-white/[0.04]"
          role="progressbar"
          aria-label="Installing launcher update"
          aria-valuetext="Installing"
        >
          <div className="h-full w-[8%] animate-update-fill rounded-full bg-gradient-to-r from-grass/60 via-grass to-grass shadow-[0_0_18px_rgba(110,231,160,0.55)]" />
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-muted/75">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle size={13} weight="fill" className="text-grass" />
            Downloaded
          </span>
          <span className="h-0.5 w-0.5 rounded-full bg-muted/40" />
          <span className="inline-flex items-center gap-1.5">
            <ArrowClockwise size={13} className="animate-spin text-gold" />
            Installing
          </span>
          <span className="h-0.5 w-0.5 rounded-full bg-muted/40" />
          <span>Restarting</span>
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-muted/55">
          The window closes briefly while the silent installer runs, then reopens automatically. No
          Next/Next.
        </p>
      </div>
    </div>
  )
}
