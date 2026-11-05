import AdmZip from 'adm-zip'
import { parse as parseToml } from 'smol-toml'
import type { LoaderType } from '@shared/types'

export interface JarDependency {
  id: string
  versionRange?: string
  required: boolean
  incompatible?: boolean
}

export interface JarMeta {
  loader: LoaderType | 'unknown'
  modId: string
  name: string
  version: string
  description?: string
  dependencies: JarDependency[]
  entries: string[]
  packFormat?: number
  /** Mod ids bundled inside this jar (Fabric nested JARs, Forge Jar-in-Jar). */
  provided: string[]
}

export function readJarMeta(file: string): JarMeta | null {
  let zip: AdmZip
  try {
    zip = new AdmZip(file)
  } catch {
    return null
  }
  const entries = zip.getEntries().map((entry) => entry.entryName)
  const read = (name: string): string | null => {
    const entry = zip.getEntry(name)
    return entry ? entry.getData().toString('utf8') : null
  }

  const fabric = read('fabric.mod.json')
  if (fabric) {
    try {
      const json = JSON.parse(fabric) as {
        id?: string
        name?: string
        version?: string
        description?: string
        depends?: Record<string, string>
        breaks?: Record<string, string>
      }
      return {
        loader: 'fabric',
        modId: String(json.id ?? filenameFallback(file)),
        name: String(json.name ?? json.id ?? filenameFallback(file)),
        version: String(json.version ?? 'unknown'),
        description: json.description,
        entries,
        provided: nestedModIds(zip, entries),
        dependencies: Object.entries(json.depends ?? {})
          .filter(([id]) => id !== 'minecraft' && id !== 'java' && id !== 'fabricloader')
          .map(([id, versionRange]) => ({ id, versionRange, required: true }))
          .concat(
            Object.entries(json.breaks ?? {}).map(([id, versionRange]) => ({
              id,
              versionRange,
              required: false,
              incompatible: true
            }))
          )
      }
    } catch {
      // Continue with other metadata formats.
    }
  }

  const quilt = read('quilt.mod.json')
  if (quilt) {
    try {
      const json = JSON.parse(quilt) as {
        quilt_loader?: {
          id?: string
          version?: string
          metadata?: { name?: string; description?: string }
          depends?: ({ id?: string; versions?: string; unless?: unknown } | string)[]
        }
      }
      const loader = json.quilt_loader ?? {}
      const dependencies: JarDependency[] = []
      for (const dependency of loader.depends ?? []) {
        if (typeof dependency === 'string') continue
        const id = dependency.id
        if (!id || id === 'minecraft' || id === 'java' || id === 'quilt_loader') continue
        dependencies.push({ id, versionRange: dependency.versions, required: !dependency.unless })
      }
      return {
        loader: 'quilt',
        modId: String(loader.id ?? filenameFallback(file)),
        name: String(loader.metadata?.name ?? loader.id ?? filenameFallback(file)),
        version: String(loader.version ?? 'unknown'),
        description: loader.metadata?.description,
        entries,
        provided: nestedModIds(zip, entries),
        dependencies
      }
    } catch {
      // Continue.
    }
  }

  const forgeToml = read('META-INF/neoforge.mods.toml') ?? read('META-INF/mods.toml')
  if (forgeToml) {
    try {
      const parsed = parseToml(forgeToml) as {
        mods?: { modId?: string; version?: string; displayName?: string; description?: string }[]
        dependencies?: Record<string, { modId?: string; type?: string; mandatory?: boolean; versionRange?: string }[]>
      }
      const first = parsed.mods?.[0]
      const dependencies: JarDependency[] = []
      for (const values of Object.values(parsed.dependencies ?? {})) {
        for (const dependency of values) {
          if (!dependency.modId || dependency.modId === 'minecraft' || dependency.modId === 'forge' || dependency.modId === 'neoforge') continue
          const type = dependency.type ?? 'required'
          dependencies.push({
            id: dependency.modId,
            versionRange: dependency.versionRange,
            required: type === 'required' || (type === 'incompatible' ? false : Boolean(dependency.mandatory)),
            incompatible: type === 'incompatible'
          })
        }
      }
      return {
        loader: forgeToml.includes('neoforge') || entries.some((entry) => entry.includes('neoforge')) ? 'neoforge' : 'forge',
        modId: String(first?.modId ?? filenameFallback(file)),
        name: String(first?.displayName ?? first?.modId ?? filenameFallback(file)),
        version: String(first?.version ?? 'unknown'),
        description: first?.description,
        entries,
        provided: nestedModIds(zip, entries),
        dependencies
      }
    } catch {
      // Continue.
    }
  }

  const legacy = read('mcmod.info')
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as { modid?: string; name?: string; version?: string; description?: string }[]
      const first = Array.isArray(parsed) ? parsed[0] : undefined
      if (first) {
        return {
          loader: 'forge',
          modId: String(first.modid ?? filenameFallback(file)),
          name: String(first.name ?? first.modid ?? filenameFallback(file)),
          version: String(first.version ?? 'unknown'),
          description: first.description,
          entries,
          provided: nestedModIds(zip, entries),
          dependencies: []
        }
      }
    } catch {
      // Continue.
    }
  }

  const pack = read('pack.mcmeta')
  if (pack) {
    try {
      const json = JSON.parse(pack) as { pack?: { pack_format?: number; description?: string } }
      return {
        loader: 'unknown',
        modId: `resourcepack_${filenameFallback(file)}`,
        name: filenameFallback(file),
        version: 'unknown',
        description: typeof json.pack?.description === 'string' ? json.pack.description : undefined,
        dependencies: [],
        entries,
        provided: nestedModIds(zip, entries),
        packFormat: json.pack?.pack_format
      }
    } catch {
      // Ignore.
    }
  }

  return {
    loader: 'unknown',
    modId: filenameFallback(file),
    name: filenameFallback(file),
    version: 'unknown',
    dependencies: [],
    entries,
    provided: nestedModIds(zip, entries)
  }
}

function nestedModIds(zip: AdmZip, entries: string[]): string[] {
  const nested = entries
    .filter((entry) => /^META-INF\/(jars|jarjar)\/.+\.jar$/i.test(entry))
    .slice(0, 60)
  const ids = new Set<string>()
  for (const name of nested) {
    try {
      const entry = zip.getEntry(name)
      if (!entry) continue
      const inner = new AdmZip(entry.getData())
      const fabric = inner.getEntry('fabric.mod.json')
      if (fabric) {
        const json = JSON.parse(fabric.getData().toString('utf8')) as { id?: string }
        if (json.id) ids.add(String(json.id))
      }
      const quilt = inner.getEntry('quilt.mod.json')
      if (quilt) {
        const json = JSON.parse(quilt.getData().toString('utf8')) as { quilt_loader?: { id?: string } }
        if (json.quilt_loader?.id) ids.add(String(json.quilt_loader.id))
      }
      const modsToml = inner.getEntry('META-INF/mods.toml') ?? inner.getEntry('META-INF/neoforge.mods.toml')
      if (modsToml) {
        const parsed = parseToml(modsToml.getData().toString('utf8')) as { mods?: { modId?: string }[] }
        for (const mod of parsed.mods ?? []) if (mod.modId) ids.add(String(mod.modId))
      }
    } catch {
      // A malformed nested JAR should not hide the outer mod.
    }
  }
  return [...ids]
}

export function filenameFallback(file: string): string {
  const name = file.split(/[\\/]/).pop() ?? file
  return name.replace(/\.(jar|zip|mrpack|disabled)$/i, '').replace(/-\d[\w.+-]*$/, '')
}

export function metadataLoaderMatches(meta: JarMeta, loader: LoaderType): boolean {
  if (loader === 'vanilla') return true
  if (meta.loader === 'unknown') return true
  if (loader === 'fabric') return meta.loader === 'fabric' || meta.loader === 'quilt'
  if (loader === 'quilt') return meta.loader === 'fabric' || meta.loader === 'quilt'
  if (loader === 'forge') return meta.loader === 'forge'
  if (loader === 'neoforge') return meta.loader === 'neoforge' || meta.loader === 'forge'
  return true
}
