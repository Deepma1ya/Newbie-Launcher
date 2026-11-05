import { CheckCircle, CloudArrowDown, DotsThree, HardDrives, PencilSimple, Play, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Instance, Loadout } from '@shared/types'
import { useUi, toast } from '../store/ui'
import { cn, errorMessage, formatBytes, relativeTime } from '../lib/utils'
import { Badge } from './ui/primitives'
import { Button } from './ui/Button'

export function LoadoutCard({
  loadout,
  instance,
  onChanged
}: {
  loadout: Loadout
  instance: Instance
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const openModal = useUi((state) => state.openModal)
  const askConfirm = useUi((state) => state.askConfirm)
  const active = instance.activeLoadoutId === loadout.id
  const addons = instance.addons.filter((addon) => loadout.addonIds.includes(addon.id))
  const size = addons.reduce((total, addon) => total + addon.size, 0)

  const activate = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.loadouts.activate(instance.id, loadout.id)
      onChanged()
      toast('success', 'Loadout active', `${loadout.name} is now applied to ${instance.name}`)
    } catch (error) {
      toast('error', 'Could not activate loadout', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const backup = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.loadouts.backup(instance.id, loadout.id)
      onChanged()
      toast('success', 'Offline backup ready', `${addons.length} files are cached for ${loadout.name}`)
    } catch (error) {
      toast('error', 'Backup failed', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = (): void => {
    askConfirm({
      title: `Delete ${loadout.name}?`,
      description: 'The add-on files stay in the instance; only this loadout definition is removed.',
      confirmLabel: 'Delete loadout',
      danger: true,
      action: async () => {
        await window.newbie.loadouts.remove(instance.id, loadout.id)
        onChanged()
      }
    })
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl border p-4 transition-colors',
        active ? 'border-grass/35 bg-grass/[0.035]' : 'border-line/55 bg-card/55 hover:border-line'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border',
              active ? 'border-grass/25 bg-grass/10 text-grass' : 'border-line/60 bg-elevated text-muted'
            )}
          >
            {loadout.mode === 'offline' ? <HardDrives size={17} /> : <CloudArrowDown size={17} />}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-[13px] font-semibold text-ink">{loadout.name}</h4>
              {active && <Badge tone="green" className="h-4 px-1.5 text-[8.5px]">Active</Badge>}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted">
              {addons.length} add-ons · {formatBytes(size)} · {relativeTime(loadout.updatedAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge tone={loadout.mode === 'offline' ? 'green' : 'blue'} className="h-5 text-[8.5px]">
            {loadout.mode === 'offline' ? 'Offline backup' : 'Download on switch'}
          </Badge>
          <div className="relative">
            <button
              aria-label={`More options for ${loadout.name}`}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-ink"
            >
              <DotsThree size={17} weight="bold" />
            </button>
            {menuOpen && (
              <>
                <button className="fixed inset-0 z-30 cursor-default" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-40 w-40 rounded-xl border border-line bg-elevated p-1 shadow-lift">
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-muted hover:bg-white/[0.05] hover:text-ink"
                    onClick={() => {
                      setMenuOpen(false)
                      openModal('loadout', { instanceId: instance.id, loadoutId: loadout.id })
                    }}
                  >
                    <PencilSimple size={14} /> Edit loadout
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-danger hover:bg-danger/10"
                    onClick={() => {
                      setMenuOpen(false)
                      remove()
                    }}
                  >
                    <Trash size={14} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {active ? (
          <span className="inline-flex h-8 items-center gap-1.5 text-[11.5px] text-grass/85">
            <CheckCircle size={14} weight="fill" /> Applied to this instance
          </span>
        ) : (
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void activate()} icon={<Play size={13} weight="fill" />}>
            Activate
          </Button>
        )}
        <Button size="sm" variant="ghost" loading={busy} onClick={() => void backup()} icon={<HardDrives size={13} />}>
          Backup now
        </Button>
      </div>
    </div>
  )
}
