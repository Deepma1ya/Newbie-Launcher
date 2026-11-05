import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { SpinnerGap } from '@phosphor-icons/react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-grass text-[#07140C] hover:bg-[#86F0B2] active:bg-[#5FD68E] shadow-[0_10px_30px_-14px_rgba(110,231,160,0.65)]',
  secondary:
    'bg-elevated text-ink border border-line/70 hover:bg-[#232F24] hover:border-line active:bg-[#1D281E]',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-white/[0.045]',
  danger: 'bg-danger/12 text-danger border border-danger/25 hover:bg-danger/20',
  subtle: 'bg-white/[0.035] text-ink border border-white/[0.04] hover:bg-white/[0.06]'
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[13.5px] gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[14.5px] gap-2.5 rounded-xl'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth,
    className,
    children,
    disabled,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium outline-none transition-[background-color,color,border-color,transform,box-shadow] duration-200',
        'disabled:pointer-events-none disabled:opacity-45',
        'active:translate-y-[0.5px]',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? <SpinnerGap size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
      {iconRight}
    </button>
  )
})

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors duration-200',
        'hover:bg-white/[0.055] hover:text-ink active:bg-white/[0.08] disabled:opacity-40',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function LinkButton({
  href,
  children,
  className
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <button
      className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-grass hover:underline', className)}
      onClick={() => window.newbie.app.openExternal(href)}
    >
      {children}
    </button>
  )
}
