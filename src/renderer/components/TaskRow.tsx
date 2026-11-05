import {
  ArrowsClockwise,
  DownloadSimple,
  HardDrives,
  Package,
  ShieldCheck,
  Sparkle,
  Wrench
} from '@phosphor-icons/react'
import type { TaskRecord } from '@shared/types'
import { cn, relativeTime } from '../lib/utils'
import { Progress } from './ui/primitives'

const icons: Record<TaskRecord['kind'], typeof DownloadSimple> = {
  'install-version': DownloadSimple,
  'install-loader': Package,
  'install-addon': Package,
  'update-addons': ArrowsClockwise,
  repair: Wrench,
  java: Sparkle,
  backup: HardDrives,
  modpack: ShieldCheck,
  server: HardDrives,
  'server-addon': Package
}

export function TaskRow({ task }: { task: TaskRecord }) {
  const Icon = icons[task.kind] ?? DownloadSimple
  const active = task.status === 'running'
  return (
    <div className="rounded-xl border border-line/50 bg-card/45 p-3.5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
            task.status === 'error'
              ? 'border-danger/25 bg-danger/10 text-danger'
              : task.status === 'done'
                ? 'border-grass/20 bg-grass/8 text-grass'
                : 'border-line/60 bg-elevated text-muted'
          )}
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-[12.5px] font-medium text-ink">{task.title}</div>
            <div className="shrink-0 text-[10px] text-muted/70">
              {task.status === 'running' ? `${Math.round(task.percent)}%` : task.status === 'done' ? 'Done' : task.status === 'error' ? 'Failed' : task.status}
            </div>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted">
            <span className="truncate">{task.error ?? task.stage}</span>
            <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-muted/50" />
            <span className="shrink-0">{relativeTime(new Date(task.startedAt).toISOString())}</span>
          </div>
          {active && <Progress value={task.percent} className="mt-2 h-1" />}
          {task.status === 'error' && task.error && (
            <p className="mt-1.5 line-clamp-2 text-[10.5px] text-danger/80">{task.error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
