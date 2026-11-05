import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CloudArrowDown, HardDrives, Package } from '@phosphor-icons/react'
import { useInstance, qk } from '../../hooks/queries'
import { toast, useUi } from '../../store/ui'
import { cn, errorMessage, formatBytes } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Switch } from '../ui/primitives'

export function LoadoutModal() {
  const state = useUi((store) => store.modal.loadout)
  const closeModal = useUi((store) => store.closeModal)
  const instanceQuery = useInstance(state?.instanceId)
  const instance = instanceQuery.data
  const queryClient = useQueryClient()

  const existing = instance?.loadouts.find((loadout) => loadout.id === state?.loadoutId)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'offline' | 'download'>('offline')
  const [selected, setSelected] = useState<string[]>([])
  const [activateAfter, setActivateAfter] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state) return
    const loadout = instance?.loadouts.find((candidate) => candidate.id === state.loadoutId)
    setName(loadout?.name ?? '')
    setMode(loadout?.mode ?? 'offline')
    setSelected(loadout?.addonIds ?? instance?.addons.map((addon) => addon.id) ?? [])
    setError(null)
  }, [state, instance])

  const addons = instance?.addons ?? []
  const selectedAddons = useMemo(() => addons.filter((addon) => selected.includes(addon.id)), [addons, selected])
  const size = selectedAddons.reduce((total, addon) => total + addon.size, 0)

  const save = async (): Promise<void> => {
    if (!instance || !state) return
    setBusy(true)
    setError(null)
    try {
      let loadout
      if (existing) {
        loadout = await window.newbie.loadouts.update(instance.id, existing.id, { name, mode, addonIds: selected })
      } else {
        loadout = await window.newbie.loadouts.create(instance.id, { name, mode, addonIds: selected })
      }
      if (activateAfter) {
        await window.newbie.loadouts.activate(instance.id, loadout.id)
      }
      await queryClient.invalidateQueries({ queryKey: qk.instance(instance.id) })
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      toast('success', existing ? 'Loadout updated' : 'Loadout created', `${loadout.name} · ${selected.length} add-ons`)
      closeModal('loadout')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(state)}
      onClose={() => closeModal('loadout')}
      title={existing ? 'Edit loadout' : 'New loadout'}
      description="Bundle a set of add-ons and switch between setups without reinstalling anything."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => closeModal('loadout')} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()} disabled={!name.trim()}>
            {existing ? 'Save loadout' : 'Create loadout'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Name">
          <Input value={name} placeholder="Performance, Vanilla+, Create…" onChange={(event) => setName(event.target.value)} maxLength={60} data-autofocus />
        </Field>

        <div>
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.09em] text-muted">Storage mode</div>
          <div className="grid grid-cols-2 gap-2.5">
            <ModeCard
              active={mode === 'offline'}
              icon={<HardDrives size={17} />}
              title="Full offline backup"
              description="Keeps a complete copy of every add-on in the launcher cache. Switching works with no internet."
              onClick={() => setMode('offline')}
            />
            <ModeCard
              active={mode === 'download'}
              icon={<CloudArrowDown size={17} />}
              title="Download on switch"
              description="Stores only metadata. Files are downloaded again when you activate this loadout."
              onClick={() => setMode('download')}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted">Add-ons</div>
            <div className="text-[10.5px] text-muted/60">
              {selected.length}/{addons.length} selected · {formatBytes(size)}
            </div>
          </div>
          <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
            {addons.length === 0 && (
              <div className="rounded-xl border border-dashed border-line/60 p-4 text-center text-[11.5px] text-muted">
                Install mods or packs from Browse first.
              </div>
            )}
            {addons.map((addon) => {
              const checked = selected.includes(addon.id)
              return (
                <button
                  key={addon.id}
                  onClick={() =>
                    setSelected((current) =>
                      checked ? current.filter((id) => id !== addon.id) : [...current, addon.id]
                    )
                  }
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors',
                    checked ? 'border-grass/25 bg-grass/[0.035]' : 'border-line/45 bg-canvas/20 hover:border-line'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      checked ? 'border-grass bg-grass text-[#07140C]' : 'border-line text-transparent'
                    )}
                  >
                    <Package size={10} weight="fill" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-ink">{addon.name}</span>
                    <span className="block text-[10px] text-muted/70">
                      {addon.type} · {addon.versionNumber}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted/60">{formatBytes(addon.size)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <Switch
          checked={activateAfter}
          onChange={setActivateAfter}
          label="Activate after saving"
          description="Switches the instance to this loadout right away."
        />

        {error && <div className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger">{error}</div>}
      </div>
    </Modal>
  )
}

function ModeCard({
  active,
  icon,
  title,
  description,
  onClick
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-left transition-colors',
        active ? 'border-grass/40 bg-grass/[0.04]' : 'border-line/50 bg-canvas/25 hover:border-line'
      )}
    >
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', active ? 'bg-grass/12 text-grass' : 'bg-white/[0.04] text-muted')}>
        {icon}
      </span>
      <span className="mt-2 block text-[12px] font-semibold text-ink">{title}</span>
      <span className="mt-1 block text-[10.5px] leading-relaxed text-muted">{description}</span>
    </button>
  )
}
