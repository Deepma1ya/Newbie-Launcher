import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import { ADOPTIUM_API } from '@shared/constants'
import type { JavaRuntime } from '@shared/types'
import { fetchJson } from './http'
import { ensureDir, pathExists } from '../util/fs'
import { extractZip } from '../util/zip'
import { paths } from './paths'
import { logger } from '../util/log'
import { downloadFile } from './http'

interface AdoptiumAsset {
  binary: {
    architecture: string
    image_type: string
    os: string
    package: {
      checksum: string
      link: string
      name: string
      size: number
    }
  }
  version: { major: number; semver: string }
}

const javaCache: { at: number; runtimes: JavaRuntime[] } = { at: 0, runtimes: [] }

export function parseJavaVersion(output: string): { version: string; major: number } | null {
  const match = output.match(/version\s+"([^"]+)"/i)
  if (!match?.[1]) return null
  const version = match[1]
  const parts = version.split(/[._+-]/)
  let major = Number(parts[0])
  if (major === 1) major = Number(parts[1] ?? 8)
  if (!Number.isFinite(major)) return null
  return { version, major }
}

export async function detectJavaRuntimes(force = false): Promise<JavaRuntime[]> {
  if (!force && javaCache.at > 0 && Date.now() - javaCache.at < 60_000) return javaCache.runtimes
  const candidates = new Set<string>()

  const envPaths = [process.env.JAVA_HOME, process.env.JDK_HOME].filter(Boolean) as string[]
  for (const home of envPaths) {
    candidates.add(path.join(home, 'bin', process.platform === 'win32' ? 'javaw.exe' : 'java'))
    candidates.add(path.join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
  }

  if (process.env.PATH) {
    for (const dir of process.env.PATH.split(path.delimiter)) {
      if (!dir) continue
      candidates.add(path.join(dir, process.platform === 'win32' ? 'javaw.exe' : 'java'))
    }
  }

  const roots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files\\Semeru',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Eclipse Adoptium'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Microsoft'),
    path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft', 'runtime'),
    path.join(paths.runtimes, 'java')
  ]

  for (const root of roots) {
    for (const exe of await findJavaExecutables(root, 0)) candidates.add(exe)
  }

  const runtimes: JavaRuntime[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) continue
    const real = path.resolve(candidate)
    if (seen.has(real.toLowerCase())) continue
    seen.add(real.toLowerCase())
    const runtime = await inspectJava(real)
    if (!runtime) continue
    const key = runtime.path.toLowerCase()
    if (runtimes.some((entry) => entry.path.toLowerCase() === key)) continue
    runtimes.push(runtime)
  }

  runtimes.sort((a, b) => b.major - a.major || a.path.localeCompare(b.path))
  javaCache.at = Date.now()
  javaCache.runtimes = runtimes
  logger.info('java', `Detected ${runtimes.length} Java runtime(s): ${runtimes.map((r) => `${r.major}@${r.path}`).join(', ')}`)
  return runtimes
}

async function findJavaExecutables(root: string, depth: number): Promise<string[]> {
  if (depth > 3) return []
  const results: string[] = []
  let entries
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name)
    if (entry.isFile()) {
      if (process.platform === 'win32' && (entry.name === 'javaw.exe' || entry.name === 'java.exe')) {
        if (full.includes(`${path.sep}bin${path.sep}`)) results.push(full)
      }
    } else if (entry.isDirectory()) {
      results.push(...(await findJavaExecutables(full, depth + 1)))
    }
  }
  return results
}

async function inspectJava(exePath: string): Promise<JavaRuntime | null> {
  const javaExe = exePath.replace(/javaw\.exe$/i, 'java.exe')
  return new Promise((resolve) => {
    let output = ''
    const child = spawn(javaExe, ['-version'], { windowsHide: true })
    const timer = setTimeout(() => {
      child.kill()
      resolve(null)
    }, 8000)
    child.stdout.on('data', (chunk) => (output += String(chunk)))
    child.stderr.on('data', (chunk) => (output += String(chunk)))
    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
    child.on('close', () => {
      clearTimeout(timer)
      const parsed = parseJavaVersion(output)
      if (!parsed) {
        resolve(null)
        return
      }
      const isJre = !/jdk/i.test(output) && !/jdk/i.test(exePath)
      const vendor = /temurin|adoptium/i.test(output)
        ? 'Eclipse Adoptium'
        : /graalvm/i.test(output)
          ? 'GraalVM'
          : /zulu/i.test(output)
            ? 'Azul Zulu'
            : /corretto/i.test(output)
              ? 'Amazon Corretto'
              : /microsoft/i.test(output)
                ? 'Microsoft'
                : /oracle/i.test(output)
                  ? 'Oracle'
                  : /openjdk/i.test(output)
                    ? 'OpenJDK'
                    : 'Java'
      resolve({
        path: javaExe.replace(/java\.exe$/i, 'javaw.exe'),
        version: parsed.version,
        major: parsed.major,
        arch: process.arch === 'x64' ? 'x64' : 'x86',
        vendor,
        isJre
      })
    })
  })
}

export async function ensureJava(major: number, autoInstall = true): Promise<JavaRuntime> {
  const runtimes = await detectJavaRuntimes()
  const exact = runtimes.find((runtime) => runtime.major === major)
  if (exact) return exact
  const newer = runtimes
    .filter((runtime) => runtime.major > major && runtime.major <= major + 4)
    .sort((a, b) => a.major - b.major)[0]
  if (newer) return newer
  if (!autoInstall) {
    throw new Error(
      `Java ${major} is required but was not found. Install Temurin ${major} or enable automatic Java downloads in Settings.`
    )
  }
  return installJavaRuntime(major)
}

export async function installJavaRuntime(
  major: number,
  onProgress?: (received: number, total: number) => void
): Promise<JavaRuntime> {
  const existing = (await detectJavaRuntimes()).find((runtime) => runtime.major === major)
  if (existing) return existing

  const url =
    `${ADOPTIUM_API}/assets/latest/${major}/hotspot?os=windows&architecture=x64&image_type=jre&vendor=eclipse`
  const assets = await fetchJson<AdoptiumAsset[]>(url, {}, { timeoutMs: 45_000 })
  const asset = assets[0]
  if (!asset) throw new Error(`No Temurin JRE ${major} build is available for Windows x64`)

  const downloadDir = path.join(paths.runtimes, 'downloads')
  await ensureDir(downloadDir)
  const archive = path.join(downloadDir, asset.binary.package.name)
  logger.info('java', `Downloading ${asset.binary.package.name}`)
  await downloadFile(asset.binary.package.link, archive, {
    sha256: asset.binary.package.checksum,
    size: asset.binary.package.size,
    onProgress: (received, total) => onProgress?.(received, total),
    retries: 4
  })

  const target = path.join(paths.runtimes, 'java', String(major))
  const staging = `${target}.staging-${Date.now()}`
  await fs.rm(staging, { recursive: true, force: true })
  await ensureDir(staging)
  await extractZip(archive, staging)
  const exe = await findJavaInRuntime(staging)
  if (!exe) {
    await fs.rm(staging, { recursive: true, force: true })
    throw new Error('The downloaded Java archive did not contain javaw.exe')
  }
  await fs.rm(target, { recursive: true, force: true })
  await fs.rename(staging, target)
  await fs.rm(archive, { force: true }).catch(() => undefined)
  const finalExe = exe.replace(staging, target)
  const runtime = await inspectJava(finalExe)
  if (!runtime) throw new Error('Downloaded Java runtime could not be started')
  javaCache.at = 0
  logger.info('java', `Installed Java ${runtime.major} at ${runtime.path}`)
  return runtime
}

async function findJavaInRuntime(root: string): Promise<string | null> {
  const candidates = await findJavaExecutables(root, 0)
  return candidates.find((candidate) => candidate.toLowerCase().endsWith('javaw.exe')) ?? candidates[0] ?? null
}

export async function javaForVersion(major: number): Promise<JavaRuntime> {
  return ensureJava(major, true)
}
