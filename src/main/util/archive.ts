import fs from 'node:fs'
import path from 'node:path'
import * as archiverModule from 'archiver'

interface ArchiveStream {
  on(event: string, listener: (...args: never[]) => void): void
  pipe<T>(destination: T): T
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
