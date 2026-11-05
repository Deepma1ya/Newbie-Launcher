import type { LoaderType } from './types'

/**
 * A modpack can be applied to an existing instance only when it targets the
 * exact same Minecraft version and the same loader. Individual mods may be
 * more forgiving, but applying a whole pack must not silently change the
 * instance's runtime.
 */
export function isPackCompatible(
  packGameVersion: string,
  packLoader: LoaderType,
  instanceGameVersion: string,
  instanceLoader: LoaderType
): boolean {
  return packGameVersion === instanceGameVersion && packLoader === instanceLoader
}
