import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowSquareOut,
  CaretRight,
  HardDrives,
  Plus,
  Stop,
  Trash
} from '@phosphor-icons/react'
import type { ServerRecord, ServerRuntimeStatus } from '@shared/types'
import { serverTypeLabel } from '@shared/serverTypes'
import { useServerStatuses, useServers, qk } from '../hooks/queries'
import { toast, useUi } from '../store/ui'
import { errorMessage, relativeTime } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { CreateServerModal } from '../components/modals/CreateServerModal'
import { Badge, Card, EmptyState, Skeleton } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'

export function ServersPage() {
  const serversQuery = useServers()
  const servers = serversQuery.data ?? []
  const loading = serversQuery.isLoading
  const statuses = useServerStatuses().data ?? []
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const askConfirm = useUi((state) => state.askConfirm)
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const statusMap = useMemo(
    () => new Map(statuses.map((status) => [status.serverId, status])),
    [statuses]
  )

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.servers })
    await queryClient.invalidateQueries({ queryKey: qk.serverStatuses })
  }

  const run = async (
    server: ServerRecord,
    action: 'start' | 'stop' | 'restart'
  ): Promise<void> => {
    setBusy((current) => ({ ...current, [server.id]: true }))
    try {
      await window.newbie.servers[action](server.id)
      await refresh()
      if (action === 'start') {
        toast('success', 'Server starting', `${server.name} · localhost:${server.port}`)
      }
    } catch (error) {
      toast('error', 'Server action failed', errorMessage(error))
    } finally {
      setBusy((current) => {
        const next = { ...current }
        delete next[server.id]
        return next
      })
    }
  }

  const remove = (server: ServerRecord): void => {
    askConfirm({
      title: `Delete ${server.name}?`,
      description:
        'The server, its world, plugins/mods, logs and settings will be removed from this computer. Stop it first if it is running.',
      confirmLabel: 'Delete server',
      danger: true,
      action: async () => {
        await window.newbie.servers.remove(server.id, true)
        await refresh()
        toast('success', 'Server deleted', server.name)
      }
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Local servers"
        title="Servers"
        description="One-click Minecraft servers that run on this PC. Vanilla, Paper, Fabric, Forge, NeoForge and Quilt."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)} icon={<Plus size={15} />}>
            New server
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-[190px]" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <EmptyState
          icon={<HardDrives size={22} />}
          title="No local servers yet"
          description="Create a server in one click. Newbie downloads the software, sets up Java, accepts the EULA after your consent and starts it on localhost."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)} icon={<Plus size={15} />}>
              Create your first server
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {servers.map((server) => {
            const status = statusMap.get(server.id) ?? { serverId: server.id, status: 'stopped' as const }
            return (
              <ServerCard
                key={server.id}
                server={server}
                status={status}
                busy={Boolean(busy[server.id])}
                onOpen={() => navigate(`/servers/${server.id}`)}
                onStart={() => void run(server, 'start')}
                onStop={() => void run(server, 'stop')}
                onRestart={() => void run(server, 'restart')}
                onFolder={() => void window.newbie.servers.openFolder(server.id)}
                onRemove={() => remove(server)}
              />
            )
          })}
        </div>
      )}

      <CreateServerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false)
          void refresh()
          navigate(`/servers/${id}`)
        }}
      />
    </div>
  )
}

function ServerCard({
  server,
  status,
  busy,
  onOpen,
  onStart,
  onStop,
  onRestart,
  onFolder,
  onRemove
}: {
  server: ServerRecord
  status: ServerRuntimeStatus
  busy: boolean
  onOpen: () => void
  onStart: () => void
  onStop: () => void
  onRestart: () => void
  onFolder: () => void
  onRemove: () => void
}) {
  const running = status.status === 'running' || status.status === 'starting'
  const statusTone = status.status === 'running' ? 'green' : status.status === 'stopped' ? 'neutral' : 'gold'
  return (
    <Card className="card-hover overflow-hidden p-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 border-b border-line/40 p-4 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-grass/20 bg-grass/8 text-grass">
          <HardDrives size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-display text-[15px] font-semibold text-ink">{server.name}</span>
            <Badge tone={statusTone as 'green' | 'neutral' | 'gold'} className="h-4 px-1.5 text-[8.5px]">
              {status.status === 'starting'
                ? 'Starting'
                : status.status === 'running'
                  ? 'Online'
                  : status.status === 'stopping'
                    ? 'Stopping'
                    : 'Stopped'}
            </Badge>
          </span>
          <span className="mt-1 block text-[10.5px] text-muted">
            {serverTypeLabel(server.type)} {server.versionId}
            {server.loaderVersion ? ` · ${server.loaderVersion}` : ''} · localhost:{server.port}
          </span>
          <span className="mt-1 block text-[10px] text-muted/65">
            {running
              ? `Up since ${status.startedAt ? relativeTime(new Date(status.startedAt).toISOString()) : 'just now'}`
              : server.lastStartedAt
                ? `Last started ${relativeTime(server.lastStartedAt)}`
                : 'Never started'}
          </span>
        </span>
        <CaretRight size={16} className="mt-1 shrink-0 text-muted/50" />
      </button>
      <div className="flex flex-wrap items-center gap-2 p-3">
        {running ? (
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={(event) => {
              event.stopPropagation()
              onStop()
            }}
            icon={<Stop size={14} />}
          >
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            onClick={(event) => {
              event.stopPropagation()
              onStart()
            }}
            icon={<CaretRight size={14} weight="fill" />}
          >
            Start
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={!running}
          onClick={(event) => {
            event.stopPropagation()
            onRestart()
          }}
        >
          Restart
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            onFolder()
          }}
          icon={<ArrowSquareOut size={14} />}
        >
          Folder
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-danger/80 hover:text-danger"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          icon={<Trash size={14} />}
        >
          Delete
        </Button>
      </div>
    </Card>
  )
}
