import { NavLink } from 'react-router-dom'
import {
  Books,
  Compass,
  Cube,
  DownloadSimple,
  GearSix,
  HardDrives,
  House,
  MapTrifold,
  SquaresFour,
  UserCircle
} from '@phosphor-icons/react'
import { APP_VERSION } from '@shared/constants'
import { useAccounts } from '../hooks/queries'
import { useUi } from '../store/ui'
import { cn } from '../lib/utils'
import appIcon from '../assets/app-icon.png'
import { SkinFace } from './ui/BlockIcon'
import { Tooltip } from './ui/primitives'

const homeNav = { to: '/', label: 'Home', icon: House, end: true }

interface NavItem {
  to: string
  label: string
  icon: typeof House
  end?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'Minecraft Java',
    items: [
      { to: '/instances', label: 'Instances', icon: SquaresFour },
      { to: '/browse', label: 'Browse', icon: Compass },
      { to: '/maps', label: 'Maps', icon: MapTrifold },
      { to: '/library', label: 'Library', icon: Books }
    ]
  },
  {
    label: 'Minecraft Bedrock',
    items: [
      { to: '/bedrock', label: 'Bedrock', icon: Cube, end: true },
      { to: '/bedrock/instances', label: 'Instances', icon: SquaresFour },
      { to: '/bedrock/browse', label: 'Browse', icon: Compass },
      { to: '/bedrock/library', label: 'Library', icon: Books }
    ]
  },
  {
    label: 'Minecraft Servers',
    items: [{ to: '/servers', label: 'Servers', icon: HardDrives }]
  },
  {
    label: 'Launcher',
    items: [
      { to: '/downloads', label: 'Downloads', icon: DownloadSimple },
      { to: '/accounts', label: 'Accounts', icon: UserCircle }
    ]
  }
]

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200 [@media(max-height:760px)]:h-9',
          isActive
            ? 'bg-elevated text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
            : 'text-muted hover:bg-white/[0.035] hover:text-ink'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={19} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
          <span>{item.label}</span>
          {isActive && <span className="absolute left-0 h-4 w-[2px] rounded-full bg-grass" />}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const accounts = useAccounts().data ?? []
  const active = accounts.find((account) => account.active) ?? accounts[0]
  const update = useUi((state) => state.update)
  const updateReady =
    update.status === 'available' ||
    update.status === 'downloading' ||
    update.status === 'downloaded' ||
    update.status === 'installing'

  return (
    <aside className="relative z-30 flex w-[218px] shrink-0 flex-col border-r border-line/40 bg-surface/45 px-3 pb-3 pt-5">
      <div className="mb-6 flex items-center gap-3 px-2.5">
        <LogoMark />
        <div className="leading-none">
          <div className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink">Newbie</div>
          <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-muted/70">Launcher</div>
        </div>
      </div>

      <nav
        aria-label="Main navigation"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5"
      >
        <div className="space-y-1">
          <SidebarLink item={homeNav} />
        </div>
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="mb-1 px-3 text-[8.5px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              {section.label}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-3 shrink-0 space-y-2 border-t border-line/25 pt-3">
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
              update.status === 'installing'
                ? 'Installing update'
                : update.status === 'downloaded'
                  ? 'Update ready — installing automatically'
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
                    update.status === 'downloaded' || update.status === 'installing'
                      ? 'bg-grass'
                      : 'bg-gold'
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

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src={appIcon}
      width={size}
      height={size}
      alt=""
      draggable={false}
      aria-hidden="true"
      className={cn('shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(110,231,160,0.25)]', className)}
      style={{ width: size, height: size }}
    />
  )
}
