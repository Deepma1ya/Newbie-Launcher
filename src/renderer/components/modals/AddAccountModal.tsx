import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowSquareOut,
  CheckCircle,
  Copy,
  Key,
  Leaf,
  ShieldCheck,
  SpinnerGap,
  WarningCircle,
  WifiSlash,
  WindowsLogo
} from '@phosphor-icons/react'
import { useAccounts, qk } from '../../hooks/queries'
import { useUi, toast } from '../../store/ui'
import { errorMessage } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge, Field, Input, Segmented, Switch } from '../ui/primitives'

type Tab = 'microsoft' | 'tlauncher' | 'offline' | 'authlib'

export function AddAccountModal() {
  const open = useUi((state) => state.modal.addAccount)
  const tab = useUi((state) => state.modal.addAccountTab)
  const openModal = useUi((state) => state.openModal)
  const closeModal = useUi((state) => state.closeModal)
  const auth = useUi((state) => state.auth)
  const setAuth = useUi((state) => state.setAuth)
  const accounts = useAccounts()
  const queryClient = useQueryClient()

  const [username, setUsername] = useState('')
  const [apiRoot, setApiRoot] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [skins, setSkins] = useState(true)

  useEffect(() => {
    if (!open) {
      setError(null)
      setBusy(false)
      setPassword('')
      setCopied(false)
      setAuth({ status: 'idle' })
    }
  }, [open, setAuth])

  const finish = async (accountId: string, label: string): Promise<void> => {
    await window.newbie.accounts.setActive(accountId)
    await queryClient.invalidateQueries({ queryKey: qk.accounts })
    toast('success', 'Account added', label)
    closeModal('addAccount')
  }

  const addOffline = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const account = await window.newbie.accounts.addOffline(username)
      await finish(account.id, `Playing offline as ${account.username}`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const addTLauncher = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const account = await window.newbie.accounts.addTlauncher(username)
      await finish(account.id, `${account.username} · TLauncher skin account`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const addAuthlib = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const account = await window.newbie.accounts.addAuthlib({ apiRoot, username, password })
      await finish(account.id, `${account.username} · authlib account`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const startMicrosoft = async (): Promise<void> => {
    setError(null)
    setAuth({ status: 'idle' })
    try {
      await window.newbie.accounts.startMicrosoft()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const copyCode = async (): Promise<void> => {
    if (!auth.userCode) return
    await navigator.clipboard.writeText(auth.userCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const microsoftBusy = auth.status === 'code' || auth.status === 'waiting'

  return (
    <Modal
      open={open}
      onClose={() => {
        if (microsoftBusy) void window.newbie.accounts.cancelMicrosoft()
        closeModal('addAccount')
      }}
      title="Add an account"
      description="Use a Microsoft account for licensed servers, or a local account for offline play."
      size="md"
      footer={
        <Button variant="ghost" onClick={() => closeModal('addAccount')}>
          Close
        </Button>
      }
    >
      <Segmented
        value={tab}
        onChange={(value) => openModal('addAccountTab', value)}
        className="mb-5 w-full"
        options={[
          { value: 'microsoft', label: 'Microsoft', icon: <WindowsLogo size={14} /> },
          { value: 'tlauncher', label: 'TLauncher', icon: <Leaf size={14} /> },
          { value: 'offline', label: 'Offline', icon: <WifiSlash size={14} /> },
          { value: 'authlib', label: 'Authlib', icon: <ShieldCheck size={14} /> }
        ]}
      />

      {tab === 'microsoft' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-info/20 bg-info/[0.045] p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <WindowsLogo size={18} className="text-info" weight="fill" />
              Sign in with Microsoft
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
              Newbie Launcher opens Microsoft&apos;s device sign-in page. We never see your password. This is the only
              account type that can join online-mode servers.
            </p>
          </div>

          {auth.status === 'idle' && (
            <Button variant="primary" fullWidth onClick={() => void startMicrosoft()} icon={<WindowsLogo size={16} />}>
              Continue with Microsoft
            </Button>
          )}

          {(auth.status === 'code' || auth.status === 'waiting') && auth.userCode && (
            <div className="rounded-xl border border-line bg-canvas/50 p-5 text-center">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">Enter this code</div>
              <button
                onClick={() => void copyCode()}
                className="group mx-auto mt-2 flex items-center gap-2 font-mono text-[30px] font-semibold tracking-[0.16em] text-grass"
                aria-label="Copy sign-in code"
              >
                {auth.userCode}
                {copied ? <CheckCircle size={20} weight="fill" /> : <Copy size={18} className="text-muted group-hover:text-ink" />}
              </button>
              {auth.verificationUri && (
                <button
                  onClick={() => void window.newbie.app.openExternal(auth.verificationUri!)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-info hover:underline"
                >
                  Open {new URL(auth.verificationUri).host} <ArrowSquareOut size={12} />
                </button>
              )}
              <div className="mt-4 flex items-center justify-center gap-2 text-[11.5px] text-muted">
                <SpinnerGap size={14} className="animate-spin" />
                {auth.status === 'code' ? 'Waiting for you to finish signing in…' : 'Finishing Xbox Live sign-in…'}
              </div>
              <button
                onClick={() => {
                  void window.newbie.accounts.cancelMicrosoft()
                  setAuth({ status: 'idle' })
                }}
                className="mt-3 text-[11px] text-muted hover:text-danger"
              >
                Cancel sign-in
              </button>
            </div>
          )}

          {auth.status === 'waiting' && !auth.userCode && (
            <div className="rounded-xl border border-line bg-canvas/50 p-5 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-info/20 bg-info/10 text-info">
                <WindowsLogo size={20} weight="fill" />
              </div>
              <div className="mt-3 text-[12.5px] font-medium text-ink">A Microsoft sign-in window is open</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {auth.message ?? 'Complete the sign-in in the Microsoft window. Newbie never sees your password.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => void startMicrosoft()}>
                  Reopen window
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void window.newbie.accounts.cancelMicrosoft()
                    setAuth({ status: 'idle' })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {auth.status === 'cancelled' && (
            <div className="rounded-xl border border-line/60 bg-card/40 p-3 text-center text-[11.5px] text-muted">
              Microsoft sign-in was cancelled.
              <button onClick={() => void startMicrosoft()} className="ml-1 font-medium text-grass hover:underline">
                Try again
              </button>
            </div>
          )}

          {auth.status === 'success' && auth.account && (
            <div className="flex items-center gap-2 rounded-xl border border-grass/25 bg-grass/5 p-3 text-[12px] text-grass">
              <CheckCircle size={17} weight="fill" /> Signed in as {auth.account.username}
            </div>
          )}

          {auth.status === 'error' && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger">
              <WarningCircle size={15} className="mt-0.5 shrink-0" />
              {auth.message ?? 'Microsoft sign-in failed'}
            </div>
          )}
        </div>
      )}

      {tab === 'tlauncher' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-grass/20 bg-grass/[0.035] p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Leaf size={18} className="text-grass" weight="fill" /> TLauncher account
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
              Adds your TLauncher nickname and syncs your skin and cape from TLauncher&apos;s public skin service. TLauncher
              accounts play in offline mode — use Microsoft for licensed servers.
            </p>
          </div>
          <Field label="TLauncher username">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Steve"
              maxLength={16}
              data-autofocus
            />
          </Field>
          <Switch
            checked={skins}
            onChange={setSkins}
            label="Sync TLauncher skin and cape"
            description="Fetches your public texture data and shows the skin next to your account."
          />
          <Button variant="primary" fullWidth loading={busy} disabled={username.trim().length < 3} onClick={() => void addTLauncher()}>
            Add TLauncher account
          </Button>
          <p className="text-[10.5px] leading-relaxed text-muted/65">
            In-game skins on vanilla versions require the TLauncher skin system. We will offer an optional CustomSkinLoader
            install in the instance settings.
          </p>
        </div>
      )}

      {tab === 'offline' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-line/60 bg-card/60 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <WifiSlash size={18} className="text-muted" /> Offline account
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
              A local username for single-player, LAN and offline-mode servers. No password, no connection and no game
              ownership check.
            </p>
          </div>
          <Field label="Username" hint="3–16 characters">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Steve"
              maxLength={16}
              data-autofocus
            />
          </Field>
          <Button variant="primary" fullWidth loading={busy} disabled={username.trim().length < 3} onClick={() => void addOffline()}>
            Create offline account
          </Button>
        </div>
      )}

      {tab === 'authlib' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#C4B5FD]/20 bg-[#C4B5FD]/[0.04] p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <ShieldCheck size={18} className="text-[#C4B5FD]" /> Authlib / Yggdrasil
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
              Connect a third-party authentication server such as Ely.by, LittleSkin or a private server. The API root is
              resolved automatically when the server publishes an ALI header.
            </p>
            <Badge tone="purple" className="mt-2">Experimental</Badge>
          </div>
          <Field label="Authentication server">
            <Input value={apiRoot} onChange={(event) => setApiRoot(event.target.value)} placeholder="https://example.com/api/yggdrasil" />
          </Field>
          <Field label="Username or email">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={64} autoComplete="username" />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button
            variant="primary"
            fullWidth
            loading={busy}
            disabled={!apiRoot.trim() || username.trim().length < 1 || !password}
            onClick={() => void addAuthlib()}
            icon={<Key size={15} />}
          >
            Sign in to auth server
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-3 text-[11.5px] text-danger">
          <WarningCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {accounts.data && accounts.data.length > 0 && (
        <div className="mt-5 border-t border-line/40 pt-4 text-[10.5px] text-muted/60">
          {accounts.data.length} account{accounts.data.length === 1 ? '' : 's'} saved · switch accounts from the Accounts page
        </div>
      )}
    </Modal>
  )
}
