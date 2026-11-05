import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowClockwise, CheckCircle, ShieldCheck, Warning, WarningCircle, Wrench } from '@phosphor-icons/react'
import type { RepairReport } from '@shared/types'
import { useInstance, qk } from '../../hooks/queries'
import { toast, useUi } from '../../store/ui'
import { cn, errorMessage } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Progress, Skeleton } from '../ui/primitives'

export function RepairModal() {
  const state = useUi((store) => store.modal.repair)
  const closeModal = useUi((store) => store.closeModal)
  const askConfirm = useUi((store) => store.askConfirm)
  const instanceQuery = useInstance(state?.instanceId)
  const instance = instanceQuery.data
  const queryClient = useQueryClient()
  const [report, setReport] = useState<RepairReport | null>(null)
  const [scanning, setScanning] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async (): Promise<void> => {
    if (!state?.instanceId) return
    setReport(null)
    setError(null)
    setScanning(true)
    try {
      const result = await window.newbie.instances.repair(state.instanceId, false)
      setReport(result)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setScanning(false)
    }
  }, [state?.instanceId])

  useEffect(() => {
    void scan()
  }, [scan])

  const refresh = useCallback(async (): Promise<void> => {
    if (!state?.instanceId) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.instance(state.instanceId) }),
      queryClient.invalidateQueries({ queryKey: qk.instances })
    ])
  }, [queryClient, state?.instanceId])

  const confirmDisables = (current: RepairReport): void => {
    if (!state?.instanceId) return
    const instanceId = state.instanceId
    const disables = current.issues.filter((issue) => issue.autoFixable && issue.requiresDisable)
    if (disables.length === 0) return
    const noun = disables.length === 1 ? 'mod' : 'mods'
    const list = disables
      .map((issue) => `• ${issue.title}${issue.files.length ? ` — ${issue.files.slice(0, 2).join(', ')}` : ''}`)
      .join('\n')
    const backupPath = current.backupPath

    askConfirm({
      title: `Disable ${disables.length} ${noun}?`,
      description:
        'Newbie tried installing missing dependencies and enabling disabled ones first. These files still cannot stay active.',
      body: `${list}\n\nDisabling renames the file to .disabled. Nothing is deleted, and a copy of the mods folder is kept as a backup.`,
      confirmLabel: `Disable ${disables.length} ${noun}`,
      danger: true,
      onCancel: () =>
        toast('info', 'No mods were disabled', 'The conflicts stay listed so you can review them later.'),
      action: async () => {
        setFixing(true)
        setError(null)
        try {
          const result = await window.newbie.instances.repair(
            instanceId,
            true,
            true,
            backupPath
          )
          setReport(result)
          await refresh()
          const kind = result.failed > 0 ? (result.fixed > 0 ? 'info' : 'error') : 'success'
          toast(
            kind,
            'Repair finished',
            `${result.fixed} fixed${result.failed ? `, ${result.failed} failed` : ''}${
              result.skipped ? `, ${result.skipped} need attention` : ''
            }`
          )
        } catch (cause) {
          const message = errorMessage(cause)
          setError(message)
          throw cause
        } finally {
          setFixing(false)
        }
      }
    })
  }

  const fix = async (): Promise<void> => {
    if (!state?.instanceId || !report) return
    const safeFixes = report.issues.filter((issue) => issue.autoFixable && !issue.requiresDisable)
    const disables = report.issues.filter((issue) => issue.autoFixable && issue.requiresDisable)
    if (safeFixes.length === 0 && disables.length > 0) {
      confirmDisables(report)
      return
    }

    setFixing(true)
    setError(null)
    try {
      // Phase one never disables a mod: install dependencies, enable disabled providers, restore files.
      const result = await window.newbie.instances.repair(state.instanceId, true, false)
      setReport(result)
      await refresh()

      if (result.fixed > 0) {
        toast(
          'success',
          'Dependencies fixed',
          `${result.fixed} safe fix${result.fixed === 1 ? '' : 'es'} applied. No mods were disabled.`
        )
      }

      if (result.pendingDisables > 0) {
        confirmDisables(result)
        return
      }

      const kind = result.failed > 0 ? (result.fixed > 0 ? 'info' : 'error') : 'success'
      toast(
        kind,
        'Repair finished',
        `${result.fixed} fixed${result.failed ? `, ${result.failed} failed` : ''}${
          result.skipped ? `, ${result.skipped} need attention` : ''
        }`
      )
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setFixing(false)
    }
  }

  const retryFailed = async (): Promise<void> => {
    if (!state?.instanceId) return
    setRetrying(true)
    setError(null)
    try {
      await window.newbie.instances.clearRepairFailures(state.instanceId)
      await scan()
      toast('info', 'Automatic fixes re-enabled', 'The previously failed fixes can be retried with Fix.')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setRetrying(false)
    }
  }

  const safeFixable = report?.issues.filter((issue) => issue.autoFixable && !issue.requiresDisable).length ?? 0
  const disableCount = report?.issues.filter((issue) => issue.autoFixable && issue.requiresDisable).length ?? 0
  const unresolved = report?.issues.filter((issue) => !issue.autoFixable).length ?? 0
  const fixable = safeFixable + disableCount

  return (
    <Modal
      open={Boolean(state)}
      onClose={() => closeModal('repair')}
      title="Repair instance"
      description="Newbie fixes dependencies first. Mods are only disabled after you confirm."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => closeModal('repair')} disabled={fixing}>
            Close
          </Button>
          <Button
            variant="ghost"
            onClick={() => void scan()}
            disabled={fixing || scanning}
            icon={<ArrowClockwise size={14} />}
          >
            Rescan
          </Button>
          <Button
            variant="primary"
            loading={fixing}
            disabled={scanning || fixable === 0}
            onClick={() => void fix()}
            icon={<Wrench size={15} />}
          >
            {fixable === 0
              ? 'Nothing to fix'
              : safeFixable > 0
                ? `Fix ${fixable} issue${fixable === 1 ? '' : 's'}`
                : `Review ${disableCount} conflict${disableCount === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-line/55 bg-canvas/35 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-grass/20 bg-grass/8 text-grass">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-ink">{instance?.name ?? 'Instance'}</div>
            <div className="text-[10.5px] text-muted">
              {instance?.versionId} · {instance?.addons.length ?? 0} tracked add-ons · a copy of the mods folder is made before files are changed
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-grass/15 bg-grass/[0.025] px-3 py-2 text-[10.5px] leading-relaxed text-grass/85">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          Fabric API, Sodium, config libraries and other essential mods are protected from conflict disables.
        </div>

        {scanning && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Issues" value={String(report.issues.length)} />
              <Metric label="Safe fixes" value={String(safeFixable)} tone={safeFixable > 0 ? 'grass' : undefined} />
              <Metric label="Needs disable" value={String(disableCount)} tone={disableCount > 0 ? 'gold' : undefined} />
              <Metric label="Manual" value={String(unresolved)} />
            </div>

            {(report.fixed > 0 || report.failed > 0) && (
              <div
                className={cn(
                  'rounded-xl border px-3 py-2 text-[10.5px] leading-relaxed',
                  report.failed > 0
                    ? 'border-gold/25 bg-gold/[0.045] text-gold'
                    : report.pendingDisables > 0
                      ? 'border-gold/20 bg-gold/[0.035] text-gold'
                      : 'border-grass/20 bg-grass/[0.04] text-grass'
                )}
              >
                Last repair: {report.fixed} fixed
                {report.failed > 0 ? ` · ${report.failed} failed` : ''}
                {report.pendingDisables > 0
                  ? ` · ${report.pendingDisables} waiting for your confirmation`
                  : ''}
                {report.failed > 0 ? '. Failed fixes are marked Manual and will not repeat automatically.' : '.'}
              </div>
            )}

            {disableCount > 0 && (
              <div className="rounded-xl border border-gold/20 bg-gold/[0.035] px-3 py-2 text-[10.5px] leading-relaxed text-gold/90">
                {disableCount} issue{disableCount === 1 ? '' : 's'} can only be resolved by disabling a mod.
                Dependencies are installed and disabled mods are re-enabled first; a confirmation popup appears
                before anything is disabled.
              </div>
            )}

            {report.blocked > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/[0.045] p-3">
                <div className="min-w-0 text-[10.5px] leading-relaxed text-gold">
                  {report.blocked} automatic fix{report.blocked === 1 ? '' : 'es'} failed before and{' '}
                  {report.blocked === 1 ? 'is' : 'are'} paused to avoid repeating.
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={retrying}
                  disabled={fixing || scanning}
                  onClick={() => void retryFailed()}
                  icon={<ArrowClockwise size={13} />}
                >
                  Retry automatic fixes
                </Button>
              </div>
            )}

            {report.issues.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-grass/20 bg-grass/[0.035] py-10 text-center">
                <CheckCircle size={32} className="text-grass" weight="fill" />
                <div className="text-[13px] font-medium text-ink">This instance looks healthy</div>
                <div className="text-[11px] text-muted">No duplicate mods, loader conflicts or missing dependencies were found.</div>
              </div>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {report.issues.map((issue) => {
                  const badge = issue.autoFixable
                    ? issue.requiresDisable
                      ? { label: 'Needs disable', className: 'bg-gold/10 text-gold' }
                      : { label: 'Safe fix', className: 'bg-grass/10 text-grass' }
                    : { label: 'Manual', className: 'bg-white/[0.05] text-muted' }
                  return (
                    <div
                      key={issue.id}
                      className={cn(
                        'rounded-xl border p-3',
                        issue.severity === 'error'
                          ? 'border-danger/20 bg-danger/[0.035]'
                          : 'border-gold/20 bg-gold/[0.025]'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {issue.severity === 'error' ? (
                          <WarningCircle size={16} className="mt-0.5 shrink-0 text-danger" />
                        ) : (
                          <Warning size={16} className="mt-0.5 shrink-0 text-gold" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12.5px] font-medium text-ink">{issue.title}</span>
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em]',
                                badge.className
                              )}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{issue.detail}</p>
                          {issue.files.length > 0 && (
                            <div className="mt-1 font-mono text-[9.5px] text-muted/60">{issue.files.slice(0, 3).join(', ')}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {report.backupPath && (
              <div className="text-[10.5px] text-muted/65">
                Backup created before repair. Open it from the instance backups folder.
              </div>
            )}
          </>
        )}

        {fixing && <Progress value={50} />}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger">
            <WarningCircle size={15} className="mt-0.5" /> {error}
          </div>
        )}
      </div>
    </Modal>
  )
}

function Metric({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone?: 'grass' | 'gold'
}) {
  return (
    <div className="rounded-xl border border-line/45 bg-canvas/30 p-2.5 text-center">
      <div
        className={cn(
          'font-display text-[18px] font-semibold',
          tone === 'grass' ? 'text-grass' : tone === 'gold' ? 'text-gold' : 'text-ink'
        )}
      >
        {value}
      </div>
      <div className="text-[9.5px] uppercase tracking-[0.08em] text-muted/70">{label}</div>
    </div>
  )
}
