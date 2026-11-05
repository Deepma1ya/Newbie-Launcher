import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, WarningCircle } from '@phosphor-icons/react'
import type { Instance } from '@shared/types'
import {
  DEFAULT_COPY_CATEGORIES,
  MINECRAFT_SETTING_CATEGORIES,
  type MinecraftSettingCategory
} from '@shared/instanceSettings'
import { useInstances, qk } from '../../hooks/queries'
import { toast } from '../../store/ui'
import { cn, errorMessage } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Segmented, Select } from '../ui/primitives'
import { BlockIcon } from '../ui/BlockIcon'

export function CopySettingsModal({
  open,
  onClose,
  source
}: {
  open: boolean
  onClose: () => void
  source: Instance
}) {
  const instances = useInstances().data ?? []
  const targets = useMemo(
    () => instances.filter((instance) => instance.id !== source.id),
    [instances, source.id]
  )
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'one' | 'all'>('one')
  const [targetId, setTargetId] = useState('')
  const [selected, setSelected] = useState<Set<MinecraftSettingCategory>>(
    () => new Set(DEFAULT_COPY_CATEGORIES)
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMode('one')
    setTargetId((current) =>
      current && targets.some((target) => target.id === current) ? current : (targets[0]?.id ?? '')
    )
    setSelected(new Set(DEFAULT_COPY_CATEGORIES))
    setError(null)
  }, [open, targets])

  const toggle = (category: MinecraftSettingCategory): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const copy = async (): Promise<void> => {
    const targetIds = mode === 'all' ? targets.map((target) => target.id) : targetId ? [targetId] : []
    if (targetIds.length === 0 || selected.size === 0) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.newbie.instances.copySettings({
        sourceId: source.id,
        targetIds,
        categories: [...selected]
      })
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      const extras: string[] = []
      if (result.skippedResourcePacks > 0) {
        extras.push(`${result.skippedResourcePacks} missing resource pack(s) skipped`)
      }
      if (result.shaderPacksCopied > 0) extras.push('shader pack copied')
      if (result.shaderConfigsCopied > 0 && result.shaderPacksCopied === 0) {
        extras.push('shader config copied')
      }
      toast(
        'success',
        'Minecraft settings copied',
        `${result.targets} instance${result.targets === 1 ? '' : 's'} updated${
          result.copiedKeys > 0 ? ` · ${result.copiedKeys} option${result.copiedKeys === 1 ? '' : 's'}` : ''
        }${extras.length ? ` · ${extras.join(' · ')}` : ''}`
      )
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const target = targets.find((candidate) => candidate.id === targetId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copy Minecraft settings"
      description="Choose exactly which in-game settings this instance should share."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={targets.length === 0 || selected.size === 0 || (mode === 'one' && !targetId)}
            onClick={() => void copy()}
            icon={<Copy size={15} />}
          >
            {mode === 'all'
              ? `Apply to all ${targets.length}`
              : target
                ? `Copy to ${target.name}`
                : 'Copy settings'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-line/55 bg-canvas/35 p-3.5">
          <BlockIcon name={source.name} color={source.color} iconUrl={source.iconUrl} size={38} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-ink">{source.name}</div>
            <div className="text-[10.5px] text-muted">
              {source.versionId} · {source.loader} · source instance
            </div>
          </div>
        </div>

        {targets.length === 0 ? (
          <div className="rounded-xl border border-gold/25 bg-gold/[0.04] p-3 text-[11.5px] leading-relaxed text-gold">
            Create a second instance first. There is nowhere to copy these settings yet.
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-xl border border-line/50 bg-canvas/25 p-3.5">
              <Segmented
                value={mode}
                onChange={setMode}
                className="w-full"
                options={[
                  { value: 'one', label: 'One instance' },
                  { value: 'all', label: `All other instances (${targets.length})` }
                ]}
              />
              {mode === 'one' ? (
                <Field label="Target instance">
                  <Select value={targetId} onChange={setTargetId}>
                    {targets.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} · {candidate.versionId} · {candidate.loader}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <p className="text-[11px] leading-relaxed text-muted">
                  These become the default Minecraft settings for all {targets.length} other instance
                  {targets.length === 1 ? '' : 's'}. Each target still keeps its own worlds and add-ons.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-[13px] font-semibold text-ink">What to copy</h3>
                  <p className="text-[10.5px] text-muted">Select only the settings this instance should share.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(DEFAULT_COPY_CATEGORIES))}
                    className="text-[10.5px] text-grass hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-muted/30">·</span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-[10.5px] text-muted hover:text-ink hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {MINECRAFT_SETTING_CATEGORIES.map((category) => (
                  <SettingChoice
                    key={category.id}
                    checked={selected.has(category.id)}
                    label={category.label}
                    description={category.description}
                    onToggle={() => toggle(category.id)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line/45 bg-canvas/25 p-3 text-[10.5px] leading-relaxed text-muted/75">
              Target <span className="font-mono text-ink/75">options.txt</span> files are backed up as
              <span className="font-mono text-ink/75"> options.txt.newbie-copy.bak</span>. Resource pack entries for
              packs missing in a target are skipped. The selected shader pack is copied when the target does not have it.
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger">
                <WarningCircle size={15} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function SettingChoice({
  checked,
  label,
  description,
  onToggle
}: {
  checked: boolean
  label: string
  description: string
  onToggle: () => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
        checked
          ? 'border-grass/35 bg-grass/[0.04]'
          : 'border-line/50 bg-canvas/25 hover:border-line/75'
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-grass/50 bg-grass/15 text-grass' : 'border-line text-transparent'
        )}
        aria-hidden="true"
      >
        <Check size={10} weight="bold" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11.5px] font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">{description}</span>
      </span>
    </label>
  )
}
