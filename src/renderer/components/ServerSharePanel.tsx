import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowSquareOut,
  CheckCircle,
  Copy,
  GlobeSimple,
  Plugs,
  Play,
  ShieldWarning,
  SpinnerGap
} from '@phosphor-icons/react'
import type { ServerAddressTest, ServerInternetProvider, ServerInternetState, ServerRecord } from '@shared/types'
import { useServerInternet, useServerShare } from '../hooks/queries'
import { toast } from '../store/ui'
import { errorMessage } from '../lib/utils'
import { Badge, Card, Input, Skeleton } from './ui/primitives'
import { Button } from './ui/Button'

const PLAYIT_DOWNLOAD = 'https://playit.gg/download'
const PLAYIT_TUNNELS = 'https://playit.gg/account/tunnels'
const RADMIN_DOWNLOAD = 'https://www.radmin-vpn.com/'
const NGROK_DOWNLOAD = 'https://ngrok.com/download'
const NGROK_TOKEN = 'https://dashboard.ngrok.com/get-started/your-authtoken'
const CLOUDFLARE_TCP_DOCS =
  'https://developers.cloudflare.com/cloudflare-one/applications/non-http/arbitrary-tcp/'

type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Advanced'

const difficultyTone: Record<Difficulty, 'green' | 'gold' | 'red' | 'purple'> = {
  Easy: 'green',
  Medium: 'gold',
  Hard: 'red',
  Advanced: 'purple'
}

export function ServerSharePanel({
  server,
  running,
  onStart,
  onOpenSettings
}: {
  server: ServerRecord
  running: boolean
  onStart: () => void
  onOpenSettings: () => void
}) {
  const share = useServerShare(server.id)
  const internet = useServerInternet(server.id)
  const [address, setAddress] = useState('')
  const [test, setTest] = useState<ServerAddressTest | null>(null)
  const [testing, setTesting] = useState(false)
  const [relayBusy, setRelayBusy] = useState<ServerInternetProvider | null>(null)
  const openedClaim = useRef<string | null>(null)

  const storageKey = `newbie:server-share:${server.id}`

  useEffect(() => {
    if (!share.data) return
    const saved = localStorage.getItem(storageKey) ?? ''
    setAddress((current) => current || saved || share.data?.lan[0]?.address || '')
  }, [share.data, storageKey])

  useEffect(() => {
    const trimmed = address.trim()
    if (trimmed) localStorage.setItem(storageKey, trimmed)
    else localStorage.removeItem(storageKey)
  }, [address, storageKey])

  useEffect(() => {
    if (!running) void internet.refetch()
  }, [running, internet.refetch])

  const relayState = internet.data
  useEffect(() => {
    if (relayState?.status === 'online' && relayState.address) setAddress(relayState.address)
  }, [relayState?.status, relayState?.address])

  useEffect(() => {
    if (relayState?.status !== 'claiming' || !relayState.claimUrl) return
    if (openedClaim.current === relayState.claimUrl) return
    openedClaim.current = relayState.claimUrl
    void window.newbie.app.openExternal(relayState.claimUrl)
  }, [relayState?.status, relayState?.claimUrl])

  const startRelay = async (provider: ServerInternetProvider): Promise<void> => {
    setRelayBusy(provider)
    try {
      const next = await window.newbie.servers.internetStart(server.id, provider)
      if (next.claimUrl) {
        openedClaim.current = next.claimUrl
        void window.newbie.app.openExternal(next.claimUrl)
      }
      await internet.refetch()
    } catch (failure) {
      toast('error', 'Could not open internet access', errorMessage(failure))
    } finally {
      setRelayBusy(null)
    }
  }

  const stopRelay = async (): Promise<void> => {
    try {
      await window.newbie.servers.internetStop(server.id)
      await internet.refetch()
      toast('success', 'Internet access closed')
    } catch (failure) {
      toast('error', 'Could not close internet access', errorMessage(failure))
    }
  }

  const copy = async (value: string, label: string): Promise<void> => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast('success', `${label} copied`, value)
    } catch (failure) {
      toast('error', 'Could not copy', errorMessage(failure))
    }
  }

  const chooseAddress = (value: string): void => {
    setAddress(value)
    setTest(null)
  }

  const runTest = async (value = address): Promise<void> => {
    const cleaned = value.trim().replace(/^tcp:\/\//i, '')
    if (!cleaned) return
    setTesting(true)
    setTest(null)
    try {
      setTest(await window.newbie.servers.testAddress(cleaned))
    } catch (failure) {
      toast('error', 'Could not test the address', errorMessage(failure))
    } finally {
      setTesting(false)
    }
  }

  if (share.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!share.data) {
    return (
      <Card className="p-5 text-[11.5px] text-muted">
        Could not read this server's network addresses.
        <Button variant="secondary" size="sm" className="ml-3" onClick={() => void share.refetch()}>
          Try again
        </Button>
      </Card>
    )
  }

  const data = share.data
  const lanAddress = data.lan[0]?.address
  const publicAddress = data.publicAddress
  const cgnat =
    data.publicIp !== undefined &&
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(
      data.publicIp
    )
  const displayAddress = address.trim().replace(/^tcp:\/\//i, '')

  return (
    <div className="space-y-4">
      {server.type === 'bedrock' && (
        <div className="rounded-xl border border-gold/25 bg-gold/[0.055] px-3.5 py-3 text-[10.5px] leading-relaxed text-gold">
          Bedrock uses <strong>UDP</strong>, not TCP. Port-forward UDP {server.port}, or use a tunnel that supports UDP
          such as playit.gg. TCP-only tunnels and the local reachability test below do not apply.
        </div>
      )}
      {!running && (
        <Card className="flex flex-wrap items-center gap-3 border-gold/25 bg-gold/[0.045] p-4">
          <ShieldWarning size={18} className="text-gold" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-ink">Start the server before sharing it</div>
            <p className="mt-0.5 text-[10.5px] text-muted">
              Tunnels and friends cannot connect while the Minecraft server is stopped.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={onStart} icon={<Play size={13} weight="fill" />}>
            Start server
          </Button>
        </Card>
      )}

      <InternetAccessCard
        server={server}
        running={running}
        state={internet.data}
        loading={internet.isLoading}
        busy={relayBusy}
        onStart={(provider) => void startRelay(provider)}
        onStop={() => void stopRelay()}
        onCopy={(value, label) => void copy(value, label)}
        onOpen={(url) => void window.newbie.app.openExternal(url)}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-grass/20 bg-grass/10 text-grass">
              <GlobeSimple size={18} />
            </span>
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink">Friends connect to</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Paste a tunnel address or pick one of the detected addresses.
              </p>
            </div>
          </div>
          <Badge tone={running ? 'green' : 'neutral'} className="h-5 text-[8.5px]">
            {running ? `localhost:${server.port}` : 'Server stopped'}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={address}
            onChange={(event) => {
              setAddress(event.target.value)
              setTest(null)
            }}
            placeholder="playit address, host:port or 1.2.3.4:25565"
            className="min-w-[220px] flex-1 font-mono"
            aria-label="Address to share with friends"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!displayAddress}
            onClick={() => void copy(displayAddress, 'Address')}
            icon={<Copy size={14} />}
          >
            Copy
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={testing}
            disabled={!displayAddress || server.type === 'bedrock'}
            onClick={() => void runTest()}
            title={server.type === 'bedrock' ? 'Bedrock uses UDP; the local test is TCP-only' : undefined}
          >
            Test
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <AddressChip
            label="Local"
            value={data.localAddress}
            onUse={() => chooseAddress(data.localAddress)}
          />
          {data.lan.map((entry) => (
            <AddressChip
              key={`${entry.interface}-${entry.address}`}
              label={`LAN · ${entry.interface}`}
              value={entry.address}
              onUse={() => chooseAddress(entry.address)}
            />
          ))}
          {data.radminAddress && (
            <AddressChip
              label="Radmin VPN"
              value={data.radminAddress}
              onUse={() => chooseAddress(data.radminAddress!)}
            />
          )}
          {publicAddress && (
            <AddressChip
              label="Public"
              value={publicAddress}
              onUse={() => chooseAddress(publicAddress)}
            />
          )}
        </div>

        {test && (
          <div
            className={`mt-3 rounded-xl border p-3 text-[11px] ${
              test.online
                ? 'border-grass/25 bg-grass/[0.045] text-grass'
                : 'border-danger/25 bg-danger/[0.045] text-danger'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle size={14} weight="fill" />
              {test.online ? 'Address is reachable' : 'No response'}
            </div>
            <p className="mt-1 leading-relaxed text-muted">
              {test.online
                ? test.note ??
                  `${test.playersOnline ?? 0}/${test.playersMax ?? '?'} players online${
                    test.version ? ` · ${test.version}` : ''
                  }`
                : test.error ??
                  'Check that the server is running, the tunnel is active, and the port is forwarded.'}
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <MethodCard
          title="Manual playit.gg"
          difficulty="Easy"
          friends="Nothing"
          description="Fallback if guided setup cannot claim the agent. Use the official playit agent and create the tunnel yourself."
        >
          <ol className="space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>1. Download and run the playit.gg agent on this PC, then claim it with a free account.</li>
            <li>
              2. Create a <span className="text-ink">Minecraft Java</span> or{' '}
              <span className="text-ink">Bedrock</span> tunnel with local address{' '}
              <code className="rounded bg-white/[0.055] px-1 py-0.5 font-mono text-[10px] text-ink">
                127.0.0.1:{server.port}
              </code>
              .
            </li>
            <li>3. Paste the playit address above and send it to your friends.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void window.newbie.app.openExternal(PLAYIT_DOWNLOAD)}
              icon={<ArrowSquareOut size={13} />}
            >
              Download playit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void window.newbie.app.openExternal(PLAYIT_TUNNELS)}
              icon={<ArrowSquareOut size={13} />}
            >
              Open tunnel setup
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void copy(`127.0.0.1:${server.port}`, 'Local playit target')}
              icon={<Copy size={13} />}
            >
              Copy local target
            </Button>
          </div>
        </MethodCard>

        <MethodCard
          title="Port forwarding"
          difficulty="Hard"
          friends="Nothing (public IP)"
          description="Open one TCP port on your router. No extra software for you or your friends, but it needs router access and a public IP."
        >
          <div className="space-y-2">
            <CopyValue label="LAN target for the router" value={lanAddress ?? 'No LAN address detected'} />
            <CopyValue label="Public address for friends" value={publicAddress ?? 'Public IP unavailable'} />
          </div>
          {cgnat && (
            <div className="mt-2 rounded-lg border border-danger/20 bg-danger/[0.045] p-2.5 text-[10.5px] leading-relaxed text-danger">
              Your public IP looks like CGNAT. Port forwarding may not work on this connection; playit.gg
              is the better choice.
            </div>
          )}
          <ol className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>
              1. Open your router and forward <span className="text-ink">TCP {server.port}</span> to{' '}
              <span className="text-ink">{lanAddress ?? 'this PC'}</span>.
            </li>
            <li>2. Allow Java on Private networks if Windows Firewall asks.</li>
            <li>3. Use the Public address above, then press Test.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.gateway && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void window.newbie.app.openExternal(`http://${data.gateway}`)}
                icon={<ArrowSquareOut size={13} />}
              >
                Open router ({data.gateway})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={!publicAddress}
              onClick={() => {
                if (!publicAddress) return
                chooseAddress(publicAddress)
                void runTest(publicAddress)
              }}
              icon={<CheckCircle size={13} />}
            >
              Use and test public
            </Button>
          </div>
        </MethodCard>

        <MethodCard
          title="Radmin VPN"
          difficulty="Medium"
          friends="Radmin VPN"
          description="A private virtual LAN. Everyone installs Radmin VPN and joins the same network, then uses the host's Radmin IP."
        >
          {data.radminAddress ? (
            <CopyValue label="Radmin address for friends" value={data.radminAddress} />
          ) : (
            <div className="rounded-lg border border-gold/20 bg-gold/[0.04] p-2.5 text-[10.5px] leading-relaxed text-gold">
              Radmin VPN is not detected. Install it, then run it and connect this PC to a network.
            </div>
          )}
          <ol className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>1. Install Radmin VPN on this PC and every friend's PC.</li>
            <li>2. Create or join the same Radmin network on all PCs.</li>
            <li>3. Share the Radmin address above; friends use it as the Minecraft server address.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void window.newbie.app.openExternal(RADMIN_DOWNLOAD)}
              icon={<ArrowSquareOut size={13} />}
            >
              Download Radmin VPN
            </Button>
            {data.radminAddress && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  chooseAddress(data.radminAddress!)
                  void copy(data.radminAddress!, 'Radmin address')
                }}
                icon={<Copy size={13} />}
              >
                Use and copy
              </Button>
            )}
          </div>
        </MethodCard>

        <MethodCard
          title="ngrok"
          difficulty="Medium"
          friends="Nothing"
          description="A TCP tunnel from ngrok. The host needs a free account; TCP endpoints require card verification on the free plan."
        >
          <CopyValue label="Command for this server" value={`ngrok tcp ${server.port}`} />
          <ol className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>1. Create a free ngrok account and add the authtoken to the ngrok agent.</li>
            <li>2. Run the command above on this PC while the server is running.</li>
            <li>3. Copy the <span className="text-ink">tcp://…</span> address from ngrok, remove the prefix, and paste it above.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void window.newbie.app.openExternal(NGROK_DOWNLOAD)}
              icon={<ArrowSquareOut size={13} />}
            >
              Download ngrok
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void window.newbie.app.openExternal(NGROK_TOKEN)}
              icon={<ArrowSquareOut size={13} />}
            >
              Get authtoken
            </Button>
          </div>
        </MethodCard>

        <MethodCard
          title="Cloudflare Tunnel"
          difficulty="Advanced"
          friends="cloudflared or WARP"
          description="Good for a free domain and Zero Trust, but not a normal public Minecraft address. Every friend needs extra tunnel software."
        >
          <div className="rounded-lg border border-gold/20 bg-gold/[0.04] p-2.5 text-[10.5px] leading-relaxed text-gold">
            Cloudflare's public tunnel is HTTP-oriented. Minecraft Java is raw TCP, so each friend must
            run cloudflared or WARP (or a client mod) and authenticate. Use this only if your friends
            are comfortable installing it.
          </div>
          <ol className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>1. Own or add a domain to Cloudflare and create a Zero Trust tunnel.</li>
            <li>
              2. Route a TCP service to <span className="text-ink">localhost:{server.port}</span>.
            </li>
            <li>3. Give friends the hostname and the cloudflared/WARP setup they need.</li>
          </ol>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void window.newbie.app.openExternal(CLOUDFLARE_TCP_DOCS)}
              icon={<ArrowSquareOut size={13} />}
            >
              Cloudflare TCP guide
            </Button>
          </div>
        </MethodCard>

        <MethodCard
          title="Same Wi-Fi / LAN"
          difficulty="Easy"
          friends="Same network"
          description="No internet setup at all. Friends on the same Wi-Fi can use the LAN address."
        >
          {data.lan.length > 0 ? (
            <div className="space-y-2">
              {data.lan.map((entry) => (
                <CopyValue
                  key={`${entry.interface}-${entry.address}-card`}
                  label={`${entry.interface} address`}
                  value={entry.address}
                />
              ))}
            </div>
          ) : (
            <div className="text-[10.5px] text-muted">No LAN IPv4 address was detected.</div>
          )}
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
            Use this only when everyone is on the same network. For friends elsewhere, choose a tunnel
            or port forwarding above.
          </p>
        </MethodCard>
      </div>

      <Card className="border-gold/20 bg-gold/[0.035] p-4">
        <div className="flex items-start gap-2.5">
          <ShieldWarning size={18} className="mt-0.5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-ink">Before you share a public address</div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
              A public address can be joined by anyone who receives it. Turn on online mode and the
              whitelist in Server settings, and only send the address to people you trust.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onOpenSettings}>
            Server settings
          </Button>
        </div>
      </Card>
    </div>
  )
}

function InternetAccessCard({
  server,
  running,
  state,
  loading,
  busy,
  onStart,
  onStop,
  onCopy,
  onOpen
}: {
  server: ServerRecord
  running: boolean
  state?: ServerInternetState
  loading: boolean
  busy: ServerInternetProvider | null
  onStart: (provider: ServerInternetProvider) => void
  onStop: () => void
  onCopy: (value: string, label: string) => void
  onOpen: (url: string) => void
}) {
  const status = state?.status ?? 'offline'
  const isBedrock = server.type === 'bedrock'
  const playitConnected = state?.playitConnected ?? false
  const provider = state?.provider
  const canStart = running && !loading && !busy && status !== 'online' && status !== 'starting' && status !== 'claiming'

  return (
    <Card className="border-grass/25 bg-grass/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-grass/25 bg-grass/10 text-grass">
            <Plugs size={18} weight="fill" />
          </span>
          <div>
            <h2 className="font-display text-[14px] font-semibold text-ink">Play from the internet</h2>
            <p className="mt-0.5 max-w-2xl text-[10.5px] leading-relaxed text-muted">
              No public IP or router port forwarding needed. The relay works behind CGNAT; friends install
              nothing and connect with the address below.
            </p>
          </div>
        </div>
        <Badge tone={status === 'online' ? 'green' : status === 'error' ? 'red' : 'neutral'} className="h-5 text-[8.5px]">
          {status === 'online'
            ? 'Online'
            : status === 'claiming'
              ? 'Waiting for approval'
              : status === 'starting'
                ? 'Opening'
                : status === 'error'
                  ? 'Needs attention'
                  : 'Not shared'}
        </Badge>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : status === 'claiming' ? (
        <div className="mt-4 rounded-xl border border-line/60 bg-canvas/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Approve this PC on playit.gg
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                Open the page below and sign in with a free playit.gg account. This is a one-time setup;
                after approval, starting a tunnel is one click.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => state?.claimUrl && onOpen(state.claimUrl)}
              icon={<ArrowSquareOut size={14} />}
            >
              Open playit.gg
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-line/60 bg-[#080d09] px-3 py-2 font-mono text-[13px] tracking-[0.14em] text-grass">
              {state?.claimCode ?? '—'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => state?.claimCode && onCopy(state.claimCode, 'Claim code')}
              icon={<Copy size={13} />}
            >
              Copy code
            </Button>
            <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
              <SpinnerGap size={13} className="animate-spin" />
              Waiting for approval…
            </span>
          </div>
          {state?.message && <p className="mt-2 text-[10.5px] text-muted/75">{state.message}</p>}
          <Button variant="ghost" size="sm" className="mt-2" onClick={onStop}>
            Cancel setup
          </Button>
        </div>
      ) : status === 'starting' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line/60 bg-canvas/40 p-3.5">
          <SpinnerGap size={17} className="animate-spin text-grass" />
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-medium text-ink">
              Opening the {provider === 'bore' ? 'bore.pub' : 'playit.gg'} tunnel…
            </div>
            <p className="mt-0.5 text-[10px] text-muted">
              {provider === 'bore'
                ? 'The free Java relay usually takes a few seconds.'
                : 'The playit agent and tunnel address can take a few seconds.'}
            </p>
            {state?.message && <p className="mt-1 text-[10px] text-muted/70">{state.message}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onStop}>
            Cancel
          </Button>
        </div>
      ) : status === 'online' && state?.address ? (
        <div className="mt-4 rounded-xl border border-grass/25 bg-grass/[0.045] p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-grass/80">
              {provider === 'bore' ? 'bore.pub relay' : 'playit.gg tunnel'} · {state.protocol.toUpperCase()}
            </span>
            <Badge tone="green" className="h-4 px-1.5 text-[8px]">
              Ready
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-line/50 bg-[#080d09] px-3 py-2 font-mono text-[12px] text-ink">
              {state.address}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onCopy(state.address!, 'Server address')}
              icon={<Copy size={14} />}
            >
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={onStop}>
              Stop sharing
            </Button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
            Send this address to friends. It closes automatically when you stop the server or Newbie closes.
          </p>
        </div>
      ) : status === 'error' ? (
        <div className="mt-4 rounded-xl border border-danger/25 bg-danger/[0.045] p-3.5">
          <div className="text-[11.5px] font-medium text-danger">Internet access could not start</div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
            {state?.message ?? 'The relay did not return an address.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={busy === 'playit'}
              disabled={!canStart}
              onClick={() => onStart('playit')}
              icon={<Plugs size={14} />}
            >
              {playitConnected ? 'Try playit again' : 'Set up playit'}
            </Button>
            {!isBedrock && (
              <Button
                variant="ghost"
                size="sm"
                loading={busy === 'bore'}
                disabled={!canStart}
                onClick={() => onStart('bore')}
                icon={<Plugs size={14} />}
              >
                Try Java relay
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onStop}>
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={busy === 'playit'}
            disabled={!canStart}
            onClick={() => onStart('playit')}
            icon={<Plugs size={14} />}
          >
            {playitConnected ? 'Go online with playit' : 'Set up playit (Java + Bedrock)'}
          </Button>
          {!isBedrock && (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === 'bore'}
              disabled={!canStart}
              onClick={() => onStart('bore')}
              icon={<Plugs size={14} />}
            >
              Java quick relay
            </Button>
          )}
          <span className="text-[10px] text-muted/65">
            {isBedrock
              ? 'playit.gg is required for Bedrock UDP.'
              : 'Java quick relay needs no account, but it is TCP-only and depends on bore.pub.'}
          </span>
        </div>
      )}

      {!running && status !== 'online' && status !== 'claiming' && status !== 'starting' && (
        <p className="mt-2 text-[10px] text-gold/80">Start the server first, then open internet access.</p>
      )}
    </Card>
  )
}

function AddressChip({
  label,
  value,
  onUse
}: {
  label: string
  value: string
  onUse: () => void
}) {
  return (
    <button
      type="button"
      onClick={onUse}
      title={`Use ${value}`}
      className="rounded-lg border border-line/55 bg-canvas/30 px-2 py-1 text-left text-[9.5px] text-muted transition-colors hover:border-line hover:text-ink"
    >
      <span className="text-muted/60">{label}</span>{' '}
      <span className="font-mono text-[9.5px]">{value}</span>
    </button>
  )
}

function MethodCard({
  title,
  difficulty,
  friends,
  recommended,
  description,
  children
}: {
  title: string
  difficulty: Difficulty
  friends: string
  recommended?: boolean
  description: string
  children: ReactNode
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[14px] font-semibold text-ink">{title}</h3>
            {recommended && (
              <Badge tone="green" className="h-4 px-1.5 text-[8px]">
                Recommended
              </Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={difficultyTone[difficulty]} className="h-4 px-1.5 text-[8px]">
              {difficulty}
            </Badge>
            <Badge tone="neutral" className="h-4 px-1.5 text-[8px]">
              Friends need: {friends}
            </Badge>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-muted">{description}</p>
      <div className="mt-3">{children}</div>
    </Card>
  )
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      toast('success', `${label} copied`, value)
    } catch (failure) {
      toast('error', 'Could not copy', errorMessage(failure))
    }
  }
  const unavailable = !value || /^(No |Public IP unavailable)/.test(value)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line/45 bg-canvas/30 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-[0.08em] text-muted/55">{label}</div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-ink/80" title={value}>
          {value}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        disabled={unavailable}
        onClick={() => void copy()}
        icon={<Copy size={12} />}
        aria-label={`Copy ${label}`}
      />
    </div>
  )
}
