import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Play, Square, Wrench } from '@phosphor-icons/react'
import type { Instance } from '@shared/types'
import { toast, useUi } from '../store/ui'
import { useTasks } from '../hooks/queries'
import { qk } from '../hooks/queries'
import { cn, errorMessage } from '../lib/utils'
import { Button } from './ui/Button'

export function PlayButton({
  instance,
  size = 'md',
  fullWidth = false,
  className
}: {
  instance: Instance
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
}) {
  const [launching, setLaunching] = useState(false)
  const launchState = useUi((state) => state.running.find((entry) => entry.instanceId === instance.id))
  const running = launchState?.status === 'running'
  const starting = launchState?.status === 'starting'
  const openModal = useUi((state) => state.openModal)
  const tasks = useTasks().data ?? []
  const liveTasks = useUi((state) => state.tasks)
  const queryClient = useQueryClient()
  const activeTask = Object.values(liveTasks)
    .concat(tasks)
    .filter((task) => task.instanceId === instance.id && task.status === 'running')
    .sort((a, b) => b.startedAt - a.startedAt)[0]

  const launch = async (): Promise<void> => {
    if (running) {
      try {
        await window.newbie.instances.stop(instance.id)
        toast('info', 'Stopping Minecraft', `${instance.name} is shutting down`)
      } catch (error) {
        toast('error', 'Could not stop Minecraft', errorMessage(error))
      }
      return
    }
    setLaunching(true)
    openModal('console', { instanceId: instance.id })
    try {
      await window.newbie.instances.launch(instance.id)
      await queryClient.invalidateQueries({ queryKey: qk.instances })
    } catch (error) {
      toast('error', 'Minecraft could not start', errorMessage(error))
    } finally {
      setLaunching(false)
    }
  }

  const progress = activeTask?.percent ?? 0
  const busy = launching || starting || Boolean(activeTask)

  return (
    <div className={cn('relative', className, fullWidth && 'w-full')}>
      <Button
        variant={running ? 'danger' : 'primary'}
        size={size}
        fullWidth={fullWidth}
        loading={busy}
        icon={running ? <Square size={15} weight="fill" /> : busy ? <Wrench size={15} /> : <Play size={15} weight="fill" />}
        onClick={() => void launch()}
        className={cn(running && 'shadow-none')}
      >
        {running ? 'Stop' : busy ? (activeTask ? `${Math.round(progress)}%` : 'Starting…') : 'Play'}
      </Button>
      {activeTask && (
        <motion.span
          layout
          className="mt-1.5 block text-[10.5px] leading-tight text-muted/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {activeTask.stage || activeTask.title}
        </motion.span>
      )}
    </div>
  )
}
