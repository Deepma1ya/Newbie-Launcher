import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowSquareOut, HardDrives, WarningCircle } from '@phosphor-icons/react'
import type { LoaderType, ServerType } from '@shared/types'
import { SERVER_TYPES, serverLoader, serverTypeInfo, serverTypeLabel } from '@shared/serverTypes'
import { useLoaderVersions, useMinecraftVersions, useSystemInfo, qk } from '../../hooks/queries'
import { toast } from '../../store/ui'
import { errorMessage } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Segmented, Select, Switch } from '../ui/primitives'

export function CreateServerModal({
  open,
  onClose,
  onCreated
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const versions = useMinecraftVersions().data ?? []
  const system = useSystemInfo().data
  const queryClient = useQueryClient()
  const [name, setName] = useState('My Minecraft Server')
  const [nameTouched, setNameTouched] = useState(false)
  const [type, setType] = useState<ServerType>('paper')
  const [versionId, setVersionId] = useState('')
  const [loaderVersion, setLoaderVersion] = useState('')
  const [memoryMb, setMemoryMb] = useState(4096)
  const [port, setPort] = useState(25565)
  const [motd, setMotd] = useState('A Newbie Minecraft Server')
  const [onlineMode, setOnlineMode] = useState(false)
  const [eulaAccepted, setEulaAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const releaseVersions = useMemo(
    () => versions.filter((version) => version.type === 'release').slice(0, 160),
    [versions]
  )
  const loader = serverLoader(type) ?? 'vanilla'
  const loaderVersions = useLoaderVersions(loader, versionId)
  const typeInfo = serverTypeInfo(type)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (!versionId && releaseVersions.length > 0) setVersionId(releaseVersions[0]!.id)
  }, [open, releaseVersions, versionId])

  useEffect(() => {
    if (!versionId || nameTouched) return
    setName(`My ${serverTypeLabel(type)} ${versionId}`)
  }, [nameTouched, type, versionId])

  useEffect(() => {
    if (!loaderVersions.data?.length) return
    if (loaderVersions.data.some((entry) => entry.version === loaderVersion)) return
    const chosen = loaderVersions.data.find((entry) => entry.stable) ?? loaderVersions.data[0]
    if (chosen) setLoaderVersion(chosen.version)
  }, [loaderVersion, loaderVersions.data])

  useEffect(() => {
    if (type === 'paper' || type === 'vanilla') setLoaderVersion('')
  }, [type])

  const create = async (): Promise<void> => {
    if (!versionId || !name.trim() || !eulaAccepted) return
    setBusy(true)
    setError(null)
    let serverId: string | null = null
    try {
      const server = await window.newbie.servers.create({
        name: name.trim(),
        type,
        versionId,
        loaderVersion: typeInfo.mods ? loaderVersion : undefined,
        port,
        memoryMb,
        motd,
        onlineMode,
        javaPath: null,
        eulaAccepted
      })
      serverId = server.id
      await queryClient.invalidateQueries({ queryKey: qk.servers })
      try {
        await window.newbie.servers.start(server.id)
      } catch (cause) {
        toast('error', 'Server created, but it could not start', errorMessage(cause))
      }
      onCreated(server.id)
      toast('success', 'Server created', `${server.name} is ready on port ${server.port}`)
    } catch (cause) {
      if (serverId) onCreated(serverId)
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const totalMem = system?.totalMemMb ?? 16384
  const maxMemory = Math.min(65536, Math.max(2048, Math.floor(totalMem * 0.75)))

  useEffect(() => {
    setMemoryMb((current) => Math.min(Math.max(1024, current), maxMemory))
  }, [maxMemory])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a local server"
      description="Pick a server type and version. Newbie downloads the software, accepts the EULA on your behalf after consent, configures the port and starts it."
      size="lg"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!versionId || !name.trim() || !eulaAccepted || (typeInfo.mods && !loaderVersion)}
            onClick={() => void create()}
            icon={<HardDrives size={15} />}
          >
            {busy ? 'Creating server…' : 'Create & start'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Server name">
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setNameTouched(true)
            }}
            maxLength={60}
            data-autofocus
          />
        </Field>

        <div>
          <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.09em] text-muted">Server type</div>
          <Select value={type} onChange={(value) => setType(value as ServerType)}>
            {SERVER_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted/70">
            {typeInfo.description}{' '}
            {typeInfo.plugins ? 'Plugins and datapacks are supported.' : typeInfo.mods ? 'Mods and datapacks are supported.' : 'Datapacks are supported.'}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <Field label="Minecraft version" hint={`${releaseVersions.length} releases`}>
            <Select value={versionId} onChange={setVersionId}>
              {releaseVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Server port" hint="LAN / localhost">
            <Input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(event) => setPort(Number(event.target.value))}
            />
          </Field>
        </div>

        {typeInfo.mods && (
          <Field label={`${serverTypeLabel(type)} build`} hint={`${loaderVersions.data?.length ?? 0} available`}>
            <Select value={loaderVersion} onChange={setLoaderVersion}>
              {(loaderVersions.data ?? []).slice(0, 100).map((entry) => (
                <option key={entry.version} value={entry.version}>
                  {entry.label ? `${entry.version} · ${entry.label}` : entry.version}
                </option>
              ))}
              {loaderVersions.isLoading && <option value="">Loading builds…</option>}
              {!loaderVersions.isLoading && (loaderVersions.data?.length ?? 0) === 0 && (
                <option value="">No {serverTypeLabel(type)} builds for {versionId}</option>
              )}
            </Select>
          </Field>
        )}

        <Field label="Server list message" hint="MOTD">
          <Input value={motd} onChange={(event) => setMotd(event.target.value)} maxLength={120} />
        </Field>

        <Field label="Memory" hint={`${(memoryMb / 1024).toFixed(1)} GB of ${(totalMem / 1024).toFixed(0)} GB`}>
          <input
            type="range"
            min={1024}
            max={maxMemory}
            step={256}
            value={memoryMb}
            onChange={(event) => setMemoryMb(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--grass))]"
            aria-label="Server memory"
          />
        </Field>

        <Switch
          checked={onlineMode}
          onChange={setOnlineMode}
          label="Online mode (Microsoft accounts)"
          description="Turn off for TLauncher or offline friends. Turn on when the server is exposed to the internet."
        />

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line/55 bg-canvas/30 p-3">
          <input
            type="checkbox"
            checked={eulaAccepted}
            onChange={(event) => setEulaAccepted(event.target.checked)}
            className="mt-0.5 accent-[rgb(var(--grass))]"
          />
          <span className="text-[11px] leading-relaxed text-muted">
            I accept the{' '}
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                void window.newbie.app.openExternal('https://aka.ms/MinecraftEULA')
              }}
              className="inline-flex items-center gap-1 text-grass hover:underline"
            >
              Minecraft End User Licence Agreement <ArrowSquareOut size={10} />
            </button>
            . The server will be configured with <span className="font-mono text-ink/80">eula=true</span>.
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger">
            <WarningCircle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-muted/60">
          Downloads and installers are verified where upstream publishes hashes. Java is prepared automatically. The
          first start can take a while on Forge and NeoForge.
        </p>
      </div>
    </Modal>
  )
}
