import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowSquareOut, ArrowsClockwise, CheckCircle, Image, Leaf, Plus, ShieldCheck, Trash, UploadSimple, UserCircle, WifiSlash, WindowsLogo } from '@phosphor-icons/react'
import type { AccountSummary } from '@shared/types'
import { useAccounts, useSettings, qk } from '../hooks/queries'
import { toast, useUi } from '../store/ui'
import { errorMessage } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { AccountCard } from '../components/AccountCard'
import { SkinFace } from '../components/ui/BlockIcon'
import { SkinCatalogModal } from '../components/modals/SkinCatalogModal'
import { Card, EmptyState, Switch } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'

export function AccountsPage() {
  const accounts = useAccounts().data ?? []
  const queryClient = useQueryClient()
  const openModal = useUi((state) => state.openModal)
  const active = accounts.find((account) => account.active) ?? accounts[0]
  const others = accounts.filter((account) => account.id !== active?.id)
  const tlauncherAccount =
    accounts.find((account) => account.active && account.type === 'tlauncher') ??
    accounts.find((account) => account.type === 'tlauncher')

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
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <EmptyState
            icon={<UserCircle size={22} />}
            title="No accounts yet"
            description="Choose a Microsoft account for licensed servers, or start with a local offline profile. You can switch at any time."
            action={
              <Button variant="primary" onClick={() => openAdd('microsoft')} icon={<Plus size={15} />}>
                Add your first account
              </Button>
            }
          />
          <div className="space-y-4">
            {tlauncherAccount && (
              <TlauncherManageCard account={tlauncherAccount} onChanged={refresh} />
            )}
            <TLauncherCapeCard />
            <AccountTypePanel onAdd={openAdd} />
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

          <div className="space-y-4">
            {tlauncherAccount && (
              <TlauncherManageCard account={tlauncherAccount} onChanged={refresh} />
            )}
            <TLauncherCapeCard />
            <AccountTypePanel onAdd={openAdd} />
          </div>
        </div>
      )}
    </div>
  )
}

function TlauncherManageCard({
  account,
  onChanged
}: {
  account: AccountSummary
  onChanged: () => void
}) {
  const settings = useSettings().data
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const refresh = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.accounts.refresh(account.id)
      onChanged()
      toast('success', 'TLauncher profile refreshed', account.username)
    } catch (error) {
      toast('error', 'Could not refresh the TLauncher profile', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const useAccount = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.accounts.setActive(account.id)
      onChanged()
      toast('success', 'TLauncher account selected', account.username)
    } catch (error) {
      toast('error', 'Could not switch account', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const sync = async (checked: boolean): Promise<void> => {
    try {
      await window.newbie.settings.update({ tlauncherSkins: checked })
      await queryClient.invalidateQueries({ queryKey: qk.settings })
      toast(
        'success',
        checked ? 'TLauncher skin sync enabled' : 'TLauncher skin sync disabled',
        checked ? 'Newbie will fetch your public skin and cape.' : 'Your current local skin stays in place.'
      )
    } catch (error) {
      toast('error', 'Could not save that setting', errorMessage(error))
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SkinFace skinUrl={account.skinUrl} name={account.username} size={44} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[13.5px] font-semibold text-ink">Manage TLauncher</h2>
              <span className="rounded border border-grass/20 bg-grass/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.07em] text-grass">
                {account.active ? 'Active' : 'Saved'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted">{account.username}</p>
          </div>
        </div>
        <Leaf size={17} className="shrink-0 text-grass" weight="fill" />
      </div>

      <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
        Refresh your public TLauncher skin and cape, choose whether this profile is active, or open TLauncher&apos;s
        account page. The TLSkinCape plugin is controlled below.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          onClick={() => void refresh()}
          icon={<ArrowsClockwise size={14} />}
        >
          Refresh skin &amp; cape
        </Button>
        {!account.active && (
          <Button variant="primary" size="sm" loading={busy} onClick={() => void useAccount()}>
            Use this account
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void window.newbie.app.openExternal('https://tlauncher.org/')}
          icon={<ArrowSquareOut size={13} />}
        >
          Open TLauncher
        </Button>
      </div>

      <div className="mt-3 border-t border-line/40 pt-3">
        <Switch
          checked={settings?.tlauncherSkins ?? true}
          onChange={(checked) => void sync(checked)}
          label="Sync TLauncher skin and cape"
          description="Fetches your public texture data and shows it on the account card and in supported game launches."
        />
      </div>
    </Card>
  )
}

function TLauncherCapeCard() {
  const settings = useSettings().data
  const queryClient = useQueryClient()
  if (!settings) return null

  const save = async (checked: boolean): Promise<void> => {
    try {
      await window.newbie.settings.update({ tlauncherCapePlugin: checked })
      await queryClient.invalidateQueries({ queryKey: qk.settings })
      toast(
        'success',
        checked ? 'TLSkinCape enabled' : 'TLSkinCape disabled',
        checked
          ? 'Supported Fabric and Forge instances will receive the plugin before launch.'
          : 'Newbie-owned TLSkinCape files are removed from instances on their next launch.'
      )
    } catch (error) {
      toast('error', 'Could not save that setting', errorMessage(error))
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[12px] font-medium text-ink">
        <Leaf size={16} className="text-grass" weight="fill" /> TL skin &amp; cape plugin
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        TLauncher adds its TLSkinCape mod when a supported version launches. Newbie can place the same official plugin
        before launch, but only for TLauncher accounts and supported Fabric or Forge builds.
      </p>
      <div className="mt-3">
        <Switch
          checked={settings.tlauncherCapePlugin}
          onChange={(checked) => void save(checked)}
          label="Place TLSkinCape on supported instances"
          description="The plugin is downloaded from TLauncher's repository and verified before it is placed in mods."
        />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted/65">
        Version support is shown on every instance and in the version picker. TLSkinCape is GPL-3.0-only and is not
        bundled with Newbie.
      </p>
    </Card>
  )
}

function CustomSkinCard({ account, onChanged }: { account: AccountSummary; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
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
          <p className="mt-2 rounded-lg border border-line/45 bg-canvas/30 px-2.5 py-2 text-[10px] leading-relaxed text-muted/75">
            Custom skins are only visible to you if you are using an offline account (if you aren&apos;t using a
            TLauncher account), your game version doesn&apos;t support the TL Skin &amp; Cape mod, or the TL Skin option
            is disabled.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={hasCustom ? 'secondary' : 'primary'} loading={busy} onClick={() => void choose()} icon={<UploadSimple size={14} />}>
              {hasCustom ? 'Replace image' : 'Choose image'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCatalogOpen(true)}
              icon={<Image size={14} />}
            >
              Browse catalog
            </Button>
            {hasCustom && (
              <Button size="sm" variant="ghost" loading={busy} onClick={() => void remove()} icon={<Trash size={14} />}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <SkinCatalogModal
        open={catalogOpen}
        account={account}
        onClose={() => setCatalogOpen(false)}
        onApplied={onChanged}
      />
    </Card>
  )
}

function AccountTypePanel({
  onAdd
}: {
  onAdd: (tab: 'microsoft' | 'tlauncher' | 'offline' | 'authlib') => void
}) {
  const options = [
    {
      tab: 'microsoft' as const,
      title: 'Microsoft',
      text: 'Licensed servers, Realms and your Minecraft profile.',
      badge: 'Licensed',
      icon: WindowsLogo,
      tone: 'border-info/20 bg-info/10 text-info'
    },
    {
      tab: 'tlauncher' as const,
      title: 'TLauncher',
      text: 'Your nickname, skin and cape from TLauncher.',
      badge: 'Skins',
      icon: Leaf,
      tone: 'border-grass/20 bg-grass/10 text-grass'
    },
    {
      tab: 'offline' as const,
      title: 'Offline',
      text: 'A local profile for single-player, LAN and custom skins.',
      badge: 'Local',
      icon: WifiSlash,
      tone: 'border-line/60 bg-elevated text-muted'
    },
    {
      tab: 'authlib' as const,
      title: 'Authlib',
      text: 'Ely.by, LittleSkin or a private authentication server.',
      badge: 'Experimental',
      icon: ShieldCheck,
      tone: 'border-[#C4B5FD]/20 bg-[#C4B5FD]/10 text-[#C4B5FD]'
    }
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-line/45 px-4 py-3.5">
        <h2 className="font-display text-[13.5px] font-semibold text-ink">Add another account</h2>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">Choose how you want to sign in.</p>
      </div>
      <div className="divide-y divide-line/35">
        {options.map((option) => (
          <button
            key={option.tab}
            type="button"
            aria-label={`Add ${option.title} account`}
            onClick={() => onAdd(option.tab)}
            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.035] focus-visible:bg-white/[0.04]"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${option.tone}`}>
              <option.icon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-ink">{option.title}</span>
                <span className="rounded border border-line/60 bg-canvas/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.07em] text-muted/70">
                  {option.badge}
                </span>
              </span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">{option.text}</span>
            </span>
            <Plus size={15} className="shrink-0 text-muted/35 transition-colors group-hover:text-grass" />
          </button>
        ))}
      </div>
      <div className="flex items-start gap-2 border-t border-line/35 bg-canvas/25 px-4 py-3 text-[10px] leading-relaxed text-muted/75">
        <CheckCircle size={13} className="mt-0.5 shrink-0 text-grass/80" weight="fill" />
        <span>Switching accounts is instant. The selected account is used for the next launch; licences are never shared.</span>
      </div>
    </Card>
  )
}
