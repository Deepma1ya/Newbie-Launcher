import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowsClockwise,
  CheckCircle,
  FolderOpen,
  Image,
  MagnifyingGlass,
  Plus,
  Trash,
  UploadSimple
} from '@phosphor-icons/react'
import type {
  ModrinthHit,
  ServerRecord,
  ServerResourcePackImport
} from '@shared/types'
import {
  qk,
  useServerResourcePack,
  useServerResourcePackSearch
} from '../hooks/queries'
import { toast, useUi } from '../store/ui'
import { errorMessage, formatBytes } from '../lib/utils'
import { Badge, Card, Input, Segmented, Skeleton, Switch } from './ui/primitives'
import { Button } from './ui/Button'
import { ProjectIcon } from './ui/BlockIcon'

export function ServerResourcePackPanel({
  server,
  running
}: {
  server: ServerRecord
  running: boolean
}) {
  const queryClient = useQueryClient()
  const askConfirm = useUi((state) => state.askConfirm)
  const pack = useServerResourcePack(server.id)
  const [source, setSource] = useState<'modrinth' | 'custom'>('modrinth')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<ServerResourcePackImport | null>(null)
  const [url, setUrl] = useState('')
  const [sha1, setSha1] = useState('')
  const [required, setRequired] = useState(false)
  const [prompt, setPrompt] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 380)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setRequired(pack.data?.required ?? false)
    setPrompt(pack.data?.prompt ?? '')
  }, [pack.data?.required, pack.data?.prompt])

  const query = useMemo(
    () => ({ serverId: server.id, query: debounced, limit: 20, offset: 0 }),
    [server.id, debounced]
  )
  const results = useServerResourcePackSearch(query)

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: qk.serverResourcePack(server.id) })
    await queryClient.invalidateQueries({ queryKey: qk.server(server.id) })
    await queryClient.invalidateQueries({ queryKey: qk.servers })
  }

  const install = async (hit: ModrinthHit): Promise<void> => {
    setInstalling(hit.project_id)
    try {
      await window.newbie.servers.installResourcePack(server.id, hit.project_id)
      await refresh()
      toast(
        'success',
        'Resource pack added',
        running ? 'Restart the server to apply it.' : `${hit.title} is now the server resource pack.`
      )
    } catch (error) {
      toast('error', 'Could not add the resource pack', errorMessage(error))
    } finally {
      setInstalling(null)
    }
  }

  const chooseFile = async (): Promise<void> => {
    try {
      const file = await window.newbie.app.pickFile([
        { name: 'Resource pack', extensions: ['zip'] }
      ])
      if (!file) return
      setImporting(true)
      const imported = await window.newbie.servers.importResourcePack(server.id, file)
      setSelected(imported)
      setSha1(imported.sha1)
      toast('success', 'Pack copied to the server', imported.filename)
    } catch (error) {
      toast('error', 'Could not add that file', errorMessage(error))
    } finally {
      setImporting(false)
    }
  }

  const saveCustom = async (): Promise<void> => {
    if (!url.trim()) {
      toast('info', 'Add a download link', 'Players download the pack from this URL, so it must be public.')
      return
    }
    setSaving(true)
    try {
      await window.newbie.servers.saveResourcePack(server.id, {
        url: url.trim(),
        sha1: sha1.trim(),
        required,
        prompt,
        name: selected?.filename,
        filename: selected?.filename,
        size: selected?.size,
        source: selected ? 'file' : 'url'
      })
      await refresh()
      toast('success', 'Resource pack saved', running ? 'Restart the server to apply it.' : undefined)
    } catch (error) {
      toast('error', 'Could not save the resource pack', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const saveSettings = async (): Promise<void> => {
    const current = pack.data
    if (!current?.url) return
    setSaving(true)
    try {
      await window.newbie.servers.saveResourcePack(server.id, {
        url: current.url,
        sha1: current.sha1,
        required,
        prompt,
        name: current.info?.name,
        filename: current.info?.filename || undefined,
        size: current.info?.size,
        source: current.info?.source,
        projectId: current.info?.projectId,
        versionId: current.info?.versionId
      })
      await refresh()
      toast('success', 'Resource pack settings saved', running ? 'Restart the server to apply them.' : undefined)
    } catch (error) {
      toast('error', 'Could not save the pack settings', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = (): void => {
    askConfirm({
      title: 'Remove the server resource pack?',
      description: 'Players will stop receiving this pack when they join. The next server start uses the updated settings.',
      body: 'The pack file is removed from the server folder. Worlds and other files are not touched.',
      confirmLabel: 'Remove resource pack',
      danger: true,
      action: async () => {
        await window.newbie.servers.removeResourcePack(server.id, true)
        setSelected(null)
        setUrl('')
        setSha1('')
        await refresh()
      }
    })
  }

  if (pack.isLoading) {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  const current = pack.data
  const activeName = current?.info?.name || current?.activeFilename || 'Server resource pack'
  const settingsDirty =
    Boolean(current?.url) && (required !== current?.required || prompt !== (current?.prompt ?? ''))

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="min-w-0 space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink">Current resource pack</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Sent to every player when they join. Changes apply on the next server start.
              </p>
            </div>
            {current?.url && (
              <Badge tone={current.required ? 'gold' : 'green'}>
                {current.required ? 'Required' : 'Optional'}
              </Badge>
            )}
          </div>

          {!current?.url ? (
            <div className="mt-3 rounded-xl border border-dashed border-line/50 p-4 text-[11px] text-muted">
              No resource pack is configured. Pick a Modrinth pack or add your own .zip on the right.
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-line/45 bg-canvas/25 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-grass/20 bg-grass/10 text-grass">
                  <Image size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-ink">{activeName}</div>
                  <div className="mt-0.5 break-all font-mono text-[9.5px] leading-relaxed text-muted/70">
                    {current.url}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[9.5px] text-muted/65">
                    {current.activeFilename && <span>{current.activeFilename}</span>}
                    {current.sha1 && <span className="font-mono">SHA-1 {current.sha1}</span>}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <Switch
                  checked={required}
                  onChange={setRequired}
                  label="Require the pack"
                  description="Players must accept the download before they can join."
                />
                <div>
                  <div className="text-[11.5px] font-medium text-ink">Prompt</div>
                  <div className="mt-0.5 text-[10px] text-muted/75">
                    Optional message shown in the client download screen.
                  </div>
                  <div className="mt-1.5">
                    <Input
                      value={prompt}
                      maxLength={256}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Download our server pack to see custom models and textures."
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={saving}
                  disabled={!settingsDirty}
                  onClick={() => void saveSettings()}
                >
                  Save pack settings
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void window.newbie.servers.openFolder(server.id, 'resourcepacks')}
                  icon={<FolderOpen size={14} />}
                >
                  Folder
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={remove}
                  icon={<Trash size={14} />}
                  className="text-danger/80 hover:bg-danger/10 hover:text-danger"
                >
                  Remove
                </Button>
              </div>
              {running && (
                <p className="mt-2 text-[10px] text-gold/80">
                  The server is running. Restart it after changing the pack.
                </p>
              )}
            </>
          )}
        </Card>

        {current && current.files.length > 0 && (
          <Card className="p-4">
            <h3 className="font-display text-[13px] font-semibold text-ink">Pack files</h3>
            <p className="mt-0.5 text-[10px] text-muted/70">
              Stored in the server's resourcepacks folder. The active pack is served through its URL.
            </p>
            <div className="mt-3 space-y-2">
              {current.files.map((file) => (
                <div
                  key={file.filename}
                  className="flex items-center gap-2 rounded-lg border border-line/40 bg-canvas/20 px-3 py-2"
                >
                  <Image size={14} className="text-muted/70" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-ink/80">
                    {file.filename}
                  </span>
                  <span className="text-[9.5px] text-muted/60">{formatBytes(file.size)}</span>
                  {current.activeFilename === file.filename && (
                    <Badge tone="green" className="h-4 px-1.5 text-[8px]">
                      Active
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink">Add a resource pack</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Pack format compatibility matters. Modrinth packs are filtered for Minecraft {server.versionId}.
              </p>
            </div>
            <Segmented
              value={source}
              onChange={(value) => setSource(value)}
              size="sm"
              options={[
                { value: 'modrinth', label: 'Modrinth' },
                { value: 'custom', label: 'My file / URL' }
              ]}
            />
          </div>

          {source === 'modrinth' ? (
            <div className="mt-3">
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search Modrinth resource packs…"
                  className="pl-9"
                  aria-label="Search resource packs"
                />
              </div>
              <div className="mt-3 max-h-[440px] space-y-2 overflow-y-auto pr-1">
                {results.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : results.data?.hits.length ? (
                  results.data.hits.map((hit) => {
                    const active = current?.info?.projectId === hit.project_id
                    return (
                      <div
                        key={hit.project_id}
                        className="flex items-center gap-3 rounded-xl border border-line/45 bg-canvas/25 p-2.5"
                      >
                        <ProjectIcon url={hit.icon_url ?? undefined} name={hit.title} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium text-ink">{hit.title}</div>
                          <div className="truncate text-[10px] text-muted/75">{hit.description}</div>
                        </div>
                        <Button
                          variant={active ? 'ghost' : 'secondary'}
                          size="sm"
                          disabled={active || installing === hit.project_id}
                          loading={installing === hit.project_id}
                          onClick={() => void install(hit)}
                          icon={active ? <CheckCircle size={14} /> : <Plus size={14} />}
                        >
                          {active ? 'Active' : 'Use pack'}
                        </Button>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-line/50 p-4 text-[11px] text-muted">
                    No resource packs found for {server.versionId}. Try another search.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-line/45 bg-canvas/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11.5px] font-medium text-ink">1. Pick your pack</div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted/75">
                      Newbie copies the .zip into the server's resourcepacks folder and calculates its SHA-1.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={importing}
                    onClick={() => void chooseFile()}
                    icon={<UploadSimple size={14} />}
                  >
                    Choose .zip
                  </Button>
                </div>
                {selected && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-grass/20 bg-grass/[0.06] px-2.5 py-2 text-[10px] text-grass">
                    <CheckCircle size={13} weight="fill" />
                    <span className="font-mono">{selected.filename}</span>
                    <span className="text-grass/70">{formatBytes(selected.size)}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11.5px] font-medium text-ink">2. Public download link</div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted/75">
                  Minecraft clients download the pack from this URL. Upload the .zip to a file host or your own web
                  server, then paste the direct link.
                </p>
                <div className="mt-1.5">
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/pack.zip"
                  />
                </div>
              </div>

              <div>
                <div className="text-[11.5px] font-medium text-ink">SHA-1</div>
                <p className="mt-0.5 text-[10px] text-muted/75">
                  {selected
                    ? 'Calculated from the file you picked. Players verify the download with it.'
                    : 'Optional. Paste the SHA-1 of the hosted file when you have it.'}
                </p>
                <div className="mt-1.5">
                  <Input
                    value={sha1}
                    onChange={(event) => setSha1(event.target.value)}
                    placeholder="40 hexadecimal characters"
                    className="font-mono"
                  />
                </div>
              </div>

              <Switch
                checked={required}
                onChange={setRequired}
                label="Require the pack"
                description="Players must accept the download before they can join."
              />

              <div>
                <div className="text-[11.5px] font-medium text-ink">Prompt</div>
                <div className="mt-1.5">
                  <Input
                    value={prompt}
                    maxLength={256}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Optional message shown in the download screen"
                  />
                </div>
              </div>

              <Button
                variant="primary"
                loading={saving}
                disabled={!url.trim()}
                onClick={() => void saveCustom()}
                icon={<ArrowsClockwise size={14} />}
              >
                {running ? 'Save pack (applies after restart)' : 'Save resource pack'}
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-4 text-[10.5px] leading-relaxed text-muted/75">
          <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
            <Image size={14} className="text-grass/80" /> How server packs work
          </div>
          <p className="mt-1.5">
            Java servers send the pack URL and SHA-1 to every client. The server does not host the file itself, so the
            link must be reachable by your players. A Modrinth pack uses its public CDN link automatically.
          </p>
          <p className="mt-2">
            Newbie never bundles the pack into the server jar. Removing the pack clears the URL and hash and deletes the
            managed copy from the resourcepacks folder.
          </p>
        </Card>
      </div>
    </div>
  )
}
