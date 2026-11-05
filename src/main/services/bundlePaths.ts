import path from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Find the folder that contains out/preload and out/renderer.
 *
 * Main-process code can end up in out/main or out/main/chunks after Vite
 * code-splitting. Accepting candidate roots keeps both layouts working.
 */
export function resolveBundleDir(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'renderer', 'index.html'))) return candidate
    const out = path.join(candidate, 'out')
    if (existsSync(path.join(out, 'renderer', 'index.html'))) return out
  }
  return null
}
