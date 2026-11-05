export type UpdateInstallBlocker = 'server' | 'instance' | 'task'

export interface UpdateActivity {
  runningServers: number
  activeInstances: boolean
  activeTasks: boolean
}

/** Pick the most disruptive thing preventing an automatic launcher restart. */
export function updateInstallBlocker(activity: UpdateActivity): UpdateInstallBlocker | null {
  if (activity.runningServers > 0) return 'server'
  if (activity.activeInstances) return 'instance'
  if (activity.activeTasks) return 'task'
  return null
}

export function updateBlockerLabel(blocker: UpdateInstallBlocker): string {
  switch (blocker) {
    case 'server':
      return 'a local server is running'
    case 'instance':
      return 'Minecraft is running'
    case 'task':
      return 'a launcher task is finishing'
  }
}
