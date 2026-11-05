import { useState } from 'react'
import { ArrowSquareOut, ArrowsClockwise, DotsThree, Power, Trash } from '@phosphor-icons/react'
import type { AddonRecord, Instance } from '@shared/types'
import { toast, useUi } from '../store/ui'
import { addonTypeLabel, cn, errorMessage, formatBytes, relativeTime } from '../lib/utils'
import { ProjectIcon } from './ui/BlockIcon'
import { Badge } from './ui/primitives'

export function AddonRow({
  record,
  instance,
  onChanged
}: {
  record: AddonRecord
  instance: Instance
  onChanged: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const askConfirm = useUi((state) => state.askConfirm)
  const updateAvailable = Boolean(record.latestVersionId && record.latestVersionId !== record.versionId)

  const toggle = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.addons.toggle(instance.id, record.id, !record.enabled)
      onChanged()
    } catch (error) {
      toast('error', 'Could not toggle add-on', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = (): void => {
    askConfirm({
      title: `Remove ${record.name}?`,
      description: 'The file will be removed from this instance. Offline backups in the cache are kept.',
      confirmLabel: 'Remove add-on',
      danger: true,
      action: async () => {
        await window.newbie.addons.remove(instance.id, record.id, true)
        onChanged()
      }
    })
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-line/45 bg-canvas/30 px-3 py-2.5 transition-colors hover:border-line/70 hover:bg-canvas/50',
        !record.enabled && 'opacity-55'
      )}
    >
      <ProjectIcon url={record.iconUrl} name={record.name} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[12.5px] font-medium text-ink">{record.name}</span>
          <Badge tone="neutral" className="h-4 px-1.5 text-[8.5px]">
            {addonTypeLabel(record.type)}
          </Badge>
          {updateAvailable && <Badge tone="green" className="h-4 px-1.5 text-[8.5px]">Update</Badge>}
          {!record.enabled && <Badge tone="gold" className="h-4 px-1.5 text-[8.5px]">Disabled</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted/75">
          <span className="font-mono">{record.versionNumber}</span>
          <span className="h-0.5 w-0.5 rounded-full bg-muted/50" />
          <span>{formatBytes(record.size)}</span>
          <span className="h-0.5 w-0.5 rounded-full bg-muted/50" />
          <span>{relativeTime(record.updatedAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {updateAvailable && (
          <button
            aria-label={`Update ${record.name}`}
            onClick={() => {
              void window.newbie.addons
                .install(instance.id, {
                  projectId: record.projectId,
                  versionId: record.latestVersionId ?? ''
                })
                .then(onChanged)
                .catch((error) => toast('error', 'Update failed', errorMessage(error)))
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-grass/80 transition-colors hover:bg-grass/10 hover:text-grass"
          >
            <ArrowsClockwise size={15} />
          </button>
        )}
        <button
          role="switch"
          aria-checked={record.enabled}
          aria-label={`${record.enabled ? 'Disable' : 'Enable'} ${record.name}`}
          disabled={busy}
          onClick={() => void toggle()}
          className={cn(
            'relative h-5 w-9 rounded-full border transition-colors',
            record.enabled ? 'border-grass/35 bg-grass/75' : 'border-line bg-elevated'
          )}
        >
          <span
            className={cn(
              'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-transform',
              record.enabled ? 'translate-x-[18px] bg-[#07140C]' : 'translate-x-[3px] bg-muted'
            )}
          />
        </button>
        <div className="relative">
          <button
            aria-label={`More options for ${record.name}`}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <DotsThree size={17} weight="bold" />
          </button>
          {menuOpen && (
            <>
              <button
                className="fixed inset-0 z-30 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-9 z-40 w-40 overflow-hidden rounded-xl border border-line bg-elevated p-1 shadow-lift">
                {record.sourceUrl && (
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-muted hover:bg-white/[0.05] hover:text-ink"
                    onClick={() => {
                      setMenuOpen(false)
                      void window.newbie.app.openExternal(record.sourceUrl!)
                    }}
                  >
                    <ArrowSquareOut size={14} /> Open project
                  </button>
                )}
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-muted hover:bg-white/[0.05] hover:text-ink"
                  onClick={() => {
                    setMenuOpen(false)
                    void toggle()
                  }}
                >
                  <Power size={14} /> {record.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-danger hover:bg-danger/10"
                  onClick={() => {
                    setMenuOpen(false)
                    remove()
                  }}
                >
                  <Trash size={14} /> Remove
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
