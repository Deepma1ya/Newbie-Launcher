import { useState } from 'react'
import { CheckSquare, Power, Trash } from '@phosphor-icons/react'
import type { AddonRecord, Instance } from '@shared/types'
import type { AddonBulkAction } from '@shared/addonBulk'
import { toast, useUi } from '../store/ui'
import { errorMessage } from '../lib/utils'
import { Button } from './ui/Button'

export function AddonSelectionBar({
  instance,
  addons,
  selectedIds,
  visibleIds,
  onClear,
  onSelectAll,
  onChanged
}: {
  instance: Instance
  addons: AddonRecord[]
  selectedIds: Set<string>
  visibleIds: string[]
  onClear: () => void
  onSelectAll: () => void
  onChanged: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState<AddonBulkAction | null>(null)
  const askConfirm = useUi((state) => state.askConfirm)
  const running = useUi((state) => state.running.some((entry) => entry.instanceId === instance.id))
  const taskRunning = useUi((state) =>
    Object.values(state.tasks).some(
      (task) => task.instanceId === instance.id && task.status === 'running'
    )
  )
  const blocked = running || taskRunning
  const selected = addons.filter((addon) => selectedIds.has(addon.id))
  const count = selected.length
  const noun = `add-on${count === 1 ? '' : 's'}`
  const remainingVisible = visibleIds.filter((id) => !selectedIds.has(id)).length

  if (count === 0) return null

  const run = async (action: AddonBulkAction): Promise<void> => {
    if (busy || blocked) return
    setBusy(action)
    try {
      const result = await window.newbie.addons.bulk(
        instance.id,
        selected.map((addon) => addon.id),
        action
      )
      await onChanged()
      onClear()
      const message =
        action === 'delete'
          ? `Deleted ${result.changed} ${noun}`
          : `${action === 'enable' ? 'Enabled' : 'Disabled'} ${result.changed} ${noun}`
      toast('success', message, instance.name)
    } catch (error) {
      await onChanged()
      toast('error', 'Bulk action failed', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const removeSelected = (): void => {
    if (busy || blocked) return
    askConfirm({
      title: `Delete ${count} ${noun}?`,
      description: `The selected files are deleted from ${instance.name}. Cached offline copies are kept, worlds stay, and the add-ons are removed from loadouts. Close Minecraft first if it is running.`,
      confirmLabel: `Delete ${count} ${noun}`,
      danger: true,
      action: () => run('delete')
    })
  }

  const blockedTitle = running
    ? 'Close Minecraft before changing selected add-ons'
    : taskRunning
      ? 'Wait for the current task to finish'
      : undefined

  return (
    <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-grass/30 bg-elevated/95 px-3 py-2 shadow-lift backdrop-blur">
      <CheckSquare size={15} className="text-grass" />
      <span className="text-[11.5px] font-semibold text-ink">{count} selected</span>
      <div className="ml-1 flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={Boolean(busy) || blocked}
          loading={busy === 'enable'}
          onClick={() => void run('enable')}
          icon={<Power size={14} />}
          title={blockedTitle}
        >
          Enable
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={Boolean(busy) || blocked}
          loading={busy === 'disable'}
          onClick={() => void run('disable')}
          icon={<Power size={14} />}
          title={blockedTitle}
        >
          Disable
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={Boolean(busy) || blocked}
          loading={busy === 'delete'}
          onClick={removeSelected}
          icon={<Trash size={14} />}
          className="text-danger/85 hover:bg-danger/10 hover:text-danger"
          title={blockedTitle}
        >
          Delete
        </Button>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {remainingVisible > 0 && (
          <button
            onClick={onSelectAll}
            className="text-[10.5px] text-grass hover:underline"
          >
            Select {remainingVisible} more
          </button>
        )}
        <button onClick={onClear} className="text-[10.5px] text-muted hover:text-ink">
          Clear
        </button>
      </div>
    </div>
  )
}
