import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import { useUi } from '../store/ui'
import { cn } from '../lib/utils'

export function Toasts() {
  const toasts = useUi((state) => state.toasts)
  const dismiss = useUi((state) => state.dismissToast)

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[360px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = toast.kind === 'success' ? CheckCircle : toast.kind === 'error' ? WarningCircle : Info
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line/70 bg-elevated/95 p-3.5 shadow-lift backdrop-blur-xl"
            >
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  toast.kind === 'success' && 'bg-grass/12 text-grass',
                  toast.kind === 'error' && 'bg-danger/12 text-danger',
                  toast.kind === 'info' && 'bg-info/12 text-info'
                )}
              >
                <Icon size={16} weight="fill" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-ink">{toast.title}</div>
                {toast.message && <div className="mt-0.5 line-clamp-3 text-[11.5px] leading-relaxed text-muted">{toast.message}</div>}
              </div>
              <button
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-1 text-muted/60 transition-colors hover:bg-white/[0.06] hover:text-ink"
              >
                <X size={12} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
