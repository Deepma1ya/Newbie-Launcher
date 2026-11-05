import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes
} from 'react'
import { createPortal } from 'react-dom'
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

interface SelectOption {
  value: string
  label: string
  disabled: boolean
}

type SelectProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value' | 'children' | 'onClick' | 'onKeyDown'
> & {
  value?: string
  onChange?: (value: string) => void
  children?: ReactNode
  'data-autofocus'?: boolean
}

function optionText(node: ReactNode): string {
  return Children.toArray(node)
    .map((part) => (typeof part === 'string' || typeof part === 'number' ? String(part) : ''))
    .join('')
}

function readSelectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== 'option') return
    const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode }
    const label = optionText(props.children).trim()
    options.push({
      value: String(props.value ?? label),
      label: label || String(props.value ?? ''),
      disabled: Boolean(props.disabled)
    })
  })
  return options
}

export function Select({ className, children, value, onChange, disabled, ...props }: SelectProps) {
  const options = useMemo(() => readSelectOptions(children), [children])
  const selectedIndex = options.findIndex((option) => option.value === value)
  const firstEnabled = options.findIndex((option) => !option.disabled)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : Math.max(0, firstEnabled))
  const [position, setPosition] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

  useEffect(() => {
    if (open) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, firstEnabled))
  }, [firstEnabled, open, selectedIndex])

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    if (!trigger) return

    const update = (): void => {
      const rect = trigger.getBoundingClientRect()
      const width = Math.max(rect.width, 190)
      const estimatedHeight = Math.min(300, options.length * 36 + 8)
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      const openAbove = spaceBelow < Math.min(estimatedHeight, 220) && spaceAbove > spaceBelow
      const maxHeight = Math.max(96, Math.min(300, openAbove ? spaceAbove - 6 : spaceBelow - 6))
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
      const top = openAbove
        ? Math.max(8, rect.top - Math.min(estimatedHeight, maxHeight) - 6)
        : rect.bottom + 6
      setPosition({ top, left, width, maxHeight })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const active = panelRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const openMenu = (): void => {
    if (disabled) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, firstEnabled))
    setOpen(true)
  }

  const choose = (index: number): void => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange?.(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const moveActive = (direction: 1 | -1): void => {
    if (options.length === 0) return
    let index = activeIndex
    for (let step = 0; step < options.length; step += 1) {
      index = (index + direction + options.length) % options.length
      if (!options[index]?.disabled) {
        setActiveIndex(index)
        return
      }
    }
  }

  const lastEnabledIndex = (): number => {
    for (let index = options.length - 1; index >= 0; index -= 1) {
      if (!options[index]?.disabled) return index
    }
    return -1
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openMenu()
      else moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) openMenu()
      else choose(activeIndex)
      return
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
      }
      return
    }
    if (event.key === 'Home' && open) {
      event.preventDefault()
      setActiveIndex(Math.max(0, firstEnabled))
      return
    }
    if (event.key === 'End' && open) {
      event.preventDefault()
      setActiveIndex(lastEnabledIndex())
      return
    }
    if (event.key === 'Tab') setOpen(false)
  }

  return (
    <span className={cn('relative block', className)}>
      <button
        {...props}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line/70 bg-canvas/55 px-3.5 text-left text-[13.5px] text-ink outline-none transition',
          'hover:border-line focus:border-grass/50 focus:ring-2 focus:ring-grass/10',
          open && 'border-grass/45 ring-2 ring-grass/10',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-muted/70')}>
          {selectedOption?.label ?? value ?? 'Select…'}
        </span>
        <CaretDown
          size={14}
          className={cn('shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            className="fixed z-[240] overflow-y-auto overscroll-contain rounded-xl border border-line/80 bg-elevated p-1 shadow-lift backdrop-blur-xl"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight
            }}
          >
            {options.length === 0 ? (
              <div className="px-2.5 py-2 text-[11.5px] text-muted">No options</div>
            ) : (
              options.map((option, index) => {
                const isSelected = index === selectedIndex
                const isActive = index === activeIndex
                return (
                  <button
                    key={`${option.value}-${index}`}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    data-index={index}
                    disabled={option.disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors',
                      isSelected
                        ? 'bg-grass/10 text-ink'
                        : isActive
                          ? 'bg-white/[0.055] text-ink'
                          : 'text-muted hover:bg-white/[0.045] hover:text-ink',
                      option.disabled && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check size={13} weight="bold" className="shrink-0 text-grass" />}
                  </button>
                )
              })
            )}
          </div>,
          document.body
        )}
    </span>
  )
}

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
