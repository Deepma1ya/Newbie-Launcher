import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CaretDown, Cube, Package, WarningCircle } from '@phosphor-icons/react'
import type { LoaderType } from '@shared/types'
import { useLoaderVersions, useMinecraftVersions, useSystemInfo, useTasks, qk } from '../../hooks/queries'
import { useUi, toast } from '../../store/ui'
import { errorMessage, formatBytes } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Progress, Segmented, Select, Switch } from '../ui/primitives'

const loaders: { value: LoaderType; label: string }[] = [
  { value: 'vanilla', label: 'Vanilla' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'quilt', label: 'Quilt' },
  { value: 'forge', label: 'Forge' },
  { value: 'neoforge', label: 'NeoForge' }
]

export function CreateInstanceModal() {
  const open = useUi((state) => state.modal.createInstance)
  const closeModal = useUi((state) => state.closeModal)
  const openModal = useUi((state) => state.openModal)
  const setActiveInstance = useUi((state) => state.setActiveInstance)
  const seed = useUi((state) => state.modal.createInstanceSeed)
  const versions = useMinecraftVersions()
  const system = useSystemInfo()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const tasks = useUi((state) => state.tasks)
  const allTasks = useTasks().data ?? []

  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [versionId, setVersionId] = useState('')
  const [loader, setLoader] = useState<LoaderType>('vanilla')
  const [loaderVersion, setLoaderVersion] = useState('')
  const [memoryMb, setMemoryMb] = useState(4096)
  const [releasesOnly, setReleasesOnly] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loaderVersions = useLoaderVersions(loader, versionId)

  const versionOptions = useMemo(() => {
    const list = (versions.data ?? []).filter((version) => !releasesOnly || version.type === 'release')
    return list.slice(0, releasesOnly ? 220 : 400)
  }, [versions.data, releasesOnly])

  useEffect(() => {
    if (!open) return
    setError(null)
    if (!versionId && versions.data?.length) {
      const latest = versions.data.find((version) => version.type === 'release') ?? versions.data[0]
      if (latest) setVersionId(latest.id)
    }
    setMemoryMb((current) =>
      current === 4096
        ? Math.max(2048, Math.min(8192, Math.round((system.data?.totalMemMb ?? 16384) / 8 / 256) * 256))
        : current
    )
    if (seed?.versionId) setVersionId(seed.versionId)
    if (seed?.loader) setLoader(seed.loader as LoaderType)
  }, [open, versions.data, seed, versionId, system.data])

  useEffect(() => {
    if (!versionId) return
    if (!nameTouched) setName(`Minecraft ${versionId}`)
  }, [versionId, nameTouched])

  useEffect(() => {
    const options = loaderVersions.data ?? []
    if (loader === 'vanilla') {
      setLoaderVersion('')
      return
    }
    if (options.length > 0 && !options.some((option) => option.version === loaderVersion)) {
      setLoaderVersion(options.find((option) => option.stable)?.version ?? options[0]!.version)
    }
  }, [loader, loaderVersion, loaderVersions.data])

  const loadingTask = [...Object.values(tasks), ...allTasks]
    .filter((task) => task.kind === 'install-version' && task.status === 'running')
    .sort((a, b) => b.startedAt - a.startedAt)[0]

  const create = async (): Promise<void> => {
    if (!versionId) return
    setCreating(true)
    setError(null)
    try {
      const instance = await window.newbie.instances.create({
        name: name.trim() || `Minecraft ${versionId}`,
        versionId,
        loader,
        loaderVersion: loader === 'vanilla' ? undefined : loaderVersion,
        memoryMb
      })
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      setActiveInstance(instance.id)
      closeModal('createInstance')
      toast('success', 'Instance created', `${instance.name} is ready to play`)
      navigate(`/instances/${instance.id}`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setCreating(false)
    }
  }

  const totalMem = system.data?.totalMemMb ?? 16384
  const maxMemory = Math.max(2048, Math.floor(totalMem * 0.75))

  return (
    <Modal
      open={open}
      onClose={() => !creating && closeModal('createInstance')}
      title="Create an instance"
      description="Pick a Minecraft version and a mod loader. Files are installed once and shared between instances."
      size="md"
      closeOnBackdrop={!creating}
      footer={
        <>
          <Button variant="ghost" onClick={() => closeModal('createInstance')} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={creating}
            disabled={!versionId || (loader !== 'vanilla' && !loaderVersion)}
            onClick={() => void create()}
            icon={<Cube size={16} />}
          >
            {creating ? 'Installing…' : 'Create instance'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Instance name">
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setNameTouched(true)
            }}
            placeholder="My survival world"
            maxLength={60}
          />
        </Field>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label="Minecraft version" hint={`${versionOptions.length} available`}>
            <Select value={versionId} onChange={setVersionId} data-autofocus>
              {versionOptions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id} · {version.type === 'release' ? 'Release' : version.type === 'snapshot' ? 'Snapshot' : version.type.replace('old_', '')}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex h-10 items-center pb-0.5">
            <Switch checked={releasesOnly} onChange={setReleasesOnly} label="Releases only" />
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.09em] text-muted">Mod loader</div>
          <Segmented value={loader} options={loaders} onChange={setLoader} className="w-full" />
          <p className="mt-1.5 text-[11px] text-muted/75">
            {loader === 'vanilla'
              ? 'Pure Minecraft. Best for vanilla servers and performance tuning.'
              : loader === 'fabric' || loader === 'quilt'
                ? 'Lightweight loader. Most Modrinth mods target Fabric.'
                : 'Forge-based ecosystems. Installation runs the official loader installer.'}
          </p>
        </div>

        {loader !== 'vanilla' && (
          <Field label={`${loader} version`} hint={`${loaderVersions.data?.length ?? 0} builds`}>
            <Select value={loaderVersion} onChange={setLoaderVersion}>
              {(loaderVersions.data ?? []).slice(0, 80).map((option) => (
                <option key={option.version} value={option.version}>
                  {option.label ? `${option.version} · ${option.label}` : option.version}
                </option>
              ))}
              {(loaderVersions.data?.length ?? 0) === 0 && <option value="">Loading builds…</option>}
            </Select>
          </Field>
        )}

        <Field label="Memory" hint={`${(memoryMb / 1024).toFixed(1)} GB of ${(totalMem / 1024).toFixed(0)} GB`}>
          <div className="pt-1">
            <input
              type="range"
              min={1024}
              max={maxMemory}
              step={256}
              value={memoryMb}
              onChange={(event) => setMemoryMb(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--grass))]"
              aria-label="Instance memory"
            />
            <div className="mt-1 flex justify-between font-mono text-[9.5px] text-muted/60">
              <span>1 GB</span>
              <span>{(maxMemory / 1024).toFixed(0)} GB</span>
            </div>
          </div>
        </Field>

        {creating && (
          <div className="rounded-xl border border-line/60 bg-canvas/50 p-3.5">
            <div className="flex items-center gap-2 text-[12px] text-ink">
              <Package size={15} className="text-grass" />
              {loadingTask?.title ?? 'Preparing installation'}
            </div>
            <div className="mt-1 text-[10.5px] text-muted">{loadingTask?.stage ?? 'Fetching version metadata…'}</div>
            <Progress value={loadingTask?.percent ?? 4} className="mt-2.5" />
            <p className="mt-2 text-[10px] leading-relaxed text-muted/60">
              Keep the launcher open while libraries and assets are checked. Existing files are reused across instances.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger/90">
            <WarningCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
