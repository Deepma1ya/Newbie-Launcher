import { useState } from 'react'
import { ArrowClockwise, CheckCircle, DownloadSimple } from '@phosphor-icons/react'
import { useUi } from '../store/ui'
import { Button } from './ui/Button'
import { Progress } from './ui/primitives'

export function UpdateBanner() {
  const update = useUi((state) => state.update)
  const [installing, setInstalling] = useState(false)

  if (update.status !== 'available' && update.status !== 'downloading' && update.status !== 'downloaded') {
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

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-grass/25 bg-grass/[0.045] px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-grass/20 bg-grass/10 text-grass">
        {update.status === 'downloaded' ? <CheckCircle size={17} weight="fill" /> : <DownloadSimple size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-ink">
          {update.status === 'downloaded'
            ? `Update ${update.version ?? ''} is ready`
            : update.status === 'downloading'
              ? `Downloading Newbie Launcher ${update.version ?? ''}`
              : `Newbie Launcher ${update.version ?? ''} is available`}
        </div>
        <div className="mt-0.5 text-[10.5px] text-muted">
          {update.status === 'downloaded'
            ? 'It will install when you close the launcher, or restart now.'
            : update.status === 'downloading'
              ? `${update.percent ?? 0}% downloaded in the background.`
              : 'The update is being prepared in the background.'}
        </div>
        {update.status === 'downloading' && (
          <Progress value={update.percent ?? 0} className="mt-2 h-1" />
        )}
      </div>
      {update.status === 'downloaded' && (
        <Button variant="primary" size="sm" loading={installing} onClick={() => void install()} icon={<ArrowClockwise size={14} />}>
          Restart and update
        </Button>
      )}
    </div>
  )
}
