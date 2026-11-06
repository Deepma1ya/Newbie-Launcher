import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowSquareOut,
  Books,
  Cube,
  FolderOpen,
  Image,
  MapTrifold,
  Package,
  Plus,
  TShirt,
  Trash
} from '@phosphor-icons/react'
import type { BedrockContentItem, BedrockContentKind } from '@shared/types'
import { useBedrockContent, useBedrockInstances, qk } from '../hooks/queries'
import { toast } from '../store/ui'
import { errorMessage } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Badge, Card, EmptyState, Segmented, Select, Skeleton } from '../components/ui/primitives'

const kindLabels: Record<BedrockContentKind, string> = {
  resourcepack: 'Resource pack',
  behaviorpack: 'Behavior pack',
  skinpack: 'Skin pack',
  world: 'World',
  template: 'World template'
}

const filters: { value: 'all' | BedrockContentKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'resourcepack', label: 'Resources' },
  { value: 'behaviorpack', label: 'Behavior' },
  { value: 'world', label: 'Worlds' },
  { value: 'skinpack', label: 'Skins' },
  { value: 'template', label: 'Templates' }
]

export function BedrockLibraryPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const instances = useBedrockInstances().data ?? []
  const active = instances.find((instance) => instance.active) ?? instances[0] ?? null
  const [targetId, setTargetId] = useState(params.get('instance') ?? '')
  const target = instances.find((instance) => instance.id === targetId) ?? active
  const contentQuery = useBedrockContent(target?.id)
  const content = contentQuery.data ?? []
  const [filter, setFilter] = useState<'all' | BedrockContentKind>('all')
  const [removing, setRemoving] = useState<BedrockContentItem | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!targetId && active) setTargetId(active.id)
  }, [active, targetId])

  const selectTarget = (id: string): void => {
    setTargetId(id)
    const next = new URLSearchParams(params)
    next.set('instance', id)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(
    () => content.filter((item) => filter === 'all' || item.kind === filter),
    [content, filter]
  )

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.bedrockInstances })
    if (target) await queryClient.invalidateQueries({ queryKey: qk.bedrockContent(target.id) })
  }

  const remove = async (): Promise<void> => {
    if (!target || !removing) return
    setBusy(true)
    try {
      await window.newbie.bedrock.removeContent(target.id, removing.id)
      await refresh()
      toast('success', 'Removed from Bedrock', removing.name)
      setRemoving(null)
    } catch (error) {
      toast('error', 'Could not remove this Bedrock item', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Bedrock library"
        title="Library"
        description="Review the packs and worlds installed in the selected Bedrock instance."
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/bedrock/browse')}
            icon={<Plus size={15} />}
          >
            Browse Bedrock content
          </Button>
        }
      />

      {!target ? (
        <EmptyState
          icon={<Cube size={22} />}
          title="Create a Bedrock instance first"
          description="Each Bedrock instance has its own library. Create one, then install packs and worlds from the marketplace."
          action={
            <Button
              variant="primary"
              onClick={() => navigate('/bedrock/instances')}
              icon={<Plus size={15} />}
            >
              Go to Bedrock instances
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Select
              value={target.id}
              onChange={selectTarget}
              className="w-[220px]"
              aria-label="Bedrock instance"
            >
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name}
                </option>
              ))}
            </Select>
            <Segmented value={filter} onChange={setFilter} options={filters} />
            <div className="ml-auto flex items-center gap-3 text-[10.5px] text-muted/60">
              <span>
                {content.length} {content.length === 1 ? 'item' : 'items'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void window.newbie.bedrock.openInstance(target.id)}
                icon={<FolderOpen size={13} />}
              >
                Folder
              </Button>
            </div>
          </div>

          {contentQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Skeleton key={index} className="h-[120px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Books size={22} />}
              title={content.length === 0 ? 'This instance is empty' : 'Nothing matches this filter'}
              description={
                content.length === 0
                  ? 'Install add-ons, texture packs, skin packs or worlds from the Bedrock marketplace.'
                  : 'Switch the filter back to All or choose another instance.'
              }
              action={
                content.length === 0 ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate('/bedrock/browse')}
                    icon={<Plus size={15} />}
                  >
                    Browse Bedrock content
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setFilter('all')}>
                    Clear filter
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <Card key={item.id} className="flex items-start gap-3 p-3.5">
                  <KindIcon kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="line-clamp-1 text-[12.5px] font-semibold text-ink">
                        {item.name}
                      </h2>
                      <Badge tone="neutral">{kindLabels[item.kind]}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] text-muted/60">
                      {item.version && <span>v{item.version}</span>}
                      {item.source && <span>· MCPEDL</span>}
                      {item.installedAt && (
                        <span>· {new Date(item.installedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    {item.source && (
                      <button
                        onClick={() => void window.newbie.app.openExternal(item.source!.url ?? `https://mcpedl.com/${item.source!.slug}/`)}
                        className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-grass/80 hover:text-grass"
                      >
                        View source <ArrowSquareOut size={10} />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-danger/75 hover:text-danger"
                    onClick={() => setRemoving(item)}
                    icon={<Trash size={13} />}
                    aria-label={`Remove ${item.name}`}
                  />
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove from this instance?"
        description={removing ? `${removing.name} will be deleted from ${target?.name ?? 'the instance'}.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-[11.5px] leading-relaxed text-muted">
          This only removes the files from Newbie&apos;s Bedrock instance. It does not affect
          another profile, and it cannot be undone unless you download it again.
        </p>
      </Modal>
    </div>
  )
}

function KindIcon({ kind }: { kind: BedrockContentKind }) {
  const Icon =
    kind === 'world' || kind === 'template'
      ? MapTrifold
      : kind === 'skinpack'
        ? TShirt
        : kind === 'resourcepack'
          ? Image
          : Package
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-grass/15 bg-grass/[0.07] text-grass/85">
      <Icon size={19} />
    </span>
  )
}
