import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  Cube,
  DownloadSimple,
  GearSix,
  Info,
  MagnifyingGlass,
  Play,
  ShieldCheck,
  ShieldWarning,
  Trash,
  WarningCircle,
  WindowsLogo,
  X
} from '@phosphor-icons/react'
import type { BedrockChannel, BedrockProgress, BedrockSetup, BedrockState, BedrockVersion } from '@shared/types'
import { BEDROCK_STORE_WEB_URL, GAMING_SERVICES_STORE_WEB_URL } from '@shared/constants'
import { PageHeader } from '../components/PageHeader'
import { Button, IconButton } from '../components/ui/Button'
import { Badge, Card, EmptyState, Input, Progress, Segmented, Skeleton } from '../components/ui/primitives'
import { useUi, toast } from '../store/ui'
import { errorMessage, formatBytes } from '../lib/utils'

export function BedrockPage() {
  const askConfirm = useUi((state) => state.askConfirm)
  const [state, setState] = useState<BedrockState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [launching, setLaunching] = useState<BedrockChannel | null>(null)
  const [excluding, setExcluding] = useState(false)
  const [channel, setChannel] = useState<BedrockChannel>('release')
  const [query, setQuery] = useState('')
  const [progress, setProgress] = useState<Record<string, BedrockProgress>>({})
  const exclusionAttempted = useRef(false)

  const refresh = useCallback(async (force = false): Promise<BedrockState | null> => {
    try {
      const next = await window.newbie.bedrock.state(force)
      setState(next)
      setError(null)
      return next
    } catch (failure) {
      setError(errorMessage(failure))
      return null
    }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    window.newbie.bedrock
      .state(false)
      .then((next) => {
        if (!alive) return
        setState(next)
        setError(null)
      })
      .catch((failure) => {
        if (alive) setError(errorMessage(failure))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    const unsubscribe = window.newbie.app.onEvent((event) => {
      if (event.type !== 'bedrock-progress') return
      setProgress((current) => ({ ...current, [event.payload.id]: event.payload }))
      if (event.payload.stage === 'done') void refresh(false)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [refresh])

  const addExclusion = useCallback(async (): Promise<void> => {
    setExcluding(true)
    try {
      const result = await window.newbie.bedrock.addExclusion()
      if (result.ok) {
        toast(
          'success',
          'Windows Security exclusion added',
          `${result.paths.length} Bedrock folder${result.paths.length === 1 ? '' : 's'} excluded.`
        )
        await refresh(false)
      } else if (result.cancelled) {
        toast('info', 'Exclusion skipped', 'You can add it any time from the Bedrock page.')
      } else {
        toast('error', 'Could not add the exclusion', result.error)
      }
    } catch (failure) {
      toast('error', 'Could not add the exclusion', errorMessage(failure))
    } finally {
      setExcluding(false)
    }
  }, [refresh])

  const requestExclusion = (
    run: () => Promise<void>,
    confirmLabel: string,
    cancelLabel: string
  ): void => {
    if (!state || state.setup.defenderExclusion === 'added' || exclusionAttempted.current) {
      void run()
      return
    }
    askConfirm({
      title: 'Add Windows Security exclusion?',
      description: 'Windows Defender can slow down or block the 1–2 GB Bedrock package download.',
      body: 'Newbie will ask Windows to exclude only its own Bedrock download folder and Microsoft’s Minecraft data folders. This opens a UAC prompt; nothing is excluded unless you approve it. Third-party files such as OnlineFix are never excluded.',
      confirmLabel,
      cancelLabel,
      onCancel: () => {
        exclusionAttempted.current = true
        void run()
      },
      action: async () => {
        exclusionAttempted.current = true
        await addExclusion()
        await run()
      }
    })
  }

  const requestManualExclusion = (): void => {
    const alreadyAdded = state?.setup.defenderExclusion === 'added'
    askConfirm({
      title: alreadyAdded ? 'Update Windows Security exclusion?' : 'Add Windows Security exclusion?',
      description: 'Windows Defender can slow down or block large Bedrock packages.',
      body: 'This opens a Windows administrator (UAC) prompt. Newbie excludes only its own Bedrock download folder and the official Minecraft data folders. It never excludes third-party DLLs or cracks.',
      confirmLabel: alreadyAdded ? 'Update exclusion' : 'Add exclusion',
      action: async () => {
        await addExclusion()
      }
    })
  }

  const runDownload = async (version: BedrockVersion): Promise<void> => {
    setBusyId(version.id)
    try {
      await window.newbie.bedrock.download(version.id)
      await refresh(false)
      toast('success', `Minecraft ${version.version} downloaded`)
    } catch (failure) {
      const message = errorMessage(failure)
      if (!/cancelled/i.test(message)) toast('error', 'Bedrock download failed', message)
    } finally {
      setBusyId(null)
    }
  }

  const download = (version: BedrockVersion): void => {
    if (busyId) return
    requestExclusion(
      () => runDownload(version),
      'Add exclusion and download',
      'Download without exclusion'
    )
  }

  const cancelDownload = async (version: BedrockVersion): Promise<void> => {
    try {
      await window.newbie.bedrock.cancel(version.id)
    } catch {
      // The download may have finished between the click and the IPC call.
    }
  }

  const runInstall = async (version: BedrockVersion, replace: boolean): Promise<void> => {
    setBusyId(version.id)
    try {
      const next = await window.newbie.bedrock.install(version.id, replace)
      setState(next)
      toast('success', `Minecraft ${version.version} installed`)
    } catch (failure) {
      toast('error', 'Bedrock installation failed', errorMessage(failure))
    } finally {
      setBusyId(null)
    }
  }

  const install = async (version: BedrockVersion): Promise<void> => {
    if (busyId) return
    const current = state?.installations.find((entry) => entry.channel === version.channel)
    if (current && current.packageVersion.toLowerCase() !== version.packageVersion.toLowerCase()) {
      askConfirm({
        title: `Replace Minecraft ${current.version}?`,
        description: `Windows keeps one ${
          version.channel === 'preview' ? 'Minecraft Preview' : 'Minecraft for Windows'
        } package installed at a time. Installing ${version.version} removes the installed package first.`,
        body: 'Your worlds, Marketplace content and settings are preserved. You can reinstall the Microsoft Store version at any time.',
        confirmLabel: 'Replace and install',
        danger: true,
        action: () =>
          requestExclusion(
            () => runInstall(version, true),
            'Add exclusion and install',
            'Install without exclusion'
          )
      })
      return
    }
    requestExclusion(
      () => runInstall(version, false),
      'Add exclusion and install',
      'Install without exclusion'
    )
  }

  const launch = async (target: BedrockChannel): Promise<void> => {
    setLaunching(target)
    try {
      await window.newbie.bedrock.launch(target)
      toast('info', 'Starting Minecraft…', 'The game window will open in a few seconds.')
    } catch (failure) {
      toast('error', 'Could not start Minecraft', errorMessage(failure))
    } finally {
      setTimeout(() => setLaunching(null), 1200)
    }
  }

  const removeDownload = (version: BedrockVersion): void => {
    askConfirm({
      title: `Delete Minecraft ${version.version}?`,
      description: 'The downloaded package is removed. An installed game and your worlds are not affected.',
      body: 'You can download it again at any time.',
      confirmLabel: 'Delete package',
      danger: true,
      action: async () => {
        await window.newbie.bedrock.delete(version.id)
        await refresh(false)
      }
    })
  }

  const refreshCatalog = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await refresh(true)
      toast('success', 'Bedrock version list refreshed')
    } finally {
      setRefreshing(false)
    }
  }

  const versions = state?.versions ?? []
  const installations = state?.installations ?? []
  const channelVersions = versions.filter((entry) => entry.channel === channel)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return channelVersions
    return channelVersions.filter((entry) =>
      `${entry.version} ${entry.packageVersion}`.toLowerCase().includes(needle)
    )
  }, [channelVersions, query])
  const installedForChannel = installations.find((entry) => entry.channel === channel)
  const installedDisplayVersion = installedForChannel
    ? versions.find(
        (entry) =>
          entry.channel === installedForChannel.channel &&
          entry.packageVersion.toLowerCase() === installedForChannel.packageVersion.toLowerCase()
      )?.version ?? installedForChannel.version
    : undefined

  if (loading) {
    return (
      <div>
        <PageHeader
          eyebrow="Bedrock Edition"
          title="Bedrock"
          description="Download and launch Minecraft for Windows. Bedrock is a separate, unmoddable edition with its own worlds and Marketplace content."
        />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-[480px]" />
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  if (error && !state) {
    return (
      <div>
        <PageHeader eyebrow="Bedrock Edition" title="Bedrock" description="Minecraft for Windows versions and installation." />
        <EmptyState
          icon={<WarningCircle size={22} />}
          title="Could not load Bedrock"
          description={error}
          action={
            <Button variant="primary" onClick={() => void refresh(true)} icon={<ArrowClockwise size={14} />}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  if (!state) {
    return (
      <div>
        <PageHeader eyebrow="Bedrock Edition" title="Bedrock" description="Minecraft for Windows versions and installation." />
        <EmptyState
          icon={<WarningCircle size={22} />}
          title="Bedrock is unavailable"
          description="The launcher could not read the Bedrock version list."
          action={
            <Button variant="primary" onClick={() => void refresh(true)} icon={<ArrowClockwise size={14} />}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Bedrock Edition"
        title="Bedrock"
        description="Download and launch Minecraft for Windows. Bedrock is a separate, unmoddable edition with its own worlds and Marketplace content."
        actions={
          <Button
            variant="secondary"
            onClick={() => void window.newbie.app.openExternal(BEDROCK_STORE_WEB_URL)}
            icon={<ArrowSquareOut size={15} />}
          >
            Microsoft Store
          </Button>
        }
      />

      <div className="space-y-4">
        {installations.length > 0 ? (
          <div className={installations.length > 1 ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}>
            {installations.map((installation) => (
              <InstalledCard
                key={installation.packageFullName}
                installation={installation}
                displayVersion={
                  versions.find(
                    (entry) =>
                      entry.channel === installation.channel &&
                      entry.packageVersion.toLowerCase() === installation.packageVersion.toLowerCase()
                  )?.version ?? installation.version
                }
                launching={launching === installation.channel}
                disabled={Boolean(busyId)}
                onLaunch={() => void launch(installation.channel)}
              />
            ))}
          </div>
        ) : (
          <Card className="flex flex-wrap items-center gap-4 p-5">
            <BedrockMark size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-[14px] font-semibold text-ink">Minecraft for Windows is not installed</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                Choose a full release below. Newbie downloads the official package and hands it to Windows for
                installation. A Microsoft account with Minecraft for Windows or Game Pass is required to play.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => void window.newbie.app.openExternal(BEDROCK_STORE_WEB_URL)}
              icon={<ArrowSquareOut size={14} />}
            >
              Open Store
            </Button>
          </Card>
        )}

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-line/45 p-4">
              <Segmented
                value={channel}
                onChange={setChannel}
                size="sm"
                options={[
                  {
                    value: 'release',
                    label: `Release ${versions.filter((entry) => entry.channel === 'release').length}`
                  },
                  {
                    value: 'preview',
                    label: `Preview ${versions.filter((entry) => entry.channel === 'preview').length}`
                  }
                ]}
              />
              <div className="relative min-w-[170px] flex-1">
                <MagnifyingGlass size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search Bedrock versions…"
                  className="pl-9"
                  aria-label="Search Bedrock versions"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                loading={refreshing}
                onClick={() => void refreshCatalog()}
                icon={<ArrowClockwise size={14} />}
              >
                Refresh
              </Button>
            </div>

            {state?.catalogError && (
              <div className="border-b border-gold/20 bg-gold/[0.045] px-4 py-2.5 text-[10.5px] leading-relaxed text-gold">
                {state.catalogError}
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-[11.5px] text-muted">
                {channelVersions.length === 0 ? 'No versions are available in this channel.' : 'No versions match that search.'}
              </div>
            ) : (
              <div className="max-h-[560px] divide-y divide-line/35 overflow-y-auto">
                {filtered.map((version) => (
                  <BedrockVersionRow
                    key={version.id}
                    version={version}
                    progress={progress[version.id]}
                    busy={busyId === version.id}
                    disabled={Boolean(busyId) && busyId !== version.id}
                    installedVersion={installedDisplayVersion}
                    onDownload={() => void download(version)}
                    onCancel={() => void cancelDownload(version)}
                    onInstall={() => void install(version)}
                    onPlay={() => void launch(version.channel)}
                    onDelete={() => removeDownload(version)}
                  />
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <SetupCard
              setup={state!.setup}
              excluding={excluding}
              onAddExclusion={requestManualExclusion}
              onOpenGamingServices={() => void window.newbie.app.openExternal(GAMING_SERVICES_STORE_WEB_URL)}
            />
            <Card className="p-5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-grass" />
                <div>
                  <h2 className="font-display text-[13.5px] font-semibold text-ink">Full package only</h2>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                    Newbie only lists the complete Minecraft for Windows package, never a trial or demo build. Microsoft
                    still checks your licence when the game starts, so the 90-minute trial applies without ownership or
                    Game Pass.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2.5 border-t border-line/40 pt-3">
                <Cube size={17} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <h2 className="font-display text-[13.5px] font-semibold text-ink">No mods on Bedrock</h2>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                    Bedrock does not use Java mods, shaders, loadouts or Modrinth add-ons. Those features stay in the
                    Java section and never touch Bedrock worlds.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function InstalledCard({
  installation,
  displayVersion,
  launching,
  disabled,
  onLaunch
}: {
  installation: BedrockState['installations'][number]
  displayVersion: string
  launching: boolean
  disabled: boolean
  onLaunch: () => void
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3.5">
        <BedrockMark size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[14px] font-semibold text-ink">
              {installation.channel === 'preview' ? 'Minecraft Preview' : 'Minecraft for Windows'}
            </h2>
            <Badge tone="green" className="h-5 text-[8.5px]">
              Installed
            </Badge>
            {installation.running && (
              <Badge tone="gold" className="h-5 text-[8.5px]">
                Running
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted">
            Version {displayVersion} · {installation.channel === 'preview' ? 'Preview' : 'Release'} channel
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={launching}
              disabled={installation.running || disabled}
              onClick={onLaunch}
              icon={<Play size={13} weight="fill" />}
            >
              {installation.running ? 'Running' : 'Play'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void window.newbie.app.openExternal(BEDROCK_STORE_WEB_URL)}
              icon={<ArrowSquareOut size={13} />}
            >
              Store
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function BedrockVersionRow({
  version,
  progress,
  busy,
  disabled,
  installedVersion,
  onDownload,
  onCancel,
  onInstall,
  onPlay,
  onDelete
}: {
  version: BedrockVersion
  progress?: BedrockProgress
  busy: boolean
  disabled: boolean
  installedVersion?: string
  onDownload: () => void
  onCancel: () => void
  onInstall: () => void
  onPlay: () => void
  onDelete: () => void
}) {
  const downloading = progress?.stage === 'downloading'
  const installing = progress?.stage === 'installing'
  const paused = !downloading && (progress?.stage === 'cancelled' || Boolean(version.partialBytes))
  const replaces = Boolean(installedVersion && !version.installed)

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12.5px] font-medium text-ink">{version.version}</span>
          {version.latest && (
            <Badge tone="gold" className="h-5 text-[8.5px]">
              Latest
            </Badge>
          )}
          {version.installed && (
            <Badge tone="green" className="h-5 text-[8.5px]">
              Installed
            </Badge>
          )}
          {version.downloaded && !version.installed && (
            <Badge tone="blue" className="h-5 text-[8.5px]">
              Downloaded
            </Badge>
          )}
          {paused && !version.downloaded && (
            <Badge tone="neutral" className="h-5 text-[8.5px]">
              Paused
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-[10.5px] text-muted">
          Package {version.packageVersion}
          {version.partialBytes ? ` · ${formatBytes(version.partialBytes)} downloaded` : ''}
          {replaces && installedVersion ? ` · replaces ${installedVersion}` : ''}
        </div>
        {downloading && (
          <div className="mt-2 max-w-md">
            <Progress value={progress?.percent ?? 0} className="h-1" tone="gold" />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[9.5px] text-muted/70">
              <span>{progress?.percent ?? 0}%</span>
              <span>
                {formatBytes(progress?.transferred)} of {formatBytes(progress?.total)}
              </span>
              {(progress?.bytesPerSecond ?? 0) > 0 && <span>{formatBytes(progress?.bytesPerSecond)}/s</span>}
            </div>
          </div>
        )}
        {progress?.stage === 'error' && (
          <div className="mt-1 text-[10px] leading-relaxed text-danger">{progress.message}</div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {downloading ? (
          <Button size="sm" variant="ghost" onClick={onCancel} icon={<X size={13} />}>
            Cancel
          </Button>
        ) : version.installed ? (
          <Button size="sm" variant="primary" disabled={disabled} onClick={onPlay} icon={<Play size={13} weight="fill" />}>
            Play
          </Button>
        ) : version.downloaded ? (
          <>
            <Button
              size="sm"
              variant="primary"
              loading={busy || installing}
              disabled={disabled}
              onClick={onInstall}
              icon={<DownloadSimple size={13} />}
            >
              {installing ? 'Installing…' : 'Install'}
            </Button>
            <IconButton label={`Delete Minecraft ${version.version} package`} onClick={onDelete} disabled={disabled}>
              <Trash size={14} />
            </IconButton>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            disabled={disabled}
            onClick={onDownload}
            icon={<DownloadSimple size={13} />}
          >
            {paused ? 'Resume' : 'Download'}
          </Button>
        )}
      </div>
    </div>
  )
}

function SetupCard({
  setup,
  excluding,
  onAddExclusion,
  onOpenGamingServices
}: {
  setup: BedrockSetup
  excluding: boolean
  onAddExclusion: () => void
  onOpenGamingServices: () => void
}) {
  return (
    <Card className="p-5">
      <h2 className="font-display text-[14px] font-semibold text-ink">Before you install</h2>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
        Windows needs these pieces to stage large Bedrock packages safely.
      </p>

      <div className="mt-4 space-y-4">
        <Requirement
          icon={setup.defenderExclusion === 'added' ? <CheckCircle size={16} weight="fill" /> : <ShieldWarning size={16} />}
          tone={setup.defenderExclusion === 'added' ? 'green' : 'gold'}
          title="Windows Security exclusion"
          detail={
            setup.defenderExclusion === 'added'
              ? 'Bedrock downloads and Minecraft data folders are excluded.'
              : 'Defender can slow down or block 1–2 GB downloads. Requires your approval.'
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              loading={excluding}
              onClick={onAddExclusion}
              icon={<ShieldCheck size={13} />}
            >
              {setup.defenderExclusion === 'added' ? 'Update' : 'Add'}
            </Button>
          }
        />

        <Requirement
          icon={setup.gamingServices ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} />}
          tone={setup.gamingServices ? 'green' : 'red'}
          title="Gaming Services"
          detail={setup.gamingServices ? 'Installed and ready.' : 'Required to install GDK Bedrock packages.'}
          action={
            !setup.gamingServices ? (
              <Button size="sm" variant="secondary" onClick={onOpenGamingServices} icon={<ArrowSquareOut size={13} />}>
                Store
              </Button>
            ) : undefined
          }
        />

        <Requirement
          icon={setup.developerMode ? <CheckCircle size={16} weight="fill" /> : <GearSix size={16} />}
          tone={setup.developerMode ? 'green' : 'gold'}
          title="Developer Mode"
          detail={
            setup.developerMode
              ? 'Enabled — Windows can sideload signed packages.'
              : 'Enable it in Settings → Privacy & security → For developers.'
          }
        />
      </div>

      <div className="mt-4 rounded-xl border border-line/45 bg-canvas/30 p-3">
        <div className="text-[9px] uppercase tracking-[0.1em] text-muted/60">Bedrock folder</div>
        <div className="mt-1 break-all font-mono text-[9.5px] leading-relaxed text-muted/75">{setup.dataDir}</div>
      </div>
    </Card>
  )
}

function Requirement({
  icon,
  tone,
  title,
  detail,
  action
}: {
  icon: ReactNode
  tone: 'green' | 'gold' | 'red'
  title: string
  detail: string
  action?: ReactNode
}) {
  const toneClass =
    tone === 'green' ? 'border-grass/20 bg-grass/10 text-grass' : tone === 'gold' ? 'border-gold/20 bg-gold/10 text-gold' : 'border-danger/20 bg-danger/10 text-danger'
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[10px] leading-relaxed text-muted">{detail}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function BedrockMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_8px_18px_rgba(110,231,160,0.18)]"
    >
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#101A12" stroke="#2C3A2E" />
      <path d="M20 7L32 13.4L20 19.8L8 13.4L20 7Z" fill="#6EE7A0" />
      <path d="M8 13.4L20 19.8V32.6L8 26.2V13.4Z" fill="#5B3A1E" />
      <path d="M32 13.4L20 19.8V32.6L32 26.2V13.4Z" fill="#3E2914" />
      <path d="M8 13.4L20 19.8L20 24.1L8 17.7V13.4Z" fill="#3E8E5C" />
      <path d="M32 13.4L20 19.8L20 24.1L32 17.7V13.4Z" fill="#2C6B43" />
      <path d="M14 22.5L17 24L20 22.5" stroke="#A7F3D0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
