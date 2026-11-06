import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowSquareOut,
  Cube,
  FolderOpen,
  Play,
  Plus,
  SquaresFour,
  Trash,
  WarningCircle
} from '@phosphor-icons/react'
import type { BedrockChannel } from '@shared/types'
import { useBedrockInstances, qk } from '../hooks/queries'
import { toast, useUi } from '../store/ui'
import { errorMessage, formatPlaytime } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import {
  Badge,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton
} from '../components/ui/primitives'

export function BedrockInstancesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const instances = useBedrockInstances().data ?? []
  const loading = useBedrockInstances().isLoading
  const anyRunning = instances.some((instance) => instance.running)
  const askConfirm = useUi((state) => state.askConfirm)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<BedrockChannel>('release')
  const [busy, setBusy] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: qk.bedrockInstances })
  }

  const create = async (): Promise<void> => {
    if (!name.trim()) return
    setBusy('create')
    try {
      await window.newbie.bedrock.createInstance({ name: name.trim(), channel })
      refresh()
      setCreateOpen(false)
      setName('')
      toast('success', 'Bedrock instance created', 'Add add-ons from the Bedrock marketplace, then press Play.')
    } catch (error) {
      toast('error', 'Could not create the Bedrock instance', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const launchNow = async (id: string): Promise<void> => {
    setBusy(`launch:${id}`)
    try {
      await window.newbie.bedrock.launchInstance(id)
      refresh()
      toast('info', 'Starting Minecraft…', 'Your Bedrock profile is linked and the game is opening.')
    } catch (error) {
      toast('error', 'Could not launch this profile', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const switchNow = async (id: string): Promise<void> => {
    setBusy(`switch:${id}`)
    try {
      const result = await window.newbie.bedrock.switchInstance(id)
      refresh()
      toast(
        'success',
        'Bedrock profile switched',
        result.migrated
          ? 'Your existing worlds were kept as “My Bedrock”.'
          : `${result.instance.name} is now linked to Minecraft.`
      )
    } catch (error) {
      toast('error', 'Could not switch the Bedrock profile', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const confirmSwitch = (instanceId: string, action: () => Promise<void>): void => {
    const instance = instances.find((entry) => entry.id === instanceId)
    if (!instance || instance.linked) {
      void action()
      return
    }
    askConfirm({
      title: `Switch Minecraft to ${instance.name}?`,
      description:
        'Bedrock has one game data folder, so Newbie links the selected profile before launching.',
      body: 'Your current worlds are kept as the protected “My Bedrock” profile, not deleted. Close Minecraft before continuing. Xbox cloud sync can still merge this profile with another PC using the same account.',
      confirmLabel: 'Switch profile',
      cancelLabel: 'Cancel',
      action
    })
  }

  const launch = (id: string): void => {
    confirmSwitch(id, () => launchNow(id))
  }

  const switchTo = (id: string): void => {
    confirmSwitch(id, () => switchNow(id))
  }

  const remove = async (id: string): Promise<void> => {
    setDeleting(id)
    try {
      await window.newbie.bedrock.removeInstance(id)
      refresh()
      toast('success', 'Bedrock instance deleted')
    } catch (error) {
      toast('error', 'Could not delete the Bedrock instance', errorMessage(error))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Bedrock profiles"
        title="Bedrock instances"
        description="Keep separate worlds, resource packs, behavior packs and skin packs for Minecraft for Windows."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)} icon={<Plus size={15} />}>
            New instance
          </Button>
        }
      />

      <Card className="mb-4 flex items-start gap-3 border-gold/15 bg-gold/[0.045] p-3.5 text-[10.5px] leading-relaxed text-muted">
        <WarningCircle size={17} className="mt-0.5 shrink-0 text-gold/80" />
        <span>
          Bedrock has one game data folder. Newbie switches it with a Windows junction when you
          play an instance, and keeps your current worlds as <span className="text-ink">My Bedrock</span>{' '}
          the first time. Close Minecraft before switching. Xbox cloud sync can still merge a
          profile with another PC using the same account.
        </span>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[210px]" />
          ))}
        </div>
      ) : instances.length === 0 ? (
        <EmptyState
          icon={<SquaresFour size={22} />}
          title="No Bedrock instances yet"
          description="Create a profile for a fresh world set. Your existing Bedrock worlds are protected as My Bedrock when you switch for the first time."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)} icon={<Plus size={15} />}>
              Create a Bedrock instance
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {instances.map((instance) => {
            const launching = busy === `launch:${instance.id}`
            const switching = busy === `switch:${instance.id}`
            return (
              <Card
                key={instance.id}
                role="button"
                tabIndex={0}
                aria-label={`Manage ${instance.name}`}
                className="flex cursor-pointer flex-col p-4 transition-colors hover:border-grass/25"
                onClick={() => navigate(`/bedrock/instances/${instance.id}`)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/bedrock/instances/${instance.id}`)
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                    style={{ backgroundColor: `${instance.color}22`, color: instance.color }}
                  >
                    <Cube size={22} weight="fill" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="truncate font-display text-[14px] font-semibold text-ink">
                        {instance.name}
                      </h2>
                      {instance.active && <Badge tone="green">Selected</Badge>}
                      {instance.linked && !instance.active && <Badge tone="blue">Linked</Badge>}
                      {instance.running && <Badge tone="gold">Minecraft running</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted/70">
                      <span>{instance.channel === 'preview' ? 'Preview' : 'Release'} channel</span>
                      <span>·</span>
                      <span>{instance.installed ? 'Installed' : 'Game not installed'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-line/40 bg-canvas/25 px-2 py-2">
                    <div className="text-[14px] font-semibold text-ink">{instance.worldCount}</div>
                    <div className="text-[8.5px] uppercase tracking-[0.08em] text-muted/60">Worlds</div>
                  </div>
                  <div className="rounded-xl border border-line/40 bg-canvas/25 px-2 py-2">
                    <div className="text-[14px] font-semibold text-ink">{instance.contentCount}</div>
                    <div className="text-[8.5px] uppercase tracking-[0.08em] text-muted/60">Packs</div>
                  </div>
                  <div className="rounded-xl border border-line/40 bg-canvas/25 px-2 py-2">
                    <div className="text-[14px] font-semibold text-ink">
                      {instance.totalPlayTimeSec > 0 ? formatPlaytime(instance.totalPlayTimeSec) : '—'}
                    </div>
                    <div className="text-[8.5px] uppercase tracking-[0.08em] text-muted/60">Playtime</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted/60">
                  <span>
                    {instance.lastPlayedAt
                      ? `Last played ${new Date(instance.lastPlayedAt).toLocaleDateString()}`
                      : instance.adopted
                        ? 'Original Bedrock worlds'
                        : 'Not played yet'}
                  </span>
                  {instance.adopted && <Badge tone="gold">Protected</Badge>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={launching}
                    disabled={!instance.installed || Boolean(busy) || anyRunning}
                    onClick={(event) => {
                      event.stopPropagation()
                      launch(instance.id)
                    }}
                    icon={<Play size={13} weight="fill" />}
                  >
                    Play
                  </Button>
                  {!instance.active && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={switching}
                      disabled={Boolean(busy) || anyRunning}
                      onClick={(event) => {
                        event.stopPropagation()
                        switchTo(instance.id)
                      }}
                    >
                      Use
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={(event) => {
                      event.stopPropagation()
                      void window.newbie.bedrock.openInstance(instance.id)
                    }}
                    icon={<FolderOpen size={13} />}
                  >
                    Folder
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-danger/80 hover:text-danger"
                    loading={deleting === instance.id}
                    disabled={Boolean(busy) || anyRunning || instance.adopted || instance.linked}
                    onClick={(event) => {
                      event.stopPropagation()
                      remove(instance.id)
                    }}
                    icon={<Trash size={13} />}
                    aria-label={`Delete ${instance.name}`}
                  />
                </div>
                {!instance.installed && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      navigate('/bedrock')
                    }}
                    className="mt-2 flex items-center gap-1 text-left text-[10px] text-gold/80 hover:text-gold"
                  >
                    Install the {instance.channel === 'preview' ? 'Preview' : 'release'} package
                    <ArrowSquareOut size={11} />
                  </button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Bedrock instance"
        description="Choose a name and the Minecraft for Windows channel this profile belongs to."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy === 'create'}
              disabled={!name.trim()}
              onClick={() => void create()}
            >
              Create instance
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-ink">Instance name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Skyblock, Horror, Creative…"
              maxLength={60}
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-ink">Game channel</span>
            <Select value={channel} onChange={(value) => setChannel(value as BedrockChannel)}>
              <option value="release">Minecraft for Windows (Release)</option>
              <option value="preview">Minecraft Preview</option>
            </Select>
          </label>
          <p className="text-[10.5px] leading-relaxed text-muted/70">
            The instance starts empty. Your existing worlds stay in the protected My Bedrock
            profile and are never moved until you switch.
          </p>
        </div>
      </Modal>
    </div>
  )
}
