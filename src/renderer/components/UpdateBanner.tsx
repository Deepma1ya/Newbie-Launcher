import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowClockwise, ArrowRight, CheckCircle, DownloadSimple } from '@phosphor-icons/react'
import { formatBytes, formatSpeed } from '@shared/update'
import { useUi } from '../store/ui'
import { Button } from './ui/Button'
import { Progress } from './ui/primitives'

export function UpdateBanner() {
  const update = useUi((state) => state.update)
  const [installing, setInstalling] = useState(false)
  const navigate = useNavigate()

  if (
    update.status !== 'available' &&
    update.status !== 'downloading' &&
    update.status !== 'downloaded' &&
    update.status !== 'installing'
  ) {
    return null
  }

  const install = async (): Promise<void> => {
    setInstalling(true)
    try {
      await window.newbie.updater.install()
    } catch {
      setInstalling(false)
    }
  }

  const details = (): void => {
    navigate('/settings?section=about')
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-grass/25 bg-grass/[0.045] px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-grass/20 bg-grass/10 text-grass">
        {update.status === 'downloaded' || update.status === 'installing' ? (
          <CheckCircle size={17} weight="fill" />
        ) : (
          <DownloadSimple size={17} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-ink">
          {update.status === 'installing'
            ? `Installing Newbie Launcher ${update.version ?? ''}`
            : update.status === 'downloaded'
              ? `Update ${update.version ?? ''} downloaded`
              : update.status === 'downloading'
                ? `Downloading Newbie Launcher ${update.version ?? ''}`
                : `Newbie Launcher ${update.version ?? ''} is available`}
        </div>
        <div className="mt-0.5 text-[10.5px] text-muted">
          {update.status === 'installing'
            ? 'Restarting the launcher now. The installer runs silently — no Next/Next.'
            : update.status === 'downloaded'
              ? update.message ??
                'Newbie restarts automatically to install it. Worlds, servers and settings stay as they are.'
              : update.status === 'downloading'
                ? `${update.percent ?? 0}% · ${formatBytes(update.transferred)} of ${formatBytes(update.total)}${
                    formatSpeed(update.bytesPerSecond) ? ` · ${formatSpeed(update.bytesPerSecond)}` : ''
                  }`
                : 'The update downloads and installs automatically in the background.'}
        </div>
        {update.status === 'downloading' && <Progress value={update.percent ?? 0} className="mt-2 h-1" />}
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={details} iconRight={<ArrowRight size={13} />}>
          Details
        </Button>
        {update.status === 'downloaded' && (
          <Button variant="primary" size="sm" loading={installing} onClick={() => void install()} icon={<ArrowClockwise size={14} />}>
            Install now
          </Button>
        )}
      </div>
    </div>
  )
}
