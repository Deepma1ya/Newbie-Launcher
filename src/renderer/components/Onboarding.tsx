import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle,
  Cube,
  FolderSimple,
  HardDrives,
  Leaf,
  ShieldCheck,
  Sparkle,
  WindowsLogo,
  Wrench
} from '@phosphor-icons/react'
import { qk, useAccounts, useJavaRuntimes, useSettings, useSystemInfo } from '../hooks/queries'
import { toast } from '../store/ui'
import { useUi } from '../store/ui'
import { errorMessage } from '../lib/utils'
import { LogoMark } from './Sidebar'
import { Button } from './ui/Button'
import { Progress, Switch } from './ui/primitives'

const steps = ['Welcome', 'Your setup', 'Account', 'Ready']

export function Onboarding({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [changing, setChanging] = useState(false)
  const settings = useSettings()
  const system = useSystemInfo()
  const java = useJavaRuntimes()
  const accounts = useAccounts()
  const openModal = useUi((state) => state.openModal)
  const queryClient = useQueryClient()

  if (!open || !settings.data) return null

  const finish = async (createInstance = false): Promise<void> => {
    setBusy(true)
    try {
      await window.newbie.settings.update({ onboardingComplete: true })
      await queryClient.invalidateQueries({ queryKey: qk.settings })
      onDone()
      if (createInstance) openModal('createInstance', true)
    } finally {
      setBusy(false)
    }
  }

  const pickDir = async (): Promise<void> => {
    const selected = await window.newbie.settings.pickDataDir()
    if (!selected) return
    setChanging(true)
    try {
      await window.newbie.settings.changeDataDir(selected)
      await queryClient.invalidateQueries({ queryKey: qk.settings })
      toast('success', 'Install location updated', selected)
    } catch (error) {
      toast('error', 'Could not move the launcher data', errorMessage(error))
    } finally {
      setChanging(false)
    }
  }

  const installJava = async (): Promise<void> => {
    setBusy(true)
    try {
      const runtime = await window.newbie.system.installJava(21)
      toast('success', 'Java installed', `${runtime.vendor} ${runtime.version}`)
      await queryClient.invalidateQueries({ queryKey: qk.java })
    } catch (error) {
      toast('error', 'Java download failed', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#050806]/97 p-6 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="grid-overlay absolute inset-0 opacity-60" />
        <div className="absolute left-1/4 top-0 h-[520px] w-[520px] rounded-full bg-grass/[0.07] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-gold/[0.05] blur-[120px]" />
      </div>

      <div className="relative grid w-full max-w-[920px] overflow-hidden rounded-3xl border border-line/70 bg-surface/85 shadow-[0_50px_160px_-30px_rgba(0,0,0,0.95)] lg:grid-cols-[280px_1fr]">
        <aside className="hidden flex-col justify-between border-r border-line/45 bg-canvas/35 p-7 lg:flex">
          <div>
            <LogoMark size={44} />
            <h2 className="mt-5 font-display text-[22px] font-semibold leading-tight text-ink">
              A calmer way
              <br />
              to play Minecraft.
            </h2>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Java Edition, handled properly. Installs, loadouts, updates and repairs in one quiet place.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { icon: Sparkle, text: 'Automatic Java setup' },
              { icon: ShieldCheck, text: 'Reliable offline backups' },
              { icon: Wrench, text: 'One-click conflict repair' }
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2.5 text-[11.5px] text-muted">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line/60 bg-elevated/70 text-grass">
                  <item.icon size={14} />
                </span>
                {item.text}
              </div>
            ))}
          </div>
          <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted/45">Version 0.1 · Java Edition</div>
        </aside>

        <div className="flex min-h-[520px] flex-col p-7">
          <div className="mb-7 flex items-center gap-2">
            {steps.map((label, index) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    index <= step ? 'bg-grass' : 'bg-line/70'
                  }`}
                />
              </div>
            ))}
            <span className="ml-2 font-mono text-[10px] text-muted/60">
              {step + 1}/{steps.length}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="min-h-0 flex-1"
            >
              {step === 0 && (
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-grass/25 bg-grass/8 text-grass">
                    <Cube size={26} />
                  </div>
                  <h1 className="mt-5 font-display text-[27px] font-semibold tracking-[-0.02em] text-ink">
                    Welcome to Newbie Launcher
                  </h1>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted">
                    A minimal launcher built for stable modding. We keep Java, versions and loadouts tidy so you can spend
                    your time in-game.
                  </p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {[
                      { title: 'Any version', text: 'Vanilla, Fabric, Quilt, Forge and NeoForge.' },
                      { title: 'Any account', text: 'Microsoft, TLauncher, offline or authlib.' },
                      { title: 'Modrinth + CurseForge', text: 'Install and update add-ons in one click.' },
                      { title: 'Never lose a world', text: 'Automatic world backups before launch.' }
                    ].map((feature) => (
                      <div key={feature.title} className="rounded-xl border border-line/50 bg-card/45 p-3">
                        <div className="text-[12px] font-semibold text-ink">{feature.title}</div>
                        <div className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{feature.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h1 className="font-display text-[24px] font-semibold text-ink">Your setup</h1>
                  <p className="mt-1.5 text-[12.5px] text-muted">Choose where game files live and let us handle Java.</p>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-xl border border-line/50 bg-card/45 p-3.5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-muted">
                          <FolderSimple size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold text-ink">Install location</div>
                          <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted">{settings.data.dataDir}</div>
                        </div>
                        <Button size="sm" variant="secondary" loading={changing} onClick={() => void pickDir()}>
                          Change
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-line/50 bg-card/45 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-gold">
                            <Sparkle size={16} />
                          </span>
                          <div>
                            <div className="text-[12px] font-semibold text-ink">Java runtime</div>
                            <div className="mt-0.5 text-[10.5px] text-muted">
                              {java.data?.length ? `${java.data.length} runtime(s) detected` : 'No Java runtime detected yet'}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" loading={busy} onClick={() => void installJava()}>
                          Install Java 21
                        </Button>
                      </div>
                      {java.data && java.data.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {java.data.slice(0, 4).map((runtime) => (
                            <span key={runtime.path} className="rounded-md border border-line/60 bg-canvas/40 px-2 py-1 text-[9.5px] text-muted">
                              {runtime.vendor} {runtime.major}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-line/50 bg-card/45 p-3.5">
                      <div>
                        <div className="text-[12px] font-semibold text-ink">Automatic Java downloads</div>
                        <div className="mt-0.5 text-[10.5px] text-muted">Temurin JRE is downloaded when a version needs it.</div>
                      </div>
                      <Switch
                        checked={settings.data.java.autoInstall}
                        onChange={(checked) => void window.newbie.settings.update({ java: { autoInstall: checked } })}
                        label="Automatic Java downloads"
                        hideLabel
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h1 className="font-display text-[24px] font-semibold text-ink">Choose an account</h1>
                  <p className="mt-1.5 text-[12.5px] text-muted">
                    Microsoft is required for online-mode servers. TLauncher and offline accounts work locally.
                  </p>
                  <div className="mt-5 space-y-2">
                    <button
                      onClick={() => openModal('addAccount', true)}
                      className="flex w-full items-center gap-3 rounded-xl border border-line/60 bg-card/55 p-3.5 text-left transition-colors hover:border-grass/30 hover:bg-grass/[0.025]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/10 text-info">
                        <WindowsLogo size={18} weight="fill" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[12.5px] font-semibold text-ink">Microsoft account</span>
                        <span className="block text-[10.5px] text-muted">Licensed servers · recommended</span>
                      </span>
                      <ArrowRight size={15} className="text-muted" />
                    </button>
                    <button
                      onClick={() => openModal('addAccount', true)}
                      className="flex w-full items-center gap-3 rounded-xl border border-line/60 bg-card/55 p-3.5 text-left transition-colors hover:border-grass/30 hover:bg-grass/[0.025]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grass/10 text-grass">
                        <Leaf size={18} />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[12.5px] font-semibold text-ink">TLauncher or offline</span>
                        <span className="block text-[10.5px] text-muted">Local play · skin sync for TLauncher</span>
                      </span>
                      <ArrowRight size={15} className="text-muted" />
                    </button>
                  </div>
                  {accounts.data && accounts.data.length > 0 && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-grass/20 bg-grass/[0.035] p-3 text-[11.5px] text-grass">
                      <CheckCircle size={16} weight="fill" /> {accounts.data.length} account(s) ready
                    </div>
                  )}
                  <button onClick={() => setStep(3)} className="mt-4 text-[11.5px] text-muted hover:text-ink">
                    Skip for now
                  </button>
                </div>
              )}

              {step === 3 && (
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-grass/25 bg-grass/8 text-grass">
                    <CheckCircle size={26} weight="fill" />
                  </div>
                  <h1 className="mt-5 font-display text-[25px] font-semibold text-ink">You&apos;re ready.</h1>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted">
                    Create your first instance to install Minecraft and a loader. You can add mods from Browse as soon as
                    the instance is ready.
                  </p>
                  <div className="mt-6 rounded-xl border border-line/50 bg-card/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[12px] font-semibold text-ink">Recommended first step</div>
                        <div className="mt-0.5 text-[10.5px] text-muted">Minecraft 1.21.1 · Fabric · 4 GB memory</div>
                      </div>
                      <Cube size={24} className="text-grass/70" />
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button variant="primary" loading={busy} onClick={() => void finish(true)} icon={<Cube size={16} />}>
                      Create my first instance
                    </Button>
                    <Button variant="ghost" onClick={() => void finish(false)}>
                      Explore the launcher
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between border-t border-line/40 pt-4">
            <button
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
              className="text-[11.5px] text-muted transition-colors hover:text-ink disabled:opacity-30"
            >
              Back
            </button>
            <div className="flex items-center gap-2">
              {step < 3 && (
                <Button variant="primary" onClick={() => setStep((current) => Math.min(3, current + 1))} iconRight={<ArrowRight size={15} />}>
                  Continue
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
