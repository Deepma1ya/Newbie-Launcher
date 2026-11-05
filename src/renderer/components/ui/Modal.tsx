import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { cn } from '../../lib/utils'
import { IconButton } from './Button'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  zIndex = 100
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnBackdrop?: boolean
  zIndex?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handler)
    const timer = setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), button[data-autofocus], select:not([disabled])'
      )
      target?.focus()
    }, 80)
    return () => {
      document.removeEventListener('keydown', handler)
      clearTimeout(timer)
    }
  }, [open, onClose])

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-5"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div
            className="absolute inset-0 bg-[#040705]/80 backdrop-blur-[6px]"
            onMouseDown={() => closeOnBackdrop && onClose()}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.965, y: 14 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.975, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
            className={cn(
              'relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-3xl border border-line/70 bg-surface shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]',
              widths[size]
            )}
          >
            <div className="flex items-start justify-between gap-6 border-b border-line/45 px-6 py-5">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-[18px] font-semibold text-ink">
                  {title}
                </h2>
                {description && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{description}</p>}
              </div>
              <IconButton label="Close dialog" onClick={onClose} className="-mr-1 -mt-1">
                <X size={17} />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-line/45 bg-canvas/25 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
