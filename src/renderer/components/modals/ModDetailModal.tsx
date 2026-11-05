import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowSquareOut,
  Calendar,
  CheckCircle,
  DownloadSimple,
  Info,
  Package,
  Star,
  WarningCircle
} from '@phosphor-icons/react'
import type { LoaderType, ModrinthProject, ModrinthVersion } from '@shared/types'
import { isPackCompatible } from '@shared/packCompatibility'
import { useActiveInstance, useInstances, useProject, useProjectVersions, qk } from '../../hooks/queries'
import { toast, useUi } from '../../store/ui'
import { addonTypeLabel, errorMessage, formatBytes, formatNumber, loaderLabel, relativeTime } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge, Divider, Field, Select, Skeleton } from '../ui/primitives'
import { ProjectIcon } from '../ui/BlockIcon'

export function ModDetailModal() {
  const detail = useUi((state) => state.modal.modDetail)
  const closeModal = useUi((state) => state.closeModal)
  const openModal = useUi((state) => state.openModal)
  const askConfirm = useUi((state) => state.askConfirm)
  const activeInstance = useActiveInstance()
  const instances = useInstances().data ?? []
  const projectQuery = useProject(detail?.id)
  const project = projectQuery.data
  const projectType = project?.project_type
  const filterLoader = projectType === 'mod' ? activeInstance?.loader : undefined
  const versionsQuery = useProjectVersions(
    detail?.id,
    projectType === 'modpack' ? undefined : activeInstance?.versionId,
    projectType === 'modpack' ? undefined : filterLoader
  )
  const vanillaBlocked = projectType === 'mod' && activeInstance?.loader === 'vanilla'
  const versions = versionsQuery.data ?? []
  const [selectedVersion, setSelectedVersion] = useState('')
  const [selectedInstanceId, setSelectedInstanceId] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!detail) {
      setSelectedVersion('')
      setSelectedInstanceId('')
      setInstalled(false)
      setInstalling(false)
    }
  }, [detail])

  useEffect(() => {
    if (versions.length === 0) return
    if (versions.some((version) => versionId(version) === selectedVersion)) return
    setSelectedVersion(versionId(versions[0]!))
  }, [versions, selectedVersion])

  const selected = useMemo(
    () => versions.find((version) => versionId(version) === selectedVersion) ?? versions[0],
    [versions, selectedVersion]
  )

  const packInfo = useMemo(() => packCompatibility(selected), [selected])
  const compatibleInstances = useMemo(() => {
    if (projectType !== 'modpack') return []
    return instances.filter((instance) =>
      packInfo.gameVersions.some((gameVersion) =>
        packInfo.loaders.some((loader) =>
          isPackCompatible(gameVersion, loader, instance.versionId, instance.loader)
        )
      )
    )
  }, [instances, packInfo, projectType])
  const targetInstance = compatibleInstances.find((instance) => instance.id === selectedInstanceId)

  useEffect(() => {
    if (selectedInstanceId && !compatibleInstances.some((instance) => instance.id === selectedInstanceId)) {
      setSelectedInstanceId('')
    }
  }, [compatibleInstances, selectedInstanceId])

  const title = project?.title
  const description = project?.description
  const icon = project?.icon_url
  const downloads = project?.downloads
  const body = project?.body
  const gallery = project?.gallery ?? []
  const categories = project?.categories ?? []
  const sourceUrl = project?.source_url

  const install = async (): Promise<void> => {
    if (!selected || !detail) return
    if (projectType === 'modpack' && targetInstance) {
      askConfirm({
        title: `Add ${title ?? 'modpack'} to ${targetInstance.name}?`,
        description:
          'The pack files and overrides will be added to this instance. Existing add-ons are kept where possible, and a backup of mods, configs and packs is created before anything changes.',
        confirmLabel: 'Add modpack',
        action: async () => {
          await window.newbie.modpacks.installToInstance(targetInstance.id, detail.id, versionId(selected))
          await queryClient.invalidateQueries({ queryKey: qk.instances })
          await queryClient.invalidateQueries({ queryKey: qk.instance(targetInstance.id) })
          await queryClient.invalidateQueries({ queryKey: qk.disk })
          useUi.getState().setActiveInstance(targetInstance.id)
          closeModal('modDetail')
          toast('success', 'Modpack added', `${title ?? 'The pack'} was applied to ${targetInstance.name}`)
          window.location.hash = `#/instances/${targetInstance.id}`
        }
      })
      return
    }
    setInstalling(true)
    try {
      if (projectType === 'modpack') {
        const instance = await window.newbie.modpacks.install(detail.id, versionId(selected))
        await queryClient.invalidateQueries({ queryKey: qk.instances })
        useUi.getState().setActiveInstance(instance.id)
        closeModal('modDetail')
        toast('success', 'Modpack ready', `${instance.name} is installed`)
        window.location.hash = `#/instances/${instance.id}`
        return
      }
      if (!activeInstance) {
        closeModal('modDetail')
        openModal('createInstance', true)
        return
      }
      await window.newbie.addons.install(activeInstance.id, {
        projectId: detail.id,
        versionId: versionId(selected)
      })
      await queryClient.invalidateQueries({ queryKey: qk.instances })
      await queryClient.invalidateQueries({ queryKey: qk.instance(activeInstance.id) })
      setInstalled(true)
      toast('success', 'Installed', `${title} was added to ${activeInstance.name}`)
    } catch (error) {
      toast('error', 'Install failed', errorMessage(error))
    } finally {
      setInstalling(false)
    }
  }

  const close = (): void => closeModal('modDetail')

  return (
    <Modal
      open={Boolean(detail)}
      onClose={close}
      title={title ?? 'Loading project'}
      description={projectType ? `${addonTypeLabel(projectType)} · Modrinth` : undefined}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          {installed ? (
            <Button variant="secondary" icon={<CheckCircle size={15} weight="fill" />} onClick={close}>
              Installed
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={installing}
              disabled={!selected || (!activeInstance && projectType !== 'modpack') || vanillaBlocked}
              onClick={() => void install()}
              icon={<DownloadSimple size={16} />}
            >
              {vanillaBlocked
                ? 'Vanilla cannot load mods'
                : projectType === 'modpack'
                  ? targetInstance
                    ? `Add to ${targetInstance.name}`
                    : 'Create instance from modpack'
                  : activeInstance
                    ? `Install to ${activeInstance.name}`
                    : 'Create an instance first'}
            </Button>
          )}
        </>
      }
    >
      {projectQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : projectQuery.isError || !project ? (
        <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-[12px] text-danger">
          <WarningCircle size={16} /> {errorMessage(projectQuery.error)}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <ProjectIcon url={icon ?? undefined} name={title ?? '?'} size={68} className="rounded-2xl" />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[22px] font-semibold leading-tight text-ink">{title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{description}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge tone="green">{addonTypeLabel(projectType ?? 'mod')}</Badge>
                  {categories.slice(0, 4).map((category) => (
                    <Badge key={category} tone="neutral">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <Stat icon={<DownloadSimple size={15} />} label="Downloads" value={formatNumber(downloads ?? 0)} />
              <Stat
                icon={<Star size={15} />}
                label="Followers"
                value={formatNumber(project.followers)}
              />
              <Stat
                icon={<Calendar size={15} />}
                label="Updated"
                value={relativeTime(project.updated)}
              />
            </div>

            {gallery.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Gallery</div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {gallery.slice(0, 6).map((image) => (
                    <button
                      key={image.url}
                      onClick={() => void window.newbie.app.openExternal(image.url)}
                      className="relative h-28 w-44 shrink-0 overflow-hidden rounded-xl border border-line/60 bg-elevated"
                    >
                      <img src={image.url} alt={image.title ?? ''} className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {body && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">About</div>
                <div className="max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/40 bg-canvas/35 p-4 text-[12.5px] leading-[1.75] text-muted">
                  {stripMarkdown(body).slice(0, 12_000)}
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {projectType === 'modpack'
                    ? 'Pack versions'
                    : `Versions${activeInstance ? ` for ${activeInstance.versionId}` : ''}`}
                </div>
                {sourceUrl && (
                  <button
                    onClick={() => void window.newbie.app.openExternal(sourceUrl)}
                    className="inline-flex items-center gap-1 text-[11px] text-grass hover:underline"
                  >
                    Project page <ArrowSquareOut size={11} />
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {versionsQuery.isLoading && <Skeleton className="h-14 w-full" />}
                {!versionsQuery.isLoading && versions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-line/60 p-4 text-[11.5px] text-muted">
                    No version of this project matches {activeInstance ? `${activeInstance.versionId} / ${loaderLabel(activeInstance.loader)}` : 'the current filters'}.
                  </div>
                )}
                {versions.slice(0, 12).map((version) => {
                  const id = versionId(version)
                  const active = id === selectedVersion
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedVersion(id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        active ? 'border-grass/35 bg-grass/[0.04]' : 'border-line/45 bg-canvas/25 hover:border-line/75'
                      }`}
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-grass/15 text-grass' : 'bg-white/[0.04] text-muted'}`}>
                        <Package size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-ink">{versionName(version)}</span>
                        <span className="mt-0.5 block text-[10px] text-muted/75">{versionMeta(version)}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-muted/60">{formatBytes(versionSize(version))}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-0 lg:h-fit">
            <div className="rounded-2xl border border-line/60 bg-canvas/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Install</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                {projectType === 'modpack'
                  ? 'Create a fresh instance, or add the pack to an existing instance with the same version and loader.'
                  : activeInstance
                    ? `Target: ${activeInstance.name} · ${activeInstance.versionId} · ${loaderLabel(activeInstance.loader)}`
                    : 'Create an instance first, then install this project into it.'}
              </p>
              <div className="mt-3">
                <Field label="Version">
                  <Select value={selectedVersion} onChange={setSelectedVersion}>
                    {versions.map((version) => (
                      <option key={versionId(version)} value={versionId(version)}>
                        {versionName(version)}
                      </option>
                    ))}
                    {versions.length === 0 && <option value="">No compatible versions</option>}
                  </Select>
                </Field>
              </div>
              {projectType === 'modpack' && (
                <div className="mt-3">
                  <Field label="Install target">
                    <Select value={selectedInstanceId} onChange={setSelectedInstanceId}>
                      <option value="">New instance</option>
                      {compatibleInstances.map((instance) => (
                        <option key={instance.id} value={instance.id}>
                          {instance.name} · {instance.versionId} · {loaderLabel(instance.loader)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted/70">
                    {compatibleInstances.length > 0
                      ? `${compatibleInstances.length} existing instance${compatibleInstances.length === 1 ? '' : 's'} match this pack version.`
                      : 'No existing instance matches this pack version and loader yet.'}
                  </p>
                </div>
              )}
              {selected && (
                <div className="mt-3 space-y-1.5 text-[10.5px] text-muted/75">
                  <div className="flex justify-between gap-2">
                    <span>Published</span>
                    <span className="text-ink/80">{versionDate(selected)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Size</span>
                    <span className="text-ink/80">{formatBytes(versionSize(selected))}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Type</span>
                    <span className="text-ink/80">{versionChannel(selected)}</span>
                  </div>
                </div>
              )}
              <Divider className="my-3" />
              {vanillaBlocked && activeInstance && (
                <div className="mb-2.5 rounded-lg border border-gold/25 bg-gold/[0.04] p-2.5 text-[10px] leading-relaxed text-gold/85">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <WarningCircle size={13} /> Vanilla instance
                  </div>
                  <p className="mt-1">
                    Minecraft cannot load mods without a loader. Switch this instance to Fabric, or create a separate modded
                    instance.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await window.newbie.instances.update(activeInstance.id, { loader: 'fabric' })
                        await queryClient.invalidateQueries({ queryKey: qk.instances })
                        await queryClient.invalidateQueries({ queryKey: qk.instance(activeInstance.id) })
                        toast('success', 'Fabric enabled', `${activeInstance.name} can now load mods`)
                      } catch (error) {
                        toast('error', 'Could not enable Fabric', errorMessage(error))
                      }
                    }}
                    className="mt-1.5 font-semibold text-grass hover:underline"
                  >
                    Switch to Fabric
                  </button>
                </div>
              )}
              <div className="flex items-start gap-2 rounded-lg bg-white/[0.025] p-2.5 text-[10px] leading-relaxed text-muted/70">
                <Info size={13} className="mt-0.5 shrink-0" />
                Required dependencies are installed automatically. Conflicts can be fixed from the instance Repair panel.
              </div>
            </div>
          </aside>
        </div>
      )}
    </Modal>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/45 bg-canvas/30 p-2.5">
      <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.08em] text-muted/70">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-[14px] font-semibold text-ink">{value}</div>
    </div>
  )
}

function versionId(version: ModrinthVersion): string {
  return version.id
}

function packCompatibility(version?: ModrinthVersion): {
  gameVersions: string[]
  loaders: LoaderType[]
} {
  if (!version) return { gameVersions: [], loaders: [] }
  const gameVersions = version.game_versions
  const loaders = version.loaders
    .map((loader) => loader.toLowerCase())
    .map((loader) => (loader === 'minecraft' ? 'vanilla' : loader))
    .filter((loader): loader is LoaderType =>
      ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'].includes(loader)
    )
  return { gameVersions, loaders }
}

function versionName(version: ModrinthVersion): string {
  return version.version_number
}

function versionSize(version: ModrinthVersion): number {
  return version.files.find((file) => file.primary)?.size ?? version.files[0]?.size ?? 0
}

function versionMeta(version: ModrinthVersion): string {
  return `${version.game_versions.slice(-3).join(', ')} · ${version.loaders.join(', ')}`
}

function versionDate(version: ModrinthVersion): string {
  return relativeTime(version.date_published)
}

function versionChannel(version: ModrinthVersion): string {
  return version.version_type
}


function stripMarkdown(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_~`]{1,3}/g, '')
    .replace(/^\s*\[\s*\]\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\r/g, '')
    .trim()
}
