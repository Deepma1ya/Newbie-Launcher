import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { MOJANG_MANIFEST_URL } from '@shared/constants'
import type { MinecraftVersionSummary } from '@shared/types'
import { fetchJson } from './http'
import { ensureDir, pathExists, readJson } from '../util/fs'
import { paths } from './paths'
import { logger } from '../util/log'
import { tokenise } from '../util/tokenise'

export interface VersionManifestEntry {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
  sha1: string
  complianceLevel?: number
}

interface VersionManifest {
  latest: { release: string; snapshot: string }
  versions: VersionManifestEntry[]
}

export interface Rule {
  action: 'allow' | 'disallow'
  os?: { name?: string; version?: string; arch?: string }
  features?: Record<string, boolean>
}

export interface LibraryArtifact {
  path?: string
  id?: string
  sha1: string
  size: number
  url: string
}

export interface Library {
  name: string
  downloads?: {
    artifact?: LibraryArtifact
    classifiers?: Record<string, LibraryArtifact>
  }
  natives?: Record<string, string>
  rules?: Rule[]
  extract?: { exclude?: string[] }
  url?: string
}

export interface VersionJson {
  id: string
  type: string
  inheritsFrom?: string
  mainClass: string
  assets?: string
  assetIndex?: { id: string; sha1: string; size: number; totalSize?: number; url: string }
  downloads?: {
    client?: LibraryArtifact
    client_mappings?: LibraryArtifact
    server?: LibraryArtifact
    server_mappings?: LibraryArtifact
  }
  libraries?: Library[]
  arguments?: { game?: (string | Record<string, unknown>)[]; jvm?: (string | Record<string, unknown>)[] }
  minecraftArguments?: string
  javaVersion?: { component: string; majorVersion: number }
  logging?: { client?: { argument: string; file: LibraryArtifact; type: string } }
  releaseTime?: string
  time?: string
  complianceLevel?: number
  minimumLauncherVersion?: number
}

export interface RuleContext {
  osName: string
  osVersion: string
  arch: string
  features: Record<string, boolean>
}

export function currentRuleContext(): RuleContext {
  const arch = process.arch === 'x64' ? 'x86_64' : process.arch === 'ia32' ? 'x86' : process.arch
  return {
    osName: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux',
    osVersion: os.release(),
    arch,
    features: {
      is_demo_user: false,
      has_custom_resolution: true,
      has_quick_plays_support: false,
      is_quick_play_singleplayer: false,
      is_quick_play_multiplayer: false,
      is_quick_play_realms: false
    }
  }
}

export function rulesAllow(rules: Rule[] | undefined, context: RuleContext): boolean {
  if (!rules || rules.length === 0) return true
  let allowed = false
  for (const rule of rules) {
    if (!ruleApplies(rule, context)) continue
    allowed = rule.action === 'allow'
  }
  return allowed
}

function ruleApplies(rule: Rule, context: RuleContext): boolean {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== context.osName) return false
    if (rule.os.arch && rule.os.arch !== context.arch) return false
    if (rule.os.version) {
      try {
        if (!new RegExp(rule.os.version).test(context.osVersion)) return false
      } catch {
        if (rule.os.version !== context.osVersion) return false
      }
    }
  }
  if (rule.features) {
    for (const [key, expected] of Object.entries(rule.features)) {
      if (Boolean(context.features[key]) !== Boolean(expected)) return false
    }
  }
  return true
}

const manifestCache = new Map<string, { at: number; value: VersionManifest }>()
const versionCache = new Map<string, VersionJson>()

export async function getVersionManifest(force = false): Promise<VersionManifest> {
  const cached = manifestCache.get('main')
  if (!force && cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.value
  const value = await fetchJson<VersionManifest>(MOJANG_MANIFEST_URL, {}, { timeoutMs: 45_000 })
  manifestCache.set('main', { at: Date.now(), value })
  await ensureDir(paths.meta)
  await fs.writeFile(path.join(paths.meta, 'version_manifest_v2.json'), JSON.stringify(value), 'utf8').catch(() => undefined)
  return value
}

export async function listMinecraftVersions(force = false): Promise<MinecraftVersionSummary[]> {
  const manifest = await getVersionManifest(force)
  return manifest.versions.map((version) => ({
    id: version.id,
    type: version.type,
    releaseTime: version.releaseTime,
    sha1: version.sha1
  }))
}

export async function getVersionJson(versionId: string): Promise<VersionJson> {
  const cached = versionCache.get(versionId)
  if (cached) return cached
  const local = paths.versionJson(versionId)
  const onDisk = await readJson<VersionJson | null>(local, null)
  if (onDisk?.id) {
    versionCache.set(versionId, onDisk)
    return onDisk
  }
  const manifest = await getVersionManifest()
  const entry = manifest.versions.find((version) => version.id === versionId)
  if (!entry) throw new Error(`Minecraft version ${versionId} was not found in the Mojang manifest`)
  const json = await fetchJson<VersionJson>(entry.url, {}, { timeoutMs: 60_000 })
  await saveVersionJson(json)
  return json
}

export async function saveVersionJson(json: VersionJson): Promise<void> {
  const dir = path.join(paths.versions, json.id)
  await ensureDir(dir)
  await fs.writeFile(path.join(dir, `${json.id}.json`), JSON.stringify(json, null, 2), 'utf8')
  versionCache.set(json.id, json)
}

export async function resolveVersion(versionId: string): Promise<VersionJson> {
  const chain: VersionJson[] = []
  let current = await getVersionJson(versionId)
  chain.push(current)
  const seen = new Set<string>([current.id])
  let depth = 0
  while (current.inheritsFrom && depth < 12) {
    if (seen.has(current.inheritsFrom)) throw new Error(`Circular version inheritance at ${current.inheritsFrom}`)
    seen.add(current.inheritsFrom)
    current = await getVersionJson(current.inheritsFrom)
    chain.push(current)
    depth += 1
  }
  let merged = chain[chain.length - 1]!
  for (let index = chain.length - 2; index >= 0; index -= 1) {
    merged = mergeVersionJson(merged, chain[index]!)
  }
  return merged
}

export function mergeVersionJson(parent: VersionJson, child: VersionJson): VersionJson {
  const libraries = dedupeLibraries([...(child.libraries ?? []), ...(parent.libraries ?? [])])
  const parentGame = argumentsToArray(parent.arguments?.game, parent.minecraftArguments)
  const childGame = argumentsToArray(child.arguments?.game, child.minecraftArguments)
  const parentJvm = argumentsToArray(parent.arguments?.jvm)
  const childJvm = argumentsToArray(child.arguments?.jvm)

  return {
    ...parent,
    ...child,
    id: child.id,
    mainClass: child.mainClass || parent.mainClass,
    assets: child.assets ?? parent.assets,
    assetIndex: child.assetIndex ?? parent.assetIndex,
    downloads: { ...(parent.downloads ?? {}), ...(child.downloads ?? {}) },
    libraries,
    arguments: {
      game: [...parentGame, ...childGame],
      jvm: [...parentJvm, ...childJvm]
    },
    minecraftArguments: undefined,
    javaVersion: child.javaVersion ?? parent.javaVersion,
    logging: child.logging ?? parent.logging,
    releaseTime: child.releaseTime ?? parent.releaseTime,
    time: child.time ?? parent.time,
    minimumLauncherVersion: Math.max(parent.minimumLauncherVersion ?? 0, child.minimumLauncherVersion ?? 0)
  }
}

function argumentsToArray(
  args?: (string | Record<string, unknown>)[],
  legacy?: string
): (string | Record<string, unknown>)[] {
  if (args && args.length > 0) return args
  if (!legacy) return []
  return tokeniseArguments(legacy)
}

export function tokeniseArguments(value: string): string[] {
  return tokenise(value)
}

function dedupeLibraries(libraries: Library[]): Library[] {
  const seen = new Map<string, Library>()
  for (const library of libraries) {
    const key = library.name
    if (!seen.has(key)) seen.set(key, library)
  }
  return [...seen.values()]
}

export function libraryArtifact(library: Library): LibraryArtifact | null {
  if (library.downloads?.artifact?.url) return library.downloads.artifact
  const [coordinates] = library.name.split('@')
  const parts = (coordinates ?? '').split(':')
  if (parts.length < 3) return null
  const [group, artifact, version, classifier] = parts
  const extension = library.name.includes('@') ? library.name.split('@')[1] : 'jar'
  if (!group || !artifact || !version) return null
  const filename = `${artifact}-${version}${classifier ? `-${classifier}` : ''}.${extension}`
  const relative = `${group.replace(/\./g, '/')}/${artifact}/${version}/${filename}`
  const base = library.url ?? 'https://libraries.minecraft.net/'
  return {
    path: relative,
    sha1: '',
    size: 0,
    url: `${base.endsWith('/') ? base : `${base}/`}${relative}`
  }
}

export function nativeArtifact(library: Library, osName: string): LibraryArtifact | null {
  const classifierTemplate = library.natives?.[osName]
  if (!classifierTemplate) return null
  const classifier = classifierTemplate.replace('${arch}', process.arch === 'x64' ? '64' : '32')
  const artifact = library.downloads?.classifiers?.[classifier]
  if (artifact) return artifact
  const [coordinates] = library.name.split('@')
  const parts = (coordinates ?? '').split(':')
  if (parts.length < 3) return null
  const [group, name, version] = parts
  if (!group || !name || !version) return null
  const relative = `${group.replace(/\./g, '/')}/${name}/${version}/${name}-${version}-${classifier}.jar`
  return {
    path: relative,
    sha1: '',
    size: 0,
    url: `https://libraries.minecraft.net/${relative}`
  }
}

export async function isVersionInstalled(versionId: string): Promise<boolean> {
  return pathExists(paths.versionJson(versionId))
}

export async function installedVersionIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(paths.versions, { withFileTypes: true })
    const result: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (await pathExists(paths.versionJson(entry.name))) result.push(entry.name)
    }
    return result
  } catch {
    return []
  }
}

export async function ensureVersionCached(versionId: string): Promise<void> {
  try {
    await getVersionJson(versionId)
  } catch (error) {
    logger.error('mojang', `Unable to load version ${versionId}`, error)
    throw error
  }
}
