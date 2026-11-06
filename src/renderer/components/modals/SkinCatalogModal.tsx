import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle, MagnifyingGlass, SpinnerGap } from '@phosphor-icons/react'
import type { AccountSummary, SkinCatalogEntry } from '@shared/types'
import { useSkinCatalog, qk } from '../../hooks/queries'
import { toast } from '../../store/ui'
import { errorMessage } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Badge, Card, Input, Skeleton } from '../ui/primitives'
import { Button } from '../ui/Button'

export function SkinCatalogModal({
  open,
  account,
  onClose,
  onApplied
}: {
  open: boolean
  account: AccountSummary
  onClose: () => void
  onApplied: () => void
}) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setDebounced('')
    setPage(1)
  }, [open])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  const catalog = useSkinCatalog(debounced, page, open)
  const entries = catalog.data?.entries ?? []
  const pages = catalog.data?.pages ?? 1

  const apply = async (entry: SkinCatalogEntry): Promise<void> => {
    setApplying(entry.id)
    try {
      await window.newbie.skins.applyCatalog(account.id, entry.skinUrl)
      await queryClient.invalidateQueries({ queryKey: qk.accounts })
      onApplied()
      toast('success', 'Skin installed', `${entry.name} is now your local skin.`)
      onClose()
    } catch (error) {
      toast('error', 'Could not install that skin', errorMessage(error))
    } finally {
      setApplying(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Skin catalog"
      description={`Browse the online skin library and install a skin for ${account.username}. This sets a local skin; capes are managed by TLauncher.`}
      size="xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlass
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skins by name or style…"
              className="pl-9"
              aria-label="Search skin catalog"
              data-autofocus
            />
          </div>
          <Badge tone="neutral" className="h-7 px-2 text-[10px]">
            {catalog.data?.total ?? 0} skins
          </Badge>
        </div>

        {catalog.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-64" />
            ))}
          </div>
        ) : catalog.isError ? (
          <Card className="p-5 text-center text-[11.5px] text-muted">
            Could not load the skin catalog.
            <Button variant="secondary" size="sm" className="ml-3" onClick={() => void catalog.refetch()}>
              Try again
            </Button>
          </Card>
        ) : entries.length === 0 ? (
          <Card className="p-5 text-center text-[11.5px] text-muted">
            No skins match “{debounced}”.
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {entries.map((entry) => (
              <Card key={entry.id} className="group overflow-hidden p-0">
                <div className="relative flex h-48 items-center justify-center bg-[#0b120d]">
                  <img
                    src={entry.renderUrl}
                    alt={entry.name}
                    className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute right-2 top-2">
                    <Badge tone="neutral" className="h-4 px-1.5 text-[8px]">
                      {entry.model === 'slim' ? 'Slim' : 'Classic'}
                    </Badge>
                  </span>
                </div>
                <div className="p-2.5">
                  <div className="truncate text-[11.5px] font-medium text-ink" title={entry.name}>
                    {entry.name}
                  </div>
                  <div className="mt-0.5 truncate text-[9.5px] text-muted/65">
                    {entry.author ? `by ${entry.author}` : 'Community skin'}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    className="mt-2"
                    loading={applying === entry.id}
                    disabled={Boolean(applying)}
                    onClick={() => void apply(entry)}
                    icon={
                      applying === entry.id ? (
                        <SpinnerGap size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle size={13} />
                      )
                    }
                  >
                    {applying === entry.id ? 'Installing…' : 'Use skin'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 text-[10.5px] text-muted">
          <span>
            Page {catalog.data?.page ?? page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1 || catalog.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= pages || catalog.isFetching}
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
            >
              Next
            </Button>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-muted/55">
          Skin library by Photo2Skin. Capes are not installed by the catalog; manage your TLauncher cape from{' '}
          <span className="text-ink/70">Manage TLauncher → Refresh skin &amp; cape</span>. Custom skins are client-side
          and only visible to you when the TL Skin &amp; Cape mod is unavailable or disabled.
        </p>
      </div>
    </Modal>
  )
}
