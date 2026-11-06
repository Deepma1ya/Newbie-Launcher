import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowsClockwise,
  Copy,
  Cpu,
  Cube,
  FolderOpen,
  HardDrives,
  MagnifyingGlass,
  MapTrifold,
  Monitor,
  Package,
  Plus,
  SquaresFour,
  TerminalWindow,
  Trash,
  UsersThree,
  WarningCircle,
  Wrench
} from '@phosphor-icons/react'
import type { Instance, LoaderType, PerformancePreset } from '@shared/types'
import type { AddonBulkFilter } from '@shared/addonBulk'
import { JAVA_MAJORS } from '@shared/constants'
import { findTlsCapeArtifact } from '@shared/tlskincape'
import {
  useAccounts,
  useBackups,
  useDiskUsage,
  useInstance,
  useInstances,
  useJavaRuntimes,
  useLoaderVersions,
  useMinecraftVersions,
  useSettings,
  useSystemInfo,
  useTasks,
  qk
} from '../hooks/queries'
import { useUi, toast } from '../store/ui'
import { errorMessage, formatBytes, formatPlaytime, loaderLabel, relativeTime } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { PlayButton } from '../components/PlayButton'
import { AddonRow } from '../components/AddonRow'
import { AddonSelectionBar } from '../components/AddonSelectionBar'
import { DeleteAllAddonsButton } from '../components/DeleteAllAddonsButton'
import { LoadoutCard } from '../components/LoadoutCard'
import { CopySettingsModal } from '../components/modals/CopySettingsModal'
import { PackTransferModal } from '../components/modals/PackTransferModal'
import { TlsCapeBadge } from '../components/TlsCapeBadge'
import { BlockIcon } from '../components/ui/BlockIcon'
import { Badge, Card, EmptyState, Field, Input, Progress, Segmented, Select, Skeleton, Switch } from '../components/ui/primitives'
import { Button, IconButton } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'

type Tab = 'overview' | 'addons' | 'loadouts' | 'settings'
type AddonFilter = AddonBulkFilter

export function InstancePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const instanceQuery = useInstance(id)
  const instance = instanceQuery.data
  const tasks = useUi((state) => state.tasks)
  const running = useUi((state) => state.running.some((entry) => entry.instanceId === id))
  const openModal = useUi((state) => state.openModal)
  const askConfirm = useUi((state) => state.askConfirm)
  const setActiveInstance = useUi((state) => state.setActiveInstance)
  const [tab, setTab] = useState<Tab>('overview')
  const [addonQuery, setAddonQuery] = useState('')
  const [addonFilter, setAddonFilter] = useState<AddonFilter>('all')
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  const [changeVersionOpen, setChangeVersionOpen] = useState(false)
  const [packOpen, setPackOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [scanning, setScanning] = useState(false)
  const backups = useBackups(id).data ?? []
  const disk = useDiskUsage().data?.instances.find((entry) => entry.id === id)

  useEffect(() => {
    setSelectedAddons(new Set())
  }, [id])

  useEffect(() => {
    setSelectedAddons(new Set())
  }, [addonFilter, addonQuery])

  useEffect(() => {
    if (!instance && !instanceQuery.isLoading) {
      navigate('/instances', { replace: true })
    }
  }, [instance, instanceQuery.isLoading, navigate])

  useEffect(() => {
    if (instance) setActiveInstance(instance.id)
  }, [instance?.id, setActiveInstance])

  if (instanceQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!instance) return null

  const activeTask = Object.values(tasks)
    .filter((task) => task.instanceId === id && task.status === 'running')
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  const addonCounts = {
    all: instance.addons.length,
    mod: instance.addons.filter((addon) => addon.type === 'mod').length,
    datapack: instance.addons.filter((addon) => addon.type === 'datapack').length,
    resourcepack: instance.addons.filter((addon) => addon.type === 'resourcepack').length,
    shader: instance.addons.filter((addon) => addon.type === 'shader').length
  }
  const pendingUpdates = instance.addons.filter(
    (addon) => addon.latestVersionId && addon.latestVersionId !== addon.versionId
  ).length

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.instance(instance.id) })
    await queryClient.invalidateQueries({ queryKey: qk.instances })
  }

  const updateAll = async (): Promise<void> => {
    setUpdating(true)
    try {
      await window.newbie.addons.updateAll(instance.id)
      await refresh()
      toast('success', 'Add-ons updated', `${instance.name} is up to date`)
    } catch (error) {
      toast('error', 'Update failed', errorMessage(error))
    } finally {
      setUpdating(false)
    }
  }

  const scan = async (): Promise<void> => {
    setScanning(true)
    try {
      const found = await window.newbie.addons.scan(instance.id)
      await refresh()
      toast('success', 'Scan complete', `${found.length} new add-on(s) matched`)
    } catch (error) {
      toast('error', 'Scan failed', errorMessage(error))
    } finally {
      setScanning(false)
    }
  }

  const remove = (): void => {
    askConfirm({
      title: `Delete ${instance.name}?`,
      description: 'Worlds, add-ons and loadouts in this instance will be permanently removed.',
      confirmLabel: 'Delete instance',
      danger: true,
      action: async () => {
        await window.newbie.instances.remove(instance.id, true)
        if (useUi.getState().activeInstanceId === instance.id) setActiveInstance(null)
        await queryClient.invalidateQueries({ queryKey: qk.instances })
        toast('success', 'Instance deleted', instance.name)
        navigate('/instances')
      }
    })
  }

  const filteredAddons = instance.addons.filter((addon) => {
    if (addonFilter !== 'all' && addon.type !== addonFilter) return false
    if (addonQuery && !addon.name.toLowerCase().includes(addonQuery.toLowerCase())) return false
    return true
  })
  const visibleAddonIds = filteredAddons.map((addon) => addon.id)

  const toggleAddonSelection = (addonId: string, on: boolean): void => {
    setSelectedAddons((previous) => {
      const next = new Set(previous)
      if (on) next.add(addonId)
      else next.delete(addonId)
      return next
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate('/instances')} className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-ink">
          <ArrowLeft size={13} /> Instances
        </button>
        <span className="text-muted/40">/</span>
        <span className="truncate text-[11.5px] text-muted">{instance.name}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <BlockIcon name={instance.name} color={instance.color} iconUrl={instance.iconUrl} size={58} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-[26px] font-semibold tracking-[-0.025em] text-ink">{instance.name}</h1>
              {running && <Badge tone="green"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" />Live</Badge>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <Badge tone="neutral">{loaderLabel(instance.loader)}</Badge>
              <Badge tone="neutral">{instance.versionId}</Badge>
              <TlsCapeBadge loader={instance.loader} versionId={instance.versionId} />
              <span>{instance.addons.length} add-ons</span>
              <span className="h-0.5 w-0.5 rounded-full bg-muted/50" />
              <span>{disk ? formatBytes(disk.mb * 1024 * 1024) : '—'}</span>
              <span className="h-0.5 w-0.5 rounded-full bg-muted/50" />
              <span>{formatPlaytime(instance.totalPlayTimeSec)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlayButton instance={instance} size="md" className="min-w-[110px]" />
          <Button variant="secondary" onClick={() => openModal('console', { instanceId: instance.id })} icon={<TerminalWindow size={15} />}>
            Console
          </Button>
          <Button variant="ghost" onClick={() => openModal('repair', { instanceId: instance.id })} icon={<Wrench size={15} />}>
            Repair
          </Button>
        </div>
      </div>

      {activeTask && (
        <Card className="mb-5 p-4">
          <div className="flex items-center justify-between gap-4 text-[12px]">
            <div className="flex items-center gap-2">
              <ArrowsClockwise size={15} className="animate-spin text-grass" />
              <span className="font-medium text-ink">{activeTask.title}</span>
              <span className="text-muted">{activeTask.stage}</span>
            </div>
            <span className="text-muted">{Math.round(activeTask.percent)}%</span>
          </div>
          <Progress value={activeTask.percent} className="mt-2.5" />
        </Card>
      )}

      <div className="mb-5 flex items-center justify-between gap-3 border-b border-line/40 pb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Overview', icon: <Cube size={14} /> },
            { value: 'addons', label: `Add-ons ${instance.addons.length}`, icon: <Package size={14} /> },
            { value: 'loadouts', label: `Loadouts ${instance.loadouts.length}`, icon: <SquaresFour size={14} /> },
            { value: 'settings', label: 'Settings', icon: <Wrench size={14} /> }
          ]}
        />
        <div className="flex items-center gap-2">
          {pendingUpdates > 0 && (
            <Button variant="subtle" size="sm" loading={updating} onClick={() => void updateAll()} icon={<ArrowsClockwise size={14} />}>
              {pendingUpdates} update{pendingUpdates === 1 ? '' : 's'}
            </Button>
          )}
          <IconButton label="Share or copy this instance" onClick={() => setPackOpen(true)}>
            <UsersThree size={16} />
          </IconButton>
          <IconButton label="Open instance folder" onClick={() => void window.newbie.instances.openFolder(instance.id)}>
            <FolderOpen size={16} />
          </IconButton>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-[15px] font-semibold text-ink">Instance details</h2>
                  <p className="mt-0.5 text-[11.5px] text-muted">Shared libraries, per-instance worlds.</p>
                </div>
                <Badge tone={instance.loader === 'vanilla' ? 'neutral' : 'green'}>{loaderLabel(instance.loader)}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Detail label="Minecraft" value={instance.versionId} />
                <Detail label="Loader" value={instance.loaderVersion ? `${loaderLabel(instance.loader)} ${instance.loaderVersion}` : loaderLabel(instance.loader)} />
                <Detail label="Memory" value={`${(instance.memoryMb / 1024).toFixed(1)} GB`} />
                <Detail label="Resolution" value={`${instance.width} × ${instance.height}`} />
                <Detail label="Created" value={relativeTime(instance.createdAt)} />
                <Detail label="Last played" value={relativeTime(instance.lastPlayedAt)} />
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4">
                <h2 className="font-display text-[15px] font-semibold text-ink">Active loadout</h2>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  Switch between different mod sets without reinstalling the game.
                </p>
              </div>
              {instance.loadouts
                .filter((loadout) => loadout.id === instance.activeLoadoutId)
                .map((loadout) => (
                  <LoadoutCard key={loadout.id} loadout={loadout} instance={instance} onChanged={() => void refresh()} />
                ))}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openModal('loadout', { instanceId: instance.id })} icon={<Plus size={14} />}>
                  New loadout
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTab('loadouts')}>
                  Manage all
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4">
                <h2 className="font-display text-[15px] font-semibold text-ink">Quick actions</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ActionButton icon={<Wrench size={16} />} title="Repair instance" text="Duplicates, loader conflicts, dependencies" onClick={() => openModal('repair', { instanceId: instance.id })} />
                <ActionButton icon={<ArrowsClockwise size={16} />} title="Update all add-ons" text={pendingUpdates ? `${pendingUpdates} update(s) available` : 'Check Modrinth'} onClick={() => void updateAll()} loading={updating} />
                <ActionButton icon={<Package size={16} />} title="Scan local files" text="Match jars you added manually" onClick={() => void scan()} loading={scanning} />
                <ActionButton icon={<HardDrives size={16} />} title="Backup worlds" text="Create a restore point now" onClick={async () => { try { await window.newbie.system.createBackup(instance.id); toast('success', 'World backup created'); await queryClient.invalidateQueries({ queryKey: qk.backups(instance.id) }) } catch (error) { toast('error', 'Backup failed', errorMessage(error)) } }} />
                <ActionButton icon={<FolderOpen size={16} />} title="Open game folder" text="Worlds, mods, configs and logs" onClick={() => void window.newbie.instances.openFolder(instance.id)} />
                <ActionButton icon={<MapTrifold size={16} />} title="Browse maps" text="Download Java worlds into saves" onClick={() => navigate(`/browse?type=world&instance=${instance.id}`)} />
                <ActionButton icon={<Monitor size={16} />} title="Change version" text="Move to another Minecraft version" onClick={() => setChangeVersionOpen(true)} />
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-display text-[15px] font-semibold text-ink">Health</h2>
              <div className="mt-4 space-y-3">
                <HealthRow label="Enabled add-ons" value={`${instance.addons.filter((addon) => addon.enabled).length}/${instance.addons.length}`} ok />
                <HealthRow label="Updates available" value={String(pendingUpdates)} ok={pendingUpdates === 0} />
                <HealthRow label="Loadouts" value={String(instance.loadouts.length)} ok />
                <HealthRow label="World backups" value={String(backups.length)} ok={backups.length > 0} />
              </div>
              <Button variant="secondary" fullWidth className="mt-4" onClick={() => openModal('repair', { instanceId: instance.id })} icon={<Wrench size={15} />}>
                Run health check
              </Button>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[15px] font-semibold text-ink">Recent backups</h2>
                <button onClick={() => void window.newbie.app.showItem(backups[0]?.path ?? instance.gameDir)} className="text-[10.5px] text-muted hover:text-ink">
                  Reveal
                </button>
              </div>
              <div className="mt-3 space-y-1.5">
                {backups.length === 0 && <div className="text-[11.5px] text-muted">No world backups yet.</div>}
                {backups.slice(0, 4).map((backup) => (
                  <div key={backup.path} className="flex items-center justify-between gap-2 rounded-lg border border-line/40 bg-canvas/25 px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[10px] text-ink/80">{backup.filename}</div>
                      <div className="text-[9.5px] text-muted/65">{relativeTime(backup.createdAt)}</div>
                    </div>
                    <span className="shrink-0 text-[9.5px] text-muted">{formatBytes(backup.size)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-danger/20 p-5">
              <h2 className="font-display text-[14px] font-semibold text-danger/90">Danger zone</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Delete this instance and everything inside it. Shared libraries and the add-on cache are kept.
              </p>
              <Button variant="danger" size="sm" className="mt-3" onClick={remove} icon={<Trash size={14} />}>
                Delete instance
              </Button>
            </Card>
          </div>
        </div>
      )}

      {tab === 'addons' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={addonQuery} onChange={(event) => setAddonQuery(event.target.value)} placeholder="Search installed add-ons…" className="pl-9" />
            </div>
            <Segmented
              value={addonFilter}
              onChange={setAddonFilter}
              options={[
                { value: 'all', label: `All ${addonCounts.all}` },
                { value: 'mod', label: `Mods ${addonCounts.mod}` },
                { value: 'datapack', label: `Datapacks ${addonCounts.datapack}` },
                { value: 'resourcepack', label: `Packs ${addonCounts.resourcepack}` },
                { value: 'shader', label: `Shaders ${addonCounts.shader}` }
              ]}
            />
            <Button variant="primary" size="sm" onClick={() => navigate(`/browse?instance=${instance.id}`)} icon={<Plus size={14} />}>
              Add
            </Button>
            <Button variant="secondary" size="sm" loading={scanning} onClick={() => void scan()} icon={<Package size={14} />}>
              Scan
            </Button>
            <DeleteAllAddonsButton
              instance={instance}
              addons={instance.addons}
              filter={addonFilter}
              onChanged={refresh}
            />
          </div>
          <AddonSelectionBar
            instance={instance}
            addons={instance.addons}
            selectedIds={selectedAddons}
            visibleIds={visibleAddonIds}
            onClear={() => setSelectedAddons(new Set())}
            onSelectAll={() => setSelectedAddons(new Set(visibleAddonIds))}
            onChanged={refresh}
          />
          {filteredAddons.length === 0 ? (
            <EmptyState
              icon={<Package size={22} />}
              title={instance.addons.length === 0 ? 'No add-ons yet' : 'Nothing matches'}
              description="Browse Modrinth, or scan local jars you already placed in the mods folder."
              action={<Button variant="primary" onClick={() => navigate(`/browse?instance=${instance.id}`)} icon={<Plus size={15} />}>Browse add-ons</Button>}
            />
          ) : (
            <div className="space-y-1.5">
              {filteredAddons.map((addon) => (
                <AddonRow
                  key={addon.id}
                  record={addon}
                  instance={instance}
                  onChanged={() => void refresh()}
                  selected={selectedAddons.has(addon.id)}
                  onSelectedChange={(on) => toggleAddonSelection(addon.id, on)}
                />
              ))}
            </div>
          )}

          <Card className="mt-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-grass/20 bg-grass/10 text-grass">
                  <UsersThree size={16} />
                </span>
                <div>
                  <h2 className="font-display text-[13.5px] font-semibold text-ink">Share or move this pack</h2>
                  <p className="mt-0.5 max-w-xl text-[10.5px] leading-relaxed text-muted">
                    Bundle every enabled mod, resource pack, datapack and shader into a standard `.mrpack`, create a
                    temporary download link, or copy the files to another instance.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPackOpen(true)}
                icon={<UsersThree size={14} />}
              >
                Share or copy
              </Button>
            </div>
            <p className="mt-2 text-[9.5px] text-muted/55">
              Worlds, configs, accounts and disabled add-ons are never included.
            </p>
          </Card>
        </div>
      )}

      {tab === 'loadouts' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-[12px] leading-relaxed text-muted">
              Loadouts apply a selected set of add-ons. Use an offline backup to keep every file cached, or download on
              switch to save disk space.
            </p>
            <Button variant="primary" size="sm" onClick={() => openModal('loadout', { instanceId: instance.id })} icon={<Plus size={14} />}>
              New loadout
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {instance.loadouts.map((loadout) => (
              <LoadoutCard key={loadout.id} loadout={loadout} instance={instance} onChanged={() => void refresh()} />
            ))}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <InstanceSettings instance={instance} onChanged={() => void refresh()} onChangeVersion={() => setChangeVersionOpen(true)} />
      )}

      <ChangeVersionModal
        open={changeVersionOpen}
        onClose={() => setChangeVersionOpen(false)}
        instanceId={instance.id}
        currentVersion={instance.versionId}
        currentLoader={instance.loader}
        onChanged={async () => {
          await refresh()
          setChangeVersionOpen(false)
        }}
      />

      <PackTransferModal
        open={packOpen}
        onClose={() => setPackOpen(false)}
        source={instance}
      />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/40 bg-canvas/25 px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.08em] text-muted/65">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-medium text-ink/90">{value}</div>
    </div>
  )
}

function HealthRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11.5px]">
      <span className="text-muted">{label}</span>
      <span className={ok ? 'font-medium text-grass/90' : 'font-medium text-gold'}>{value}</span>
    </div>
  )
}

function ActionButton({
  icon,
  title,
  text,
  onClick,
  loading
}: {
  icon: React.ReactNode
  title: string
  text: string
  onClick: () => void
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-start gap-2.5 rounded-xl border border-line/45 bg-canvas/25 p-3 text-left transition-colors hover:border-grass/25 hover:bg-grass/[0.02] disabled:opacity-50"
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-grass/80">
        {loading ? <ArrowsClockwise size={14} className="animate-spin" /> : icon}
      </span>
      <span>
        <span className="block text-[11.5px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">{text}</span>
      </span>
    </button>
  )
}

function InstanceSettings({
  instance,
  onChanged,
  onChangeVersion
}: {
  instance: Instance
  onChanged: () => void
  onChangeVersion: () => void
}) {
  const queryClient = useQueryClient()
  const java = useJavaRuntimes().data ?? []
  const system = useSystemInfo().data
  const settings = useSettings().data
  const accounts = useAccounts().data ?? []
  const activeAccount = accounts.find((entry) => entry.active) ?? accounts[0]
  const [name, setName] = useState(instance.name)
  const [memory, setMemory] = useState(instance.memoryMb)
  const [width, setWidth] = useState(String(instance.width))
  const [height, setHeight] = useState(String(instance.height))
  const [fullscreen, setFullscreen] = useState(instance.fullscreen)
  const [javaPath, setJavaPath] = useState(instance.javaPath ?? '')
  const [jvmArgs, setJvmArgs] = useState(instance.jvmArgs)
  const [saving, setSaving] = useState(false)
  const [installingJava, setInstallingJava] = useState<number | null>(null)
  const [capeBusy, setCapeBusy] = useState(false)
  const [capeEnabled, setCapeEnabled] = useState(instance.tlauncherCape !== false)
  const [copySettingsOpen, setCopySettingsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<PerformancePreset>(settings?.performance.profile ?? 'balanced')
  const widthValue = Number(width)
  const heightValue = Number(height)
  const widthValid = Number.isFinite(widthValue) && widthValue >= 320 && widthValue <= 7680
  const heightValid = Number.isFinite(heightValue) && heightValue >= 240 && heightValue <= 4320
  const resolutionValid = widthValid && heightValid

  useEffect(() => {
    setName(instance.name)
    setMemory(instance.memoryMb)
    setWidth(String(instance.width))
    setHeight(String(instance.height))
    setFullscreen(instance.fullscreen)
    setJavaPath(instance.javaPath ?? '')
    setJvmArgs(instance.jvmArgs)
    setCapeEnabled(instance.tlauncherCape !== false)
  }, [instance])

  // The main process switches the preset to Custom when Minecraft's settings
  // change, so keep the control in sync while this page stays open.
  useEffect(() => {
    if (settings?.performance.profile) setProfile(settings.performance.profile)
  }, [settings?.performance.profile])

  const save = async (): Promise<void> => {
    if (!resolutionValid) {
      setError('Choose a width from 320 to 7680 and a height from 240 to 4320.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await window.newbie.instances.update(instance.id, {
        name,
        memoryMb: memory,
        width: Math.round(widthValue),
        height: Math.round(heightValue),
        fullscreen,
        javaPath: javaPath || null,
        jvmArgs
      })
      await queryClient.invalidateQueries({ queryKey: qk.instance(instance.id) })
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      onChanged()
      toast('success', 'Instance settings saved')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const applyGpu = async (): Promise<void> => {
    try {
      const result = await window.newbie.system.applyGpu(instance.id)
      toast(result.ok ? 'success' : 'error', 'GPU preference', result.message)
    } catch (error) {
      toast('error', 'GPU preference failed', errorMessage(error))
    }
  }

  const chooseJava = async (value: string): Promise<void> => {
    if (!value.startsWith('major:')) {
      setJavaPath(value)
      return
    }
    const major = Number(value.slice('major:'.length))
    if (!Number.isFinite(major)) return
    setInstallingJava(major)
    setError(null)
    try {
      const runtime = await window.newbie.system.installJava(major)
      await queryClient.invalidateQueries({ queryKey: qk.java })
      setJavaPath(runtime.path)
      toast('success', `Java ${runtime.major} ready`, runtime.path)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setInstallingJava(null)
    }
  }

  const toggleCape = async (enabled: boolean): Promise<void> => {
    setCapeEnabled(enabled)
    setCapeBusy(true)
    setError(null)
    try {
      await window.newbie.instances.update(instance.id, { tlauncherCape: enabled })
      await queryClient.invalidateQueries({ queryKey: qk.instance(instance.id) })
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      onChanged()
      const result = await window.newbie.instances.syncTlsCape(instance.id)
      if (!enabled) {
        toast('success', 'TLSkinCape removed', 'Newbie-owned TLSkinCape files were removed from this instance.')
      } else if (result.active) {
        toast(
          'success',
          'TLSkinCape ready',
          result.reason === 'existing'
            ? 'Using the TLSkinCape file already in the mods folder.'
            : `${result.fileName ?? 'TLSkinCape'} will load with this instance.`
        )
      } else if (result.reason === 'account') {
        toast('info', 'TLSkinCape preference saved', 'It will be added when you launch with a TLauncher account.')
      } else if (result.reason === 'unsupported') {
        toast('info', 'TLSkinCape not available', 'No TLSkinCape build exists for this loader and version.')
      } else {
        toast('info', 'TLSkinCape is off globally', 'Turn it on in Accounts to use the plugin.')
      }
    } catch (cause) {
      setCapeEnabled(instance.tlauncherCape !== false)
      setError(errorMessage(cause))
    } finally {
      setCapeBusy(false)
    }
  }

  const total = system?.totalMemMb ?? 16384
  const capeSupported = Boolean(findTlsCapeArtifact(instance.loader, instance.versionId))
  const capeGlobal = settings?.tlauncherCapePlugin !== false
  const capeAccountNote =
    activeAccount?.type === 'tlauncher'
      ? 'Added to mods/ before launch and removed when you turn this off.'
      : 'Takes effect when a TLauncher account is active.'

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="p-5">
        <h2 className="font-display text-[15px] font-semibold text-ink">Runtime</h2>
        <p className="mt-0.5 text-[11.5px] text-muted">These settings apply only when this instance launches.</p>
        <div className="mt-4 space-y-4">
          <Field label="Instance name">
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
          </Field>
          <Field label="Memory" hint={`${(memory / 1024).toFixed(1)} GB of ${(total / 1024).toFixed(0)} GB`}>
            <input
              type="range"
              min={1024}
              max={Math.max(2048, Math.floor(total * 0.75))}
              step={256}
              value={memory}
              onChange={(event) => setMemory(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--grass))]"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Width"
              hint="320–7680"
              error={!widthValid ? 'Enter 320–7680' : undefined}
            >
              <Input
                type="number"
                min={320}
                max={7680}
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              />
            </Field>
            <Field
              label="Height"
              hint="240–4320"
              error={!heightValid ? 'Enter 240–4320' : undefined}
            >
              <Input
                type="number"
                min={240}
                max={4320}
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </Field>
          </div>
          <Switch checked={fullscreen} onChange={setFullscreen} label="Launch in fullscreen" />
          <Field
            label="Java runtime"
            hint={
              installingJava !== null
                ? `Installing Java ${installingJava}…`
                : java.length
                  ? `${java.length} detected`
                  : 'None detected'
            }
          >
            <Select
              value={javaPath}
              onChange={(value) => void chooseJava(value)}
              disabled={installingJava !== null}
            >
              <option value="">Automatic (recommended)</option>
              {java.map((runtime) => (
                <option key={runtime.path} value={runtime.path}>
                  {runtime.vendor} {runtime.major} · {runtime.arch}
                </option>
              ))}
              {JAVA_MAJORS.filter((major) => !java.some((runtime) => runtime.major === major)).map(
                (major) => (
                  <option key={`install-java-${major}`} value={`major:${major}`}>
                    Java {major} · install Temurin
                  </option>
                )
              )}
            </Select>
          </Field>
          <p className="text-[10px] leading-relaxed text-muted/60">
            Choosing an uninstalled version downloads Eclipse Temurin now. Java 25 is available for newer versions and
            mods that support it.
          </p>
          <Field label="Extra JVM arguments" hint="space separated">
            <Input value={jvmArgs} onChange={(event) => setJvmArgs(event.target.value)} placeholder="-XX:+UseG1GC" />
          </Field>
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger">
              <WarningCircle size={15} /> {error}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="primary" loading={saving} disabled={!resolutionValid} onClick={() => void save()}>
              Save settings
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="font-display text-[15px] font-semibold text-ink">Version</h2>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="green">{instance.versionId}</Badge>
            <Badge tone="neutral">{loaderLabel(instance.loader)}</Badge>
            <TlsCapeBadge loader={instance.loader} versionId={instance.versionId} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Changing the version reinstalls the loader and moves add-ons to compatible builds automatically. Incompatible
            files are reported by Repair.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onChangeVersion} icon={<ArrowsClockwise size={14} />}>
            Change version
          </Button>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-[15px] font-semibold text-ink">Minecraft settings</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            Copy keybinds, video and audio options, resource pack order and shader selection to another instance.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setCopySettingsOpen(true)}
            icon={<Copy size={14} />}
          >
            Copy settings
          </Button>
        </Card>

        <CopySettingsModal
          open={copySettingsOpen}
          onClose={() => setCopySettingsOpen(false)}
          source={instance}
        />

        <Card className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink">TLauncher skin &amp; cape</h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                Places TLauncher&apos;s official TLSkinCape mod in this instance.
              </p>
            </div>
            <TlsCapeBadge
              loader={instance.loader}
              versionId={instance.versionId}
            />
          </div>
          <div className="mt-3">
            <Switch
              checked={capeEnabled && capeGlobal && capeSupported}
              onChange={(checked) => void toggleCape(checked)}
              disabled={!capeSupported || !capeGlobal || capeBusy}
              label="Place TLSkinCape before launch"
              description={
                !capeSupported
                  ? 'No TLSkinCape build exists for this loader and version.'
                  : !capeGlobal
                    ? 'Turn on TLSkinCape in Accounts first.'
                    : capeAccountNote
              }
            />
          </div>
          {instance.tlsCapeFile && (
            <div className="mt-3 truncate rounded-lg border border-line/45 bg-canvas/35 px-2.5 py-1.5 font-mono text-[9.5px] text-muted/70">
              {instance.tlsCapeFile}
            </div>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-muted/65">
            Downloaded from TLauncher&apos;s repository and checked against its published SHA-1. TLSkinCape is
            GPL-3.0-only and is not bundled with Newbie. Fabric and Forge builds only.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-[15px] font-semibold text-ink">Performance</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Applies the shared preset once and the GPU preference. In-game changes switch the preset to Custom.
          </p>
          <div className="mt-3">
            <Segmented
              value={profile}
              onChange={(value) => {
                setProfile(value)
                void window.newbie.settings.update({ performance: { profile: value } }).then(() => {
                  void queryClient.invalidateQueries({ queryKey: qk.settings })
                })
              }}
              options={[
                { value: 'performance', label: 'FPS' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'quality', label: 'Quality' },
                { value: 'custom', label: 'Custom' }
              ]}
              size="sm"
            />
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
            {profile === 'performance'
              ? 'Lower render distance, VSync off, 144 FPS cap.'
              : profile === 'quality'
                ? 'Higher render distance, shadows and particles.'
                : profile === 'custom'
                  ? 'Minecraft settings are left exactly as you changed them.'
                  : 'A stable middle ground for most systems.'}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void applyGpu()} icon={<Cpu size={14} />}>
            Use high-performance GPU
          </Button>
          {system?.gpus?.[0] && <p className="mt-2 truncate text-[10px] text-muted/60">{system.gpus[0]}</p>}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-[15px] font-semibold text-ink">Folder</h2>
          <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-muted/70">{instance.gameDir}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void window.newbie.instances.openFolder(instance.id)} icon={<FolderOpen size={14} />}>
              Open
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void window.newbie.app.showItem(instance.gameDir)} icon={<ArrowSquareOut size={14} />}>
              Reveal
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function ChangeVersionModal({
  open,
  onClose,
  instanceId,
  currentVersion,
  currentLoader,
  onChanged
}: {
  open: boolean
  onClose: () => void
  instanceId: string
  currentVersion: string
  currentLoader: LoaderType
  onChanged: () => Promise<void> | void
}) {
  const versions = useMinecraftVersions().data ?? []
  const [versionId, setVersionId] = useState(currentVersion)
  const [loader, setLoader] = useState<LoaderType>(currentLoader)
  const [loaderVersion, setLoaderVersion] = useState('')
  const [releasesOnly, setReleasesOnly] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loaderVersions = useLoaderVersions(loader, versionId)

  useEffect(() => {
    if (!open) return
    setVersionId(currentVersion)
    setLoader(currentLoader)
    setError(null)
  }, [open, currentVersion, currentLoader])

  useEffect(() => {
    const options = loaderVersions.data ?? []
    if (loader !== 'vanilla' && options.length > 0 && !options.some((option) => option.version === loaderVersion)) {
      setLoaderVersion(options[0]!.version)
    }
  }, [loader, loaderVersion, loaderVersions.data])

  const options = useMemo(
    () => versions.filter((version) => !releasesOnly || version.type === 'release').slice(0, 300),
    [versions, releasesOnly]
  )

  const apply = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.newbie.instances.update(instanceId, {
        versionId,
        loader,
        loaderVersion: loader === 'vanilla' ? undefined : loaderVersion
      })
      toast('success', 'Version changed', `${versionId} · ${loaderLabel(loader)}`)
      await onChanged()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Minecraft version"
      description="The loader and game files are installed first, then compatible add-on updates are fetched."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void apply()}>Change version</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Minecraft version">
          <Select value={versionId} onChange={setVersionId}>
            {options.map((version) => (
              <option
                key={version.id}
                value={version.id}
                data-tl={findTlsCapeArtifact(loader, version.id) ? 'yes' : 'no'}
              >
                {version.id}
              </option>
            ))}
          </Select>
        </Field>
        <Switch checked={releasesOnly} onChange={setReleasesOnly} label="Releases only" />
        <div>
          <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.09em] text-muted">Loader</div>
          <Segmented
            value={loader}
            onChange={setLoader}
            className="w-full"
            options={[
              { value: 'vanilla', label: 'Vanilla' },
              { value: 'fabric', label: 'Fabric' },
              { value: 'quilt', label: 'Quilt' },
              { value: 'forge', label: 'Forge' },
              { value: 'neoforge', label: 'NeoForge' }
            ]}
          />
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted/55">
            TL skin marks versions with an official TLSkinCape build for this loader. Vanilla, Quilt and NeoForge
            cannot load it.
          </p>
        </div>
        {loader !== 'vanilla' && (
          <Field label={`${loader} build`}>
            <Select value={loaderVersion} onChange={setLoaderVersion}>
              {(loaderVersions.data ?? []).slice(0, 80).map((option) => (
                <option key={option.version} value={option.version}>{option.version}</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="rounded-xl border border-gold/20 bg-gold/[0.03] p-3 text-[10.5px] leading-relaxed text-gold/80">
          Worlds stay in place. Add-ons that have no build for the new version remain installed but may be disabled by
          Repair.
        </div>
        {error && <div className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
