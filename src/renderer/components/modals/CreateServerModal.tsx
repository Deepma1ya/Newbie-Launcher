import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowSquareOut, HardDrives, WarningCircle } from '@phosphor-icons/react'
import type { BedrockChannel, LoaderType, ServerType } from '@shared/types'
import { SERVER_TYPES, serverLoader, serverTypeInfo, serverTypeLabel } from '@shared/serverTypes'
import { useAccounts, useBedrockServerBuilds, useLoaderVersions, useMinecraftVersions, useSystemInfo, qk } from '../../hooks/queries'
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
  const [edition, setEdition] = useState<'java' | 'bedrock'>('java')
  const [name, setName] = useState('My Minecraft Server')
  const [nameTouched, setNameTouched] = useState(false)
  const [type, setType] = useState<ServerType>('paper')
  const [bedrockChannel, setBedrockChannel] = useState<BedrockChannel>('release')
  const [bedrockVersion, setBedrockVersion] = useState('')
  const [allowMicrosoftAccount, setAllowMicrosoftAccount] = useState(true)
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
  const loaderVersions = useLoaderVersions(loader, edition === 'java' ? versionId : '')
  const typeInfo = serverTypeInfo(edition === 'bedrock' ? 'bedrock' : type)
  const bedrockBuilds = useBedrockServerBuilds(edition === 'bedrock')
  const javaTypes = SERVER_TYPES.filter((entry) => entry.value !== 'bedrock')
  const accounts = useAccounts().data ?? []
  const microsoftAccount = accounts.find((entry) => entry.active && entry.type === 'microsoft')
  const hasMicrosoftAccount = accounts.some((entry) => entry.type === 'microsoft')

  useEffect(() => {
    if (!open) return
    setError(null)
    if (!versionId && releaseVersions.length > 0) setVersionId(releaseVersions[0]!.id)
  }, [open, releaseVersions, versionId])

  useEffect(() => {
    const builds = bedrockBuilds.data
    if (!builds?.length) return
    const chosen = builds.find((entry) => entry.channel === bedrockChannel) ?? builds[0]
    if (chosen) setBedrockVersion(chosen.version)
  }, [bedrockBuilds.data, bedrockChannel])

  useEffect(() => {
    setNameTouched(false)
    setPort(edition === 'bedrock' ? 19132 : 25565)
    setOnlineMode(edition === 'bedrock')
  }, [edition])

  useEffect(() => {
    if (nameTouched) return
    if (edition === 'bedrock') {
      if (bedrockVersion) setName(`My Bedrock ${bedrockVersion}`)
      return
    }
    if (versionId) setName(`My ${serverTypeLabel(type)} ${versionId}`)
  }, [nameTouched, edition, type, versionId, bedrockVersion])

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
    const version = edition === 'bedrock' ? bedrockVersion : versionId
    if (!version || !name.trim() || !eulaAccepted) return
    setBusy(true)
    setError(null)
    let serverId: string | null = null
    try {
      const server = await window.newbie.servers.create({
        name: name.trim(),
        type: edition === 'bedrock' ? 'bedrock' : type,
        versionId: version,
        bedrockChannel: edition === 'bedrock' ? bedrockChannel : undefined,
        allowMicrosoftAccount: edition === 'bedrock' ? allowMicrosoftAccount : undefined,
        loaderVersion: typeInfo.mods ? loaderVersion : undefined,
        port,
        memoryMb,
        motd,
        onlineMode: edition === 'bedrock' ? true : onlineMode,
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
      description="Choose Java or Bedrock. Newbie downloads the software, accepts the EULA on your behalf after consent, configures the port and starts it."
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
            disabled={
              !name.trim() ||
              !eulaAccepted ||
              (edition === 'bedrock'
                ? !bedrockVersion
                : !versionId || (typeInfo.mods && !loaderVersion))
            }
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
          <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.09em] text-muted">Edition</div>
          <Segmented
            value={edition}
            onChange={setEdition}
            options={[
              { value: 'java', label: 'Java Edition' },
              { value: 'bedrock', label: 'Bedrock' }
            ]}
          />
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted/70">
            {edition === 'bedrock'
              ? 'Official Minecraft for Windows Dedicated Server. Uses UDP, needs no Java and runs one Bedrock world.'
              : 'Java servers support Fabric, Forge, NeoForge, Quilt, Paper and Vanilla with mods, plugins and datapacks.'}
          </p>
        </div>

        {edition === 'java' ? (
          <>
            <div>
              <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.09em] text-muted">Server type</div>
              <Select value={type} onChange={(value) => setType(value as ServerType)}>
                {javaTypes.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted/70">
                {typeInfo.description}{' '}
                {typeInfo.plugins
                  ? 'Plugins and datapacks are supported.'
                  : typeInfo.mods
                    ? 'Mods and datapacks are supported.'
                    : 'Datapacks are supported.'}
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
              <Field label="Server port" hint="TCP · LAN / localhost">
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
          </>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <Field
                label="Bedrock dedicated server"
                hint={
                  bedrockBuilds.isLoading
                    ? 'Loading Mojang builds…'
                    : `${bedrockBuilds.data?.length ?? 0} channels`
                }
              >
                <Select
                  value={bedrockChannel}
                  onChange={(value) => setBedrockChannel(value as BedrockChannel)}
                >
                  {(bedrockBuilds.data ?? []).map((entry) => (
                    <option key={entry.channel} value={entry.channel}>
                      {entry.channel === 'release' ? 'Stable' : 'Preview'} · {entry.version}
                    </option>
                  ))}
                  {(bedrockBuilds.data?.length ?? 0) === 0 && <option value="">No builds loaded</option>}
                </Select>
              </Field>
              <Field label="Server port" hint="UDP · default 19132">
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(event) => setPort(Number(event.target.value))}
                />
              </Field>
            </div>
            <p className="text-[10.5px] leading-relaxed text-muted/70">
              Version {bedrockVersion || '—'} will be downloaded from Minecraft.net. Bedrock manages memory
              automatically; 4 GB or more is recommended for a small server.
            </p>
            {microsoftAccount ? (
              <Switch
                checked={allowMicrosoftAccount}
                onChange={setAllowMicrosoftAccount}
                label={`Add ${microsoftAccount.gamertag ?? microsoftAccount.username} to the allow list`}
                description={
                  microsoftAccount.xuid
                    ? 'The account can still join after you turn on the Bedrock allow list. Friends can be added later from the server Players tab.'
                    : 'Refresh this Microsoft account from Accounts to load its Xbox ID, then recreate the server or add it from Players.'
                }
              />
            ) : (
              hasMicrosoftAccount && (
                <p className="text-[10px] leading-relaxed text-gold/80">
                  Select your Microsoft account on the Accounts page to add it to this server&apos;s allow list.
                </p>
              )
            )}
          </>
        )}

        {edition === 'java' ? (
          <Switch
            checked={onlineMode}
            onChange={setOnlineMode}
            label="Online mode (Microsoft accounts)"
            description="Turn off for TLauncher or offline friends. Turn on when the server is exposed to the internet."
          />
        ) : (
          <div className="rounded-xl border border-info/20 bg-info/[0.045] p-3 text-[10.5px] leading-relaxed text-muted">
            <strong className="text-ink">Bedrock servers are always online.</strong> Players sign in with
            their Xbox/Microsoft account, so online mode is fixed on.
          </div>
        )}

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
          {edition === 'bedrock'
            ? 'The official Bedrock Dedicated Server is downloaded from Minecraft.net. It needs no Java and uses UDP; port-forward UDP if friends join over the internet.'
            : 'Downloads and installers are verified where upstream publishes hashes. Java is prepared automatically. The first start can take a while on Forge and NeoForge.'}
        </p>
      </div>
    </Modal>
  )
}
