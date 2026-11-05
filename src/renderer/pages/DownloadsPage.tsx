import { DownloadSimple, FolderOpen, HardDrives, SpinnerGap } from '@phosphor-icons/react'
import type { TaskRecord } from '@shared/types'
import { useDiskUsage, useTasks } from '../hooks/queries'
import { useUi } from '../store/ui'
import { formatBytes } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { TaskRow } from '../components/TaskRow'
import { Card, EmptyState } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'

export function DownloadsPage() {
  const persisted = useTasks().data ?? []
  const live = useUi((state) => state.tasks)
  const disk = useDiskUsage().data
  const merged = new Map<string, TaskRecord>()
  for (const task of persisted) merged.set(task.id, task)
  for (const task of Object.values(live)) merged.set(task.id, task)
  const tasks = [...merged.values()].sort((a, b) => b.startedAt - a.startedAt)
  const active = tasks.filter((task) => task.status === 'running')
  const recent = tasks.filter((task) => task.status !== 'running')

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Downloads & tasks"
        description="Installs, updates, repairs and Java downloads running in the background."
        actions={
          <Button variant="secondary" onClick={() => void window.newbie.settings.revealDataDir()} icon={<FolderOpen size={15} />}>
            Open data folder
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-[0.1em] text-muted/65">Active</div>
          <div className="mt-1 font-display text-[22px] font-semibold text-ink">{active.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-[0.1em] text-muted/65">Recent</div>
          <div className="mt-1 font-display text-[22px] font-semibold text-ink">{Math.min(20, recent.length)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-[0.1em] text-muted/65">Add-on cache</div>
          <div className="mt-1 font-display text-[22px] font-semibold text-ink">{disk ? formatBytes(disk.cacheMb * 1024 * 1024) : '—'}</div>
        </Card>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<DownloadSimple size={22} />}
          title="Nothing in the queue"
          description="Installing a version, updating mods or downloading Java creates a task here. You can close the launcher while the game is running."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Running</h2>
              {active.length > 0 && <SpinnerGap size={13} className="animate-spin text-grass" />}
            </div>
            <div className="space-y-2">
              {active.length === 0 && <div className="rounded-xl border border-dashed border-line/50 p-4 text-[11.5px] text-muted">No active transfers.</div>}
              {active.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">History</h2>
            </div>
            <div className="space-y-2">
              {recent.length === 0 && <div className="rounded-xl border border-dashed border-line/50 p-4 text-[11.5px] text-muted">Completed tasks will appear here.</div>}
              {recent.slice(0, 20).map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-line/40 bg-card/30 p-3 text-[10.5px] leading-relaxed text-muted/70">
        <HardDrives size={13} className="mr-1 inline" />
        Downloads are verified against SHA-1/SHA-256 where upstream publishes hashes, written atomically, and retried on
        transient failures. Existing files are reused.
      </div>
    </div>
  )
}
