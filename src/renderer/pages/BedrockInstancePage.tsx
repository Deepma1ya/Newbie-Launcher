import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowSquareOut,
  CalendarBlank,
  Clock,
  Cube,
  FolderOpen,
  Image,
  MapTrifold,
  Package,
  PencilSimple,
  Play,
  TShirt,
  Trash,
  WarningCircle
} from '@phosphor-icons/react'
import type { BedrockContentItem, BedrockContentKind } from '@shared/types'
import { useBedrockContent, useBedrockInstances, qk } from '../hooks/queries'
import { toast, useUi } from '../store/ui'
import { errorMessage, formatPlaytime, relativeTime } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Badge, Card, EmptyState, Input, Skeleton } from '../components/ui/primitives'

const kindLabels: Record<BedrockContentKind, string> = {
  resourcepack: 'Resource pack',
  behaviorpack: 'Behavior pack',
  skinpack: 'Skin pack',
  world: 'World',
  template: 'World template'
}

export function BedrockInstancePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const askConfirm = useUi((state) => state.askConfirm)
  const instancesQuery = useBedrockInstances()
  const instance = instancesQuery.data?.find((entry) => entry.id === id)
  const contentQuery = useBedrockContent(id)
  const content = useMemo(() => contentQuery.data ?? [], [contentQuery.data])
  const [busy, setBusy] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [name, setName] = useState('')

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: qk.bedrockInstances })
    if (id) void queryClient.invalidateQueries({ queryKey: qk.bedrockContent(id) })
  }

  const launchNow = async (): Promise<void> => {
    if (!instance) return
    setBusy('launch')
    try {
      await window.newbie.bedrock.launchInstance(instance.id)
      refresh()
      toast('info', 'Starting Minecraft…', `${instance.name} is opening.`)
    } catch (error) {
      toast('error', 'Could not launch this profile', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const play = (): void => {
    if (!instance) return
    if (!instance.linked) {
      askConfirm({
        title: `Switch Minecraft to ${instance.name}?`,
        description:
          'Bedrock has one game data folder, so Newbie links the selected profile before launching.',
        body: 'Your current worlds are kept as the protected “My Bedrock” profile, not deleted. Close Minecraft before continuing. Xbox cloud sync can still merge this profile with another PC using the same account.',
        confirmLabel: 'Switch and play',
        cancelLabel: 'Cancel',
        action: launchNow
      })
      return
    }
    void launchNow()
  }

  const switchNow = async (): Promise<void> => {
    if (!instance) return
    setBusy('switch')
    try {
      const result = await window.newbie.bedrock.switchInstance(instance.id)
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

  const useProfile = (): void => {
    if (!instance || instance.linked) return
    askConfirm({
      title: `Switch Minecraft to ${instance.name}?`,
      description:
        'Bedrock has one game data folder, so Newbie links the selected profile before launching.',
      body: 'Your current worlds are kept as the protected “My Bedrock” profile, not deleted. Close Minecraft before continuing. Xbox cloud sync can still merge this profile with another PC using the same account.',
      confirmLabel: 'Switch profile',
      cancelLabel: 'Cancel',
      action: switchNow
    })
  }

  const openRename = (): void => {
    if (!instance) return
    setName(instance.name)
    setRenameOpen(true)
  }

  const rename = async (): Promise<void> => {
    if (!instance || !name.trim()) return
    setBusy('rename')
    try {
      await window.newbie.bedrock.updateInstance(instance.id, { name: name.trim() })
      refresh()
      setRenameOpen(false)
      toast('success', 'Bedrock instance renamed', name.trim())
    } catch (error) {
      toast('error', 'Could not rename the instance', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const remove = (): void => {
    if (!instance) return
    askConfirm({
      title: `Delete ${instance.name}?`,
      description:
        'The profile folder and its worlds and packs are removed from Newbie. Your protected My Bedrock profile is not affected.',
      confirmLabel: 'Delete instance',
      danger: true,
      action: async () => {
        setBusy('remove')
        try {
          await window.newbie.bedrock.removeInstance(instance.id)
          refresh()
          toast('success', 'Bedrock instance deleted', instance.name)
          navigate('/bedrock/instances')
        } catch (error) {
          toast('error', 'Could not delete the instance', errorMessage(error))
        } finally {
          setBusy(null)
        }
      }
    })
  }

  const removeContent = (item: BedrockContentItem): void => {
    if (!instance) return
    askConfirm({
      title: `Remove ${item.name}?`,
      description: `This removes ${kindLabels[item.kind].toLowerCase()} from ${instance.name}. It cannot be undone unless you download it again.`,
      confirmLabel: 'Remove',
      danger: true,
      action: async () => {
        setBusy(`remove:${item.id}`)
        try {
          await window.newbie.bedrock.removeContent(instance.id, item.id)
          refresh()
          toast('success', 'Removed from Bedrock', item.name)
        } catch (error) {
          toast('error', 'Could not remove this item', errorMessage(error))
        } finally {
          setBusy(null)
        }
      }
    })
  }

  if (instancesQuery.isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-5 h-40" />
        <Skeleton className="mt-4 h-64" />
      </div>
    )
  }

  if (!instance) {
    return (
      <div>
        <button
          onClick={() => navigate('/bedrock/instances')}
          className="mb-5 inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
        >
          <ArrowLeft size={13} /> Bedrock instances
        </button>
        <EmptyState
          icon={<Cube size={22} />}
          title="Bedrock instance not found"
          description="It may have been deleted. Return to the instance list to choose another profile."
          action={
            <Button variant="primary" onClick={() => navigate('/bedrock/instances')}>
              Back to instances
            </Button>
          }
        />
      </div>
    )
  }

  const channel = instance.channel === 'preview' ? 'Preview' : 'Release'
  const playtime =
    instance.totalPlayTimeSec > 0 ? formatPlaytime(instance.totalPlayTimeSec) : 'Never played'
  const deleting = busy === 'remove'
  const canDelete = !instance.adopted && !instance.linked

  return (
    <div>
      <button
        onClick={() => navigate('/bedrock/instances')}
        className="mb-5 inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
      >
        <ArrowLeft size={13} /> Bedrock instances
      </button>

      <PageHeader
        eyebrow="Bedrock profile"
        title={instance.name}
        description={`Minecraft for Windows · ${channel} channel · ${instance.worldCount} ${
          instance.worldCount === 1 ? 'world' : 'worlds'
        } · ${instance.contentCount} ${instance.contentCount === 1 ? 'pack' : 'packs'}`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void window.newbie.bedrock.openInstance(instance.id)}
              icon={<FolderOpen size={15} />}
            >
              Folder
            </Button>
            <Button
              variant="primary"
              loading={busy === 'launch'}
              disabled={!instance.installed || instance.running || Boolean(busy)}
              onClick={play}
              icon={<Play size={15} weight="fill" />}
            >
              Play
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Badge tone={instance.active ? 'green' : 'neutral'}>{instance.active ? 'Selected' : 'Saved'}</Badge>
        <Badge tone={instance.linked ? 'blue' : 'neutral'}>{instance.linked ? 'Linked to Minecraft' : 'Not linked'}</Badge>
        <Badge tone={instance.installed ? 'green' : 'gold'}>
          {instance.installed ? 'Installed' : 'Game not installed'}
        </Badge>
        {instance.running && <Badge tone="gold">Minecraft running</Badge>}
        {instance.adopted && <Badge tone="gold">Protected original worlds</Badge>}
        <Badge tone="neutral">{channel}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink">Profile overview</h2>
                <p className="mt-0.5 text-[11px] text-muted">Worlds and packs stay inside this Bedrock profile.</p>
              </div>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                style={{ backgroundColor: `${instance.color}22`, color: instance.color }}
              >
                <Cube size={22} weight="fill" />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Worlds" value={String(instance.worldCount)} />
              <Metric label="Packs" value={String(instance.contentCount)} />
              <Metric label="Playtime" value={playtime} />
              <Metric
                label="Last played"
                value={instance.lastPlayedAt ? relativeTime(instance.lastPlayedAt) : 'Never'}
              />
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-line/40 bg-canvas/25 p-3 text-[10.5px] leading-relaxed text-muted">
              <div className="flex items-center gap-2">
                <FolderOpen size={13} className="shrink-0 text-muted/60" />
                <span className="break-all font-mono text-[10px] text-ink/75">{instance.dataDir}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarBlank size={13} className="shrink-0 text-muted/60" />
                <span>Created {relativeTime(instance.createdAt)}</span>
              </div>
              {!instance.installed && (
                <div className="flex items-center gap-2 text-gold/80">
                  <WarningCircle size={13} className="shrink-0" />
                  <span>Install the {channel.toLowerCase()} Minecraft for Windows package before playing.</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={openRename} icon={<PencilSimple size={13} />}>
                Rename
              </Button>
              {!instance.linked && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === 'switch'}
                  disabled={Boolean(busy) || instance.running}
                  onClick={useProfile}
                  icon={<Cube size={13} />}
                >
                  Use this profile
                </Button>
              )}
              {!instance.installed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/bedrock')}
                  icon={<Package size={13} />}
                >
                  Install game
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink">Installed content</h2>
                <p className="mt-0.5 text-[11px] text-muted">Worlds, resource packs, behavior packs and skin packs in this profile.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate(`/bedrock/browse?instance=${instance.id}`)}>
                  Browse content
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/bedrock/library?instance=${instance.id}`)}>
                  Open library
                </Button>
              </div>
            </div>

            {contentQuery.isLoading ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : content.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<MapTrifold size={22} />}
                  title="This profile is empty"
                  description="Install add-ons, maps, texture packs or skin packs from the Bedrock marketplace."
                  action={
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/bedrock/browse?instance=${instance.id}`)}
                    >
                      Browse Bedrock content
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {content.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-line/40 bg-canvas/25 p-2.5"
                  >
                    <ContentIcon kind={item.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[11.5px] font-medium text-ink">{item.name}</span>
                        <Badge tone="neutral">{kindLabels[item.kind]}</Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9.5px] text-muted/60">
                        {item.version && <span>v{item.version}</span>}
                        {item.source && <span>· MCPEDL</span>}
                        {item.installedAt && <span>· {new Date(item.installedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    {item.source && (
                      <button
                        onClick={() =>
                          void window.newbie.app.openExternal(
                            item.source!.url ?? `https://mcpedl.com/${item.source!.slug}/`
                          )
                        }
                        className="shrink-0 text-muted/60 hover:text-grass"
                        aria-label={`Open ${item.name} source`}
                      >
                        <ArrowSquareOut size={13} />
                      </button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-danger/75 hover:text-danger"
                      loading={busy === `remove:${item.id}`}
                      disabled={Boolean(busy) || instance.running}
                      onClick={() => removeContent(item)}
                      icon={<Trash size={13} />}
                      aria-label={`Remove ${item.name}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-display text-[15px] font-semibold text-ink">Manage</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Bedrock only reads one game data folder. Switching profiles requires Minecraft to be closed.
            </p>
            <div className="mt-4 space-y-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate(`/bedrock/browse?instance=${instance.id}`)}
                icon={<Package size={14} />}
              >
                Browse Bedrock content
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate(`/bedrock/library?instance=${instance.id}`)}
                icon={<MapTrifold size={14} />}
              >
                Open content library
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => void window.newbie.bedrock.openInstance(instance.id)}
                icon={<FolderOpen size={14} />}
              >
                Open profile folder
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/bedrock')}
                icon={<Cube size={14} />}
              >
                Bedrock versions
              </Button>
            </div>
          </Card>

          <Card className="border-danger/20 p-5">
            <h2 className="font-display text-[14px] font-semibold text-danger/90">Delete profile</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {instance.adopted
                ? 'This profile owns your original Bedrock worlds and cannot be deleted from Newbie.'
                : instance.linked
                  ? 'Switch to another Bedrock profile before deleting this one.'
                  : 'The profile folder, worlds and packs are removed. The installed game and other profiles are kept.'}
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              loading={deleting}
              disabled={!canDelete || Boolean(busy) || instance.running}
              onClick={remove}
              icon={<Trash size={14} />}
            >
              Delete instance
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename Bedrock instance"
        description="The name is only used inside Newbie. It does not change your Xbox profile."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy === 'rename'}
              disabled={!name.trim()}
              onClick={() => void rename()}
            >
              Save name
            </Button>
          </>
        }
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          autoFocus
          aria-label="Bedrock instance name"
        />
      </Modal>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/40 bg-canvas/25 px-3 py-2">
      <div className="text-[8.5px] uppercase tracking-[0.08em] text-muted/60">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">{value}</div>
    </div>
  )
}

function ContentIcon({ kind }: { kind: BedrockContentKind }) {
  const Icon =
    kind === 'world' || kind === 'template'
      ? MapTrifold
      : kind === 'skinpack'
        ? TShirt
        : kind === 'resourcepack'
          ? Image
          : Package
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-grass/15 bg-grass/[0.07] text-grass/85">
      <Icon size={15} />
    </span>
  )
}
