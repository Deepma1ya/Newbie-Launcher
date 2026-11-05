import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle,
  Copy,
  DownloadSimple,
  FolderOpen,
  UploadSimple,
  UsersThree,
  WarningCircle
} from '@phosphor-icons/react'
import type {
  BulkAddonType,
  Instance,
  PackCopyResult,
  PackShareInfo
} from '@shared/types'
import { BULK_ADDON_TYPES, isBulkAddonType } from '@shared/addonBulk'
import { useInstances, qk } from '../../hooks/queries'
import { toast } from '../../store/ui'
import { cn, errorMessage, formatBytes } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge, Card, Segmented, Select, Switch } from '../ui/primitives'

const TYPE_LABELS: Record<BulkAddonType, string> = {
  mod: 'Mods',
  datapack: 'Datapacks',
  resourcepack: 'Resource packs',
  shader: 'Shaders'
}

export function PackTransferModal({
  open,
  onClose,
  source
}: {
  open: boolean
  onClose: () => void
  source: Instance
}) {
  const instances = useInstances().data ?? []
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const targets = useMemo(
    () => instances.filter((instance) => instance.id !== source.id),
    [instances, source.id]
  )
  const [tab, setTab] = useState<'share' | 'copy'>('share')
  const [targetId, setTargetId] = useState('')
  const [types, setTypes] = useState<Set<BulkAddonType>>(new Set(BULK_ADDON_TYPES))
  const [includeDisabled, setIncludeDisabled] = useState(false)
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState<'export' | 'share' | 'copy' | 'import' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [share, setShare] = useState<PackShareInfo | null>(null)
  const [copyResult, setCopyResult] = useState<PackCopyResult | null>(null)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const shareRef = useRef<PackShareInfo | null>(null)

  const enabledAddons = source.addons.filter(
    (addon) => addon.enabled && isBulkAddonType(addon.type)
  )
  const disabledAddons = source.addons.filter(
    (addon) => !addon.enabled && isBulkAddonType(addon.type)
  )
  const totalBytes = enabledAddons.reduce((sum, addon) => sum + (addon.size || 0), 0)
  const target = targets.find((instance) => instance.id === targetId)
  const mismatch = Boolean(
    target && (target.versionId !== source.versionId || target.loader !== source.loader)
  )

  useEffect(() => {
    if (!open) return
    setTab('share')
    setTargetId(targets[0]?.id ?? '')
    setTypes(new Set(BULK_ADDON_TYPES))
    setIncludeDisabled(false)
    setReplace(false)
    setError(null)
    setCopyResult(null)
    setExportNote(null)
    setBusy(null)
    // A target can disappear while the dialog is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source.id])

  useEffect(() => {
    if (!open) return
    setTargetId((current) =>
      current && targets.some((entry) => entry.id === current) ? current : (targets[0]?.id ?? '')
    )
  }, [open, targets])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.newbie.instances
      .packShare()
      .then((current) => {
        if (cancelled || current?.instanceId !== source.id) return
        shareRef.current = current
        setShare(current)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, source.id])

  useEffect(() => {
    return () => {
      if (shareRef.current) void window.newbie.instances.stopPackShare()
      shareRef.current = null
    }
  }, [])

  const close = (): void => {
    if (shareRef.current) {
      void window.newbie.instances.stopPackShare()
      shareRef.current = null
      setShare(null)
    }
    onClose()
  }

  const exportPack = async (): Promise<void> => {
    setBusy('export')
    setError(null)
    setExportNote(null)
    try {
      const result = await window.newbie.instances.exportPack(source.id)
      if (!result) return
      setExportNote(`${result.filename} · ${formatBytes(result.bytes)} · ${result.addons} add-on${result.addons === 1 ? '' : 's'}${result.skipped.length ? ` · ${result.skipped.length} skipped` : ''}`)
      toast('success', 'Modpack exported', result.filename)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(null)
    }
  }

  const importPack = async (): Promise<void> => {
    setError(null)
    try {
      const file = await window.newbie.app.pickFile([
        { name: 'Modrinth modpack', extensions: ['mrpack', 'zip'] }
      ])
      if (!file) return
      setBusy('import')
      const instance = await window.newbie.instances.importPack(file)
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      await queryClient.invalidateQueries({ queryKey: qk.disk })
      toast('success', 'Modpack imported', instance.name)
      close()
      navigate(`/instances/${instance.id}`)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(null)
    }
  }

  const startShare = async (): Promise<void> => {
    setBusy('share')
    setError(null)
    try {
      const info = await window.newbie.instances.sharePack(source.id)
      shareRef.current = info
      setShare(info)
      toast('info', 'Download link ready', 'Copy the link before closing this window.')
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(null)
    }
  }

  const stopShare = async (): Promise<void> => {
    await window.newbie.instances.stopPackShare().catch(() => undefined)
    shareRef.current = null
    setShare(null)
  }

  const copy = async (): Promise<void> => {
    if (!target || types.size === 0) return
    setBusy('copy')
    setError(null)
    setCopyResult(null)
    try {
      const result = await window.newbie.instances.copyAddons(source.id, target.id, {
        types: [...types],
        includeDisabled,
        replace
      })
      setCopyResult(result)
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      await queryClient.invalidateQueries({ queryKey: qk.instance(target.id) })
      toast(
        'success',
        result.copied > 0 ? 'Add-ons copied' : 'Nothing copied',
        `${result.copied} copied${result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}`
      )
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(null)
    }
  }

  const copyUrl = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      toast('success', 'Download link copied', url)
    } catch (failure) {
      toast('error', 'Could not copy the link', errorMessage(failure))
    }
  }

  const toggleType = (type: BulkAddonType): void => {
    setTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const typeCount = (type: BulkAddonType): number =>
    (includeDisabled ? [...enabledAddons, ...disabledAddons] : enabledAddons).filter(
      (addon) => addon.type === type
    ).length

  const footer =
    tab === 'copy' ? (
      <>
        <Button variant="ghost" onClick={close} disabled={Boolean(busy)}>
          Close
        </Button>
        <Button
          variant="primary"
          loading={busy === 'copy'}
          disabled={!target || types.size === 0 || booleanBusy(busy)}
          onClick={() => void copy()}
          icon={<Copy size={15} />}
        >
          {target ? `Copy to ${target.name}` : 'Copy add-ons'}
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" onClick={close} disabled={Boolean(busy)}>
          Close
        </Button>
        <Button
          variant="primary"
          loading={busy === 'share'}
          disabled={booleanBusy(busy) || enabledAddons.length === 0}
          onClick={() => void startShare()}
          icon={<UsersThree size={15} />}
        >
          {share ? 'Restart link' : 'Create download link'}
        </Button>
      </>
    )

  return (
    <Modal
      open={open}
      onClose={close}
      title="Share or move your modpack"
      description="Bundle the enabled add-ons from this instance, or copy the files to another instance."
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'share', label: 'Share pack' },
            { value: 'copy', label: 'Copy to instance' }
          ]}
        />

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-danger">
            <WarningCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {tab === 'share' ? (
          <>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-[14px] font-semibold text-ink">One file. Every enabled add-on.</h3>
                  <p className="mt-1 max-w-xl text-[10.5px] leading-relaxed text-muted">
                    Standard Modrinth `.mrpack`. Includes {enabledAddons.length} enabled add-on
                    {enabledAddons.length === 1 ? '' : 's'} and roughly {formatBytes(totalBytes)} of files. Worlds, configs,
                    accounts and disabled add-ons stay out.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy === 'export'}
                    disabled={booleanBusy(busy) || enabledAddons.length === 0}
                    onClick={() => void exportPack()}
                    icon={<DownloadSimple size={14} />}
                  >
                    Export .mrpack
                  </Button>
                  <Badge tone="green" className="h-5 text-[9px]">
                    mrpack
                  </Badge>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BULK_ADDON_TYPES.map((type) => (
                  <div key={type} className="rounded-lg border border-line/40 bg-canvas/25 px-2.5 py-2">
                    <div className="text-[9px] uppercase tracking-[0.08em] text-muted/60">{TYPE_LABELS[type]}</div>
                    <div className="mt-0.5 font-mono text-[12px] text-ink/85">
                      {enabledAddons.filter((addon) => addon.type === type).length}
                    </div>
                  </div>
                ))}
              </div>
              {source.addons.some(
                (addon) => addon.type === 'datapack' && addon.relativeFolder?.startsWith('saves/')
              ) && (
                <p className="mt-2 text-[10px] text-gold/80">
                  World-specific datapacks are skipped. Put them in the top-level datapacks folder to include them.
                </p>
              )}
            </Card>

            {share ? (
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-grass" weight="fill" />
                    <div>
                      <h3 className="font-display text-[13px] font-semibold text-ink">Download link is live</h3>
                      <p className="text-[10px] text-muted">
                        {share.filename} · {formatBytes(share.bytes)} · stops when you close this window
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void stopShare()}>
                    Stop sharing
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {share.urls.map((url, index) => (
                    <div
                      key={url}
                      className="flex items-center gap-2 rounded-lg border border-line/40 bg-canvas/25 px-2.5 py-2"
                    >
                      <span className="min-w-0 flex-1 break-all font-mono text-[9.5px] text-muted/80">{url}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void copyUrl(url)}
                        icon={<Copy size={13} />}
                      >
                        Copy
                      </Button>
                      {index === 0 && (
                        <Badge tone="neutral" className="h-4 px-1.5 text-[8px]">
                          This PC
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                {share.urls.length === 1 && (
                  <p className="mt-2 text-[10px] text-gold/80">
                    No LAN address was detected. This link only works on this PC; check your network adapter or use the
                    exported file instead.
                  </p>
                )}
                <p className="mt-2 text-[10px] leading-relaxed text-muted/65">
                  Friends download the `.mrpack` in a browser, then use <strong className="text-ink/80">Import pack</strong> on
                  the Instances page or in this dialog. The link is random and only serves this file. It is reachable on your LAN; internet
                  friends need port forwarding or a tunnel.
                </p>
              </Card>
            ) : (
              <Card className="p-4">
                <div className="flex items-start gap-2.5">
                  <UsersThree size={17} className="mt-0.5 shrink-0 text-grass" />
                  <div>
                    <h3 className="font-display text-[13px] font-semibold text-ink">Two ways to hand it over</h3>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                      Export a file to send through Discord or a file host, or create a temporary LAN download link. Friends
                      import either one into Newbie.
                    </p>
                  </div>
                </div>
                {exportNote && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-grass/20 bg-grass/[0.06] px-3 py-2 text-[10.5px] text-grass">
                    <CheckCircle size={13} weight="fill" />
                    <span className="min-w-0 flex-1 truncate font-mono">{exportNote}</span>
                    <FolderOpen size={13} />
                  </div>
                )}
              </Card>
            )}
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <UploadSimple size={17} className="mt-0.5 shrink-0 text-grass" />
                  <div>
                    <h3 className="font-display text-[13px] font-semibold text-ink">Import a .mrpack</h3>
                    <p className="mt-1 max-w-xl text-[10.5px] leading-relaxed text-muted">
                      Open a pack someone shared. Newbie reads its Minecraft version and loader, creates a matching
                      instance, then downloads the pack files. Your current instance is not changed.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === 'import'}
                  disabled={booleanBusy(busy)}
                  onClick={() => void importPack()}
                  icon={<UploadSimple size={14} />}
                >
                  Choose .mrpack
                </Button>
              </div>
            </Card>
          </>
        ) : (
          <>
            <div>
              <div className="text-[11.5px] font-medium text-ink">Target instance</div>
              <div className="mt-1.5">
                <Select value={targetId} onChange={setTargetId}>
                  {targets.length === 0 ? (
                    <option value="">Create another instance first</option>
                  ) : (
                    targets.map((instance) => (
                      <option key={instance.id} value={instance.id}>
                        {instance.name} · {instance.versionId} · {instance.loader}
                      </option>
                    ))
                  )}
                </Select>
              </div>
            </div>

            {mismatch && (
              <div className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2.5 text-[10.5px] leading-relaxed text-gold">
                <WarningCircle size={14} className="mt-0.5 shrink-0" />
                The target is {target?.versionId} with {target?.loader}. Mods may not load unless the version and loader
                match; resource packs, datapacks and shaders are usually safe.
              </div>
            )}

            <div>
              <div className="text-[11.5px] font-medium text-ink">What to copy</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {BULK_ADDON_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={types.has(type)}
                    onClick={() => toggleType(type)}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition',
                      types.has(type)
                        ? 'border-grass/35 bg-grass/[0.07] text-ink'
                        : 'border-line/50 bg-canvas/25 text-muted hover:border-line-strong'
                    )}
                  >
                    <span className="text-[11px] font-medium">{TYPE_LABELS[type]}</span>
                    <span className="font-mono text-[10px] text-muted/70">{typeCount(type)}</span>
                  </button>
                ))}
              </div>
            </div>

            {disabledAddons.length > 0 && (
              <Switch
                checked={includeDisabled}
                onChange={setIncludeDisabled}
                label="Include disabled add-ons"
                description={`${disabledAddons.length} disabled file${disabledAddons.length === 1 ? '' : 's'} will be copied as disabled.`}
              />
            )}
            <Switch
              checked={replace}
              onChange={setReplace}
              label="Replace existing files"
              description="Overwrite files with the same path in the target instance."
            />

            {copyResult && (
              <Card className="p-3">
                <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
                  <CheckCircle size={14} className="text-grass" weight="fill" />
                  {copyResult.copied} copied · {copyResult.skipped} skipped
                </div>
                {(copyResult.warnings.length > 0 || copyResult.conflicts.length > 0) && (
                  <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted/75">
                    {copyResult.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                    {copyResult.conflicts.slice(0, 6).map((conflict) => (
                      <p key={conflict} className="text-gold/80">
                        {conflict}
                      </p>
                    ))}
                  </div>
                )}
              </Card>
            )}

            <p className="text-[10px] leading-relaxed text-muted/60">
              Copying reads the source instance and writes into the target instance. The source stays untouched. Worlds and
              configs are not copied.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}

function booleanBusy(value: 'export' | 'share' | 'copy' | 'import' | null): boolean {
  return value !== null
}
