import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  FolderOpen,
  MagnifyingGlass,
  MapTrifold,
  Plus,
  WarningCircle
} from '@phosphor-icons/react'
import type { JavaMapProject } from '@shared/types'
import {
  useInstances,
  useJavaMapDetail,
  useJavaMapSearch,
  useActiveInstance,
  qk
} from '../hooks/queries'
import { toast } from '../store/ui'
import { errorMessage, formatBytes, formatNumber } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { ProjectIcon } from '../components/ui/BlockIcon'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Badge, Card, EmptyState, Input, Select, Skeleton } from '../components/ui/primitives'

const PAGE_SIZE = 20

export function JavaMapsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const instances = useInstances().data ?? []
  const active = useActiveInstance()
  const [targetId, setTargetId] = useState('')
  const target = instances.find((instance) => instance.id === targetId) ?? active
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState<'popular' | 'updated' | 'downloads'>('popular')
  const [page, setPage] = useState(1)
  const [mapId, setMapId] = useState<number | null>(null)
  const [fileId, setFileId] = useState<number | undefined>()
  const [installing, setInstalling] = useState<number | null>(null)

  useEffect(() => {
    if (!targetId && active) setTargetId(active.id)
  }, [active, targetId])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 380)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debounced, sort])

  const search = useJavaMapSearch(
    { query: debounced, sort, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE },
    Boolean(target)
  )
  const detail = useJavaMapDetail(mapId)

  useEffect(() => {
    setFileId(undefined)
  }, [mapId])

  useEffect(() => {
    setFileId(detail.data?.files.find((file) => file.releaseType === 1)?.id ?? detail.data?.files[0]?.id)
  }, [detail.data?.id])

  const install = async (map: JavaMapProject, selectedFileId?: number): Promise<void> => {
    if (!target) {
      toast('info', 'Choose an instance first', 'Create or select an instance, then install the map into it.')
      return
    }
    setInstalling(map.id)
    try {
      const result = await window.newbie.maps.install(target.id, map.id, selectedFileId)
      await queryClient.invalidateQueries({ queryKey: qk.worlds(target.id) })
      toast(
        'success',
        'Map installed',
        `${result.name} is in ${target.name}'s saves folder (${result.files} files).`
      )
      setMapId(null)
    } catch (error) {
      toast('error', 'Could not install this map', errorMessage(error))
    } finally {
      setInstalling(null)
    }
  }

  const results = search.data?.items ?? []
  const total = search.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        eyebrow="Java Edition"
        title="Maps"
        description="Download Java worlds from CurseForge and unpack them directly into the selected instance's saves folder."
        actions={
          target ? (
            <Button
              variant="secondary"
              onClick={() => void window.newbie.instances.openFolder(target.id)}
              icon={<FolderOpen size={15} />}
            >
              Open game folder
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => navigate('/instances')} icon={<Plus size={15} />}>
              Create an instance
            </Button>
          )
        }
      />

      {!target ? (
        <EmptyState
          icon={<MapTrifold size={22} />}
          title="Create an instance first"
          description="Maps are installed into an instance's saves folder. Create or select an instance, then browse maps."
          action={
            <Button variant="primary" onClick={() => navigate('/instances')} icon={<Plus size={15} />}>
              Go to instances
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <MagnifyingGlass
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search Java maps, adventures, parkour, survival…"
                  className="h-11 pl-10 text-[13.5px]"
                  aria-label="Search Java maps"
                />
              </div>
              <Select value={sort} onChange={(value) => setSort(value as typeof sort)} className="w-[180px]">
                <option value="popular">Most popular</option>
                <option value="downloads">Most downloaded</option>
                <option value="updated">Recently updated</option>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={target.id}
                onChange={setTargetId}
                className="w-[220px]"
                aria-label="Target instance"
              >
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} · {instance.versionId}
                  </option>
                ))}
              </Select>
              <span className="text-[10.5px] text-muted/60">
                Maps are unpacked into <span className="font-mono text-ink/70">saves/</span> and appear in Minecraft's world list.
              </span>
              <div className="ml-auto text-[10.5px] text-muted/60">
                {search.data
                  ? `${formatNumber(total)} maps`
                  : search.isLoading
                    ? 'Loading CurseForge…'
                    : ''}
              </div>
            </div>
          </div>

          {search.isError ? (
            <EmptyState
              icon={<WarningCircle size={22} />}
              title="The map catalog is unavailable"
              description="CurseForge could not be reached. Check your connection and try again."
              action={
                <Button variant="secondary" onClick={() => void search.refetch()} icon={<ArrowClockwise size={14} />}>
                  Retry
                </Button>
              }
            />
          ) : search.isLoading && results.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} className="h-[250px]" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<MapTrifold size={22} />}
              title="No maps found"
              description="Try a different search term or sort order."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setDebounced('')
                  }}
                  icon={<ArrowClockwise size={14} />}
                >
                  Reset search
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((map) => {
                  const busy = installing === map.id
                  return (
                    <Card
                      key={map.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${map.title}`}
                      className="group flex cursor-pointer flex-col overflow-hidden transition-colors hover:border-grass/25"
                      onClick={() => setMapId(map.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setMapId(map.id)
                        }
                      }}
                    >
                      <div className="relative h-32 w-full overflow-hidden bg-elevated">
                        {map.imageUrl ? (
                          <img
                            src={map.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted/40">
                            <MapTrifold size={34} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-transparent to-transparent" />
                        <div className="absolute left-2 top-2">
                          <Badge tone="neutral">Java map</Badge>
                        </div>
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur">
                          <DownloadSimple size={10} />
                          {formatNumber(map.downloads)}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col p-3.5">
                        <div className="flex items-start gap-2">
                          <ProjectIcon url={map.iconUrl ?? map.imageUrl} name={map.title} size={34} />
                          <div className="min-w-0 flex-1">
                            <h2 className="line-clamp-1 text-[12.5px] font-semibold text-ink">{map.title}</h2>
                            <p className="mt-0.5 truncate text-[9.5px] text-muted/60">
                              {map.author ? `By ${map.author}` : 'CurseForge'}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-muted/75">
                          {map.summary || 'No description provided.'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {map.categories.slice(0, 3).map((category) => (
                            <span
                              key={category}
                              className="rounded border border-line/50 bg-white/[0.025] px-1.5 py-0.5 text-[8.5px] text-muted/70"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="text-[9.5px] text-muted/50">
                            {map.updatedAt ? new Date(map.updatedAt).toLocaleDateString() : 'CurseForge'}
                          </span>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={Boolean(installing)}
                            loading={busy}
                            onClick={(event) => {
                              event.stopPropagation()
                              void install(map)
                            }}
                            icon={<DownloadSimple size={13} />}
                          >
                            Install
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || search.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  icon={<CaretLeft size={13} />}
                >
                  Previous
                </Button>
                <span className="text-[10.5px] text-muted/60">
                  Page {page} of {pageCount}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pageCount || search.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                  iconRight={<CaretRight size={13} />}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <Modal
        open={Boolean(mapId)}
        onClose={() => setMapId(null)}
        title={detail.data?.title ?? 'Java map'}
        description={detail.data?.author ? `By ${detail.data.author} · CurseForge` : 'CurseForge'}
        size="lg"
        footer={
          detail.data && target ? (
            <>
              <Button
                variant="ghost"
                onClick={() => void window.newbie.app.openExternal(detail.data!.url)}
                icon={<ArrowSquareOut size={13} />}
              >
                Open on CurseForge
              </Button>
              <Button
                variant="primary"
                loading={installing === detail.data.id}
                disabled={Boolean(installing) || detail.data.files.length === 0}
                onClick={() => void install(detail.data!, fileId)}
                icon={<DownloadSimple size={14} />}
              >
                Install to {target.name}
              </Button>
            </>
          ) : undefined
        }
      >
        {detail.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-24" />
          </div>
        ) : detail.isError ? (
          <EmptyState
            icon={<WarningCircle size={22} />}
            title="Could not load this map"
            description={errorMessage(detail.error)}
            action={
              <Button variant="secondary" onClick={() => void detail.refetch()} icon={<ArrowClockwise size={14} />}>
                Retry
              </Button>
            }
          />
        ) : detail.data ? (
          <div className="space-y-4">
            {detail.data.imageUrl && (
              <div className="overflow-hidden rounded-2xl border border-line/50">
                <img src={detail.data.imageUrl} alt="" className="max-h-64 w-full object-cover" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">Java map</Badge>
              <Badge tone="neutral">{formatNumber(detail.data.downloads)} downloads</Badge>
              {detail.data.categories.map((category) => (
                <Badge key={category} tone="neutral">
                  {category}
                </Badge>
              ))}
            </div>
            <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-muted">
              {detail.data.description || detail.data.summary || 'No description provided.'}
            </p>
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-ink">Download file</span>
              {detail.data.files.length > 0 ? (
                <>
                  <Select
                    value={String(fileId ?? detail.data.files[0]?.id ?? '')}
                    onChange={(value) => setFileId(Number(value))}
                  >
                    {detail.data.files.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.label}
                        {file.gameVersions.length > 0 ? ` · ${file.gameVersions.slice(0, 3).join(', ')}` : ''}
                      </option>
                    ))}
                  </Select>
                  {fileId !== undefined && (
                    <p className="text-[9.5px] text-muted/60">
                      {(() => {
                        const file = detail.data.files.find((entry) => entry.id === fileId)
                        return file ? `${file.filename} · ${formatBytes(file.size)}` : ''
                      })()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[10.5px] text-danger/80">
                  This map has no downloadable .zip file. Use the CurseForge page instead.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
