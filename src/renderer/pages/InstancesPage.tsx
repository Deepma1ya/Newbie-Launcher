import { useState } from 'react'
import { MagnifyingGlass, Plus, SquaresFour } from '@phosphor-icons/react'
import { useInstances, useDiskUsage } from '../hooks/queries'
import { useUi } from '../store/ui'
import { formatBytes } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { InstanceCard } from '../components/InstanceCard'
import { Button } from '../components/ui/Button'
import { EmptyState, Input, Segmented, Skeleton } from '../components/ui/primitives'

export function InstancesPage() {
  const instances = useInstances().data ?? []
  const loading = useInstances().isLoading
  const disk = useDiskUsage().data
  const openModal = useUi((state) => state.openModal)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'modded' | 'vanilla'>('all')

  const filtered = instances.filter((instance) => {
    if (filter === 'modded' && instance.loader === 'vanilla') return false
    if (filter === 'vanilla' && instance.loader !== 'vanilla') return false
    if (query && !`${instance.name} ${instance.versionId} ${instance.loader}`.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Instances"
        description="Each instance keeps its own worlds, add-ons and loadouts. Versions, libraries and assets are shared to save disk."
        actions={
          <Button variant="primary" onClick={() => openModal('createInstance', true)} icon={<Plus size={15} />}>
            New instance
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search instances, versions, loaders…"
            className="pl-9"
            aria-label="Search instances"
          />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${instances.length}` },
            { value: 'modded', label: 'Modded' },
            { value: 'vanilla', label: 'Vanilla' }
          ]}
        />
        {disk && (
          <div className="text-[10.5px] text-muted/65">
            {formatBytes(disk.dataDirMb * 1024 * 1024)} on disk · {formatBytes(disk.cacheMb * 1024 * 1024)} cached
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[190px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SquaresFour size={22} />}
          title={instances.length === 0 ? 'No instances yet' : 'No instances match'}
          description={
            instances.length === 0
              ? 'Create your first instance. Pick a version and loader, and Newbie handles the downloads, Java runtime and folder structure.'
              : 'Try a different search term or switch the filter back to All.'
          }
          action={
            instances.length === 0 ? (
              <Button variant="primary" onClick={() => openModal('createInstance', true)} icon={<Plus size={15} />}>
                Create an instance
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => { setQuery(''); setFilter('all') }}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((instance) => (
            <InstanceCard key={instance.id} instance={instance} />
          ))}
        </div>
      )}
    </div>
  )
}
