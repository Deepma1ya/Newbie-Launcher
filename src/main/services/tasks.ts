import type { InstallProgress, TaskRecord } from '@shared/types'
import { store } from './store'
import { emit } from './events'
import { uniqueId } from '../util/fs'
import { logger } from '../util/log'

export interface TaskHandle {
  id: string
  progress: (update: Omit<InstallProgress, 'taskId'>) => void
  done: (message?: string) => Promise<void>
  fail: (error: unknown) => Promise<void>
}

class TaskManager {
  private tasks = new Map<string, TaskRecord>()
  private lastPersist = 0

  start(
    kind: TaskRecord['kind'],
    title: string,
    subtitle?: string,
    instanceId?: string
  ): TaskHandle {
    const id = uniqueId('task')
    const task: TaskRecord = {
      id,
      kind,
      instanceId,
      title,
      subtitle,
      stage: 'Queued',
      current: 0,
      total: 0,
      percent: 0,
      status: 'running',
      startedAt: Date.now()
    }
    this.tasks.set(id, task)
    this.emitTask(task)
    void this.persist(task)

    return {
      id,
      progress: (update) => {
        const live = this.tasks.get(id)
        if (!live) return
        const total = Math.max(0, update.total)
        const percent =
          update.percent !== undefined
            ? clamp(update.percent)
            : total > 0
              ? clamp((update.current / total) * 100)
              : 0
        live.stage = update.stage
        live.current = update.current
        live.total = total
        live.percent = percent
        live.title = update.message || live.title
        live.subtitle = update.detail ?? live.subtitle
        this.emitTask(live)
        emit({
          type: 'install-progress',
          payload: { ...update, taskId: id, instanceId: update.instanceId ?? instanceId }
        })
        if (Date.now() - this.lastPersist > 2500) {
          this.lastPersist = Date.now()
          void this.persist(live)
        }
      },
      done: async (message) => {
        const live = this.tasks.get(id)
        if (!live) return
        live.status = 'done'
        live.stage = message ?? 'Done'
        live.percent = 100
        live.finishedAt = Date.now()
        this.emitTask(live)
        await this.persist(live)
      },
      fail: async (error) => {
        const live = this.tasks.get(id)
        if (!live) return
        live.status = 'error'
        live.stage = 'Failed'
        live.error = error instanceof Error ? error.message : String(error)
        live.finishedAt = Date.now()
        this.emitTask(live)
        logger.error('task', `${title} failed`, error)
        await this.persist(live)
      }
    }
  }

  list(): TaskRecord[] {
    const live = [...this.tasks.values()].sort((a, b) => b.startedAt - a.startedAt)
    const persisted = store.recentTasks().filter((task) => !this.tasks.has(task.id))
    return [...live, ...persisted].slice(0, 60)
  }

  hasActive(): boolean {
    return [...this.tasks.values()].some((task) => task.status === 'running')
  }

  private emitTask(task: TaskRecord): void {
    emit({ type: 'task', payload: { ...task } })
  }

  private async persist(task: TaskRecord): Promise<void> {
    try {
      await store.recordTask({ ...task })
    } catch (error) {
      logger.warn('task', 'Unable to persist task', error)
    }
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export const tasks = new TaskManager()
