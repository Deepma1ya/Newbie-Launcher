import { spawn } from 'node:child_process'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import {
  FABRIC_META,
  FORGE_PROMOTIONS,
  NEOFORGE_MAVEN,
  QUILT_META
} from '@shared/constants'
import type { LoaderType, LoaderVersion } from '@shared/types'
import type { VersionJson } from './mojang'
import { getVersionJson, saveVersionJson } from './mojang'
import { fetchJson, fetchText, downloadFile } from './http'
import { ensureDir, pathExists } from '../util/fs'
import { paths } from './paths'
import { ensureJava } from './java'
import { logger } from '../util/log'

const loaderCache = new Map<string, { at: number; versions: LoaderVersion[] }>()

export async function listLoaderVersions(type: LoaderType, gameVersion: string): Promise<LoaderVersion[]> {
  if (type === 'vanilla') return []
  const key = `${type}:${gameVersion}`
  const cached = loaderCache.get(key)
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.versions
  let versions: LoaderVersion[] = []
  if (type === 'fabric' || type === 'quilt') {
    versions = await listFabricLike(type, gameVersion)
  } else if (type === 'forge') {
    versions = await listForge(gameVersion)
  } else if (type === 'neoforge') {
    versions = await listNeoForge(gameVersion)
  }
  loaderCache.set(key, { at: Date.now(), versions })
  return versions
}

async function listFabricLike(type: 'fabric' | 'quilt', gameVersion: string): Promise<LoaderVersion[]> {
  const base = type === 'fabric' ? FABRIC_META : QUILT_META
  try {
    const data = await fetchJson<
      { loader: { version: string; stable: boolean }; intermediary: { version: string } }[]
    >(`${base}/versions/loader/${encodeURIComponent(gameVersion)}`, {}, { timeoutMs: 25_000 })
    return data.map((entry) => ({
      type,
      version: entry.loader.version,
      gameVersion,
      stable: Boolean(entry.loader.stable),
      label: entry.loader.stable ? 'Stable' : 'Beta'
    }))
  } catch (error) {
    logger.warn('loaders', `Unable to list ${type} loaders for ${gameVersion}`, error)
    return []
  }
}

async function listForge(gameVersion: string): Promise<LoaderVersion[]> {
  const found = new Map<string, boolean>()
  try {
    const promotions = await fetchJson<{ promos: Record<string, string> }>(
      FORGE_PROMOTIONS,
      {},
      { timeoutMs: 25_000 }
    )
    const recommended = promotions.promos[`${gameVersion}-recommended`]
    const latest = promotions.promos[`${gameVersion}-latest`]
    if (recommended) found.set(recommended, true)
    if (latest) found.set(latest, false)
  } catch (error) {
    logger.warn('loaders', 'Forge promotions unavailable', error)
  }
  try {
    const xml = await fetchText(
      'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml',
      {},
      { timeoutMs: 45_000 }
    )
    for (const match of xml.matchAll(/<version>([^<]+)<\/version>/g)) {
      const version = match[1]
      if (!version) continue
      const prefix = `${gameVersion}-`
      if (!version.startsWith(prefix)) continue
      const forgeVersion = version.slice(prefix.length)
      if (!found.has(forgeVersion)) found.set(forgeVersion, false)
    }
  } catch (error) {
    logger.warn('loaders', 'Forge maven metadata unavailable', error)
  }
  return [...found.entries()]
    .map(([version, stable]) => ({ type: 'forge' as const, version, gameVersion, stable }))
    .sort((a, b) => compareVersions(b.version, a.version))
}

async function listNeoForge(gameVersion: string): Promise<LoaderVersion[]> {
  try {
    const parts = gameVersion.split('.')
    const major = parts[1] ?? '0'
    const minor = parts[2] ?? '0'
    const prefix = `${major}.${minor}.`
    const xml = await fetchText(NEOFORGE_MAVEN, {}, { timeoutMs: 45_000 })
    const versions: string[] = []
    for (const match of xml.matchAll(/<version>([^<]+)<\/version>/g)) {
      const version = match[1]
      if (version?.startsWith(prefix)) versions.push(version)
    }
    return versions
      .sort((a, b) => compareVersions(b, a))
      .map((version) => ({
        type: 'neoforge' as const,
        version,
        gameVersion,
        stable: !version.includes('beta')
      }))
  } catch (error) {
    logger.warn('loaders', `Unable to list NeoForge loaders for ${gameVersion}`, error)
    return []
  }
}

export function versionIdForLoader(type: LoaderType, gameVersion: string, loaderVersion: string): string {
  switch (type) {
    case 'fabric':
      return `fabric-loader-${loaderVersion}-${gameVersion}`
    case 'quilt':
      return `quilt-loader-${loaderVersion}-${gameVersion}`
    case 'forge':
      return `forge-${gameVersion}-${loaderVersion}`
    case 'neoforge':
      return `neoforge-${loaderVersion}`
    default:
      return gameVersion
  }
}

export async function installLoader(
  type: LoaderType,
  gameVersion: string,
  requestedVersion?: string,
  onStage?: (message: string) => void
): Promise<string> {
  if (type === 'vanilla') return gameVersion
  const versions = await listLoaderVersions(type, gameVersion)
  const chosen =
    requestedVersion ??
    versions.find((version) => version.stable)?.version ??
    versions[0]?.version
  if (!chosen) throw new Error(`No ${type} loader is available for Minecraft ${gameVersion}`)

  if (type === 'fabric' || type === 'quilt') {
    onStage?.(`Fetching ${type} loader profile`)
    return installFabricLike(type, gameVersion, chosen)
  }
  onStage?.(`Installing ${type} ${chosen}`)
  return installForgeLike(type, gameVersion, chosen, onStage)
}

async function installFabricLike(type: 'fabric' | 'quilt', gameVersion: string, loaderVersion: string): Promise<string> {
  const base = type === 'fabric' ? FABRIC_META : QUILT_META
  const url = `${base}/versions/loader/${encodeURIComponent(gameVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`
  const profile = await fetchJson<VersionJson>(url, {}, { timeoutMs: 30_000 })
  profile.id = versionIdForLoader(type, gameVersion, loaderVersion)
  profile.inheritsFrom = gameVersion
  await saveVersionJson(profile)
  // Ensure the vanilla parent metadata is available for argument merging.
  await getVersionJson(gameVersion)
  logger.info('loaders', `Installed ${type} ${loaderVersion} for ${gameVersion} as ${profile.id}`)
  return profile.id
}

async function installForgeLike(
  type: 'forge' | 'neoforge',
  gameVersion: string,
  loaderVersion: string,
  onStage?: (message: string) => void
): Promise<string> {
  const versionId = versionIdForLoader(type, gameVersion, loaderVersion)
  const existing = paths.versionJson(versionId)
  if (await pathExists(existing)) return versionId

  const vanilla = await getVersionJson(gameVersion)
  const java = await ensureJava(vanilla.javaVersion?.majorVersion ?? 17, true)
  const installerUrl =
    type === 'forge'
      ? `https://maven.minecraftforge.net/net/minecraftforge/forge/${gameVersion}-${loaderVersion}/forge-${gameVersion}-${loaderVersion}-installer.jar`
      : `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVersion}/neoforge-${loaderVersion}-installer.jar`
  const filename = path.basename(installerUrl)
  const jar = path.join(paths.downloadsCache, filename)
  onStage?.(`Downloading ${filename}`)
  await downloadFile(installerUrl, jar, { retries: 4 })

  onStage?.(`Running ${type} installer`)
  const javaExe = java.path.replace(/javaw\.exe$/i, 'java.exe')
  await runInstaller(javaExe, jar, paths.data)
  if (!(await pathExists(existing))) {
    throw new Error(`${type} installer finished but ${versionId} was not created. Check the launcher log for details.`)
  }
  await fs.rm(jar, { force: true }).catch(() => undefined)
  logger.info('loaders', `Installed ${type} ${loaderVersion} for ${gameVersion}`)
  return versionId
}

function runInstaller(javaExe: string, installer: string, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(javaExe, ['-jar', installer, '--installClient', target], {
      cwd: target,
      windowsHide: true
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += String(chunk)
      if (output.length > 60_000) output = output.slice(-60_000)
    })
    child.stderr.on('data', (chunk) => {
      output += String(chunk)
      if (output.length > 60_000) output = output.slice(-60_000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      const tail = output.split(/\r?\n/).filter(Boolean).slice(-18).join('\n')
      reject(new Error(`Installer exited with code ${code}\n${tail}`))
    })
  })
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((part) => Number(part) || 0)
  const pb = b.split(/[.+-]/).map((part) => Number(part) || 0)
  const length = Math.max(pa.length, pb.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (pa[index] ?? 0) - (pb[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
