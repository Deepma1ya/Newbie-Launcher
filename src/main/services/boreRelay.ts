import path from 'node:path'
import { promises as fs } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { downloadFile } from './http'
import { paths } from './paths'
import { ensureDir, pathExists } from '../util/fs'
import { extractZipEntryTo } from '../util/zip'
import { logger } from '../util/log'

const BORE_VERSION = '0.6.0'
const BORE_ZIP_URL = `https://github.com/ekzhang/bore/releases/download/v${BORE_VERSION}/bore-v${BORE_VERSION}-x86_64-pc-windows-msvc.zip`
const BORE_ZIP_SHA256 = '01709C64FE2787CDC9A21D7030B0F08AD72DFF0C36B7ECB72F4F667A55A34B4F'
const BORE_EXE_SHA256 = 'E8C1096EA01460BA9DBF30017B5ECCF2100F63EF2C701930E56FCACA239B48CC'
const BORE_DIR = () => path.join(paths.data, 'tools', 'bore')

export interface BoreRelay {
  child: ChildProcess
  address: string
}

let boreBinary: Promise<string> | null = null

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex').toUpperCase()
}

async function ensureBoreBinary(): Promise<string> {
  if (boreBinary) return boreBinary
  boreBinary = (async () => {
    const dir = BORE_DIR()
    const exe = path.join(dir, 'bore.exe')
    await ensureDir(dir)
    if (await pathExists(exe)) {
      const hash = sha256(await fs.readFile(exe))
      if (hash === BORE_EXE_SHA256) return exe
      await fs.rm(exe, { force: true }).catch(() => undefined)
    }
    const zip = path.join(dir, 'bore.zip')
    if (await pathExists(zip)) {
      const hash = sha256(await fs.readFile(zip))
      if (hash !== BORE_ZIP_SHA256) await fs.rm(zip, { force: true }).catch(() => undefined)
    }
    if (!(await pathExists(zip))) {
      logger.info('bore', 'Downloading the bore relay client')
      await downloadFile(BORE_ZIP_URL, zip, { retries: 4 })
    }
    if (sha256(await fs.readFile(zip)) !== BORE_ZIP_SHA256) {
      await fs.rm(zip, { force: true }).catch(() => undefined)
      throw new Error('The downloaded bore relay client failed its integrity check.')
    }
    if (!extractZipEntryTo(zip, 'bore.exe', exe)) {
      throw new Error('The bore relay download did not contain bore.exe.')
    }
    if (sha256(await fs.readFile(exe)) !== BORE_EXE_SHA256) {
      await fs.rm(exe, { force: true }).catch(() => undefined)
      throw new Error('The extracted bore relay client failed its integrity check.')
    }
    await fs.rm(zip, { force: true }).catch(() => undefined)
    logger.info('bore', 'bore relay client ready')
    return exe
  })().catch((error) => {
    boreBinary = null
    throw error
  })
  return boreBinary
}

export function parseBoreAddress(output: string): string | null {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '')
  const match = /bore\.pub:(\d{1,5})/i.exec(clean)
  if (!match?.[1]) return null
  const port = Number(match[1])
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return `bore.pub:${port}`
}

export async function startBoreRelay(port: number): Promise<BoreRelay> {
  if (process.platform !== 'win32') throw new Error('The quick relay is only available on Windows.')
  const exe = await ensureBoreBinary()
  const child = spawn(exe, ['local', String(port), '--to', 'bore.pub'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  let settled = false
  const address = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`bore.pub did not return an address. ${output.slice(-300)}`))
    }, 25_000)
    const finish = (value: string | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (value) resolve(value)
      else reject(new Error(`bore.pub relay failed. ${output.slice(-300)}`))
    }
    const onData = (chunk: Buffer | string): void => {
      output += String(chunk)
      const parsed = parseBoreAddress(output)
      if (parsed) finish(parsed)
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.once('error', (error) => {
      output += `\n${error.message}`
      finish(null)
    })
    child.once('exit', (code) => {
      if (!settled) finish(null)
      else if (code !== null && code !== 0) logger.warn('bore', `bore relay exited with code ${code}`)
    })
  })
  return { child, address }
}

export async function stopBoreRelay(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  child.kill()
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1_500)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
  if (child.exitCode === null && child.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
      killer.on('close', () => resolve())
      killer.on('error', () => resolve())
    })
  }
}
