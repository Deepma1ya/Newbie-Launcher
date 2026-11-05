import { Trash } from '@phosphor-icons/react'
import type { AddonRecord, Instance } from '@shared/types'
import {
  addonBulkNoun,
  addonBulkTargets,
  type AddonBulkFilter
} from '@shared/addonBulk'
import { toast, useUi } from '../store/ui'
import { Button } from './ui/Button'

export function DeleteAllAddonsButton({
  instance,
  addons,
  filter,
  onChanged
}: {
  instance: Instance
  addons: AddonRecord[]
  filter: AddonBulkFilter
  onChanged: () => void | Promise<void>
}) {
  const askConfirm = useUi((state) => state.askConfirm)
  const running = useUi((state) =>
    state.running.some((entry) => entry.instanceId === instance.id)
  )
  const taskRunning = useUi((state) =>
    Object.values(state.tasks).some(
      (task) => task.instanceId === instance.id && task.status === 'running'
    )
  )
  const blocked = running || taskRunning
  const noun = addonBulkNoun(filter)
  const count = addonBulkTargets(addons, filter)

  const remove = (): void => {
    if (count === 0 || blocked) return
    askConfirm({
      title: `Delete all ${noun}?`,
      description: `${count} ${noun} will be removed from ${instance.name}. ${
        filter === 'datapack' || filter === 'all'
          ? 'Datapacks inside worlds are removed from those worlds. '
          : ''
      }Only the installed files are deleted — cached offline copies are kept, and worlds stay. Removed add-ons are also taken out of loadouts. Close Minecraft first if it is running.`,
      confirmLabel: `Delete ${count} ${noun}`,
      danger: true,
      action: async () => {
        const removed = await window.newbie.addons.removeAll(
          instance.id,
          filter === 'all' ? undefined : filter
        )
        await onChanged()
        toast('success', `Deleted ${removed} ${noun}`, instance.name)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={count === 0 || blocked}
      onClick={remove}
      icon={<Trash size={14} />}
      className="text-danger/80 hover:bg-danger/10 hover:text-danger"
      title={
        blocked
          ? running
            ? 'Stop Minecraft before deleting add-ons'
            : 'Wait for the current task to finish'
          : `Delete all ${noun} from ${instance.name}`
      }
    >
      Delete all
    </Button>
  )
}
