import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle, ShieldCheck, Warning, WarningCircle, Wrench } from '@phosphor-icons/react'
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
  const instanceQuery = useInstance(state?.instanceId)
  const instance = instanceQuery.data
  const queryClient = useQueryClient()
  const [report, setReport] = useState<RepairReport | null>(null)
  const [scanning, setScanning] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ran, setRan] = useState(false)

  useEffect(() => {
    if (!state?.instanceId) return
    setReport(null)
    setRan(false)
    setError(null)
    setScanning(true)
    window.newbie.instances
      .repair(state.instanceId, false)
      .then((result) => {
        setReport(result)
        setRan(true)
      })
      .catch((cause) => setError(errorMessage(cause)))
      .finally(() => setScanning(false))
  }, [state?.instanceId])

  const fix = async (): Promise<void> => {
    if (!state?.instanceId) return
    setFixing(true)
    setError(null)
    try {
      const result = await window.newbie.instances.repair(state.instanceId, true)
      const after = await window.newbie.instances.repair(state.instanceId, false)
      setReport({ ...after, fixed: result.fixed, skipped: result.skipped, backupPath: result.backupPath })
      await queryClient.invalidateQueries({ queryKey: qk.instance(state.instanceId) })
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      toast('success', 'Repair finished', `${result.fixed} issue(s) fixed${result.skipped ? `, ${result.skipped} need attention` : ''}`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setFixing(false)
    }
  }

  const fixable = report?.issues.filter((issue) => issue.autoFixable).length ?? 0
  const unresolved = report?.issues.filter((issue) => !issue.autoFixable).length ?? 0

  return (
    <Modal
      open={Boolean(state)}
      onClose={() => closeModal('repair')}
      title="Repair instance"
      description="Find duplicate mods, wrong-loader files, missing dependencies and broken records."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => closeModal('repair')} disabled={fixing}>
            Close
          </Button>
          <Button
            variant="primary"
            loading={fixing}
            disabled={scanning || fixable === 0}
            onClick={() => void fix()}
            icon={<Wrench size={15} />}
          >
            {fixable > 0 ? `Fix ${fixable} safe issue${fixable === 1 ? '' : 's'}` : 'Nothing to fix'}
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
              {instance?.versionId} · {instance?.addons.length ?? 0} tracked add-ons · a copy of the mods folder is made before changes
            </div>
          </div>
        </div>

        {scanning && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Issues" value={String(report.issues.length)} />
              <Metric label="Safe fixes" value={String(fixable)} />
              <Metric label="Manual" value={String(unresolved)} />
            </div>

            {report.issues.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-grass/20 bg-grass/[0.035] py-10 text-center">
                <CheckCircle size={32} className="text-grass" weight="fill" />
                <div className="text-[13px] font-medium text-ink">This instance looks healthy</div>
                <div className="text-[11px] text-muted">No duplicate mods, loader conflicts or missing dependencies were found.</div>
              </div>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {report.issues.map((issue) => (
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
                              issue.autoFixable ? 'bg-grass/10 text-grass' : 'bg-white/[0.05] text-muted'
                            )}
                          >
                            {issue.autoFixable ? 'Auto-fix' : 'Manual'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{issue.detail}</p>
                        {issue.files.length > 0 && (
                          <div className="mt-1 font-mono text-[9.5px] text-muted/60">{issue.files.slice(0, 3).join(', ')}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/45 bg-canvas/30 p-2.5 text-center">
      <div className="font-display text-[18px] font-semibold text-ink">{value}</div>
      <div className="text-[9.5px] uppercase tracking-[0.08em] text-muted/70">{label}</div>
    </div>
  )
}
