import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowsClockwise,
  Books,
  CalendarBlank,
  CheckCircle,
  Clock,
  Cube,
  Cpu,
  FolderOpen,
  Globe,
  HardDrives,
  Stack,
  Lightning,
  MapTrifold,
  Package,
  Play,
  Plus,
  Sparkle,
  TerminalWindow,
  Wrench
} from '@phosphor-icons/react'
import { APP_VERSION, GITHUB_URL, WEBSITE_URL } from '@shared/constants'
import type { BedrockInstanceSummary } from '@shared/types'
import {
  useAccounts,
  useActiveInstance,
  useBedrockInstances,
  useDiskUsage,
  useInstances,
  useSettings,
  useSystemInfo,
  useTasks,
  qk
} from '../hooks/queries'
import { toast, useUi } from '../store/ui'
import { loaderLabel, formatPlaytime, relativeTime, formatBytes, errorMessage, cn } from '../lib/utils'
import { PageHeader, SectionTitle } from '../components/PageHeader'
import { InstanceCard } from '../components/InstanceCard'
import { TlsCapeBadge } from '../components/TlsCapeBadge'
import { PlayButton } from '../components/PlayButton'
import { BlockIcon, SkinFace } from '../components/ui/BlockIcon'
import { Badge, Card, Progress, Skeleton } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'

export function HomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const instancesQuery = useInstances()
  const bedrockQuery = useBedrockInstances()
  const activeInstance = useActiveInstance()
  const accounts = useAccounts().data ?? []
  const account = accounts.find((candidate) => candidate.active) ?? accounts[0]
  const system = useSystemInfo().data
  const disk = useDiskUsage().data
  const settings = useSettings().data
  const update = useUi((state) => state.update)
  const openModal = useUi((state) => state.openModal)
  const askConfirm = useUi((state) => state.askConfirm)
  const tasks = useUi((state) => state.tasks)
  const running = useUi((state) => state.running)
  const instances = instancesQuery.data ?? []
  const bedrockInstances = bedrockQuery.data ?? []
  const [bedrockLaunching, setBedrockLaunching] = useState(false)

  const lastJava = instances.reduce<(typeof instances)[number] | undefined>((best, instance) => {
    if (!instance.lastPlayedAt) return best
    return !best || Date.parse(instance.lastPlayedAt) > Date.parse(best.lastPlayedAt!)
      ? instance
      : best
  }, undefined)
  const lastBedrock = bedrockInstances.reduce<BedrockInstanceSummary | undefined>(
    (best, instance) => {
      if (!instance.lastPlayedAt) return best
      return !best || Date.parse(instance.lastPlayedAt) > Date.parse(best.lastPlayedAt!)
        ? instance
        : best
    },
    undefined
  )
  const javaLastPlayed = lastJava?.lastPlayedAt ? Date.parse(lastJava.lastPlayedAt) : 0
  const bedrockLastPlayed = lastBedrock?.lastPlayedAt ? Date.parse(lastBedrock.lastPlayedAt) : 0
  const bedrockHome = lastBedrock && bedrockLastPlayed > javaLastPlayed ? lastBedrock : null
  const active = lastJava ?? activeInstance
  const javaIsLastPlayed = Boolean(lastJava)

  const addonCount = instances.reduce((total, instance) => total + instance.addons.length, 0)
  const loadoutCount = instances.reduce((total, instance) => total + instance.loadouts.length, 0)
  const pendingUpdates = active?.addons.filter((addon) => addon.latestVersionId && addon.latestVersionId !== addon.versionId).length ?? 0
  const totalPendingUpdates = instances.reduce(
    (total, instance) =>
      total +
      instance.addons.filter(
        (addon) => addon.latestVersionId && addon.latestVersionId !== addon.versionId
      ).length,
    0
  )
  const activeLoadout = active?.loadouts.find((loadout) => loadout.id === active.activeLoadoutId) ?? active?.loadouts[0]
  const activeRunning = Boolean(active && running.some((entry) => entry.instanceId === active.id))
  const playtime = active && active.totalPlayTimeSec >= 60
    ? formatPlaytime(active.totalPlayTimeSec).replace(/ played$/, '')
    : '0m'
  const greeting = greetingForNow()

  const launchBedrockNow = async (instance: BedrockInstanceSummary): Promise<void> => {
    setBedrockLaunching(true)
    try {
      await window.newbie.bedrock.launchInstance(instance.id)
      void queryClient.invalidateQueries({ queryKey: qk.bedrockInstances })
      toast('info', 'Starting Minecraft…', `${instance.name} is opening.`)
    } catch (error) {
      toast('error', 'Could not launch Bedrock', errorMessage(error))
    } finally {
      setBedrockLaunching(false)
    }
  }

  const playBedrock = (): void => {
    if (!bedrockHome) return
    if (!bedrockHome.linked) {
      askConfirm({
        title: `Switch Minecraft to ${bedrockHome.name}?`,
        description:
          'Bedrock has one game data folder, so Newbie links the selected profile before launching.',
        body: 'Your current worlds are kept as the protected “My Bedrock” profile, not deleted. Close Minecraft before continuing. Xbox cloud sync can still merge this profile with another PC using the same account.',
        confirmLabel: 'Switch and play',
        cancelLabel: 'Cancel',
        action: () => launchBedrockNow(bedrockHome)
      })
      return
    }
    void launchBedrockNow(bedrockHome)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-grass/75">Java + Bedrock</div>
          <h1 className="mt-1.5 font-display text-[27px] font-semibold tracking-[-0.025em] text-ink">
            {greeting}
            {account ? `, ${account.username}` : ''}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {bedrockHome
              ? `${bedrockHome.name} is ready. ${formatPlaytime(bedrockHome.totalPlayTimeSec)}.`
              : active
                ? `${active.name} is ready. ${formatPlaytime(active.totalPlayTimeSec)}.`
                : 'Set up your first instance and start playing.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bedrockHome ? (
            <>
              <Button
                variant="secondary"
                onClick={() => navigate('/bedrock/browse')}
                icon={<Books size={15} />}
              >
                Browse Bedrock
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/bedrock/instances')}
                icon={<Plus size={15} />}
              >
                New Bedrock
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => navigate('/browse')} icon={<Books size={15} />}>
                Browse add-ons
              </Button>
              <Button variant="primary" onClick={() => openModal('createInstance', true)} icon={<Plus size={15} />}>
                New instance
              </Button>
            </>
          )}
        </div>
      </div>

      {instancesQuery.isLoading || bedrockQuery.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-[1.55fr_0.8fr]">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      ) : bedrockHome || active ? (
        <div className="grid gap-5 lg:grid-cols-[1.55fr_0.8fr]">
          {bedrockHome ? (
            <BedrockHomeCard
              instance={bedrockHome}
              launching={bedrockLaunching}
              onPlay={playBedrock}
              onManage={() => navigate('/bedrock/instances')}
              onBrowse={() => navigate('/bedrock/browse')}
              onFolder={() =>
                void window.newbie.bedrock
                  .openInstance(bedrockHome.id)
                  .catch((error) =>
                    toast('error', 'Could not open the Bedrock folder', errorMessage(error))
                  )
              }
              onInstall={() => navigate('/bedrock')}
            />
          ) : active ? (
          <Card className="relative overflow-hidden p-0">
            <div
              className="relative min-h-[300px] p-6 sm:p-7"
              style={{
                background: `radial-gradient(120% 130% at 82% 10%, ${active.color}33 0%, transparent 55%), linear-gradient(135deg, #131D15 0%, #0B100C 65%)`
              }}
            >
              <div className="block-art absolute inset-0 opacity-[0.14]" />
              <div
                className="absolute -right-12 -top-20 h-56 w-56 rotate-12 rounded-3xl opacity-[0.07]"
                style={{ backgroundColor: active.color }}
              />
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-grass/70">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full bg-grass',
                        activeRunning && 'animate-pulse'
                      )}
                    />
                    {javaIsLastPlayed ? 'Last played' : 'Active instance'}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="green">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full bg-grass',
                          activeRunning && 'animate-pulse'
                        )}
                      />
                      {activeRunning ? 'Running' : 'Ready'}
                    </Badge>
                    <Badge tone="neutral">{loaderLabel(active.loader)}</Badge>
                    <Badge tone="neutral">{active.versionId}</Badge>
                    <TlsCapeBadge loader={active.loader} versionId={active.versionId} />
                  </div>
                </div>

                <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="min-w-0">
                    <div className="flex items-start gap-4">
                      <BlockIcon
                        name={active.name}
                        color={active.color}
                        iconUrl={active.iconUrl}
                        size={64}
                      />
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-[27px] font-semibold tracking-[-0.02em] text-ink">
                          {active.name}
                        </h2>
                        <p className="mt-1 text-[11px] text-muted">
                          {activeRunning ? 'Running now' : 'Ready to play'}
                          {' · '}
                          {activeLoadout ? `Loadout: ${activeLoadout.name}` : 'No active loadout'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 self-center">
                    <MiniStat
                      icon={<Package size={12} />}
                      label="Add-ons"
                      value={String(active.addons.length)}
                      detail={
                        pendingUpdates > 0
                          ? `${pendingUpdates} update${pendingUpdates === 1 ? '' : 's'}`
                          : 'Up to date'
                      }
                      highlight={pendingUpdates > 0}
                    />
                    <MiniStat
                      icon={<Stack size={12} />}
                      label="Loadouts"
                      value={String(active.loadouts.length)}
                      detail={activeLoadout?.name ?? 'None'}
                    />
                    <MiniStat
                      icon={<Clock size={12} />}
                      label="Playtime"
                      value={playtime}
                      detail="Total"
                    />
                    <MiniStat
                      icon={<CalendarBlank size={12} />}
                      label="Last played"
                      value={active.lastPlayedAt ? relativeTime(active.lastPlayedAt) : 'Never'}
                      detail={active.lastPlayedAt ? 'Last session' : 'Not played yet'}
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-5">
                  <div className="w-[148px]">
                    <PlayButton instance={active} size="lg" fullWidth />
                  </div>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-[148px]"
                    onClick={() => navigate(`/instances/${active.id}`)}
                    icon={<Stack size={15} />}
                  >
                    Manage
                  </Button>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => openModal('console', { instanceId: active.id })}
                      icon={<TerminalWindow size={15} />}
                    >
                      Console
                    </Button>
                    {pendingUpdates > 0 && (
                      <Button
                        variant="subtle"
                        onClick={() => void window.newbie.addons.updateAll(active.id)}
                        icon={<ArrowsClockwise size={15} />}
                      >
                        {pendingUpdates} update{pendingUpdates === 1 ? '' : 's'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
          ) : null}

          <div className="space-y-4">
            <Card className="p-4">
              <SectionTitle
                title="Account"
                action={
                  <button onClick={() => navigate('/accounts')} className="text-[11px] text-grass hover:underline">
                    Manage
                  </button>
                }
              />
              {account ? (
                <div className="flex items-center gap-3">
                  <SkinFace skinUrl={account.skinUrl} name={account.username} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">{account.username}</div>
                    <div className="text-[10.5px] uppercase tracking-[0.08em] text-muted">
                      {account.type === 'microsoft' ? 'Microsoft · licensed' : account.type === 'tlauncher' ? 'TLauncher · offline' : account.type}
                    </div>
                  </div>
                  <CheckCircle size={16} className="text-grass" weight="fill" />
                </div>
              ) : (
                <button
                  onClick={() => openModal('addAccount', true)}
                  className="flex w-full items-center justify-between rounded-xl border border-dashed border-line/70 p-3 text-left text-[11.5px] text-muted hover:text-ink"
                >
                  Add your first account <ArrowRight size={14} />
                </button>
              )}
            </Card>

            <Card className="p-4">
              <SectionTitle title="System" />
              <div className="space-y-2.5">
                <SystemRow icon={<Cpu size={14} />} label="Java" value={system?.javaRuntimes[0] ? `${system.javaRuntimes[0].vendor} ${system.javaRuntimes[0].major}` : 'Not found'} ok={Boolean(system?.javaRuntimes.length)} />
                <SystemRow icon={<HardDrives size={14} />} label="Free space" value={system ? `${(system.dataDirFreeMb / 1024).toFixed(0)} GB` : '—'} ok />
                <SystemRow icon={<Lightning size={14} />} label="GPU profile" value={settings ? settings.performance.profile.replace(/^\w/, (c) => c.toUpperCase()) : 'Balanced'} ok />
                <SystemRow icon={<Package size={14} />} label="Add-on cache" value={disk ? formatBytes(disk.cacheMb * 1024 * 1024) : '—'} ok />
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="relative overflow-hidden p-0">
          <div className="relative min-h-[320px] p-8">
            <div className="absolute inset-0 bg-[radial-gradient(110%_120%_at_80%_0%,rgba(110,231,160,0.12),transparent_60%)]" />
            <div className="grid-overlay absolute inset-0 opacity-40" />
            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <Badge tone="green">
                  <Sparkle size={11} weight="fill" /> First launch
                </Badge>
                <h2 className="mt-4 max-w-lg font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
                  A clean place to build your Minecraft worlds.
                </h2>
                <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted">
                  Install any version, add a loader, then collect mods, packs and shaders without letting them fight each
                  other. Loadouts and offline backups are built in.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button variant="primary" size="lg" onClick={() => openModal('createInstance', true)} icon={<Plus size={17} />}>
                    Create an instance
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => openModal('addAccount', true)} icon={<Play size={16} weight="fill" />}>
                    Add an account
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 self-center">
                {[
                  { icon: Sparkle, title: 'Java, handled', text: 'Temurin JRE downloaded automatically.' },
                  { icon: Wrench, title: 'Self-repairing', text: 'Conflicts fixed in one click.' },
                  { icon: HardDrives, title: 'Offline loadouts', text: 'Keep every pack cached and ready.' },
                  { icon: Cube, title: 'Every version', text: 'Vanilla through NeoForge.' }
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-line/50 bg-card/50 p-3">
                    <item.icon size={18} className="text-grass" />
                    <div className="mt-2 text-[11.5px] font-semibold text-ink">{item.title}</div>
                    <div className="mt-0.5 text-[10px] leading-relaxed text-muted">{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Cube size={16} />} label="Instances" value={String(instances.length)} detail={`${instances.filter((instance) => instance.loader !== 'vanilla').length} modded`} />
        <StatCard icon={<Package size={16} />} label="All add-ons" value={String(addonCount)} detail={totalPendingUpdates > 0 ? `${totalPendingUpdates} updates available` : 'All up to date'} />
        <StatCard icon={<Stack size={16} />} label="All loadouts" value={String(loadoutCount)} detail="across your instances" />
        <StatCard
          icon={<Sparkle size={16} />}
          label="Version"
          value={update.version ?? APP_VERSION}
          detail={
            update.status === 'installing'
              ? 'Installing update'
              : update.status === 'downloaded'
                ? 'Update ready'
                : update.status === 'downloading'
                  ? 'Downloading update'
                  : update.status === 'available'
                    ? 'Update available'
                    : 'Newbie Launcher'
          }
        />
      </div>

      {instances.length > 1 && (
        <section className="mt-7">
          <SectionTitle
            title="Your instances"
            action={
              <button onClick={() => navigate('/instances')} className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-ink">
                View all <ArrowRight size={12} />
              </button>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {instances
              .filter((instance) => instance.id !== active?.id)
              .slice(0, 3)
              .map((instance, index) => (
                <motion.div
                  key={instance.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.2 }}
                >
                  <InstanceCard instance={instance} compact />
                </motion.div>
              ))}
          </div>
        </section>
      )}

      <div className="mt-7 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-5">
          <SectionTitle title="What's new in Newbie" description="Recent launcher features" />
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              'One-click Java servers with GUI settings',
              'Server command snippets and TPS dashboard',
              'Server resource packs and scheduled restarts',
              'Play with friends sharing tools',
              'Silent, automatic launcher updates',
              'Bedrock install, uninstall and exclusion manager',
              'Bulk add-on cleanup by section',
              'Automatic Java 8–25 setup'
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-line/40 bg-canvas/25 px-2.5 py-2 text-[11px] text-muted">
                <CheckCircle size={13} className="shrink-0 text-grass/80" weight="fill" />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void window.newbie.app.openExternal(`${GITHUB_URL}/releases`)}>
              Release notes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void window.newbie.app.openExternal(WEBSITE_URL)} icon={<Globe size={13} />}>
              Website
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={update.status === 'checking'}
              onClick={() => void window.newbie.updater.check()}
            >
              Check for updates
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-5">
          <div>
            <SectionTitle title="Keep exploring" />
            <p className="text-[12px] leading-relaxed text-muted">
              Find performance mods, fresh world packs and shaders from Modrinth. Add them to the active
              instance or build a separate loadout.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => navigate('/browse?type=mod')} className="rounded-lg border border-line/55 bg-canvas/40 px-2.5 py-1.5 text-[11px] text-muted hover:border-grass/30 hover:text-ink">
              Mods
            </button>
            <button onClick={() => navigate('/browse?type=modpack')} className="rounded-lg border border-line/55 bg-canvas/40 px-2.5 py-1.5 text-[11px] text-muted hover:border-grass/30 hover:text-ink">
              Modpacks
            </button>
            <button onClick={() => navigate('/browse?type=resourcepack')} className="rounded-lg border border-line/55 bg-canvas/40 px-2.5 py-1.5 text-[11px] text-muted hover:border-grass/30 hover:text-ink">
              Resource packs
            </button>
            <button onClick={() => navigate('/browse?type=shader')} className="rounded-lg border border-line/55 bg-canvas/40 px-2.5 py-1.5 text-[11px] text-muted hover:border-grass/30 hover:text-ink">
              Shaders
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function SystemRow({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-[11.5px]">
      <span className={ok ? 'text-grass/75' : 'text-danger/75'}>{icon}</span>
      <span className="text-muted">{label}</span>
      <span className="ml-auto text-right font-medium text-ink/85">{value}</span>
    </div>
  )
}

function BedrockHomeCard({
  instance,
  launching,
  onPlay,
  onManage,
  onBrowse,
  onFolder,
  onInstall
}: {
  instance: BedrockInstanceSummary
  launching: boolean
  onPlay: () => void
  onManage: () => void
  onBrowse: () => void
  onFolder: () => void
  onInstall: () => void
}) {
  const playtime =
    instance.totalPlayTimeSec >= 60
      ? formatPlaytime(instance.totalPlayTimeSec).replace(/ played$/, '')
      : '0m'
  const channel = instance.channel === 'preview' ? 'Preview' : 'Release'
  return (
    <Card className="relative overflow-hidden p-0">
      <div
        className="relative min-h-[300px] p-6 sm:p-7"
        style={{
          background: `radial-gradient(120% 130% at 82% 10%, ${instance.color}33 0%, transparent 55%), linear-gradient(135deg, #131D15 0%, #0B100C 65%)`
        }}
      >
        <div className="block-art absolute inset-0 opacity-[0.14]" />
        <div
          className="absolute -right-12 -top-20 h-56 w-56 rotate-12 rounded-3xl opacity-[0.07]"
          style={{ backgroundColor: instance.color }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-grass/70">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-grass',
                  instance.running && 'animate-pulse'
                )}
              />
              Last played · Bedrock
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={instance.installed ? 'green' : 'gold'}>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    instance.installed ? 'bg-grass' : 'bg-gold',
                    instance.running && 'animate-pulse'
                  )}
                />
                {instance.running ? 'Running' : instance.installed ? 'Ready' : 'Not installed'}
              </Badge>
              <Badge tone="neutral">Minecraft for Windows</Badge>
              <Badge tone="neutral">{channel}</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                  style={{ backgroundColor: `${instance.color}22`, color: instance.color }}
                >
                  <Cube size={30} weight="fill" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[27px] font-semibold tracking-[-0.02em] text-ink">
                    {instance.name}
                  </h2>
                  <p className="mt-1 text-[11px] text-muted">
                    {instance.running
                      ? 'Running now'
                      : instance.linked
                        ? 'Linked to Minecraft'
                        : 'Switches on Play'}
                    {' · '}
                    {instance.worldCount} {instance.worldCount === 1 ? 'world' : 'worlds'} ·{' '}
                    {instance.contentCount} {instance.contentCount === 1 ? 'pack' : 'packs'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 self-center">
              <MiniStat
                icon={<MapTrifold size={12} />}
                label="Worlds"
                value={String(instance.worldCount)}
                detail="In this profile"
              />
              <MiniStat
                icon={<Package size={12} />}
                label="Packs"
                value={String(instance.contentCount)}
                detail="Installed"
              />
              <MiniStat
                icon={<Clock size={12} />}
                label="Playtime"
                value={playtime}
                detail="Total"
              />
              <MiniStat
                icon={<CalendarBlank size={12} />}
                label="Last played"
                value={instance.lastPlayedAt ? relativeTime(instance.lastPlayedAt) : 'Never'}
                detail={instance.lastPlayedAt ? 'Last session' : 'Not played yet'}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-5">
            <div className="w-[148px]">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={launching}
                disabled={!instance.installed || instance.running}
                onClick={onPlay}
                icon={<Play size={16} weight="fill" />}
              >
                Play
              </Button>
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="w-[148px]"
              onClick={onManage}
              icon={<Cube size={15} />}
            >
              Manage
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={onFolder} icon={<FolderOpen size={15} />}>
                Folder
              </Button>
              <Button variant="ghost" onClick={onBrowse} icon={<Books size={15} />}>
                Browse
              </Button>
            </div>
          </div>
          {!instance.installed && (
            <button
              onClick={onInstall}
              className="mt-2 flex items-center gap-1 text-left text-[10px] text-gold/80 hover:text-gold"
            >
              Install the {channel.toLowerCase()} package from the Bedrock page
              <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

function MiniStat({
  icon,
  label,
  value,
  detail,
  highlight = false
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/[0.055] bg-black/15 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-muted/60">
        <span className={highlight ? 'text-gold/80' : 'text-grass/65'}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 truncate font-display text-[14px] font-semibold text-ink">{value}</div>
      <div className={cn('mt-0.5 truncate text-[9px]', highlight ? 'text-gold/75' : 'text-muted/55')}>
        {detail}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/70">{label}</span>
        <span className="text-muted/50">{icon}</span>
      </div>
      <div className="mt-2 font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted/65">{detail}</div>
    </Card>
  )
}

function greetingForNow(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still awake'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
