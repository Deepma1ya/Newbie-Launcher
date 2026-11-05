import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowSquareOut,
  CheckCircle,
  Cpu,
  DownloadSimple,
  FolderSimple,
  GearSix,
  Globe,
  HardDrives,
  Info,
  Key,
  Lightning,
  Sparkle,
  Trash,
  WarningCircle
} from '@phosphor-icons/react'
import type { PerformanceProfile } from '@shared/types'
import { APP_VERSION, GITHUB_URL, JAVA_MAJORS, WEBSITE_URL } from '@shared/constants'
import { useDiskUsage, useJavaRuntimes, useSettings, useSystemInfo, qk } from '../hooks/queries'
import { toast } from '../store/ui'
import { errorMessage, formatBytes } from '../lib/utils'
import { PageHeader } from '../components/PageHeader'
import { UpdatePanel } from '../components/UpdatePanel'
import { LogoMark } from '../components/Sidebar'
import { Badge, Card, Field, Input, Progress, Segmented, Select, Switch } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'

type Section = 'general' | 'java' | 'performance' | 'downloads' | 'backups' | 'about'

const sections: { value: Section; label: string; icon: typeof GearSix }[] = [
  { value: 'general', label: 'General', icon: GearSix },
  { value: 'java', label: 'Java', icon: Sparkle },
  { value: 'performance', label: 'Performance', icon: Lightning },
  { value: 'downloads', label: 'Downloads', icon: DownloadSimple },
  { value: 'backups', label: 'Backups', icon: HardDrives },
  { value: 'about', label: 'About', icon: Info }
]

export function SettingsPage() {
  const settings = useSettings().data
  const [params] = useSearchParams()
  const requested = params.get('section') as Section | null
  const [section, setSection] = useState<Section>(
    requested && sections.some((entry) => entry.value === requested) ? requested : 'general'
  )
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (requested && sections.some((entry) => entry.value === requested)) setSection(requested)
  }, [requested])

  if (!settings) return null

  const save = async (patch: Parameters<typeof window.newbie.settings.update>[0]): Promise<void> => {
    try {
      await window.newbie.settings.update(patch)
      await queryClient.invalidateQueries({ queryKey: qk.settings })
    } catch (error) {
      toast('error', 'Could not save settings', errorMessage(error))
    }
  }

  const changeDir = async (): Promise<void> => {
    const selected = await window.newbie.settings.pickDataDir()
    if (!selected) return
    setBusy(true)
    try {
      await window.newbie.settings.changeDataDir(selected)
      await queryClient.invalidateQueries({ queryKey: qk.settings })
      await queryClient.invalidateQueries({ queryKey: qk.system })
      toast('success', 'Install location changed', selected)
    } catch (error) {
      toast('error', 'Could not move launcher data', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Java, performance, storage and update behaviour for Newbie Launcher."
      />
      <div className="grid gap-6 lg:grid-cols-[190px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">
          {sections.map((entry) => (
            <button
              key={entry.value}
              onClick={() => setSection(entry.value)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] transition-colors ${
                section === entry.value ? 'bg-elevated text-ink' : 'text-muted hover:bg-white/[0.035] hover:text-ink'
              }`}
            >
              <entry.icon size={16} className={section === entry.value ? 'text-grass' : ''} />
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {section === 'general' && (
            <>
              <Card className="p-5">
                <h2 className="font-display text-[15px] font-semibold text-ink">Install location</h2>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                  Game files, Java runtimes, instances, caches and backups live here. Moving copies everything and updates the
                  launch paths; the old folder is left in place.
                </p>
                <div className="mt-3 rounded-xl border border-line/50 bg-canvas/35 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-muted/65">
                    <FolderSimple size={13} /> Data directory
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] text-ink/85">{settings.dataDir}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" loading={busy} onClick={() => void changeDir()} icon={<FolderSimple size={14} />}>
                    Change location
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void window.newbie.settings.revealDataDir()} icon={<ArrowSquareOut size={14} />}>
                    Open folder
                  </Button>
                </div>
              </Card>

              <Card className="space-y-4 p-5">
                <h2 className="font-display text-[15px] font-semibold text-ink">Behaviour</h2>
                <Switch
                  checked={settings.closeToTray}
                  onChange={(checked) => void save({ closeToTray: checked })}
                  label="Close to tray"
                  description="Keep the launcher running in the notification area when the window is closed."
                />
                <Switch
                  checked={settings.minimizeOnLaunch}
                  onChange={(checked) => void save({ minimizeOnLaunch: checked })}
                  label="Minimize when Minecraft starts"
                  description="Get out of the way after the game process is launched."
                />
                <div className="flex items-center justify-between gap-3 border-t border-line/40 pt-4">
                  <div>
                    <div className="text-[12.5px] font-medium text-ink">Run setup again</div>
                    <div className="text-[10.5px] text-muted">Revisit the install folder and Java steps.</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void save({ onboardingComplete: false })}>
                    Open setup
                  </Button>
                </div>
              </Card>

              <Card className="space-y-4 p-5">
                <div>
                  <h2 className="font-display text-[15px] font-semibold text-ink">TLauncher skins</h2>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                    Applies when a TLauncher account is selected. Version support for the plugin is shown on each
                    instance and in the version picker.
                  </p>
                </div>
                <Switch
                  checked={settings.tlauncherSkins}
                  onChange={(checked) => void save({ tlauncherSkins: checked })}
                  label="Sync TLauncher skin and cape"
                  description="Fetch the public TLauncher skin and cape when adding or refreshing an account."
                />
                <Switch
                  checked={settings.tlauncherCapePlugin}
                  onChange={(checked) => void save({ tlauncherCapePlugin: checked })}
                  label="Place TLSkinCape in supported instances"
                  description="Download TLauncher's official TLSkinCape mod and add it to Fabric or Forge instances that support it."
                />
              </Card>
            </>
          )}

          {section === 'java' && <JavaSection />}
          {section === 'performance' && <PerformanceSection />}
          {section === 'downloads' && <DownloadsSection />}
          {section === 'backups' && <BackupsSection />}
          {section === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

function JavaSection() {
  const settings = useSettings().data!
  const java = useJavaRuntimes().data ?? []
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<number | null>(null)
  const [jvm, setJvm] = useState(settings.java.jvmArgs)

  useEffect(() => setJvm(settings.java.jvmArgs), [settings.java.jvmArgs])

  const save = async (patch: Parameters<typeof window.newbie.settings.update>[0]): Promise<void> => {
    await window.newbie.settings.update(patch)
    await queryClient.invalidateQueries({ queryKey: qk.settings })
  }

  const install = async (major: number): Promise<void> => {
    setBusy(major)
    try {
      const runtime = await window.newbie.system.installJava(major)
      await queryClient.invalidateQueries({ queryKey: qk.java })
      toast('success', `Java ${runtime.major} installed`, runtime.path)
    } catch (error) {
      toast('error', 'Java installation failed', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const pickManual = async (): Promise<void> => {
    const file = await window.newbie.app.pickFile([{ name: 'Java executable', extensions: ['exe'] }])
    if (!file) return
    await save({ java: { manualPath: file } })
    toast('success', 'Java path saved', file)
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-ink">Automatic Java</h2>
            <p className="mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-muted">
              Minecraft versions usually need Java 8, 11, 17 or 21; newer setups can use Java 25. Newbie downloads the
              matching Eclipse Temurin JRE and verifies its SHA-256 checksum.
            </p>
          </div>
          <Switch
            checked={settings.java.autoInstall}
            onChange={(checked) => void save({ java: { autoInstall: checked } })}
            label="Automatic Java"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {JAVA_MAJORS.map((major) => {
            const installed = java.some((runtime) => runtime.major === major)
            return (
              <Button
                key={major}
                variant={major === 8 ? 'ghost' : 'secondary'}
                size="sm"
                loading={busy === major}
                disabled={installed}
                onClick={() => void install(major)}
              >
                {installed ? `Java ${major} installed` : `Install Java ${major}`}
              </Button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted/60">
          Java 25 is optional. Use it only for versions or mods that support it; each instance can still choose its own
          runtime.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-[15px] font-semibold text-ink">Detected runtimes</h2>
        <div className="mt-3 space-y-1.5">
          {java.length === 0 && <div className="text-[11.5px] text-muted">No Java runtime was found on this PC.</div>}
          {java.map((runtime) => (
            <div key={runtime.path} className="flex items-center gap-3 rounded-xl border border-line/45 bg-canvas/25 p-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-grass/8 text-grass">
                <CheckCircle size={15} weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-medium text-ink">{runtime.vendor} {runtime.version}</div>
                <div className="truncate font-mono text-[9.5px] text-muted/60">{runtime.path}</div>
              </div>
              <Badge tone="neutral">Java {runtime.major}</Badge>
              <Badge tone={runtime.arch === 'x64' ? 'green' : 'gold'}>{runtime.arch}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-[15px] font-semibold text-ink">Advanced</h2>
        <div className="flex items-end gap-2">
          <Field label="Manual Java path" hint={settings.java.manualPath ? 'Override active' : 'Automatic'}>
            <Input value={settings.java.manualPath ?? ''} readOnly placeholder="Automatic" />
          </Field>
          <Button variant="secondary" onClick={() => void pickManual()}>Browse</Button>
          {settings.java.manualPath && (
            <Button variant="ghost" onClick={() => void save({ java: { manualPath: null } })} icon={<Trash size={14} />}>
              Clear
            </Button>
          )}
        </div>
        <Field label="Default memory for new instances" hint={`${(settings.java.defaultMemoryMb / 1024).toFixed(1)} GB`}>
          <input
            type="range"
            min={1024}
            max={16384}
            step={256}
            value={settings.java.defaultMemoryMb}
            onChange={(event) => void save({ java: { defaultMemoryMb: Number(event.target.value) } })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--grass))]"
          />
        </Field>
        <Field label="Global JVM arguments" hint="Appended to every instance">
          <Input
            value={jvm}
            onChange={(event) => setJvm(event.target.value)}
            onBlur={() => void save({ java: { jvmArgs: jvm } })}
            placeholder="-XX:+UseG1GC"
          />
        </Field>
      </Card>
    </>
  )
}

function PerformanceSection() {
  const settings = useSettings().data!
  const system = useSystemInfo().data
  const queryClient = useQueryClient()
  const [applying, setApplying] = useState(false)

  const save = async (patch: Parameters<typeof window.newbie.settings.update>[0]): Promise<void> => {
    await window.newbie.settings.update(patch)
    await queryClient.invalidateQueries({ queryKey: qk.settings })
  }

  const apply = async (): Promise<void> => {
    setApplying(true)
    try {
      const result = await window.newbie.system.applyGpu()
      toast(result.ok ? 'success' : 'error', 'GPU preference', result.message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <Card className="p-5">
        <h2 className="font-display text-[15px] font-semibold text-ink">Performance preset</h2>
        <p className="mt-0.5 text-[11.5px] text-muted">Applied to <span className="font-mono">options.txt</span> before each launch. A backup is kept.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {([
            { value: 'performance', title: 'Performance', text: '8 chunks · 144 FPS · VSync off', icon: Lightning },
            { value: 'balanced', title: 'Balanced', text: '12 chunks · 120 FPS · shadows on', icon: Cpu },
            { value: 'quality', title: 'Quality', text: '16 chunks · unlimited FPS · fancy', icon: Sparkle }
          ] as { value: PerformanceProfile; title: string; text: string; icon: typeof Cpu }[]).map((preset) => (
            <button
              key={preset.value}
              onClick={() => void save({ performance: { profile: preset.value } })}
              className={`rounded-xl border p-3 text-left transition-colors ${
                settings.performance.profile === preset.value
                  ? 'border-grass/40 bg-grass/[0.04]'
                  : 'border-line/50 bg-canvas/25 hover:border-line'
              }`}
            >
              <preset.icon size={17} className={settings.performance.profile === preset.value ? 'text-grass' : 'text-muted'} />
              <div className="mt-2 text-[12px] font-semibold text-ink">{preset.title}</div>
              <div className="mt-0.5 text-[10px] text-muted">{preset.text}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-line/40 pt-4">
          <Switch
            checked={settings.performance.autoApply}
            onChange={(checked) => void save({ performance: { autoApply: checked } })}
            label="Apply automatically on launch"
            description="Writes the performance preset and Windows GPU preference before starting Minecraft."
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-[15px] font-semibold text-ink">GPU preference</h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          On Windows, this writes the high-performance preference for the Java executable in the DirectX user settings. It
          ensures hybrid laptops use the discrete GPU.
        </p>
        <div className="mt-3">
          <Segmented
            value={settings.performance.gpuPreference}
            onChange={(value) => void save({ performance: { gpuPreference: value } })}
            options={[
              { value: 'high', label: 'High performance' },
              { value: 'default', label: 'System default' }
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" loading={applying} onClick={() => void apply()} icon={<Cpu size={14} />}>
            Apply to Windows
          </Button>
          <span className="text-[10.5px] text-muted/65">Requires no administrator rights (current user only).</span>
        </div>
        {system?.gpus && system.gpus.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {system.gpus.map((gpu) => (
              <Badge key={gpu} tone="neutral">{gpu}</Badge>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

function DownloadsSection() {
  const settings = useSettings().data!
  const disk = useDiskUsage().data
  const queryClient = useQueryClient()

  return (
    <>
      <Card className="p-5">
        <h2 className="font-display text-[15px] font-semibold text-ink">Download behaviour</h2>
        <div className="mt-4 space-y-4">
          <Field label="Parallel downloads" hint={`${settings.downloadConcurrency} at a time`}>
            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={settings.downloadConcurrency}
              onChange={async (event) => {
                await window.newbie.settings.update({ downloadConcurrency: Number(event.target.value) })
                await queryClient.invalidateQueries({ queryKey: qk.settings })
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--grass))]"
            />
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-line/45 bg-canvas/25 p-3">
            <div>
              <div className="text-[12px] font-medium text-ink">Add-on cache</div>
              <div className="mt-0.5 text-[10.5px] text-muted">Shared by offline loadouts and version deduplication.</div>
            </div>
            <div className="text-right">
              <div className="font-display text-[14px] font-semibold text-ink">{disk ? formatBytes(disk.cacheMb * 1024 * 1024) : '—'}</div>
              <button onClick={() => void window.newbie.settings.revealDataDir()} className="text-[10px] text-grass hover:underline">
                Reveal folder
              </button>
            </div>
          </div>
        </div>
      </Card>
    </>
  )
}

function BackupsSection() {
  const settings = useSettings().data!
  const queryClient = useQueryClient()

  const save = async (patch: Parameters<typeof window.newbie.settings.update>[0]): Promise<void> => {
    await window.newbie.settings.update(patch)
    await queryClient.invalidateQueries({ queryKey: qk.settings })
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-display text-[15px] font-semibold text-ink">World backups</h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          Before launching an instance, Newbie zips its worlds into a local backup folder. This has saved more worlds than
          any other feature.
        </p>
      </div>
      <Switch
        checked={settings.backups.enabled}
        onChange={(checked) => void save({ backups: { enabled: checked } })}
        label="Back up worlds before launch"
        description="Creates a compressed copy of the saves folder."
      />
      <Field label="Frequency">
        <Select
          value={settings.backups.frequency}
          onChange={(value) => void save({ backups: { frequency: value as 'always' | 'daily' } })}
        >
          <option value="daily">Once a day</option>
          <option value="always">Every launch</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Keep for (days)">
          <Input
            type="number"
            min={1}
            max={365}
            value={settings.backups.keepDays}
            onChange={(event) => void save({ backups: { keepDays: Number(event.target.value) } })}
          />
        </Field>
        <Field label="Maximum size (MB)">
          <Input
            type="number"
            min={256}
            max={65536}
            value={settings.backups.maxSizeMb}
            onChange={(event) => void save({ backups: { maxSizeMb: Number(event.target.value) } })}
          />
        </Field>
      </div>
      <div className="rounded-xl border border-line/45 bg-canvas/25 p-3 text-[10.5px] leading-relaxed text-muted">
        Backups are stored under <span className="font-mono text-ink/70">backups/worlds</span>. Instance deletion never removes
        them.
      </div>
    </Card>
  )
}

function AboutSection() {
  const settings = useSettings().data!
  const system = useSystemInfo().data
  const queryClient = useQueryClient()

  const save = async (patch: Parameters<typeof window.newbie.settings.update>[0]): Promise<void> => {
    try {
      await window.newbie.settings.update(patch)
      await queryClient.invalidateQueries({ queryKey: qk.settings })
    } catch (error) {
      toast('error', 'Could not save settings', errorMessage(error))
    }
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <LogoMark size={44} />
            <div>
              <h2 className="font-display text-[17px] font-semibold text-ink">Newbie Launcher</h2>
              <p className="mt-1 text-[11.5px] text-muted">Version {APP_VERSION} · Java Edition + Bedrock · Windows x64</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="green">MIT</Badge>
                <Badge tone="neutral">Electron</Badge>
                <Badge tone="neutral">Modrinth</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => void window.newbie.app.openExternal(WEBSITE_URL)} icon={<Globe size={14} />}>
              Website
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void window.newbie.app.openExternal(GITHUB_URL)} icon={<ArrowSquareOut size={14} />}>
              GitHub
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void window.newbie.app.openExternal(`${GITHUB_URL}/issues`)}>
              Report an issue
            </Button>
          </div>
        </div>
      </Card>

      <UpdatePanel
        autoCheckUpdates={settings.autoCheckUpdates}
        allowPrerelease={settings.allowPrerelease}
        onSave={save}
      />

      <Card className="p-5">
        <h2 className="font-display text-[14px] font-semibold text-ink">System</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <InfoRow label="OS" value={`${system?.platform ?? process.platform} ${system?.arch ?? ''}`} />
          <InfoRow label="CPU" value={system ? `${system.cpuCores} × ${system.cpuModel}` : '—'} />
          <InfoRow label="Memory" value={system ? `${(system.totalMemMb / 1024).toFixed(0)} GB` : '—'} />
          <InfoRow label="Free disk" value={system ? `${(system.dataDirFreeMb / 1024).toFixed(0)} GB` : '—'} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-[14px] font-semibold text-ink">Runtime folder</h2>
        <div className="mt-2 break-all font-mono text-[10px] leading-relaxed text-muted/70">{settings.dataDir}</div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void window.newbie.settings.revealDataDir()}>Open data folder</Button>
          <Button variant="ghost" size="sm" onClick={() => void window.newbie.app.openExternal(GITHUB_URL)} icon={<ArrowSquareOut size={13} />}>Documentation</Button>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-line/40 bg-card/30 p-3 text-[10.5px] leading-relaxed text-muted/65">
        <Info size={14} className="mt-0.5 shrink-0" />
        Newbie Launcher is not affiliated with Mojang, Microsoft, TLauncher or Modrinth. Minecraft is a trademark of Mojang
        Synergies AB. Java and Bedrock are managed as separate editions with their own worlds and settings.
      </div>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/40 bg-canvas/25 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.08em] text-muted/60">{label}</div>
      <div className="mt-0.5 truncate text-[11.5px] text-ink/85">{value}</div>
    </div>
  )
}
