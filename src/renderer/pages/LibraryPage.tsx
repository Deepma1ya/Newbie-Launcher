import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowsClockwise,
  Books,
  MagnifyingGlass,
  Package,
  Plus,
  SquaresFour,
  Wrench
} from '@phosphor-icons/react'
import { useActiveInstance, useInstances, qk } from '../hooks/queries'
import { useUi, toast } from '../store/ui'
import { errorMessage, formatBytes } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { AddonRow } from '../components/AddonRow'
import { LoadoutCard } from '../components/LoadoutCard'
import { BlockIcon } from '../components/ui/BlockIcon'
import { Badge, Card, EmptyState, Input, Segmented, Select } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'

type TypeFilter = 'all' | 'mod' | 'resourcepack' | 'shader'

export function LibraryPage() {
  const instances = useInstances().data ?? []
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const openModal = useUi((state) => state.openModal)
  const activeInstance = useActiveInstance()
  const selectedId = params.get('instance') ?? activeInstance?.id ?? instances[0]?.id ?? ''
  const instance = instances.find((candidate) => candidate.id === selectedId) ?? activeInstance ?? instances[0]
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (!params.get('instance') && instance) setParams({ instance: instance.id }, { replace: true })
  }, [instance, params, setParams])

  if (instances.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Library" title="Library" description="Everything installed across your instances." />
        <EmptyState
          icon={<Books size={22} />}
          title="Nothing installed yet"
          description="Create an instance first, then install mods, resource packs and shaders from Browse."
          action={<Button variant="primary" onClick={() => openModal('createInstance', true)} icon={<Plus size={15} />}>Create an instance</Button>}
        />
      </div>
    )
  }

  const addons = instance?.addons ?? []
  const filtered = addons.filter((addon) => {
    if (filter !== 'all' && addon.type !== filter) return false
    if (query && !addon.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })
  const pending = addons.filter((addon) => addon.latestVersionId && addon.latestVersionId !== addon.versionId).length
  const totalSize = addons.reduce((total, addon) => total + addon.size, 0)

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.instance(instance!.id) })
    await queryClient.invalidateQueries({ queryKey: qk.instances })
  }

  const updateAll = async (): Promise<void> => {
    if (!instance) return
    setBusy(true)
    try {
      await window.newbie.addons.updateAll(instance.id)
      await refresh()
      toast('success', 'Library updated', `${instance.name} is up to date`)
    } catch (error) {
      toast('error', 'Update failed', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const scan = async (): Promise<void> => {
    if (!instance) return
    setScanning(true)
    try {
      const found = await window.newbie.addons.scan(instance.id)
      await refresh()
      toast('success', 'Scan complete', `${found.length} add-on(s) matched`)
    } catch (error) {
      toast('error', 'Scan failed', errorMessage(error))
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Installed add-ons"
        description="One place to update, toggle and repair everything in your instances."
        actions={
          <>
            <Button variant="secondary" onClick={() => openModal('repair', { instanceId: instance!.id })} icon={<Wrench size={15} />}>
              Repair
            </Button>
            <Button variant="primary" onClick={() => navigate(`/browse?instance=${instance!.id}`)} icon={<Plus size={15} />}>
              Browse add-ons
            </Button>
          </>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <BlockIcon name={instance!.name} color={instance!.color} iconUrl={instance!.iconUrl} size={42} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink">{instance!.name}</div>
            <div className="text-[10.5px] text-muted">
              {instance!.versionId} · {addons.length} add-ons · {formatBytes(totalSize)}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {instances.length > 1 && (
              <Select
                value={instance!.id}
                onChange={(event) => setParams({ instance: event.target.value })}
                className="w-[190px]"
                aria-label="Select instance"
              >
                {instances.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </Select>
            )}
            <Button variant="secondary" size="sm" loading={scanning} onClick={() => void scan()} icon={<Package size={14} />}>
              Scan local
            </Button>
            <Button variant="primary" size="sm" loading={busy} onClick={() => void updateAll()} icon={<ArrowsClockwise size={14} />}>
              {pending > 0 ? `Update ${pending}` : 'Check updates'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this library…" className="pl-9" />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${addons.length}` },
            { value: 'mod', label: 'Mods' },
            { value: 'resourcepack', label: 'Packs' },
            { value: 'shader', label: 'Shaders' }
          ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package size={22} />}
              title={addons.length === 0 ? 'This instance is empty' : 'No add-ons match'}
              description={addons.length === 0 ? 'Browse Modrinth and install your first add-on.' : 'Try a different type filter or search term.'}
              action={<Button variant="primary" onClick={() => navigate(`/browse?instance=${instance!.id}`)}>Browse add-ons</Button>}
            />
          ) : (
            <div className="space-y-1.5">
              {filtered.map((addon) => (
                <AddonRow key={addon.id} record={addon} instance={instance!} onChanged={() => void refresh()} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[14px] font-semibold text-ink">Loadouts</h2>
            <button onClick={() => openModal('loadout', { instanceId: instance!.id })} className="inline-flex items-center gap-1 text-[11px] text-grass hover:underline">
              <SquaresFour size={12} /> New
            </button>
          </div>
          <div className="space-y-2.5">
            {instance!.loadouts.map((loadout) => (
              <LoadoutCard key={loadout.id} loadout={loadout} instance={instance!} onChanged={() => void refresh()} />
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-line/45 bg-card/40 p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
              <Books size={14} className="text-grass/80" /> Offline backup mode
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
              Loadouts set to offline backup keep every file in the local cache, so switching works with no connection.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge tone="green">Offline</Badge>
              <Badge tone="blue">Download on switch</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
