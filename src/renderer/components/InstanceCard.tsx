import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowSquareOut,
  DotsThree,
  FolderOpen,
  PencilSimple,
  TerminalWindow,
  Trash,
  Wrench
} from '@phosphor-icons/react'
import type { Instance } from '@shared/types'
import { useUi } from '../store/ui'
import { loaderLabel, relativeTime, formatPlaytime } from '../lib/utils'
import { BlockIcon } from './ui/BlockIcon'
import { Badge } from './ui/primitives'
import { PlayButton } from './PlayButton'
import { cn } from '../lib/utils'

export function InstanceCard({ instance, compact = false }: { instance: Instance; compact?: boolean }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const openModal = useUi((state) => state.openModal)
  const askConfirm = useUi((state) => state.askConfirm)
  const setActiveInstance = useUi((state) => state.setActiveInstance)
  const running = useUi((state) => state.running.some((entry) => entry.instanceId === instance.id))

  useEffect(() => {
    if (!menuOpen) return
    const handler = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const remove = (): void => {
    askConfirm({
      title: `Delete ${instance.name}?`,
      description: 'The instance, its worlds and its add-ons will be removed from this computer.',
      confirmLabel: 'Delete instance',
      danger: true,
      action: async () => {
        await window.newbie.instances.remove(instance.id, true)
        window.location.hash = '#/instances'
      }
    })
  }

  return (
    <article
      className={cn(
        'card-hover group relative cursor-pointer rounded-2xl border border-line/60 bg-card/70',
        compact ? 'min-h-[148px]' : 'min-h-[178px]'
      )}
      onClick={() => {
        setActiveInstance(instance.id)
        navigate(`/instances/${instance.id}`)
      }}
      aria-label={`Open ${instance.name}`}
    >
      <div
        className="relative h-[76px] overflow-hidden border-b border-line/40"
        style={{
          background: `radial-gradient(160% 120% at 10% -10%, ${instance.color}38 0%, transparent 58%), linear-gradient(120deg, #111A13, #0B100C)`
        }}
      >
        <div className="block-art absolute inset-0 opacity-25" />
        <div
          className="absolute -right-4 -top-8 h-28 w-28 rotate-12 rounded-2xl opacity-25"
          style={{ backgroundColor: instance.color }}
        />
        <div className="absolute right-4 top-3 flex items-center gap-1.5">
          {running && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-grass/25 bg-grass/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-grass">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" />
              Live
            </span>
          )}
          <Badge tone="neutral" className="h-5 bg-black/25 text-[9px]">
            {loaderLabel(instance.loader)}
          </Badge>
        </div>
        <div className="absolute bottom-3 left-4">
          <BlockIcon name={instance.name} color={instance.color} iconUrl={instance.iconUrl} size={42} />
        </div>
        <div className="absolute bottom-3 right-4 rounded-md border border-white/[0.06] bg-black/30 px-2 py-1 font-mono text-[10px] text-white/65">
          {instance.versionId}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 px-4 pb-3.5 pt-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[14.5px] font-semibold text-ink">{instance.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted">
            <span>{instance.addons.length} add-ons</span>
            <span className="h-0.5 w-0.5 rounded-full bg-muted/60" />
            <span>{instance.loadouts.length} loadout{instance.loadouts.length === 1 ? '' : 's'}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-muted/60" />
            <span>{instance.lastPlayedAt ? relativeTime(instance.lastPlayedAt) : 'New instance'}</span>
          </div>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            aria-label={`More options for ${instance.name}`}
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen((open) => !open)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <DotsThree size={18} weight="bold" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-xl border border-line bg-elevated p-1 shadow-lift">
              <MenuItem
                icon={<TerminalWindow size={15} />}
                label="Open console"
                onClick={() => {
                  setMenuOpen(false)
                  openModal('console', { instanceId: instance.id })
                }}
              />
              <MenuItem
                icon={<Wrench size={15} />}
                label="Repair"
                onClick={() => {
                  setMenuOpen(false)
                  openModal('repair', { instanceId: instance.id })
                }}
              />
              <MenuItem
                icon={<FolderOpen size={15} />}
                label="Open folder"
                onClick={() => {
                  setMenuOpen(false)
                  void window.newbie.instances.openFolder(instance.id)
                }}
              />
              <MenuItem
                icon={<PencilSimple size={15} />}
                label="Edit instance"
                onClick={() => {
                  setMenuOpen(false)
                  navigate(`/instances/${instance.id}`)
                }}
              />
              <MenuItem
                icon={<ArrowSquareOut size={15} />}
                label="View add-ons"
                onClick={() => {
                  setMenuOpen(false)
                  navigate(`/library?instance=${instance.id}`)
                }}
              />
              <div className="my-1 h-px bg-line/50" />
              <MenuItem icon={<Trash size={15} />} label="Delete" danger onClick={remove} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line/35 px-4 py-2.5">
        <span className="text-[10.5px] text-muted/80">{formatPlaytime(instance.totalPlayTimeSec)}</span>
        <PlayButton instance={instance} size="sm" className="min-w-[92px]" />
      </div>
    </article>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors',
        danger ? 'text-danger hover:bg-danger/10' : 'text-muted hover:bg-white/[0.055] hover:text-ink'
      )}
    >
      {icon}
      {label}
    </button>
  )
}
