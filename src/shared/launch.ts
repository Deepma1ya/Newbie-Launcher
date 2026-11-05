/**
 * A process is only treated as a crash when it was not intentionally stopped.
 * Exit code 1 is the usual Minecraft crash signal; null is used when Windows
 * terminated the process without a code.
 */
export function isCrashedExit(code: number | null, spawnError: boolean, stopping: boolean): boolean {
  if (stopping) return false
  return spawnError || (code !== null && code !== 0)
}
