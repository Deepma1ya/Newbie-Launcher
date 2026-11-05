export type LoaderType = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge'
export type AddonType = 'mod' | 'resourcepack' | 'shader' | 'modpack' | 'datapack' | 'world' | 'plugin'
export type BulkAddonType = 'mod' | 'datapack' | 'resourcepack' | 'shader'
export type AddonProvider = 'modrinth' | 'local'
export type LoadoutMode = 'offline' | 'download'
export type AccountType = 'microsoft' | 'tlauncher' | 'offline' | 'authlib'
export type ThemeMode = 'dark' | 'light' | 'system'
export type PerformanceProfile = 'balanced' | 'performance' | 'quality'
export type GpuPreference = 'default' | 'high'

export interface JavaRuntime {
  path: string
  version: string
  major: number
  arch: string
  vendor: string
  isJre: boolean
}

export interface JavaSettings {
  autoInstall: boolean
  manualPath: string | null
  defaultMemoryMb: number
  jvmArgs: string
}

export interface PerformanceSettings {
  gpuPreference: GpuPreference
  profile: PerformanceProfile
  autoApply: boolean
}

export interface BackupSettings {
  enabled: boolean
  frequency: 'always' | 'daily'
  keepDays: number
  maxSizeMb: number
}

export interface LauncherSettings {
  language: 'en'
  theme: ThemeMode
  dataDir: string
  closeToTray: boolean
  minimizeOnLaunch: boolean
  autoCheckUpdates: boolean
  allowPrerelease: boolean
  downloadConcurrency: number
  java: JavaSettings
  performance: PerformanceSettings
  backups: BackupSettings
  onboardingComplete: boolean
  tlauncherSkins: boolean
  tlauncherCapePlugin: boolean
}

export interface AccountSummary {
  id: string
  type: AccountType
  username: string
  uuid: string
  active: boolean
  skinUrl?: string
  capeUrl?: string
  createdAt: string
  expiresAt?: string
  needsRefresh?: boolean
  apiRoot?: string
  xuid?: string
}

export type AuthAccount = AccountSummary & {
  /** Encrypted at rest by the main process. Never sent to the renderer. */
  accessToken?: string
  refreshToken?: string
  clientToken?: string
}

export interface Loadout {
  id: string
  name: string
  mode: LoadoutMode
  addonIds: string[]
  createdAt: string
  updatedAt: string
  lastActivatedAt?: string
}

export interface AddonDependency {
  provider?: AddonProvider
  projectId?: string
  versionId?: string
  type: 'required' | 'optional' | 'incompatible' | 'embedded'
  name?: string
}

export interface AddonRecord {
  id: string
  provider: AddonProvider
  projectId: string
  versionId: string
  name: string
  slug?: string
  type: AddonType
  filename: string
  versionNumber: string
  sha1?: string
  size: number
  iconUrl?: string
  description?: string
  sourceUrl?: string
  dependencies: AddonDependency[]
  enabled: boolean
  installedAt: string
  updatedAt: string
  latestVersionId?: string
  latestVersionNumber?: string
  updateCheckedAt?: string
  /** Folder relative to the game directory, used by world-specific datapacks. */
  relativeFolder?: string
}

export interface RepairFailure {
  at: string
  message?: string
}

export interface Instance {
  id: string
  name: string
  /** Selected Minecraft version, e.g. 1.20.1 */
  versionId: string
  /** Version JSON used for launch (loader profile id, or the vanilla version id). */
  resolvedVersionId: string
  loader: LoaderType
  loaderVersion: string
  iconUrl?: string
  color: string
  createdAt: string
  lastPlayedAt?: string
  totalPlayTimeSec: number
  memoryMb: number
  width: number
  height: number
  fullscreen: boolean
  javaPath: string | null
  jvmArgs: string
  gameDir: string
  activeLoadoutId: string
  loadouts: Loadout[]
  addons: AddonRecord[]
  modpackProjectId?: string
  modpackVersionId?: string
  /** Fingerprints of automatic repairs that failed, so Repair does not retry them in a loop. */
  repairFailures?: Record<string, RepairFailure>
  /** Place TLauncher's TLSkinCape mod in mods/ before launch. Defaults to true. */
  tlauncherCape?: boolean
  /** Managed TLSkinCape file relative to the game directory, when Newbie placed it. */
  tlsCapeFile?: string
}

export interface CreateInstanceInput {
  name: string
  versionId: string
  loader: LoaderType
  loaderVersion?: string
  memoryMb?: number
  iconUrl?: string
  color?: string
  modpack?: {
    projectId: string
    versionId: string
  }
}

export interface UpdateInstanceInput {
  name?: string
  versionId?: string
  loader?: LoaderType
  loaderVersion?: string
  memoryMb?: number
  width?: number
  height?: number
  fullscreen?: boolean
  javaPath?: string | null
  jvmArgs?: string
  iconUrl?: string
  color?: string
  tlauncherCape?: boolean
}

export interface PackExportResult {
  path: string
  filename: string
  addons: number
  bytes: number
  skipped: string[]
}

export interface PackCopyOptions {
  types: BulkAddonType[]
  includeDisabled?: boolean
  replace?: boolean
}

export interface PackCopyResult {
  targetId: string
  targetName: string
  copied: number
  skipped: number
  conflicts: string[]
  warnings: string[]
}

export interface PackShareInfo {
  instanceId: string
  filename: string
  bytes: number
  port: number
  urls: string[]
  startedAt: string
}

export interface WorldSummary {
  folder: string
  name: string
  updatedAt: string
}

export interface MinecraftVersionSummary {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  releaseTime: string
  sha1?: string
}
export interface LoaderVersion {
  type: LoaderType
  version: string
  gameVersion: string
  stable: boolean
  label?: string
}

export interface InstallProgress {
  taskId: string
  instanceId?: string
  stage:
    | 'preparing'
    | 'metadata'
    | 'java'
    | 'loader'
    | 'libraries'
    | 'assets'
    | 'client'
    | 'addons'
    | 'extract'
    | 'finalize'
  message: string
  current: number
  total: number
  percent: number
  speedBps?: number
  detail?: string
}

export interface LaunchLog {
  instanceId: string
  stream: 'stdout' | 'stderr' | 'system'
  line: string
  ts: number
}

export interface LaunchExit {
  instanceId: string
  code: number | null
  signal: string | null
  durationSec: number
  crashed: boolean
}

export interface LaunchState {
  instanceId: string
  status: 'starting' | 'running' | 'stopped'
  pid?: number
  startedAt: number
}

export interface TaskRecord {
  id: string
  kind: 'install-version' | 'install-loader' | 'install-addon' | 'update-addons' | 'repair' | 'java' | 'backup' | 'modpack' | 'server' | 'server-addon'
  instanceId?: string
  title: string
  subtitle?: string
  stage: string
  current: number
  total: number
  percent: number
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'
  startedAt: number
  finishedAt?: number
  error?: string
}

export interface ModrinthHit {
  project_id: string
  project_type: AddonType
  slug: string
  title: string
  description: string
  categories: string[]
  display_categories?: string[]
  client_side: string
  server_side: string
  downloads: number
  follows: number
  icon_url: string | null
  date_modified: string
  latest_version: string | null
  license: string
  versions: string[]
  gallery?: string[]
  author?: string
}

export interface ModrinthSearchResponse {
  hits: ModrinthHit[]
  offset: number
  limit: number
  total_hits: number
}

export interface ModrinthFile {
  hashes: { sha1?: string; sha512?: string }
  url: string
  filename: string
  primary: boolean
  size: number
  file_type?: string
}

export interface ModrinthDependency {
  version_id: string | null
  project_id: string | null
  file_name: string | null
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded'
}

export interface ModrinthVersion {
  id: string
  project_id: string
  name: string
  version_number: string
  game_versions: string[]
  loaders: string[]
  date_published: string
  downloads: number
  version_type: 'release' | 'beta' | 'alpha'
  files: ModrinthFile[]
  dependencies: ModrinthDependency[]
}

export interface ModrinthProject {
  id: string
  slug: string
  project_type: AddonType
  title: string
  description: string
  body: string
  categories: string[]
  additional_categories?: string[]
  client_side: string
  server_side: string
  downloads: number
  followers: number
  icon_url: string | null
  gallery?: { url: string; featured: boolean; title?: string; description?: string }[]
  license: { id: string; name: string; url?: string } | string
  source_url?: string | null
  issues_url?: string | null
  wiki_url?: string | null
  discord_url?: string | null
  versions: string[]
  game_versions: string[]
  loaders: string[]
  published: string
  updated: string
  team?: string
}

export interface SearchQuery {
  query: string
  type: AddonType
  gameVersion?: string
  loader?: LoaderType
  categories?: string[]
  sort?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  offset?: number
  limit?: number
}

export interface SearchPage {
  provider: 'modrinth'
  hits: ModrinthHit[]
  total: number
  offset: number
  limit: number
}

export type RepairIssueKind =
  | 'duplicate'
  | 'loader-mismatch'
  | 'missing-dependency'
  | 'disabled-dependency'
  | 'incompatible'
  | 'corrupt'
  | 'state-mismatch'
  | 'unmanaged'

export interface RepairIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  kind: RepairIssueKind
  title: string
  detail: string
  files: string[]
  autoFixable: boolean
  /** The fix requires disabling an installed mod. */
  requiresDisable?: boolean
  fixLabel?: string
}

export interface RepairReport {
  instanceId: string
  scannedAt: string
  issues: RepairIssue[]
  fixed: number
  failed: number
  blocked: number
  pendingDisables: number
  skipped: number
  backupPath?: string
}

export interface LoadoutPlan {
  addonIds: string[]
  missing: { addonId: string; name: string }[]
  remove: string[]
  copy: number
  download: number
  totalBytes: number
}

export interface SystemInfo {
  platform: string
  arch: string
  totalMemMb: number
  freeMemMb: number
  cpuModel: string
  cpuCores: number
  gpus: string[]
  dataDir: string
  dataDirFreeMb: number
  javaRuntimes: JavaRuntime[]
  appVersion: string
}

export interface GpuApplyResult {
  ok: boolean
  message: string
  javaPath?: string
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  arch: string
  dataDir: string
  githubUrl: string
  isPackaged: boolean
}

export interface MicrosoftAuthState {
  status: 'idle' | 'code' | 'waiting' | 'success' | 'error' | 'cancelled'
  userCode?: string
  verificationUri?: string
  expiresAt?: number
  message?: string
  account?: AccountSummary
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'installing' | 'error'
  /** Installed launcher version. */
  currentVersion?: string
  /** Version offered by GitHub, when there is one. */
  version?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  releaseName?: string
  releaseNotes?: string
  releaseDate?: string
  lastCheckedAt?: string
  message?: string
}

export type BedrockChannel = 'release' | 'preview'

export interface BedrockVersion {
  /** Exact Windows package full name, e.g. Microsoft.MinecraftUWP_1.26.6201.0_x64__8wekyb3d8bbwe. */
  id: string
  /** Friendly Minecraft version, e.g. 1.26.62.1. */
  version: string
  /** Windows package version, e.g. 1.26.6201.0. */
  packageVersion: string
  channel: BedrockChannel
  urls: string[]
  latest: boolean
  downloaded: boolean
  partialBytes?: number
  installed: boolean
}

export interface BedrockInstallation {
  channel: BedrockChannel
  packageFullName: string
  version: string
  packageVersion: string
  installLocation: string
  familyName: string
  appId: string
  running: boolean
}

export type DefenderExclusionState = 'unknown' | 'missing' | 'partial' | 'added'

export interface BedrockSetup {
  developerMode: boolean
  gamingServices: boolean
  windowsBuild: string
  defenderExclusion: DefenderExclusionState
  defenderCheckedAt?: string
  /** Bedrock paths Windows Security already excludes. */
  defenderExcludedPaths: string[]
  /** Bedrock paths that still need an exclusion, including the current install location. */
  defenderMissingPaths: string[]
  /** Windows Tamper Protection is enabled. */
  defenderTamperProtected?: boolean
  /** Windows protects the Defender exclusion list itself (TPExclusions = 1). */
  defenderTamperExclusions?: boolean
  dataDir: string
  gameDataDirs: string[]
}

export interface BedrockState {
  setup: BedrockSetup
  installations: BedrockInstallation[]
  versions: BedrockVersion[]
  catalogUpdatedAt?: string
  catalogError?: string
}

export interface BedrockProgress {
  id: string
  version: string
  stage: 'downloading' | 'verifying' | 'installing' | 'done' | 'error' | 'cancelled'
  transferred: number
  total: number
  percent: number
  bytesPerSecond?: number
  message?: string
}

export interface BedrockExclusionResult {
  ok: boolean
  cancelled?: boolean
  partial?: boolean
  /** Windows protected the exclusion list; paths must be added manually. */
  manual?: boolean
  paths: string[]
  /** All paths Newbie tried to exclude, including failed ones. */
  allPaths?: string[]
  failed?: { path: string; error?: string }[]
  error?: string
}

export interface BackupRecord {
  filename: string
  path: string
  size: number
  createdAt: string
}

export type ServerType = 'vanilla' | 'paper' | 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'bedrock'
export type ServerRuntimeState = 'stopped' | 'starting' | 'running' | 'stopping'
export type ServerAddonType = 'mod' | 'plugin' | 'datapack'
export type ServerResourcePackSource = 'modrinth' | 'file' | 'url'
export type ServerRestartMode = 'interval' | 'daily'

export interface ServerRestartSchedule {
  enabled: boolean
  mode: ServerRestartMode
  /** Used when mode is interval. */
  intervalMinutes: number
  /** Local HH:MM used when mode is daily. */
  time: string
  lastRestartAt?: string
  nextRestartAt?: string
}

export interface ServerResourcePackFile {
  filename: string
  size: number
}

export interface ServerResourcePackInfo {
  name: string
  filename: string
  url: string
  sha1?: string
  size?: number
  source: ServerResourcePackSource
  projectId?: string
  versionId?: string
  installedAt: string
}

export interface ServerResourcePackState {
  serverId: string
  url: string
  sha1: string
  required: boolean
  prompt: string
  files: ServerResourcePackFile[]
  activeFilename?: string
  info?: ServerResourcePackInfo
}

export interface ServerResourcePackSearchQuery {
  serverId: string
  query: string
  sort?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  offset?: number
  limit?: number
}

export interface ServerResourcePackImport {
  filename: string
  size: number
  sha1: string
}

export interface ServerResourcePackInput {
  url: string
  sha1?: string
  required?: boolean
  prompt?: string
  name?: string
  filename?: string
  size?: number
  source?: ServerResourcePackSource
  projectId?: string
  versionId?: string
}

export interface ServerAddonRecord {
  id: string
  provider: 'modrinth' | 'local'
  projectId: string
  versionId: string
  name: string
  filename: string
  type: ServerAddonType
  versionNumber: string
  sha1?: string
  size: number
  iconUrl?: string
  description?: string
  sourceUrl?: string
  enabled: boolean
  installedAt: string
  updatedAt: string
  latestVersionId?: string
  latestVersionNumber?: string
  /** Folder relative to the server directory, e.g. mods, plugins or world/datapacks. */
  relativePath: string
}

export interface ServerRecord {
  id: string
  name: string
  type: ServerType
  versionId: string
  loaderVersion: string
  port: number
  memoryMb: number
  javaPath: string | null
  javaMajor: number
  eulaAccepted: boolean
  createdAt: string
  lastStartedAt?: string
  lastStoppedAt?: string
  levelName: string
  launchKind: 'jar' | 'script' | 'args' | 'exe'
  launchFile: string
  paperBuild?: number
  /** Release or preview channel for a Bedrock Dedicated Server. */
  bedrockChannel?: BedrockChannel
  addons: ServerAddonRecord[]
  resourcePack?: ServerResourcePackInfo
  restartSchedule?: ServerRestartSchedule
}

export interface ServerRuntimeStatus {
  serverId: string
  status: ServerRuntimeState
  pid?: number
  startedAt?: number
  address?: string
}

export interface ServerStats {
  serverId: string
  online: boolean
  status: ServerRuntimeState
  players: string[]
  maxPlayers?: number
  tps?: number
  tps1m?: number
  tps5m?: number
  tps15m?: number
  mspt?: number
  sampledAt: string
  message?: string
}

export interface CreateServerInput {
  name: string
  type: ServerType
  versionId: string
  loaderVersion?: string
  /** Present when type is bedrock. */
  bedrockChannel?: BedrockChannel
  port: number
  memoryMb: number
  motd?: string
  onlineMode?: boolean
  levelName?: string
  javaPath?: string | null
  eulaAccepted: boolean
}

export interface BedrockServerBuild {
  channel: BedrockChannel
  version: string
  url: string
}

export interface UpdateServerInput {
  name?: string
  memoryMb?: number
  restartSchedule?: ServerRestartSchedule
}

export interface ServerSearchQuery {
  serverId: string
  type: ServerAddonType
  query: string
  sort?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  offset?: number
  limit?: number
}

export interface ServerShareAddress {
  interface: string
  address: string
}

export interface ServerShareInfo {
  serverId: string
  port: number
  running: boolean
  localAddress: string
  lan: ServerShareAddress[]
  radminAddress?: string
  publicIp?: string
  publicAddress?: string
  gateway?: string
}

export interface ServerAddressTest {
  address: string
  online: boolean
  playersOnline?: number
  playersMax?: number
  version?: string
  note?: string
  error?: string
}

export type AppEvent =
  | { type: 'install-progress'; payload: InstallProgress }
  | { type: 'launch-log'; payload: LaunchLog }
  | { type: 'launch-state'; payload: LaunchState }
  | { type: 'launch-exit'; payload: LaunchExit }
  | { type: 'task'; payload: TaskRecord }
  | { type: 'microsoft-auth'; payload: MicrosoftAuthState }
  | { type: 'update'; payload: UpdateState }
  | { type: 'bedrock-progress'; payload: BedrockProgress }
  | { type: 'server-schedule'; payload: { serverId: string } }
  | { type: 'toast'; payload: { kind: 'success' | 'error' | 'info'; title: string; message?: string } }
  | { type: 'navigate'; payload: { page: string; params?: Record<string, string> } }

export interface WindowState {
  maximized: boolean
  focused: boolean
}
