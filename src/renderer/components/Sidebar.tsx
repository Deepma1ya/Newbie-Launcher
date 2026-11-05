import { NavLink } from 'react-router-dom'
import {
  Books,
  Compass,
  Cube,
  DownloadSimple,
  GearSix,
  House,
  SquaresFour,
  UserCircle
} from '@phosphor-icons/react'
import { APP_VERSION } from '@shared/constants'
import { useAccounts } from '../hooks/queries'
import { useUi } from '../store/ui'
import { cn } from '../lib/utils'
import { SkinFace } from './ui/BlockIcon'
import { Tooltip } from './ui/primitives'

const nav = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/instances', label: 'Instances', icon: SquaresFour },
  { to: '/bedrock', label: 'Bedrock', icon: Cube },
  { to: '/browse', label: 'Browse', icon: Compass },
  { to: '/library', label: 'Library', icon: Books },
  { to: '/downloads', label: 'Downloads', icon: DownloadSimple },
  { to: '/accounts', label: 'Accounts', icon: UserCircle }
]

export function Sidebar() {
  const accounts = useAccounts().data ?? []
  const active = accounts.find((account) => account.active) ?? accounts[0]
  const update = useUi((state) => state.update)
  const updateReady = update.status === 'available' || update.status === 'downloading' || update.status === 'downloaded'

  return (
    <aside className="relative z-30 flex w-[218px] shrink-0 flex-col border-r border-line/40 bg-surface/45 px-3 pb-3 pt-5">
      <div className="mb-6 flex items-center gap-3 px-2.5">
        <LogoMark />
        <div className="leading-none">
          <div className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink">Newbie</div>
          <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-muted/70">Launcher</div>
        </div>
      </div>

      <nav aria-label="Main navigation" className="space-y-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-elevated text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : 'text-muted hover:bg-white/[0.035] hover:text-ink'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={19} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
                <span>{item.label}</span>
                {isActive && <span className="absolute left-0 h-4 w-[2px] rounded-full bg-grass" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 pt-5">
        {active ? (
          <NavLink
            to="/accounts"
            className="flex items-center gap-2.5 rounded-xl border border-line/50 bg-card/60 p-2.5 transition-colors hover:border-line hover:bg-card"
          >
            <SkinFace skinUrl={active.skinUrl} name={active.username} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-ink">{active.username}</span>
              <span className="block text-[10px] uppercase tracking-[0.09em] text-muted/80">
                {active.type === 'microsoft'
                  ? 'Microsoft'
                  : active.type === 'tlauncher'
                    ? 'TLauncher'
                    : active.type === 'authlib'
                      ? 'Authlib'
                      : 'Offline'}
              </span>
            </span>
            <span className="h-2 w-2 rounded-full bg-grass" />
          </NavLink>
        ) : (
          <NavLink
            to="/accounts"
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-line/70 bg-card/35 p-2.5 text-[12px] text-muted transition-colors hover:text-ink"
          >
            <UserCircle size={28} aria-hidden="true" />
            Add an account
          </NavLink>
        )}

        <div className="flex items-center gap-1">
          <Tooltip label="Settings">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex h-9 flex-1 items-center gap-2.5 rounded-xl px-3 text-[12.5px] transition-colors',
                  isActive ? 'bg-elevated text-ink' : 'text-muted hover:bg-white/[0.035] hover:text-ink'
                )
              }
            >
              <GearSix size={17} aria-hidden="true" />
              Settings
            </NavLink>
          </Tooltip>
          <Tooltip
            label={
              update.status === 'downloaded'
                ? 'Update ready to install'
                : updateReady
                  ? 'Update available'
                  : 'Launcher version'
            }
          >
            <NavLink
              to="/settings?section=about"
              className="relative rounded-md px-2 py-1 font-mono text-[9px] text-muted/40 transition-colors hover:bg-white/[0.035] hover:text-muted"
            >
              v{update.currentVersion ?? APP_VERSION}
              {updateReady && (
                <span
                  className={cn(
                    'absolute right-0 top-0 h-1.5 w-1.5 rounded-full',
                    update.status === 'downloaded' ? 'bg-grass' : 'bg-gold'
                  )}
                />
              )}
            </NavLink>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="drop-shadow-[0_6px_14px_rgba(110,231,160,0.25)]"
    >
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#101A12" stroke="#2C3A2E" />
      <path d="M20 7L32 13.4V26.2L20 32.6L8 26.2V13.4L20 7Z" fill="#243B29" />
      <path d="M20 7L32 13.4L20 19.8L8 13.4L20 7Z" fill="#6EE7A0" />
      <path d="M8 13.4L20 19.8V32.6L8 26.2V13.4Z" fill="#3E8E5C" />
      <path d="M32 13.4L20 19.8V32.6L32 26.2V13.4Z" fill="#2C6B43" />
      <path d="M14 22.5L17 24L20 22.5" stroke="#A7F3D0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15.5" cy="17" r="1" fill="#07140C" />
      <circle cx="24.5" cy="17" r="1" fill="#07140C" />
    </svg>
  )
}
