import { useState } from 'react'
import { ArrowsClockwise, Check, DotsThree, Trash, UserCircle } from '@phosphor-icons/react'
import type { AccountSummary } from '@shared/types'
import { useUi, toast } from '../store/ui'
import { cn, errorMessage, relativeTime } from '../lib/utils'
import { SkinFace } from './ui/BlockIcon'
import { Badge } from './ui/primitives'
import { Button } from './ui/Button'

const typeLabels: Record<AccountSummary['type'], string> = {
  microsoft: 'Microsoft',
  tlauncher: 'TLauncher',
  offline: 'Offline',
  authlib: 'Authlib'
}

export function AccountCard({
  account,
  large = false,
  onChanged
}: {
  account: AccountSummary
  large?: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const askConfirm = useUi((state) => state.askConfirm)

  const setActive = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.accounts.setActive(account.id)
      onChanged()
      toast('success', `Playing as ${account.username}`)
    } catch (error) {
      toast('error', 'Could not switch account', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const refresh = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.accounts.refresh(account.id)
      onChanged()
      toast('success', 'Account refreshed', account.username)
    } catch (error) {
      toast('error', 'Could not refresh account', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = (): void => {
    askConfirm({
      title: `Remove ${account.username}?`,
      description: 'The account is removed from this launcher. Your Microsoft or TLauncher account itself is not affected.',
      confirmLabel: 'Remove account',
      danger: true,
      action: async () => {
        await window.newbie.accounts.remove(account.id)
        onChanged()
      }
    })
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-card/65',
        account.active ? 'border-grass/35' : 'border-line/55',
        large ? 'p-5' : 'p-4'
      )}
    >
      {account.active && <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-transparent via-grass/80 to-transparent" />}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <SkinFace skinUrl={account.skinUrl} name={account.username} size={large ? 56 : 42} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn('truncate font-display font-semibold text-ink', large ? 'text-[19px]' : 'text-[14px]')}>
                {account.username}
              </h3>
              {account.active && <Badge tone="green" className="h-5 text-[8.5px]">Active</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted">
              <Badge tone={account.type === 'microsoft' ? 'blue' : account.type === 'tlauncher' ? 'green' : 'neutral'} className="h-4 px-1.5 text-[8.5px]">
                {typeLabels[account.type]}
              </Badge>
              {account.type === 'microsoft' && (
                <span>{account.gamertag ? `Xbox · ${account.gamertag}` : 'Licensed · online servers'}</span>
              )}
              {account.type === 'tlauncher' && <span>Skin sync · offline play</span>}
              {account.type === 'offline' && <span>Local play</span>}
              {account.type === 'authlib' && <span>{account.apiRoot ? new URL(account.apiRoot).host : 'Third-party auth'}</span>}
            </div>
            <div className="mt-1 font-mono text-[9.5px] text-muted/55">{account.uuid}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {account.type === 'microsoft' && (
            <span className="mr-1 text-[10px] text-muted/70">
              {account.expiresAt ? `Renews ${relativeTime(account.expiresAt)}` : ''}
            </span>
          )}
          {!account.active && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void setActive()} icon={<Check size={13} />}>
              Use
            </Button>
          )}
          <div className="relative">
            <button
              aria-label={`More options for ${account.username}`}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              <DotsThree size={18} weight="bold" />
            </button>
            {menuOpen && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-line bg-elevated p-1 shadow-lift">
                  {account.type !== 'offline' && (
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-muted hover:bg-white/[0.05] hover:text-ink"
                      onClick={() => {
                        setMenuOpen(false)
                        void refresh()
                      }}
                    >
                      <ArrowsClockwise size={14} /> Refresh account
                    </button>
                  )}
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-danger hover:bg-danger/10"
                    onClick={() => {
                      setMenuOpen(false)
                      remove()
                    }}
                  >
                    <Trash size={14} /> Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AccountTypeIcon({ type }: { type: AccountSummary['type'] }) {
  return <UserCircle size={18} aria-hidden="true" />
}
