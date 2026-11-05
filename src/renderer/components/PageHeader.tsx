import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-7 flex flex-wrap items-end justify-between gap-5', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-grass/75">{eyebrow}</div>
        )}
        <h1 className="font-display text-[27px] font-semibold leading-tight tracking-[-0.025em] text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionTitle({
  title,
  action,
  description
}: {
  title: string
  action?: ReactNode
  description?: string
}) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
