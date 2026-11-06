import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  Check,
  Compass,
  Cube,
  DownloadSimple,
  Image,
  MagnifyingGlass,
  MapTrifold,
  Package,
  Plus,
  TShirt,
  WarningCircle
} from '@phosphor-icons/react'
import type { BedrockMarketProject } from '@shared/types'
import {
  useBedrockContent,
  useBedrockInstances,
  useBedrockMarketDetail,
  useBedrockMarketSearch,
  qk
} from '../hooks/queries'
import { toast } from '../store/ui'
import { errorMessage, formatNumber } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { ProjectIcon } from '../components/ui/BlockIcon'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import {
  Badge,
  Card,
  EmptyState,
  Input,
  Segmented,
  Select,
  Skeleton
} from '../components/ui/primitives'

const types = [
  { value: '1', label: 'Add-ons', icon: <Package size={14} /> },
  { value: '2', label: 'Maps', icon: <MapTrifold size={14} /> },
  { value: '3', label: 'Texture packs', icon: <Image size={14} /> },
  { value: '6', label: 'Skin packs', icon: <TShirt size={14} /> }
]

export function BedrockBrowsePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const instances = useBedrockInstances().data ?? []
  const active = instances.find((instance) => instance.active) ?? instances[0] ?? null
  const [targetId, setTargetId] = useState('')
  const target = instances.find((instance) => instance.id === targetId) ?? active
  const content = useBedrockContent(target?.id).data ?? []
  const installedSlugs = useMemo(
    () => new Set(content.map((item) => item.source?.slug).filter((slug): slug is string => Boolean(slug))),
    [content]
  )

  const [typeId, setTypeId] = useState('1')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState<'popularity_week' | 'popularity_all'>('popularity_week')
  const [page, setPage] = useState(1)
  const [slug, setSlug] = useState<string | null>(null)
  const [downloadId, setDownloadId] = useState<number | undefined>()
  const [installing, setInstalling] = useState<string | null>(null)

  useEffect(() => {
    if (!targetId && active) setTargetId(active.id)
  }, [active, targetId])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 380)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [typeId, debounced, sort])

  const search = useBedrockMarketSearch(
    { query: debounced, typeId: Number(typeId), page, sort },
    Boolean(target)
  )
  const detail = useBedrockMarketDetail(slug)

  useEffect(() => {
    setDownloadId(detail.data?.versions[0]?.id)
  }, [detail.data?.slug])

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.bedrockInstances })
    if (target) await queryClient.invalidateQueries({ queryKey: qk.bedrockContent(target.id) })
  }

  const install = async (item: BedrockMarketProject, versionId?: number): Promise<void> => {
    if (!target) {
      toast('info', 'Choose a Bedrock instance first', 'Create or select an instance, then install into it.')
      return
    }
    setInstalling(item.slug)
    try {
      await window.newbie.bedrock.marketInstall(target.id, item.slug, versionId)
      await invalidate()
      toast('success', 'Installed into Bedrock', `${item.title} was added to ${target.name}.`)
      setSlug(null)
    } catch (error) {
      toast('error', 'Could not install this Bedrock item', errorMessage(error))
    } finally {
      setInstalling(null)
    }
  }

  const results = search.data?.items ?? []
  const pageCount = search.data?.pageCount ?? 1

  return (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="Bedrock marketplace"
        description="Add-ons, worlds, texture packs and skin packs from MCPEDL, installed into the selected Bedrock instance."
        actions={
          target ? (
            <button
              onClick={() => navigate('/bedrock/instances')}
              className="flex items-center gap-2 rounded-xl border border-line/60 bg-card/60 px-3 py-2 text-left transition-colors hover:border-grass/30"
            >
              <Cube size={14} className="text-grass" />
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted">Installing to</span>
              <span className="max-w-[150px] truncate text-[11.5px] font-medium text-ink">
                {target.name}
              </span>
            </button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => navigate('/bedrock/instances')}
              icon={<Cube size={15} />}
            >
              Create an instance
            </Button>
          )
        }
      />

      {!target && (
        <EmptyState
          icon={<Cube size={22} />}
          title="Create a Bedrock instance first"
          description="Bedrock downloads are installed into an isolated profile. Create one to keep packs and worlds separate."
          action={
            <Button variant="primary" onClick={() => navigate('/bedrock/instances')} icon={<Plus size={15} />}>
              Go to Bedrock instances
            </Button>
          }
        />
      )}

      {target && (
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
                  placeholder={`Search ${types.find((entry) => entry.value === typeId)?.label.toLowerCase() ?? 'Bedrock content'}…`}
                  className="h-11 pl-10 text-[13.5px]"
                  aria-label="Search the Bedrock marketplace"
                />
              </div>
              <Segmented value={typeId} onChange={setTypeId} options={types} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={target.id}
                onChange={setTargetId}
                className="w-[210px]"
                aria-label="Target Bedrock instance"
              >
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} · {instance.worldCount} worlds
                  </option>
                ))}
              </Select>
              <Select
                value={sort}
                onChange={(value) => setSort(value as typeof sort)}
                className="w-[170px]"
                aria-label="Sort results"
              >
                <option value="popularity_week">Trending this week</option>
                <option value="popularity_all">Popular all time</option>
              </Select>
              <div className="ml-auto text-[10.5px] text-muted/60">
                {search.data
                  ? `${formatNumber(search.data.total)} results`
                  : search.isLoading
                    ? 'Loading MCPEDL…'
                    : ''}
              </div>
            </div>
          </div>

          {search.isError ? (
            <EmptyState
              icon={<WarningCircle size={22} />}
              title="MCPEDL is unavailable"
              description="The Bedrock catalog could not be reached. Check your connection and try again."
              action={
                <Button
                  variant="secondary"
                  onClick={() => void search.refetch()}
                  icon={<ArrowClockwise size={14} />}
                >
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
              icon={<Compass size={22} />}
              title="No Bedrock content found"
              description="Try a different search or switch to another category."
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
                {results.map((item) => {
                  const installed = installedSlugs.has(item.slug)
                  const busy = installing === item.slug
                  return (
                    <Card
                      key={item.slug}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${item.title}`}
                      className="group flex cursor-pointer flex-col overflow-hidden transition-colors hover:border-grass/25"
                      onClick={() => setSlug(item.slug)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSlug(item.slug)
                        }
                      }}
                    >
                      <div className="relative h-28 w-full overflow-hidden bg-elevated">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted/40">
                            <Package size={30} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-transparent to-transparent" />
                        <div className="absolute left-2 top-2">
                          <Badge tone="neutral">{item.typeLabel}</Badge>
                        </div>
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur">
                          <DownloadSimple size={10} />
                          {formatNumber(item.downloads)}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col p-3.5">
                        <div className="flex items-start gap-2">
                          <ProjectIcon url={item.imageUrl} name={item.title} size={34} />
                          <div className="min-w-0 flex-1">
                            <h2 className="line-clamp-1 text-[12.5px] font-semibold text-ink">
                              {item.title}
                            </h2>
                            <p className="mt-0.5 truncate text-[9.5px] text-muted/60">
                              {item.author ? `By ${item.author}` : 'MCPEDL'}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-muted/75">
                          {item.summary || 'No description provided.'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded border border-line/50 bg-white/[0.025] px-1.5 py-0.5 text-[8.5px] text-muted/70"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="text-[9.5px] text-muted/50">
                            {item.rating ? `${item.rating.toFixed(1)} ★` : 'Bedrock'}
                          </span>
                          <Button
                            size="sm"
                            variant={installed ? 'subtle' : 'primary'}
                            disabled={installed || Boolean(installing)}
                            loading={busy}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (!installed) void install(item)
                            }}
                            icon={installed ? <Check size={13} /> : <Plus size={13} />}
                          >
                            {installed ? 'Installed' : 'Install'}
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
                  Page {search.data?.page ?? page} of {pageCount}
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
        open={Boolean(slug)}
        onClose={() => setSlug(null)}
        title={detail.data?.title ?? 'Bedrock project'}
        description={detail.data?.author ? `By ${detail.data.author} · MCPEDL` : 'MCPEDL'}
        size="lg"
        footer={
          detail.data && target ? (
            <>
              <Button
                variant="ghost"
                onClick={() => void window.newbie.app.openExternal(detail.data!.url)}
                icon={<ArrowSquareOut size={13} />}
              >
                Open on MCPEDL
              </Button>
              <Button
                variant="primary"
                loading={installing === detail.data.slug}
                disabled={Boolean(installing) || detail.data.versions.length === 0}
                onClick={() => void install(detail.data!, downloadId)}
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
            <Skeleton className="h-44" />
            <Skeleton className="h-24" />
          </div>
        ) : detail.isError ? (
          <EmptyState
            icon={<WarningCircle size={22} />}
            title="Could not load this project"
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
                <img
                  src={detail.data.imageUrl}
                  alt=""
                  className="max-h-64 w-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">{detail.data.typeLabel}</Badge>
              <Badge tone="neutral">{formatNumber(detail.data.downloads)} downloads</Badge>
              {detail.data.rating && <Badge tone="gold">{detail.data.rating.toFixed(1)} ★</Badge>}
              {detail.data.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-muted">
              {detail.data.description || detail.data.summary || 'No description provided.'}
            </p>
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-ink">Download version</span>
              {detail.data.versions.length > 0 ? (
                <Select
                  value={String(downloadId ?? detail.data.versions[0]?.id ?? '')}
                  onChange={(value) => setDownloadId(Number(value))}
                >
                  {detail.data.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-[10.5px] text-danger/80">
                  This project has no direct download. Use the MCPEDL page instead.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
