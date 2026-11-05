import { useState } from 'react'
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretDown,
  CheckCircle,
  DownloadSimple,
  Sparkle,
  WarningCircle
} from '@phosphor-icons/react'
import type { UpdateState } from '@shared/types'
import { APP_VERSION, GITHUB_URL } from '@shared/constants'
import { formatBytes, formatSpeed, parseReleaseNotes } from '@shared/update'
import { useUi, toast } from '../store/ui'
import { errorMessage, relativeTime } from '../lib/utils'
import { Badge, Card, Progress, Switch } from './ui/primitives'
import { Button } from './ui/Button'

interface UpdatePanelProps {
  autoCheckUpdates: boolean
  allowPrerelease: boolean
  onSave: (patch: { autoCheckUpdates?: boolean; allowPrerelease?: boolean }) => Promise<void>
}

export function UpdatePanel({ autoCheckUpdates, allowPrerelease, onSave }: UpdatePanelProps) {
  const update = useUi((state) => state.update)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [saving, setSaving] = useState(false)

  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      const result = await window.newbie.updater.check()
      if (result.status === 'error') {
        toast('error', 'Update check failed', result.message)
      }
    } catch (error) {
      toast('error', 'Update check failed', errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  const install = async (): Promise<void> => {
    setInstalling(true)
    try {
      await window.newbie.updater.install()
    } catch (error) {
      toast('error', 'Could not restart the launcher', errorMessage(error))
      setInstalling(false)
    }
  }

  const setAutoCheck = async (checked: boolean): Promise<void> => {
    setSaving(true)
    try {
      await onSave({ autoCheckUpdates: checked })
      if (checked) void check()
    } finally {
      setSaving(false)
    }
  }

  const setPrerelease = async (checked: boolean): Promise<void> => {
    setSaving(true)
    try {
      await onSave({ allowPrerelease: checked })
    } finally {
      setSaving(false)
    }
  }

  const busy = update.status === 'checking' || update.status === 'available' || update.status === 'downloading'
  const hasUpdate = update.status === 'available' || update.status === 'downloading' || update.status === 'downloaded'
  const currentVersion = update.currentVersion ?? APP_VERSION
  const releaseUrl = update.version
    ? `${GITHUB_URL}/releases/tag/v${update.version.replace(/^v/i, '')}`
    : `${GITHUB_URL}/releases`

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line/45 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-grass/20 bg-grass/10 text-grass">
            <DownloadSimple size={20} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[16px] font-semibold text-ink">Launcher updates</h2>
              <Badge tone="neutral" className="h-5 text-[9px]">
                v{currentVersion}
              </Badge>
              {update.status === 'downloaded' && <Badge tone="green" className="h-5 text-[9px]">Ready</Badge>}
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              Built in and free. Newbie downloads updates from GitHub Releases in the background.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={checking || update.status === 'checking'}
          disabled={busy || update.status === 'downloaded'}
          onClick={() => void check()}
          icon={<Sparkle size={14} />}
        >
          Check now
        </Button>
      </div>

      <div className="px-5 py-4">
        <UpdateStatus
          update={update}
          checking={checking}
          installing={installing}
          onCheck={check}
          onInstall={install}
          releaseUrl={releaseUrl}
        />
      </div>

      {hasUpdate && update.releaseNotes && (
        <details className="group border-t border-line/40 px-5 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11.5px] font-medium text-ink outline-none [&::-webkit-details-marker]:hidden">
            <span>What&apos;s new in {update.version}</span>
            <CaretDown size={14} className="text-muted transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto pr-1">
            {parseReleaseNotes(update.releaseNotes).map((line, index) => {
              if (line.kind === 'space') return <div key={index} className="h-1.5" />
              if (line.kind === 'heading') {
                return (
                  <div key={index} className="pt-1.5 text-[11.5px] font-semibold text-ink/90">
                    {line.text}
                  </div>
                )
              }
              if (line.kind === 'bullet') {
                return (
                  <div key={index} className="flex gap-2 text-[11px] leading-relaxed text-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-grass/70" />
                    <span>{line.text}</span>
                  </div>
                )
              }
              return (
                <p key={index} className="text-[11px] leading-relaxed text-muted">
                  {line.text}
                </p>
              )
            })}
          </div>
        </details>
      )}

      <div className="grid gap-4 border-t border-line/40 bg-canvas/20 px-5 py-4 sm:grid-cols-2">
        <Switch
          checked={autoCheckUpdates}
          disabled={saving}
          onChange={(checked) => void setAutoCheck(checked)}
          label="Check automatically"
          description="Checks shortly after launch and every 30 minutes."
        />
        <Switch
          checked={allowPrerelease}
          disabled={saving}
          onChange={(checked) => void setPrerelease(checked)}
          label="Beta channel"
          description="Receive prerelease builds. Stable is recommended."
        />
      </div>
    </Card>
  )
}

function UpdateStatus({
  update,
  checking,
  installing,
  onCheck,
  onInstall,
  releaseUrl
}: {
  update: UpdateState
  checking: boolean
  installing: boolean
  onCheck: () => Promise<void>
  onInstall: () => Promise<void>
  releaseUrl: string
}) {
  const status = update.status
  const developmentBuild = status === 'none' && /development/i.test(update.message ?? '')
  const tone =
    status === 'error'
      ? 'border-danger/20 bg-danger/10 text-danger'
      : status === 'downloaded' || status === 'none'
        ? 'border-grass/20 bg-grass/10 text-grass'
        : status === 'idle'
          ? 'border-line/60 bg-elevated text-muted'
          : 'border-gold/20 bg-gold/10 text-gold'

  const icon =
    status === 'error' ? (
      <WarningCircle size={18} />
    ) : status === 'downloaded' || status === 'none' ? (
      <CheckCircle size={18} weight="fill" />
    ) : status === 'idle' ? (
      <DownloadSimple size={18} />
    ) : (
      <DownloadSimple size={18} className={status === 'checking' ? 'animate-pulse' : ''} />
    )

  const title =
    status === 'checking'
      ? 'Checking for updates'
      : developmentBuild
        ? 'Development build'
        : status === 'none'
          ? 'You are up to date'
          : status === 'available'
            ? `Version ${update.version ?? ''} is available`
            : status === 'downloading'
              ? `Downloading version ${update.version ?? ''}`
              : status === 'downloaded'
                ? `Version ${update.version ?? ''} is ready to install`
                : status === 'error'
                  ? 'Could not check for updates'
                  : 'Updates are ready when you are'

  const description =
    status === 'checking'
      ? 'Contacting GitHub Releases…'
      : developmentBuild
        ? 'Packaged builds check GitHub automatically. This development build does not update itself.'
        : status === 'none'
          ? update.message ?? `Newbie Launcher ${APP_VERSION} is the latest version.`
          : status === 'available'
            ? 'The download starts automatically. You can keep using the launcher.'
            : status === 'downloading'
              ? `${update.percent ?? 0}% · ${formatBytes(update.transferred)} of ${formatBytes(update.total)}${
                  formatSpeed(update.bytesPerSecond) ? ` · ${formatSpeed(update.bytesPerSecond)}` : ''
                }`
              : status === 'downloaded'
                ? 'Restart to finish installing. Worlds, instances, accounts and settings stay exactly as they are.'
                : status === 'error'
                  ? update.message ?? 'The update feed could not be reached.'
                  : 'Newbie checks GitHub Releases and installs only after you agree to restart.'

  return (
    <div className="flex items-start gap-3.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-muted">{description}</div>

        {status === 'downloading' && (
          <Progress value={update.percent ?? 0} className="mt-2.5 h-1.5" tone={update.percent === 100 ? 'green' : 'gold'} />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status === 'downloaded' && (
            <Button
              variant="primary"
              size="sm"
              loading={installing}
              onClick={() => void onInstall()}
              icon={<ArrowClockwise size={14} />}
            >
              Restart and install
            </Button>
          )}
          {status === 'error' && (
            <Button variant="primary" size="sm" loading={checking} onClick={() => void onCheck()} icon={<ArrowClockwise size={14} />}>
              Try again
            </Button>
          )}
          {status !== 'none' && status !== 'idle' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void window.newbie.app.openExternal(status === 'error' ? `${GITHUB_URL}/releases/latest` : releaseUrl)}
              icon={<ArrowSquareOut size={13} />}
            >
              {status === 'error' ? 'Download manually' : 'Release page'}
            </Button>
          )}
          {status === 'none' && !developmentBuild && update.lastCheckedAt && (
            <span className="text-[10px] text-muted/60">Checked {relativeTime(update.lastCheckedAt)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
