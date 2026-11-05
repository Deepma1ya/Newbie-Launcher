import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Image, Leaf, Plus, ShieldCheck, Trash, UploadSimple, UserCircle, WifiSlash, WindowsLogo } from '@phosphor-icons/react'
import type { AccountSummary } from '@shared/types'
import { useAccounts, qk } from '../hooks/queries'
import { toast, useUi } from '../store/ui'
import { errorMessage } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { AccountCard } from '../components/AccountCard'
import { SkinFace } from '../components/ui/BlockIcon'
import { Card, EmptyState } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'

export function AccountsPage() {
  const accounts = useAccounts().data ?? []
  const queryClient = useQueryClient()
  const openModal = useUi((state) => state.openModal)
  const active = accounts.find((account) => account.active) ?? accounts[0]
  const others = accounts.filter((account) => account.id !== active?.id)

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: qk.accounts })
  }

  const openAdd = (tab: 'microsoft' | 'tlauncher' | 'offline' | 'authlib'): void => {
    openModal('addAccountTab', tab)
    openModal('addAccount', true)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Identity"
        title="Accounts"
        description="Use Microsoft for licensed servers, TLauncher for your nickname and skin, or an offline profile for local worlds."
        actions={
          <Button variant="primary" onClick={() => openAdd('microsoft')} icon={<Plus size={15} />}>
            Add account
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <div className="space-y-5">
          <EmptyState
            icon={<UserCircle size={22} />}
            title="No accounts yet"
            description="Add a Microsoft account for online servers, or start with a local offline profile. You can switch at any time."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => openAdd('microsoft')} icon={<WindowsLogo size={15} />}>Microsoft</Button>
                <Button variant="secondary" onClick={() => openAdd('tlauncher')} icon={<Leaf size={15} />}>TLauncher</Button>
                <Button variant="ghost" onClick={() => openAdd('offline')} icon={<WifiSlash size={15} />}>Offline</Button>
              </div>
            }
          />
          <div className="grid gap-3 md:grid-cols-3">
            <TypeCard icon={<WindowsLogo size={20} />} title="Microsoft" text="Official sign-in. Licensed servers, Realms and your Mojang profile." onClick={() => openAdd('microsoft')} />
            <TypeCard icon={<Leaf size={20} />} title="TLauncher" text="Your TLauncher nickname with skin and cape sync. Offline play." onClick={() => openAdd('tlauncher')} />
            <TypeCard icon={<WifiSlash size={20} />} title="Offline" text="A local username for single-player and LAN. No login required." onClick={() => openAdd('offline')} />
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            {active && <AccountCard account={active} large onChanged={refresh} />}
            {active && (active.type === 'offline' || active.type === 'tlauncher') && (
              <CustomSkinCard account={active} onChanged={refresh} />
            )}

            {others.length > 0 && (
              <div>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Other accounts</h2>
                <div className="space-y-2">
                  {others.map((account) => (
                    <AccountCard key={account.id} account={account} onChanged={refresh} />
                  ))}
                </div>
              </div>
            )}

            <Card className="p-4">
              <div className="flex items-center gap-2 text-[12px] font-medium text-ink">
                <ShieldCheck size={16} className="text-grass" /> How sign-in is stored
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Microsoft refresh tokens and authlib passwords are encrypted with Windows DPAPI through Electron safeStorage.
                They never reach the renderer and are only used by the launcher process. Removing an account deletes its
                local token.
              </p>
            </Card>
          </div>

          <div className="space-y-3">
            <TypeCard icon={<WindowsLogo size={20} />} title="Microsoft" text="Licensed servers and Realms." onClick={() => openAdd('microsoft')} />
            <TypeCard icon={<Leaf size={20} />} title="TLauncher" text="Nickname, skin and cape sync." onClick={() => openAdd('tlauncher')} />
            <TypeCard icon={<WifiSlash size={20} />} title="Offline" text="Local worlds and LAN." onClick={() => openAdd('offline')} />
            <TypeCard icon={<ShieldCheck size={20} />} title="Authlib" text="Ely.by, LittleSkin or a private server." onClick={() => openAdd('authlib')} />
            <Card className="p-4">
              <div className="flex items-center gap-2 text-[11.5px] font-medium text-ink">
                <CheckCircle size={15} className="text-grass" weight="fill" /> Account switching is instant
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                The selected account is used for the next launch. Licences are never shared between profiles.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomSkinCard({ account, onChanged }: { account: AccountSummary; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const hasCustom = Boolean(account.skinUrl?.startsWith('data:image/'))

  const choose = async (): Promise<void> => {
    const file = await window.newbie.app.pickFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'] }
    ])
    if (!file) return
    setBusy(true)
    try {
      await window.newbie.accounts.setSkin(account.id, file)
      onChanged()
      toast('success', 'Custom skin applied', `It will be used when ${account.username} launches.`)
    } catch (error) {
      toast('error', 'Could not apply that image', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.accounts.removeSkin(account.id)
      onChanged()
      toast('success', 'Custom skin removed')
    } catch (error) {
      toast('error', 'Could not remove the skin', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <SkinFace skinUrl={account.skinUrl} name={account.username} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Image size={16} className="text-grass" />
            <h2 className="font-display text-[14px] font-semibold text-ink">Custom skin</h2>
            {hasCustom && <span className="rounded bg-grass/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-grass">Custom</span>}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Use a Minecraft skin PNG or any image. Newbie converts it and applies it to the offline player model with a
            local resource pack. Other players on servers will not see it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={hasCustom ? 'secondary' : 'primary'} loading={busy} onClick={() => void choose()} icon={<UploadSimple size={14} />}>
              {hasCustom ? 'Replace image' : 'Choose image'}
            </Button>
            {hasCustom && (
              <Button size="sm" variant="ghost" loading={busy} onClick={() => void remove()} icon={<Trash size={14} />}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function TypeCard({
  icon,
  title,
  text,
  onClick
}: {
  icon: React.ReactNode
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card-hover rounded-2xl border border-line/55 bg-card/55 p-4 text-left"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line/60 bg-elevated text-grass">{icon}</span>
      <span className="mt-2.5 block text-[12.5px] font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-[10.5px] leading-relaxed text-muted">{text}</span>
      <span className="mt-2 block text-[10px] font-medium text-grass/80">Add account →</span>
    </button>
  )
}
