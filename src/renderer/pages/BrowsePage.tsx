import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowClockwise,
  Compass,
  Cube,
  Funnel,
  Image,
  MagnifyingGlass,
  Package,
  Sparkle,
  SquaresFour
} from '@phosphor-icons/react'
import type { AddonType, CurseForgeMod, LoaderType, ModrinthHit, SearchPage, SearchQuery } from '@shared/types'
import { useActiveInstance, useInstances, useMinecraftVersions, useSearch, qk } from '../hooks/queries'
import { useUi } from '../store/ui'
import { addonTypeLabel, formatNumber, loaderLabel } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { ProjectIcon } from '../components/ui/BlockIcon'
import { Badge, Card, EmptyState, Input, Segmented, Select, Skeleton } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'

const types: { value: AddonType; label: string; icon: React.ReactNode }[] = [
  { value: 'mod', label: 'Mods', icon: <Package size={14} /> },
  { value: 'modpack', label: 'Modpacks', icon: <SquaresFour size={14} /> },
  { value: 'resourcepack', label: 'Resource packs', icon: <Image size={14} /> },
  { value: 'shader', label: 'Shaders', icon: <Sparkle size={14} /> }
]

export function BrowsePage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const instances = useInstances().data ?? []
  const active = useActiveInstance()
  const setActive = useUi((state) => state.setActiveInstance)
  const openModal = useUi((state) => state.openModal)
  const versions = useMinecraftVersions().data ?? []

  const initialType = (params.get('type') as AddonType | null) ?? 'mod'
  const [type, setType] = useState<AddonType>(types.some((entry) => entry.value === initialType) ? initialType : 'mod')
  const [provider, setProvider] = useState<'modrinth' | 'curseforge'>('modrinth')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [gameVersion, setGameVersion] = useState(params.get('version') ?? active?.versionId ?? '')
  const [loader, setLoader] = useState<LoaderType>(active?.loader ?? 'fabric')
  const [sort, setSort] = useState<NonNullable<SearchQuery['sort']>>('relevance')
  const [offset, setOffset] = useState(0)
  const [accumulated, setAccumulated] = useState<SearchPage['hits']>([])

  const targetInstance = instances.find((instance) => instance.id === params.get('instance')) ?? active

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 380)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!gameVersion && versions.length > 0) {
      const latest = versions.find((version) => version.type === 'release') ?? versions[0]
      if (latest) setGameVersion(latest.id)
    }
  }, [gameVersion, versions])

  useEffect(() => {
    if (active && params.get('instance')) setActive(active.id)
  }, [active, params, setActive])

  useEffect(() => {
    setOffset(0)
    setAccumulated([])
  }, [type, provider, debounced, gameVersion, loader, sort])

  const searchQuery: SearchQuery = useMemo(
    () => ({
      query: debounced,
      type,
      gameVersion: gameVersion || undefined,
      loader: type === 'mod' || type === 'modpack' ? (loader === 'vanilla' ? undefined : loader) : undefined,
      sort,
      provider,
      offset,
      limit: 24
    }),
    [debounced, type, gameVersion, loader, sort, provider, offset]
  )

  const search = useSearch(searchQuery)
  const hideLoader = type === 'resourcepack' || type === 'shader'
  const releaseVersions = versions.filter((version) => version.type === 'release').slice(0, 120)

  useEffect(() => {
    if (!search.data) return
    setAccumulated((current) => (search.data.offset === 0 ? search.data.hits : [...current, ...search.data.hits]))
  }, [search.data])

  const changeType = (next: AddonType): void => {
    setType(next)
    setParams((current) => {
      const copy = new URLSearchParams(current)
      copy.set('type', next)
      return copy
    })
  }

  const results = accumulated
  const canLoadMore = (search.data?.offset ?? 0) + (search.data?.limit ?? 0) < (search.data?.total ?? 0)
  const requiresKey = provider === 'curseforge' && search.isError

  return (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="Browse"
        description="Mods, modpacks, resource packs and shaders from Modrinth and CurseForge — installed with dependencies handled."
        actions={
          targetInstance ? (
            <button
              onClick={() => navigate('/instances')}
              className="flex items-center gap-2 rounded-xl border border-line/60 bg-card/60 px-3 py-2 text-left transition-colors hover:border-grass/30"
            >
              <Package size={14} className="text-grass" />
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted">Installing to</span>
              <span className="max-w-[150px] truncate text-[11.5px] font-medium text-ink">{targetInstance.name}</span>
            </button>
          ) : (
            <Button variant="secondary" onClick={() => useUi.getState().openModal('createInstance', true)} icon={<Cube size={15} />}>
              Create an instance
            </Button>
          )
        }
      />

      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${types.find((entry) => entry.value === type)?.label.toLowerCase() ?? 'projects'}…`}
              className="h-11 pl-10 text-[13.5px]"
              aria-label="Search projects"
            />
          </div>
          <Segmented
            value={provider}
            onChange={setProvider}
            options={[
              { value: 'modrinth', label: 'Modrinth' },
              { value: 'curseforge', label: 'CurseForge' }
            ]}
          />
          <Segmented value={type} onChange={changeType} options={types} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Funnel size={14} className="text-muted/60" />
          <Select value={gameVersion} onChange={(event) => setGameVersion(event.target.value)} className="w-[160px]">
            {releaseVersions.map((version) => (
              <option key={version.id} value={version.id}>{version.id}</option>
            ))}
            {releaseVersions.length === 0 && <option value="">Any version</option>}
          </Select>
          {!hideLoader && (
            <Select value={loader} onChange={(event) => setLoader(event.target.value as LoaderType)} className="w-[140px]">
              <option value="vanilla">Any loader</option>
              <option value="fabric">Fabric</option>
              <option value="quilt">Quilt</option>
              <option value="forge">Forge</option>
              <option value="neoforge">NeoForge</option>
            </Select>
          )}
          <Select value={sort} onChange={(event) => setSort(event.target.value as NonNullable<SearchQuery['sort']>)} className="w-[150px]">
            <option value="relevance">Relevance</option>
            <option value="downloads">Downloads</option>
            <option value="follows">Followers</option>
            <option value="newest">Newest</option>
            <option value="updated">Recently updated</option>
          </Select>
          <div className="ml-auto text-[10.5px] text-muted/60">
            {search.data ? `${formatNumber(search.data.total)} results` : search.isLoading ? 'Searching…' : ''}
          </div>
        </div>
      </div>

      {requiresKey ? (
        <EmptyState
          icon={<Compass size={22} />}
          title="CurseForge needs an API key"
          description="CurseForge requires a personal API key for third-party apps. Add one in Settings → Downloads, or keep browsing Modrinth without a key."
          action={<Button variant="primary" onClick={() => navigate('/settings?section=downloads')}>Add API key</Button>}
        />
      ) : search.isLoading && results.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-[150px]" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Compass size={22} />}
          title="No projects found"
          description="Try a different search, version or loader. Some projects only publish for specific game versions."
          action={<Button variant="secondary" onClick={() => { setQuery(''); setDebounced('') }} icon={<ArrowClockwise size={14} />}>Reset search</Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((hit) => {
              const data = normalizeHit(hit, provider)
              return (
                <button
                  key={`${provider}-${data.id}`}
                  onClick={() => openModal('modDetail', { provider, id: data.id })}
                  className="card-hover flex min-h-[148px] flex-col rounded-2xl border border-line/55 bg-card/65 p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <ProjectIcon url={data.icon} name={data.title} size={46} className="rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[13.5px] font-semibold text-ink">{data.title}</div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-muted/65">
                        {addonTypeLabel(data.type)} · {formatNumber(data.downloads)} downloads
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{data.description}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                    {data.categories.slice(0, 3).map((category) => (
                      <Badge key={category} tone="neutral" className="h-5 text-[8.5px]">{category}</Badge>
                    ))}
                    {data.loaders.length > 0 && (
                      <span className="ml-auto text-[9.5px] text-muted/55">
                        {data.loaders.slice(0, 2).map(loaderLabel).join(' · ')}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {canLoadMore && (
            <div className="mt-5 flex justify-center">
              <Button variant="secondary" loading={search.isFetching} onClick={() => setOffset((current) => current + 24)}>
                Load more projects
              </Button>
            </div>
          )}
        </>
      )}

      <div className="mt-6 rounded-xl border border-line/40 bg-card/30 p-3 text-[10.5px] leading-relaxed text-muted/70">
        {provider === 'modrinth'
          ? 'Modrinth is free and open. Newbie resolves required dependencies and picks the newest compatible release for your selected loader and game version.'
          : 'CurseForge results use your personal API key. Some authors disable third-party downloads; those files can only be installed manually.'}
      </div>
    </div>
  )
}

function normalizeHit(hit: ModrinthHit | CurseForgeMod, provider: 'modrinth' | 'curseforge') {
  if (provider === 'modrinth' || 'project_id' in hit) {
    const modrinth = hit as ModrinthHit
    return {
      id: modrinth.project_id,
      title: modrinth.title,
      description: modrinth.description,
      icon: modrinth.icon_url ?? undefined,
      downloads: modrinth.downloads,
      categories: modrinth.display_categories ?? modrinth.categories ?? [],
      loaders: modrinth.categories ?? [],
      type: modrinth.project_type
    }
  }
  const curse = hit as CurseForgeMod
  return {
    id: String(curse.id),
    title: curse.name,
    description: curse.summary,
    icon: curse.logo?.thumbnailUrl ?? curse.logo?.url,
    downloads: curse.downloadCount,
    categories: curse.categories?.map((category) => category.name) ?? [],
    loaders: [],
    type: curse.classId === 4471 ? 'modpack' : curse.classId === 12 ? 'resourcepack' : curse.classId === 6552 ? 'shader' : 'mod'
  }
}
