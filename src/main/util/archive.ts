import fs from 'node:fs'
import path from 'node:path'
import * as archiverModule from 'archiver'

interface ArchiveStream {
  on(event: string, listener: (...args: never[]) => void): void
  pipe<T>(destination: T): T
  append(data: Buffer | string, options: { name: string }): void
  directory(directory: string, destination?: string): void
  file(file: string, data: { name: string }): void
  finalize(): Promise<void>
}

type ZipArchiveCtor = new (options?: Record<string, unknown>) => ArchiveStream

function zipArchiveConstructor(): ZipArchiveCtor {
  const namespace = archiverModule as unknown as {
    ZipArchive?: ZipArchiveCtor
    default?: { ZipArchive?: ZipArchiveCtor }
  }
  const ctor = namespace.ZipArchive ?? namespace.default?.ZipArchive
  if (!ctor) throw new Error('The zip library could not be loaded')
  return ctor
}

function createArchive(): ArchiveStream {
  const ZipArchive = zipArchiveConstructor()
  return new ZipArchive({ zlib: { level: 9 } })
}

export function zipDirectory(source: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    const output = fs.createWriteStream(destination)
    const archive = createArchive()
    output.on('close', () => resolve())
    output.on('error', reject)
    archive.on('warning', (...args: never[]) => {
      const error = args[0] as NodeJS.ErrnoException | undefined
      if (error?.code === 'ENOENT') return
      reject(error)
    })
    archive.on('error', (...args: never[]) => reject(args[0]))
    archive.pipe(output)
    archive.directory(source, '')
    void archive.finalize()
  })
}

export function zipPaths(root: string, paths: string[], destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    const output = fs.createWriteStream(destination)
    const archive = createArchive()
    output.on('close', () => resolve())
    output.on('error', reject)
    archive.on('error', (...args: never[]) => reject(args[0]))
    archive.pipe(output)
    for (const item of paths) {
      const full = path.join(root, item)
      if (!fs.existsSync(full)) continue
      const stat = fs.statSync(full)
      if (stat.isDirectory()) archive.directory(full, item)
      else archive.file(full, { name: item })
    }
    void archive.finalize()
  })
}

export interface ZipEntry {
  /** Path inside the archive, using forward slashes. */
  name: string
  /** Source file. Ignored when data is provided. */
  file?: string
  /** In-memory content, for manifests and small metadata files. */
  data?: Buffer | string
}

/** Build a ZIP from explicitly named files and in-memory content. */
export function zipEntries(entries: ZipEntry[], destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    const output = fs.createWriteStream(destination)
    const archive = createArchive()
    output.on('close', () => resolve())
    output.on('error', reject)
    archive.on('error', (...args: never[]) => reject(args[0]))
    archive.pipe(output)
    for (const entry of entries) {
      const name = entry.name.replace(/\\/g, '/').replace(/^\/+/, '')
      if (!name || name.includes('..')) continue
      if (entry.data !== undefined) {
        archive.append(entry.data, { name })
        continue
      }
      if (!entry.file || !fs.existsSync(entry.file)) continue
      archive.file(entry.file, { name })
    }
    void archive.finalize()
  })
}
