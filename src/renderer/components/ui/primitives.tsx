import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import { CaretDown, Check, Info } from '@phosphor-icons/react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line/60 bg-card/75 shadow-soft backdrop-blur-md',
        className
      )}
      {...props}
    />
  )
}

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-line/50 bg-surface/70', className)} {...props} />
}

type BadgeTone = 'neutral' | 'green' | 'gold' | 'red' | 'blue' | 'purple'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-white/[0.055] text-muted border-white/[0.05]',
  green: 'bg-grass/10 text-grass border-grass/20',
  gold: 'bg-gold/10 text-gold border-gold/20',
  red: 'bg-danger/10 text-danger border-danger/20',
  blue: 'bg-info/10 text-info border-info/20',
  purple: 'bg-[#C4B5FD]/10 text-[#C4B5FD] border-[#C4B5FD]/20'
}

export function Badge({
  tone = 'neutral',
  className,
  children
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]',
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-line/70 bg-canvas/55 px-3.5 text-[13.5px] text-ink outline-none transition',
        'placeholder:text-muted/60 focus:border-grass/50 focus:bg-canvas/80 focus:ring-2 focus:ring-grass/10',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-24 w-full resize-y rounded-xl border border-line/70 bg-canvas/55 px-3.5 py-3 text-[13.5px] text-ink outline-none transition',
          'placeholder:text-muted/60 focus:border-grass/50 focus:ring-2 focus:ring-grass/10',
          className
        )}
        {...props}
      />
    )
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <span className="relative block">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-xl border border-line/70 bg-canvas/55 px-3.5 pr-9 text-[13.5px] text-ink outline-none transition',
          'focus:border-grass/50 focus:ring-2 focus:ring-grass/10',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </span>
  )
})

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  hideLabel = false,
  size = 'md',
  className
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  hideLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  // Keep the visual state responsive while a settings IPC round-trip is in
  // flight, then re-sync when the persisted value arrives.
  const [optimistic, setOptimistic] = useState(checked)
  const descriptionId = useId()

  useEffect(() => {
    setOptimistic(checked)
  }, [checked])

  const toggle = (next: boolean): void => {
    if (disabled) return
    setOptimistic(next)
    onChange(next)
  }

  // The knob is centred inside the track, not inside the border box. For a
  // 24px track and 16px knob that is 4px on every side; for the compact
  // 20px track and 14px knob it is 3px. Horizontal travel is the remaining
  // space, which keeps the on-state margin identical to the off-state margin.
  const geometry =
    size === 'sm'
      ? { track: 'h-5 w-9', knob: 'left-[3px] top-[3px] h-3.5 w-3.5', on: 'translate-x-4' }
      : { track: 'h-6 w-11', knob: 'left-1 top-1 h-4 w-4', on: 'translate-x-5' }

  return (
    <label
      className={cn(
        hideLabel ? 'inline-flex items-center' : 'flex select-none items-start justify-between gap-5',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className
      )}
    >
      {!hideLabel && (
        <span className="min-w-0">
          <span className="block text-[13.5px] font-medium text-ink">{label}</span>
          {description && (
            <span id={descriptionId} className="mt-0.5 block text-[12px] leading-relaxed text-muted">
              {description}
            </span>
          )}
        </span>
      )}
      <span
        className={cn(
          'relative inline-flex shrink-0 items-center',
          geometry.track,
          !hideLabel && 'mt-0.5'
        )}
      >
        <input
          type="checkbox"
          role="switch"
          aria-label={label}
          aria-checked={optimistic}
          aria-describedby={description ? descriptionId : undefined}
          checked={optimistic}
          disabled={disabled}
          onChange={(event) => toggle(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 rounded-full border transition-colors duration-200',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-grass/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas',
            optimistic ? 'border-grass/40 bg-grass/80' : 'border-line bg-elevated'
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute rounded-full shadow transition-transform duration-200',
            geometry.knob,
            optimistic ? `${geometry.on} bg-[#08110A]` : 'translate-x-0 bg-muted'
          )}
        />
      </span>
    </label>
  )
}

export function Progress({
  value,
  className,
  tone = 'green'
}: {
  value: number
  className?: string
  tone?: 'green' | 'gold' | 'blue'
}) {
  const colors = {
    green: 'bg-grass',
    gold: 'bg-gold',
    blue: 'bg-info'
  }
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300 ease-out', colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} aria-hidden="true" />
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line/70 bg-card/30 px-8 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line/60 bg-elevated/60 text-muted">
        {icon}
      </div>
      <h3 className="font-display text-[17px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md'
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-line/60 bg-canvas/50 p-1',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200',
              size === 'sm' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3 text-[12px]',
              active
                ? 'bg-elevated text-ink shadow-sm'
                : 'text-muted hover:bg-white/[0.035] hover:text-ink'
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-ink opacity-0 shadow-lift transition-opacity duration-150 group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  className
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted">{label}</span>
        {hint && <span className="text-[11px] text-muted/70">{hint}</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-danger">
          <Info size={13} aria-hidden="true" />
          {error}
        </span>
      )}
    </label>
  )
}

export function CheckRow({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border',
          checked ? 'border-grass/40 bg-grass/15 text-grass' : 'border-line text-transparent'
        )}
      >
        <Check size={10} weight="bold" aria-hidden="true" />
      </span>
      {label}
    </span>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line/45', className)} />
}
