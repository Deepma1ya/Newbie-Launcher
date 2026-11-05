import path from 'node:path'
import type { Library, Rule, VersionJson } from './mojang'
import { libraryArtifact, rulesAllow, currentRuleContext } from './mojang'
import { tokenise as tokeniseValue } from '../util/tokenise'

export interface ArgumentRule {
  rules?: Rule[]
  value: string | string[]
}

export interface LaunchProfile {
  username: string
  uuid: string
  accessToken: string
  userType: 'msa' | 'legacy' | 'offline'
  xuid?: string
  clientId?: string
  userProperties?: string
}

export interface ArgumentBuildOptions {
  version: VersionJson
  profile: LaunchProfile
  instanceId: string
  versionName: string
  gameDir: string
  assetsDir: string
  nativesDir: string
  libraryDir: string
  classpath: string
  loggingFile?: string
  memoryMb: number
  width: number
  height: number
  fullscreen: boolean
  extraJvmArgs: string
  launcherName: string
  launcherVersion: string
  javaMajor: number
}

const FEATURE_CONTEXT = {
  is_demo_user: false,
  has_custom_resolution: true,
  has_quick_plays_support: false,
  is_quick_play_singleplayer: false,
  is_quick_play_multiplayer: false,
  is_quick_play_realms: false
}

export function buildClasspath(
  version: VersionJson,
  libraryDir: string,
  clientJar: string
): string[] {
  const entries: string[] = []
  const seen = new Set<string>()
  for (const library of version.libraries ?? []) {
    if (!rulesAllow(library.rules, currentRuleContext())) continue
    const artifact = libraryArtifact(library)
    if (!artifact?.path) continue
    const full = path.join(libraryDir, artifact.path)
    if (seen.has(full)) continue
    seen.add(full)
    entries.push(full)
  }
  if (!seen.has(clientJar)) entries.push(clientJar)
  return entries
}

export function substitute(template: string, values: Record<string, string>): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, key: string) => values[key] ?? match)
}

export function buildArguments(options: ArgumentBuildOptions): { jvm: string[]; game: string[]; classpath: string } {
  const { version, profile } = options
  const values: Record<string, string> = {
    auth_player_name: profile.username,
    version_name: options.versionName,
    game_directory: options.gameDir,
    assets_root: options.assetsDir,
    game_assets: options.assetsDir,
    assets_index_name: version.assetIndex?.id ?? version.assets ?? 'legacy',
    auth_uuid: profile.uuid.replace(/-/g, ''),
    auth_access_token: profile.accessToken,
    auth_session: `token:${profile.accessToken}:${profile.uuid.replace(/-/g, '')}`,
    user_type: profile.userType,
    version_type: version.type,
    user_properties: profile.userProperties ?? '{}',
    clientid: profile.clientId ?? '',
    auth_xuid: profile.xuid ?? '',
    launcher_name: options.launcherName,
    launcher_version: options.launcherVersion,
    natives_directory: options.nativesDir,
    library_directory: options.libraryDir,
    classpath: options.classpath,
    classpath_separator: path.delimiter,
    resolution_width: String(options.width),
    resolution_height: String(options.height)
  }

  const game = expandArguments(version.arguments?.game, values, version.minecraftArguments)
  const jvmTemplates = expandArguments(version.arguments?.jvm, values)

  const jvm: string[] = []
  const seen = new Set<string>()
  const push = (arg: string): void => {
    if (!arg) return
    if (seen.has(arg)) return
    seen.add(arg)
    jvm.push(arg)
  }

  push(`-Xmx${Math.max(512, options.memoryMb)}M`)
  push(`-Xms${Math.min(Math.max(512, Math.round(options.memoryMb / 2)), options.memoryMb)}M`)
  push(`-Djava.library.path=${options.nativesDir}`)
  push('-Dminecraft.launcher.brand=Newbie Launcher')
  push(`-Dminecraft.launcher.version=${options.launcherVersion}`)
  push('-Dfile.encoding=UTF-8')
  push('-Dorg.lwjgl.system.SharedLibraryExtractPath=' + options.nativesDir)
  push('-Dio.netty.native.workdir=' + options.nativesDir)
  if (options.loggingFile) push(`-Dlog4j.configurationFile=${options.loggingFile}`)
  for (const arg of splitJvmArgs(options.extraJvmArgs)) push(substitute(arg, values))
  for (const arg of jvmTemplates) {
    const value = substitute(arg, values)
    if (value.startsWith('-Djava.library.path=')) {
      // Keep the explicit natives path from this launcher.
      const existingIndex = jvm.findIndex((candidate) => candidate.startsWith('-Djava.library.path='))
      if (existingIndex >= 0) jvm[existingIndex] = value
      continue
    }
    push(value)
  }
  if (!jvm.some((arg) => arg === '-cp' || arg === '-classpath')) {
    push('-cp')
    push(options.classpath)
  } else {
    const index = jvm.findIndex((arg) => arg === '-cp' || arg === '-classpath')
    if (index >= 0) jvm[index + 1] = options.classpath
  }

  const hasResolution = game.includes('--width') && game.includes('--height')
  if (!hasResolution) {
    game.push('--width', String(options.width), '--height', String(options.height))
  }
  if (options.fullscreen && !game.includes('--fullscreen')) game.push('--fullscreen')
  if (!game.includes('--version')) game.push('--version', options.versionName)
  if (!game.includes('--gameDir')) game.push('--gameDir', options.gameDir)
  if (!game.includes('--assetsDir')) game.push('--assetsDir', options.assetsDir)
  if (!game.includes('--assetIndex')) game.push('--assetIndex', version.assetIndex?.id ?? version.assets ?? 'legacy')
  if (!game.includes('--uuid')) game.push('--uuid', profile.uuid.replace(/-/g, ''))
  if (!game.includes('--accessToken')) game.push('--accessToken', profile.accessToken)
  if (!game.includes('--username')) game.push('--username', profile.username)
  if (!game.includes('--userType')) game.push('--userType', profile.userType)
  if (profile.xuid && !game.includes('--xuid')) game.push('--xuid', profile.xuid)
  if (profile.clientId && !game.includes('--clientId')) game.push('--clientId', profile.clientId)

  return { jvm, game, classpath: options.classpath }
}

function expandArguments(
  args: (string | Record<string, unknown>)[] | undefined,
  values: Record<string, string>,
  legacy?: string
): string[] {
  const result: string[] = []
  if (!args || args.length === 0) {
    if (!legacy) return result
    return tokeniseValue(legacy).map((token) => substitute(token, values))
  }
  for (const entry of args) {
    if (typeof entry === 'string') {
      result.push(substitute(entry, values))
      continue
    }
    const rules = entry.rules as Rule[] | undefined
    if (rules && !rulesAllow(rules, currentRuleContext())) continue
    const value = entry.value
    if (typeof value === 'string') result.push(substitute(value, values))
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string') result.push(substitute(item, values))
    }
  }
  return result
}

export { tokeniseValue as tokenise }

export function splitJvmArgs(value: string): string[] {
  return tokeniseValue(value)
}

export function sortedNativeJars(libraries: Library[], osName: string): string[] {
  void osName
  const jars: string[] = []
  for (const library of libraries) {
    if (!library.natives) continue
    if (!rulesAllow(library.rules, currentRuleContext())) continue
    const classifiers = library.downloads?.classifiers
    if (!classifiers) continue
    const classifier = library.natives[osName]?.replace('${arch}', process.arch === 'x64' ? '64' : '32')
    if (!classifier) continue
    const artifact = classifiers[classifier]
    if (artifact?.path) jars.push(artifact.path)
  }
  return jars
}

export const LAUNCH_FEATURES = FEATURE_CONTEXT
