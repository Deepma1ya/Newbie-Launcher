import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowsClockwise,
  CaretRight,
  CheckCircle,
  FolderOpen,
  HardDrives,
  Package,
  PaperPlaneTilt,
  Plus,
  Stop,
  Trash,
  WarningCircle
} from '@phosphor-icons/react'
import type {
  ModrinthHit,
  ServerAddonRecord,
  ServerAddonType,
  ServerRecord,
  ServerRuntimeStatus
} from '@shared/types'
import {
  SERVER_PROPERTY_FIELDS,
  SERVER_PROPERTY_GROUPS,
  type ServerPropertyField
} from '@shared/serverProperties'
import {
  serverSupportsAddon,
  serverTypeLabel
} from '@shared/serverTypes'
import {
  useServer,
  useServerLogs,
  useServerProperties,
  useServerSearch,
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

type Tab = 'console' | 'settings' | 'addons'

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
        <WarningCircle size={13} className="text-gold/70" />
        <span className="text-[10.5px] text-muted/65">
          Keep Newbie running while the server is on. Servers stop when you quit the launcher.
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'console', label: 'Console', icon: <PaperPlaneTilt size={14} /> },
            { value: 'settings', label: 'Settings', icon: <HardDrives size={14} /> },
            { value: 'addons', label: `Add-ons ${server.addons.length}`, icon: <Package size={14} /> }
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
      {tab === 'settings' && <ServerSettings server={server} running={running} />}
      {tab === 'addons' && <ServerAddons server={server} running={running} />}
    </div>
  )
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
  const [command, setCommand] = useState('')
  const [sending, setSending] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
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

  return (
    <div className="space-y-3">
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
            {['list', 'save-all', 'whitelist list'].map((quick) => (
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
  )
}

function ServerSettings({ server, running }: { server: ServerRecord; running: boolean }) {
  const queryClient = useQueryClient()
  const system = useSystemInfo().data
  const propertiesQuery = useServerProperties(server.id)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [name, setName] = useState(server.name)
  const [memoryMb, setMemoryMb] = useState(server.memoryMb)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (propertiesQuery.data) setDraft(propertiesQuery.data)
  }, [propertiesQuery.data])

  useEffect(() => {
    setName(server.name)
    setMemoryMb(server.memoryMb)
  }, [server.name, server.memoryMb])

  const runtimeDirty = name.trim() !== server.name || memoryMb !== server.memoryMb
  const dirty = useMemo(
    () =>
      runtimeDirty ||
      JSON.stringify(draft) !== JSON.stringify(propertiesQuery.data ?? {}),
    [runtimeDirty, draft, propertiesQuery.data]
  )

  const totalMem = system?.totalMemMb ?? 16384
  const maxMemory = Math.min(
    65536,
    Math.max(2048, Math.floor(totalMem * 0.75), server.memoryMb)
  )

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      if (runtimeDirty) {
        await window.newbie.servers.update(server.id, {
          name: name.trim() || server.name,
          memoryMb
        })
      }
      await window.newbie.servers.saveProperties(server.id, draft)
      await queryClient.invalidateQueries({ queryKey: qk.serverProperties(server.id) })
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
        </div>
        <p className="mt-3 text-[10px] text-muted/60">
          Java {server.javaMajor} managed automatically · server folder {server.id} · {serverTypeLabel(server.type)}{' '}
          {server.versionId}
        </p>
      </Card>
      {running && (
        <div className="rounded-xl border border-gold/20 bg-gold/[0.035] p-3 text-[10.5px] leading-relaxed text-gold/85">
          The server is running. Most changes apply after a restart; use Restart in the header when you are ready.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {SERVER_PROPERTY_GROUPS.map((group) => (
          <Card key={group.value} className="p-4">
            <h3 className="font-display text-[13px] font-semibold text-ink">{group.label}</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted/70">{group.description}</p>
            <div className="mt-3 space-y-3">
              {SERVER_PROPERTY_FIELDS.filter((field) => field.group === group.value).map((field) => (
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
