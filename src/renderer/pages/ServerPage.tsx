import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowsClockwise,
  CaretRight,
  CheckCircle,
  FolderOpen,
  Gauge,
  HardDrives,
  Image,
  Package,
  PaperPlaneTilt,
  Plus,
  Stop,
  Trash,
  UserPlus,
  UsersThree,
  WarningCircle
} from '@phosphor-icons/react'
import type {
  ModrinthHit,
  ServerAddonRecord,
  ServerAddonType,
  ServerRecord,
  ServerRestartSchedule,
  ServerRuntimeStatus,
  ServerStats
} from '@shared/types'
import {
  BEDROCK_PROPERTY_FIELDS,
  BEDROCK_PROPERTY_GROUPS,
  SERVER_PROPERTY_FIELDS,
  SERVER_PROPERTY_GROUPS,
  type ServerPropertyField
} from '@shared/serverProperties'
import {
  DEFAULT_RESTART_SCHEDULE,
  nextRestartAt,
  normalizeRestartSchedule,
  restartIntervalLabel
} from '@shared/serverSchedule'
import {
  serverSupportsAddon,
  serverTypeLabel
} from '@shared/serverTypes'
import {
  useAccounts,
  useServer,
  useServerAllowlist,
  useServerLogs,
  useServerProperties,
  useServerSearch,
  useServerStats,
  useServerStatus,
  useSystemInfo,
  qk
} from '../hooks/queries'
import { toast, useUi } from '../store/ui'
import { addonTypeLabel, cn, errorMessage, formatBytes, relativeTime } from '../lib/utils'
import { Badge, Card, Field, Input, Segmented, Select, Skeleton, Switch } from '../components/ui/primitives'
import { Button, IconButton } from '../components/ui/Button'
import { ProjectIcon } from '../components/ui/BlockIcon'
import { PageHeader } from '../components/PageHeader'
import { ServerSharePanel } from '../components/ServerSharePanel'
import { ServerResourcePackPanel } from '../components/ServerResourcePackPanel'
import { ServerCommandSnippets } from '../components/ServerCommandSnippets'

type Tab = 'console' | 'share' | 'players' | 'settings' | 'resource-pack' | 'addons'

export function ServerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const serverQuery = useServer(id)
  const server = serverQuery.data
  const statusQuery = useServerStatus(id)
  const status = statusQuery.data ?? ({ serverId: id ?? '', status: 'stopped' } as ServerRuntimeStatus)
  const [tab, setTab] = useState<Tab>('console')
  const [busy, setBusy] = useState(false)

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.server(id ?? '') })
    await queryClient.invalidateQueries({ queryKey: qk.serverStatus(id ?? '') })
    await queryClient.invalidateQueries({ queryKey: qk.serverStatuses })
  }

  const action = async (kind: 'start' | 'stop' | 'restart'): Promise<void> => {
    if (!server) return
    setBusy(true)
    try {
      await window.newbie.servers[kind](server.id)
      await refresh()
      toast(
        'success',
        kind === 'stop' ? 'Server stopping' : kind === 'restart' ? 'Server restarting' : 'Server starting',
        `${server.name} · localhost:${server.port}`
      )
    } catch (error) {
      toast('error', 'Server action failed', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  if (!server) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const running = status.status === 'running' || status.status === 'starting'
  const isBedrock = server.type === 'bedrock'
  const statusTone = status.status === 'running' ? 'green' : status.status === 'stopped' ? 'neutral' : 'gold'

  return (
    <div>
      <Link to="/servers" className="mb-4 inline-flex items-center gap-1.5 text-[11.5px] text-muted hover:text-ink">
        <ArrowLeft size={13} /> Servers
      </Link>

      <PageHeader
        eyebrow="Local server"
        title={server.name}
        description={`${serverTypeLabel(server.type)} ${server.versionId}${
          server.loaderVersion ? ` · ${server.loaderVersion}` : ''
        } · Runs on this PC at localhost:${server.port}`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void window.newbie.servers.openFolder(server.id)}
              icon={<FolderOpen size={15} />}
            >
              Folder
            </Button>
            {running ? (
              <Button variant="secondary" loading={busy} onClick={() => void action('stop')} icon={<Stop size={15} />}>
                Stop
              </Button>
            ) : (
              <Button variant="primary" loading={busy} onClick={() => void action('start')} icon={<CaretRight size={15} weight="fill" />}>
                Start server
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={!running || busy}
              onClick={() => void action('restart')}
              icon={<ArrowsClockwise size={15} />}
            >
              Restart
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <Badge tone={statusTone as 'green' | 'neutral' | 'gold'}>
          {status.status === 'starting'
            ? 'Starting'
            : status.status === 'running'
              ? 'Online'
              : status.status === 'stopping'
                ? 'Stopping'
                : 'Stopped'}
        </Badge>
        <Badge tone="neutral">{serverTypeLabel(server.type)}</Badge>
        <Badge tone="neutral">{server.versionId}</Badge>
        <span className="rounded-md border border-line/50 bg-canvas/30 px-2 py-1 font-mono text-[10px] text-ink/75">
          localhost:{server.port}
        </span>
        {server.restartSchedule?.enabled && server.restartSchedule.nextRestartAt && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line/50 bg-canvas/30 px-2 py-1 text-[10px] text-muted">
            <ArrowsClockwise size={11} />
            Restart {formatRestartTime(server.restartSchedule.nextRestartAt)}
          </span>
        )}
        <WarningCircle size={13} className="text-gold/70" />
        <span className="text-[10.5px] text-muted/65">
          Keep Newbie running while the server is on. Servers stop when you quit the launcher.
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-3">
        <Segmented
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          options={[
            { value: 'console', label: 'Console', icon: <PaperPlaneTilt size={14} /> },
            { value: 'share', label: 'Share', icon: <UsersThree size={14} /> },
            ...(isBedrock
              ? [
                  {
                    value: 'players',
                    label: 'Players',
                    icon: <UserPlus size={14} />
                  }
                ]
              : []),
            { value: 'settings', label: 'Settings', icon: <HardDrives size={14} /> },
            ...(isBedrock
              ? []
              : [
                  {
                    value: 'resource-pack',
                    label: 'Resource pack',
                    icon: <Image size={14} />
                  },
                  {
                    value: 'addons',
                    label: `Add-ons ${server.addons.length}`,
                    icon: <Package size={14} />
                  }
                ])
          ]}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void window.newbie.servers.openFolder(server.id, 'logs')}
            icon={<FolderOpen size={14} />}
          >
            Open logs
          </Button>
        </div>
      </div>

      {tab === 'console' && (
        <ServerConsole server={server} status={status} running={running} onStart={() => void action('start')} busy={busy} />
      )}
      {tab === 'share' && (
        <ServerSharePanel
          server={server}
          running={running}
          onStart={() => void action('start')}
          onOpenSettings={() => setTab('settings')}
        />
      )}
      {tab === 'players' && isBedrock && (
        <ServerPlayersPanel
          server={server}
          running={running}
          onOpenSettings={() => setTab('settings')}
        />
      )}
      {tab === 'settings' && <ServerSettings server={server} running={running} />}
      {tab === 'resource-pack' && (
        <ServerResourcePackPanel server={server} running={running} />
      )}
      {tab === 'addons' && <ServerAddons server={server} running={running} />}
    </div>
  )
}

function formatRestartTime(iso: string | null | undefined): string {
  if (!iso) return 'Not scheduled'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return date.toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function ServerConsole({
  server,
  status,
  running,
  onStart,
  busy
}: {
  server: ServerRecord
  status: ServerRuntimeStatus
  running: boolean
  onStart: () => void
  busy: boolean
}) {
  const logs = useServerLogs(server.id, true).data ?? []
  const isBedrock = server.type === 'bedrock'
  const statsQuery = useServerStats(server.id, running && !isBedrock)
  const [command, setCommand] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshingStats, setRefreshingStats] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !stickToBottom.current) return
    panel.scrollTop = panel.scrollHeight
  }, [logs])

  const send = async (value?: string): Promise<void> => {
    const next = (value ?? command).trim()
    if (!next || !running) return
    setSending(true)
    try {
      await window.newbie.servers.command(server.id, next)
      if (!value) setCommand('')
    } catch (error) {
      toast('error', 'Command failed', errorMessage(error))
    } finally {
      setSending(false)
    }
  }

  const insert = (next: string): void => {
    setCommand(next)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const refreshStats = async (): Promise<void> => {
    setRefreshingStats(true)
    try {
      await statsQuery.refetch()
    } finally {
      setRefreshingStats(false)
    }
  }

  return (
    <div className="space-y-3">
      {!isBedrock && (
        <ServerPerformanceCard
          server={server}
          running={running}
          stats={statsQuery.data}
          refreshing={refreshingStats}
          onRefresh={() => void refreshStats()}
        />
      )}
      <div
        className={
          isBedrock
            ? 'space-y-3'
            : 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]'
        }
      >
        <div className="min-w-0 space-y-3">
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-[14px] font-semibold text-ink">Live console</h2>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  {running
                    ? `Server is ${status.status === 'running' ? 'running' : 'starting'} on localhost:${server.port}.`
                    : 'The server is stopped. Start it to run commands.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(isBedrock
                  ? ['list', 'save hold', 'allowlist list']
                  : ['list', 'save-all', 'whitelist list']
                ).map((quick) => (
                  <Button
                    key={quick}
                    variant="ghost"
                    size="sm"
                    disabled={!running}
                    onClick={() => void send(quick)}
                  >
                    {quick}
                  </Button>
                ))}
              </div>
            </div>
            <div
              ref={panelRef}
              onScroll={(event) => {
                const element = event.currentTarget
                stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40
              }}
              className="h-[430px] overflow-y-auto rounded-xl border border-line/50 bg-[#080d09] p-3 font-mono text-[10.5px] leading-[1.7]"
            >
              {logs.length === 0 ? (
                <div className="text-muted/55">
                  {running ? 'Waiting for server output…' : 'No logs yet. Start the server to see its output.'}
                </div>
              ) : (
                logs.map((line, index) => (
                  <div
                    key={`${index}-${line.slice(0, 24)}`}
                    className={cn(
                      'whitespace-pre-wrap break-words',
                      line.includes('[stderr]') || line.includes('ERROR') || line.includes('Exception')
                        ? 'text-danger/90'
                        : line.includes('[command]')
                          ? 'text-grass/90'
                          : line.includes('[system]')
                            ? 'text-gold/85'
                            : 'text-muted/85'
                    )}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <Input
                ref={inputRef}
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder={running ? 'Type a server command…' : 'Start the server to use commands'}
                disabled={!running || sending}
                className="font-mono"
              />
              <Button type="submit" variant="primary" loading={sending} disabled={!running || !command.trim()} icon={<PaperPlaneTilt size={15} />}>
                Send
              </Button>
            </form>
          </Card>
          {!running && (
            <Card className="flex items-center gap-3 p-4 text-[11.5px] text-muted">
              <HardDrives size={18} className="text-grass" />
              <span className="flex-1">Start the server when you are ready to play.</span>
              <Button variant="primary" size="sm" loading={busy} onClick={onStart}>
                Start server
              </Button>
            </Card>
          )}
        </div>
        {!isBedrock && (
          <ServerCommandSnippets
            serverType={server.type}
            players={statsQuery.data?.players ?? []}
            onInsert={insert}
          />
        )}
      </div>
    </div>
  )
}

function ServerPlayersPanel({
  server,
  running,
  onOpenSettings
}: {
  server: ServerRecord
  running: boolean
  onOpenSettings: () => void
}) {
  const queryClient = useQueryClient()
  const openModal = useUi((state) => state.openModal)
  const allowlist = useServerAllowlist(server.id, server.type === 'bedrock')
  const properties = useServerProperties(server.id)
  const accounts = useAccounts().data ?? []
  const account =
    accounts.find((entry) => entry.active && entry.type === 'microsoft') ??
    accounts.find((entry) => entry.type === 'microsoft')
  const [busyXuid, setBusyXuid] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const allowListEnabled = properties.data?.['allow-list'] === 'true'
  const onlineMode = properties.data?.['online-mode'] !== 'false'
  const entries = allowlist.data ?? []
  const accountAdded = Boolean(
    account?.xuid && entries.some((entry) => entry.xuid === account.xuid)
  )

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.serverAllowlist(server.id) })
  }

  const toggleAllowList = async (checked: boolean): Promise<void> => {
    setSaving(true)
    try {
      await window.newbie.servers.saveProperties(server.id, { 'allow-list': String(checked) })
      await queryClient.invalidateQueries({ queryKey: qk.serverProperties(server.id) })
      toast(
        'success',
        checked ? 'Allow list enabled' : 'Allow list disabled',
        checked
          ? running
            ? 'Bedrock checks the list when players join. Restart the server if a new entry is ignored.'
            : 'Bedrock checks the list the next time the server starts.'
          : 'Anyone with the server address can join again.'
      )
    } catch (error) {
      toast('error', 'Could not change the allow list', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const addMyAccount = async (): Promise<void> => {
    if (!account) {
      openModal('addAccountTab', 'microsoft')
      openModal('addAccount', true)
      return
    }
    if (!account.xuid) {
      toast(
        'error',
        'Xbox ID missing',
        'Refresh this Microsoft account from Accounts to load its Xbox ID, then try again.'
      )
      return
    }
    setBusyXuid(account.xuid)
    try {
      await window.newbie.servers.allowlistAdd(server.id, {
        name: account.gamertag ?? account.username,
        xuid: account.xuid
      })
      await refresh()
      toast(
        'success',
        'Player added',
        `${account.gamertag ?? account.username} can join this Bedrock server when the allow list is on.`
      )
    } catch (error) {
      toast('error', 'Could not add that player', errorMessage(error))
    } finally {
      setBusyXuid(null)
    }
  }

  const removeEntry = async (xuid: string): Promise<void> => {
    setBusyXuid(xuid)
    try {
      await window.newbie.servers.allowlistRemove(server.id, xuid)
      await refresh()
      toast('success', 'Player removed', 'The change applies on the next join or server restart.')
    } catch (error) {
      toast('error', 'Could not remove that player', errorMessage(error))
    } finally {
      setBusyXuid(null)
    }
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink">Allowed players</h2>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                Bedrock matches players by Xbox ID. The allow list only restricts joins while online mode is on.
              </p>
            </div>
            <Badge tone={allowListEnabled ? 'green' : 'neutral'}>
              {allowListEnabled ? 'Allow list on' : 'Allow list off'}
            </Badge>
          </div>
          <div className="mt-4">
            <Switch
              checked={allowListEnabled}
              onChange={(checked) => void toggleAllowList(checked)}
              label="Only allow listed players"
              description="Turns allow-list=true in server.properties. Changes apply on the next server start; Newbie reloads the list when the server is running."
            />
          </div>
          {saving && <p className="mt-2 text-[10px] text-muted/70">Saving…</p>}
          {!onlineMode && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold/25 bg-gold/[0.055] px-3 py-2.5 text-[10.5px] leading-relaxed text-gold">
              <WarningCircle size={14} className="shrink-0" />
              <span className="min-w-0 flex-1">
                Online mode is off, so Bedrock cannot verify Xbox identities and the allow list will not
                protect the server.
              </span>
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                Open settings
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink">Player list</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {entries.length} player{entries.length === 1 ? '' : 's'} allowed by Xbox ID.
              </p>
            </div>
            <Badge tone="neutral">{entries.length}</Badge>
          </div>
          {entries.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-line/70 p-4 text-center text-[11px] text-muted/70">
              No players yet. Add your Microsoft account or use the console command{' '}
              <span className="font-mono text-ink/80">allowlist add &lt;gamertag&gt;</span> while the server is
              running.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.xuid}
                  className="flex items-center gap-3 rounded-xl border border-line/45 bg-canvas/30 px-3 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-grass/20 bg-grass/10 text-grass">
                    <UserPlus size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-ink">{entry.name}</div>
                    <div className="font-mono text-[9.5px] text-muted/60">{entry.xuid}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyXuid === entry.xuid}
                    onClick={() => void removeEntry(entry.xuid)}
                    icon={<Trash size={13} />}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-grass" />
          <h2 className="font-display text-[13.5px] font-semibold text-ink">Your Microsoft account</h2>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
          Add the account you play Bedrock with. Minecraft for Windows uses the Microsoft account signed into
          the Xbox app; this list controls who may join the server.
        </p>
        {account ? (
          <>
            <div className="mt-3 rounded-xl border border-line/50 bg-canvas/30 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-ink">
                  {account.gamertag ?? account.username}
                </span>
                <Badge tone={accountAdded ? 'green' : 'neutral'}>
                  {accountAdded ? 'Allowed' : 'Not added'}
                </Badge>
              </div>
              <div className="mt-1 font-mono text-[9.5px] text-muted/60">
                {account.xuid ?? 'Xbox ID not loaded'}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={Boolean(account.xuid && busyXuid === account.xuid)}
                disabled={accountAdded || !account.xuid}
                onClick={() => void addMyAccount()}
                icon={<UserPlus size={14} />}
              >
                {accountAdded ? 'Already allowed' : 'Add my account'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void window.newbie.bedrock.openXbox().catch((error) => {
                  toast('error', 'Could not open the Xbox app', errorMessage(error))
                })}
                icon={<ArrowSquareOut size={14} />}
              >
                Open Xbox app
              </Button>
            </div>
            {!account.xuid && (
              <p className="mt-2 text-[10px] leading-relaxed text-gold">
                Refresh this account from Accounts to load its Xbox ID.
              </p>
            )}
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => void addMyAccount()}
            icon={<Plus size={14} />}
          >
            Add Microsoft account
          </Button>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-muted/60">
          To play with this account, sign in to the Xbox app with the same Microsoft account once. Newbie
          launches the installed Bedrock game normally.
        </p>
      </Card>
    </div>
  )
}

function ServerPerformanceCard({
  server,
  running,
  stats,
  refreshing,
  onRefresh
}: {
  server: ServerRecord
  running: boolean
  stats?: ServerStats
  refreshing: boolean
  onRefresh: () => void
}) {
  const tps = stats?.tps
  const tpsTone =
    tps === undefined ? 'text-muted' : tps >= 19.5 ? 'text-grass' : tps >= 15 ? 'text-gold' : 'text-danger'
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-grass/20 bg-grass/10 text-grass">
            <Gauge size={16} />
          </span>
          <div>
            <h2 className="font-display text-[14px] font-semibold text-ink">Performance</h2>
            <p className="mt-0.5 text-[10px] text-muted">
              TPS and online players sampled from the live console every 30 seconds.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <span className="text-[9.5px] text-muted/60">Updated {relativeTime(stats.sampledAt)}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            loading={refreshing}
            disabled={!running}
            onClick={onRefresh}
            icon={<ArrowsClockwise size={13} />}
          >
            Refresh
          </Button>
        </div>
      </div>
      {!running ? (
        <div className="mt-3 rounded-xl border border-dashed border-line/50 p-3 text-[11px] text-muted">
          Start the server to measure TPS and online players.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
          <div className="rounded-xl border border-line/45 bg-canvas/30 p-3">
            <div className="text-[9px] uppercase tracking-[0.1em] text-muted/60">TPS</div>
            <div className={cn('mt-0.5 font-display text-[30px] font-semibold leading-none', tpsTone)}>
              {tps === undefined ? '—' : tps.toFixed(1)}
            </div>
            <div className="mt-1 text-[9.5px] leading-relaxed text-muted/60">
              {tps === undefined
                ? stats?.message ?? 'Waiting for a sample…'
                : tps >= 19.5
                  ? 'Healthy'
                  : tps >= 15
                    ? 'Under load'
                    : 'Lagging'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="1 min" value={stats?.tps1m !== undefined ? stats.tps1m.toFixed(1) : '—'} />
            <Metric label="5 min" value={stats?.tps5m !== undefined ? stats.tps5m.toFixed(1) : '—'} />
            <Metric label="15 min" value={stats?.tps15m !== undefined ? stats.tps15m.toFixed(1) : '—'} />
            <Metric label="MSPT" value={stats?.mspt !== undefined ? stats.mspt.toFixed(2) : '—'} />
            <Metric
              label="Players"
              value={
                stats
                  ? `${stats.players.length}${stats.maxPlayers ? ` / ${stats.maxPlayers}` : ''}`
                  : '—'
              }
            />
            <Metric label="Server" value={serverTypeLabel(server.type)} />
          </div>
        </div>
      )}
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/40 bg-canvas/20 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-[0.08em] text-muted/55">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[11.5px] text-ink/85">{value}</div>
    </div>
  )
}

function ServerSettings({ server, running }: { server: ServerRecord; running: boolean }) {
  const queryClient = useQueryClient()
  const system = useSystemInfo().data
  const propertiesQuery = useServerProperties(server.id)
  const isBedrock = server.type === 'bedrock'
  const propertyGroups = isBedrock ? BEDROCK_PROPERTY_GROUPS : SERVER_PROPERTY_GROUPS
  const propertyFields = isBedrock ? BEDROCK_PROPERTY_FIELDS : SERVER_PROPERTY_FIELDS
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [name, setName] = useState(server.name)
  const [memoryMb, setMemoryMb] = useState(server.memoryMb)
  const [schedule, setSchedule] = useState<ServerRestartSchedule>(
    server.restartSchedule ?? { ...DEFAULT_RESTART_SCHEDULE }
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (propertiesQuery.data) setDraft(propertiesQuery.data)
  }, [propertiesQuery.data])

  useEffect(() => {
    setName(server.name)
    setMemoryMb(server.memoryMb)
    setSchedule(server.restartSchedule ?? { ...DEFAULT_RESTART_SCHEDULE })
  }, [server.name, server.memoryMb, server.restartSchedule])

  const runtimeDirty = name.trim() !== server.name || memoryMb !== server.memoryMb
  const scheduleDirty = useMemo(
    () =>
      JSON.stringify(schedule) !==
      JSON.stringify(server.restartSchedule ?? { ...DEFAULT_RESTART_SCHEDULE }),
    [schedule, server.restartSchedule]
  )
  const dirty = useMemo(
    () =>
      runtimeDirty ||
      scheduleDirty ||
      JSON.stringify(draft) !== JSON.stringify(propertiesQuery.data ?? {}),
    [runtimeDirty, scheduleDirty, draft, propertiesQuery.data]
  )

  const totalMem = system?.totalMemMb ?? 16384
  const maxMemory = Math.min(
    65536,
    Math.max(2048, Math.floor(totalMem * 0.75), server.memoryMb)
  )

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      if (runtimeDirty || scheduleDirty) {
        await window.newbie.servers.update(server.id, {
          ...(runtimeDirty ? { name: name.trim() || server.name, memoryMb } : {}),
          ...(scheduleDirty ? { restartSchedule: normalizeRestartSchedule(schedule) } : {})
        })
      }
      await window.newbie.servers.saveProperties(server.id, draft)
      await queryClient.invalidateQueries({ queryKey: qk.serverProperties(server.id) })
      await queryClient.invalidateQueries({ queryKey: qk.serverShare(server.id) })
      await queryClient.invalidateQueries({ queryKey: qk.server(server.id) })
      await queryClient.invalidateQueries({ queryKey: qk.servers })
      toast(
        'success',
        'Server settings saved',
        running ? 'Restart the server to apply the changes.' : 'They will be used the next time the server starts.'
      )
    } catch (error) {
      toast('error', 'Could not save server settings', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: string): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const nextDisplay =
    running && !scheduleDirty
      ? server.restartSchedule?.nextRestartAt
      : nextRestartAt(schedule)

  if (propertiesQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-display text-[14px] font-semibold text-ink">Server settings</h2>
          <p className="mt-0.5 text-[10.5px] text-muted">
            Runtime options, gameplay, world and security settings — no text files to edit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[10.5px] text-gold">Unsaved changes</span>}
          <Button variant="primary" size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>
            Save settings
          </Button>
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="font-display text-[13px] font-semibold text-ink">Server runtime</h3>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted/70">
          Launcher options. Memory changes apply after a restart.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11.5px] font-medium text-ink">Server name</div>
            <div className="mt-0.5 text-[10px] leading-relaxed text-muted/75">
              Shown in the launcher. The folder name stays the same.
            </div>
            <div className="mt-1.5">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                aria-label="Server name"
              />
            </div>
          </div>
          {!isBedrock && (
            <Field
              label="Memory"
              hint={`${(memoryMb / 1024).toFixed(1)} GB of ${(totalMem / 1024).toFixed(0)} GB`}
            >
              <input
                type="range"
                min={1024}
                max={maxMemory}
                step={256}
                value={memoryMb}
                onChange={(event) => setMemoryMb(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--grass))]"
                aria-label="Server memory"
              />
            </Field>
          )}
        </div>
        <p className="mt-3 text-[10px] text-muted/60">
          {isBedrock
            ? `Bedrock Dedicated Server · no Java required · server folder ${server.id}`
            : `Java ${server.javaMajor} managed automatically · server folder ${server.id} · ${serverTypeLabel(server.type)} ${server.versionId}`}
        </p>
      </Card>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-[13px] font-semibold text-ink">Scheduled restarts</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted/70">
              Restart automatically while the server is running. Newbie must stay open, and the server must be online
              when the timer is due.
            </p>
          </div>
          <Switch
            checked={schedule.enabled}
            onChange={(enabled) => setSchedule((current) => ({ ...current, enabled }))}
            label="Automatic restarts"
            hideLabel
          />
        </div>

        {schedule.enabled && (
          <div className="mt-4 space-y-3">
            <Segmented
              value={schedule.mode}
              onChange={(mode) => setSchedule((current) => ({ ...current, mode }))}
              size="sm"
              options={[
                { value: 'interval', label: 'Every few hours' },
                { value: 'daily', label: 'Daily at' }
              ]}
            />
            {schedule.mode === 'interval' ? (
              <div>
                <div className="text-[11.5px] font-medium text-ink">Interval</div>
                <div className="mt-0.5 text-[10px] text-muted/75">
                  The timer restarts when you start the server manually.
                </div>
                <div className="mt-1.5">
                  <Select
                    value={String(schedule.intervalMinutes)}
                    onChange={(value) =>
                      setSchedule((current) => ({
                        ...current,
                        intervalMinutes: Number(value)
                      }))
                    }
                  >
                    {[30, 60, 120, 240, 360, 720, 1440].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {restartIntervalLabel(minutes)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[11.5px] font-medium text-ink">Restart time</div>
                <div className="mt-0.5 text-[10px] text-muted/75">Local time on this PC.</div>
                <div className="mt-1.5">
                  <Input
                    type="time"
                    value={schedule.time}
                    onChange={(event) =>
                      setSchedule((current) => ({ ...current, time: event.target.value }))
                    }
                  />
                </div>
              </div>
            )}
            <div className="rounded-lg border border-line/45 bg-canvas/30 px-3 py-2 text-[10.5px] text-muted">
              <span className="text-ink/80">Next restart:</span>{' '}
              {formatRestartTime(nextDisplay)}
              {!running && ' · starts counting when the server runs'}
              {server.restartSchedule?.lastRestartAt && (
                <span className="ml-2 text-muted/60">
                  Last: {formatRestartTime(server.restartSchedule.lastRestartAt)}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
      {running && (
        <div className="rounded-xl border border-gold/20 bg-gold/[0.035] p-3 text-[10.5px] leading-relaxed text-gold/85">
          The server is running. Most changes apply after a restart; use Restart in the header when you are ready.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {propertyGroups.map((group) => (
          <Card key={group.value} className="p-4">
            <h3 className="font-display text-[13px] font-semibold text-ink">{group.label}</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted/70">{group.description}</p>
            <div className="mt-3 space-y-3">
              {propertyFields
                .filter((field) => field.group === group.value)
                .map((field) => (
                  <PropertyControl
                    key={field.key}
                    field={field}
                    value={draft[field.key] ?? ''}
                    onChange={(value) => set(field.key, value)}
                  />
                ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PropertyControl({
  field,
  value,
  onChange
}: {
  field: ServerPropertyField
  value: string
  onChange: (value: string) => void
}) {
  if (field.kind === 'boolean') {
    return (
      <Switch
        checked={value === 'true'}
        onChange={(checked) => onChange(String(checked))}
        label={field.label}
        description={field.description}
      />
    )
  }
  return (
    <div>
      <div className="text-[11.5px] font-medium text-ink">{field.label}</div>
      <div className="mt-0.5 text-[10px] leading-relaxed text-muted/75">{field.description}</div>
      <div className="mt-1.5">
        {field.kind === 'select' ? (
          <Select value={value} onChange={onChange}>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : field.kind === 'number' ? (
          <Input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <Input value={value} onChange={(event) => onChange(event.target.value)} />
        )}
      </div>
    </div>
  )
}

function ServerAddons({ server, running }: { server: ServerRecord; running: boolean }) {
  const queryClient = useQueryClient()
  const askConfirm = useUi((state) => state.askConfirm)
  const availableTypes: ServerAddonType[] = serverSupportsAddon(server.type, 'plugin')
    ? ['plugin', 'datapack']
    : serverSupportsAddon(server.type, 'mod')
      ? ['mod', 'datapack']
      : ['datapack']
  const [type, setType] = useState<ServerAddonType>(availableTypes[0]!)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 380)
    return () => clearTimeout(timer)
  }, [search])

  const query = useMemo(
    () => ({ serverId: server.id, type, query: debounced, limit: 24, offset: 0 }),
    [server.id, type, debounced]
  )
  const results = useServerSearch(query)
  const installed = server.addons
  const installedIds = new Set(installed.map((addon) => addon.projectId))
  const pendingUpdates = installed.filter(
    (addon) => addon.latestVersionId && addon.latestVersionId !== addon.versionId
  )

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.server(server.id) })
    await queryClient.invalidateQueries({ queryKey: qk.servers })
  }

  const install = async (hit: ModrinthHit): Promise<void> => {
    if (running) {
      toast('info', 'Stop the server first', 'New plugins and mods are loaded when the server starts.')
      return
    }
    setInstalling(hit.project_id)
    try {
      await window.newbie.servers.installAddon(server.id, {
        projectId: hit.project_id,
        type
      })
      await refresh()
      toast('success', 'Add-on installed', `${hit.title} was added to ${server.name}`)
    } catch (error) {
      toast('error', 'Install failed', errorMessage(error))
    } finally {
      setInstalling(null)
    }
  }

  const checkUpdates = async (): Promise<void> => {
    setUpdating(true)
    try {
      await window.newbie.servers.checkAddonUpdates(server.id)
      await refresh()
      toast('success', 'Checked for updates')
    } catch (error) {
      toast('error', 'Update check failed', errorMessage(error))
    } finally {
      setUpdating(false)
    }
  }

  const updateAll = async (): Promise<void> => {
    if (running) {
      toast('info', 'Stop the server first', 'Add-ons cannot be replaced while the server is running.')
      return
    }
    setUpdating(true)
    try {
      await window.newbie.servers.updateAllAddons(server.id)
      await refresh()
      toast('success', 'Server add-ons updated')
    } catch (error) {
      toast('error', 'Update failed', errorMessage(error))
    } finally {
      setUpdating(false)
    }
  }

  const remove = (record: ServerAddonRecord): void => {
    askConfirm({
      title: `Remove ${record.name}?`,
      description: 'The file will be removed from the server folder.',
      confirmLabel: 'Remove add-on',
      danger: true,
      action: async () => {
        await window.newbie.servers.removeAddon(server.id, record.id, true)
        await refresh()
      }
    })
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="min-w-0 space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink">Find {type}s</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {type === 'datapack'
                  ? "Installed into the world's datapacks folder."
                  : `Installed directly into ${type === 'plugin' ? 'plugins' : 'mods'}/.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Segmented
                value={type}
                onChange={(value) => {
                  setType(value)
                  setSearch('')
                  setDebounced('')
                }}
                options={availableTypes.map((value) => ({ value, label: addonTypeLabel(value) }))}
              />
            </div>
          </div>
          <div className="mt-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search Modrinth ${type}s…`}
              aria-label={`Search ${type}s`}
            />
          </div>
          <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {results.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : results.data?.hits.length ? (
              results.data.hits.map((hit) => (
                <div
                  key={hit.project_id}
                  className="flex items-center gap-3 rounded-xl border border-line/45 bg-canvas/25 p-2.5"
                >
                  <ProjectIcon url={hit.icon_url ?? undefined} name={hit.title} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-ink">{hit.title}</div>
                    <div className="truncate text-[10px] text-muted/75">{hit.description}</div>
                  </div>
                  <Button
                    variant={installedIds.has(hit.project_id) ? 'ghost' : 'secondary'}
                    size="sm"
                    disabled={running || installedIds.has(hit.project_id) || installing === hit.project_id}
                    loading={installing === hit.project_id}
                    onClick={() => void install(hit)}
                    icon={installedIds.has(hit.project_id) ? <CheckCircle size={14} /> : <Plus size={14} />}
                  >
                    {installedIds.has(hit.project_id) ? 'Installed' : 'Install'}
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-line/50 p-4 text-[11px] text-muted">
                No {type}s found for {server.versionId}.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink">Installed add-ons</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {server.addons.length} installed ·{' '}
                {serverSupportsAddon(server.type, 'plugin')
                  ? 'plugins load from plugins/, datapacks from the world folder'
                  : serverSupportsAddon(server.type, 'mod')
                    ? 'mods load from mods/, datapacks from the world folder'
                    : 'datapacks load from the world folder'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" loading={updating} onClick={() => void checkUpdates()}>
                Check updates
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={updating}
                disabled={pendingUpdates.length === 0 || running}
                onClick={() => void updateAll()}
              >
                {pendingUpdates.length > 0 ? `Update ${pendingUpdates.length}` : 'Up to date'}
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {server.addons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line/50 p-4 text-[11px] text-muted">
                No add-ons installed yet. Search Modrinth above.
              </div>
            ) : (
              server.addons.map((record) => (
                <ServerAddonRow
                  key={record.id}
                  record={record}
                  running={running}
                  onToggle={async (enabled) => {
                    try {
                      await window.newbie.servers.toggleAddon(server.id, record.id, enabled)
                      await refresh()
                    } catch (error) {
                      toast('error', 'Could not toggle add-on', errorMessage(error))
                    }
                  }}
                  onUpdate={async () => {
                    if (running) return
                    try {
                      await window.newbie.servers.installAddon(server.id, {
                        projectId: record.projectId,
                        versionId: record.latestVersionId,
                        type: record.type
                      })
                      await refresh()
                    } catch (error) {
                      toast('error', 'Update failed', errorMessage(error))
                    }
                  }}
                  onRemove={() => remove(record)}
                />
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 text-[10.5px] leading-relaxed text-muted/75">
          <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
            <Package size={14} className="text-grass/80" /> Server add-ons
          </div>
          <p className="mt-1.5">
            {serverSupportsAddon(server.type, 'plugin')
              ? 'Paper loads plugins and datapacks. Stop the server before installing or updating plugins.'
              : serverSupportsAddon(server.type, 'mod')
                ? 'Fabric, Forge, NeoForge and Quilt load mods and datapacks. Stop the server before changing them.'
                : 'Vanilla servers load datapacks only. They are installed inside the world folder.'}
          </p>
          <p className="mt-2">
            Modrinth required dependencies are resolved automatically. One-click updates replace only the add-on files;
            worlds and settings stay in place.
          </p>
        </Card>
      </div>
    </div>
  )
}

function ServerAddonRow({
  record,
  running,
  onToggle,
  onUpdate,
  onRemove
}: {
  record: ServerAddonRecord
  running: boolean
  onToggle: (enabled: boolean) => Promise<void>
  onUpdate: () => Promise<void>
  onRemove: () => void
}) {
  const updateAvailable = Boolean(record.latestVersionId && record.latestVersionId !== record.versionId)
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line/45 bg-canvas/25 p-2.5">
      <ProjectIcon url={record.iconUrl} name={record.name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[11.5px] font-medium text-ink">{record.name}</span>
          <Badge tone="neutral" className="h-4 px-1.5 text-[8px]">
            {addonTypeLabel(record.type)}
          </Badge>
          {updateAvailable && <Badge tone="green" className="h-4 px-1.5 text-[8px]">Update</Badge>}
          {!record.enabled && <Badge tone="gold" className="h-4 px-1.5 text-[8px]">Disabled</Badge>}
        </div>
        <div className="mt-0.5 text-[9.5px] text-muted/70">
          {record.versionNumber} · {formatBytes(record.size)}
        </div>
      </div>
      {updateAvailable && (
        <IconButton label={`Update ${record.name}`} disabled={running} onClick={() => void onUpdate()}>
          <ArrowsClockwise size={14} className="text-grass/80" />
        </IconButton>
      )}
      <Switch
        size="sm"
        hideLabel
        checked={record.enabled}
        disabled={running}
        onChange={() => void onToggle(!record.enabled)}
        label={`Toggle ${record.name}`}
      />
      <IconButton label={`Remove ${record.name}`} disabled={running} onClick={onRemove}>
        <Trash size={14} className="text-danger/80" />
      </IconButton>
    </div>
  )
}
