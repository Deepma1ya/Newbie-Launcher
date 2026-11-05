import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  AccountSummary,
  BackupRecord,
  Instance,
  JavaRuntime,
  LauncherSettings,
  LoaderType,
  LoaderVersion,
  MinecraftVersionSummary,
  ModrinthProject,
  ModrinthVersion,
  SearchPage,
  SearchQuery,
  SystemInfo,
  TaskRecord
} from '@shared/types'
import { useUi } from '../store/ui'

const api = window.newbie

export const qk = {
  instances: ['instances'] as const,
  instance: (id: string) => ['instances', id] as const,
  accounts: ['accounts'] as const,
  settings: ['settings'] as const,
  system: ['system'] as const,
  java: ['java'] as const,
  tasks: ['tasks'] as const,
  versions: ['versions', 'minecraft'] as const,
  loaders: (type: LoaderType, version: string) => ['versions', 'loaders', type, version] as const,
  search: (query: SearchQuery) => ['search', query] as const,
  project: (id: string) => ['project', id] as const,
  projectVersions: (id: string, game?: string, loader?: string) =>
    ['project-versions', id, game, loader] as const,
  backups: (id?: string) => ['backups', id ?? 'all'] as const,
  disk: ['disk'] as const
}

export function useInstances(): UseQueryResult<Instance[]> {
  return useQuery({ queryKey: qk.instances, queryFn: () => api.instances.list() })
}

export function useInstance(id?: string | null): UseQueryResult<Instance | null> {
  return useQuery({
    queryKey: qk.instance(id ?? ''),
    queryFn: () => (id ? api.instances.get(id) : Promise.resolve(null)),
    enabled: Boolean(id)
  })
}

export function useActiveInstance(): Instance | null {
  const instances = useInstances().data ?? []
  const activeId = useUi((state) => state.activeInstanceId)
  return instances.find((instance) => instance.id === activeId) ?? instances[0] ?? null
}

export function useAccounts(): UseQueryResult<AccountSummary[]> {
  return useQuery({ queryKey: qk.accounts, queryFn: () => api.accounts.list() })
}

export function useSettings(): UseQueryResult<LauncherSettings> {
  return useQuery({ queryKey: qk.settings, queryFn: () => api.settings.get() })
}

export function useSystemInfo(): UseQueryResult<SystemInfo> {
  return useQuery({ queryKey: qk.system, queryFn: () => api.system.info(), staleTime: 60_000 })
}

export function useJavaRuntimes(): UseQueryResult<JavaRuntime[]> {
  return useQuery({ queryKey: qk.java, queryFn: () => api.system.detectJava(), staleTime: 60_000 })
}

export function useTasks(): UseQueryResult<TaskRecord[]> {
  return useQuery({ queryKey: qk.tasks, queryFn: () => api.tasks.list(), staleTime: 0 })
}

export function useMinecraftVersions(): UseQueryResult<MinecraftVersionSummary[]> {
  return useQuery({ queryKey: qk.versions, queryFn: () => api.versions.minecraft(), staleTime: 10 * 60_000 })
}

export function useLoaderVersions(type: LoaderType, gameVersion?: string): UseQueryResult<LoaderVersion[]> {
  return useQuery({
    queryKey: qk.loaders(type, gameVersion ?? ''),
    queryFn: () => (gameVersion ? api.versions.loaders(type, gameVersion) : Promise.resolve([])),
    enabled: Boolean(gameVersion) && type !== 'vanilla',
    staleTime: 10 * 60_000
  })
}

export function useSearch(query: SearchQuery, enabled = true): UseQueryResult<SearchPage> {
  return useQuery({
    queryKey: qk.search(query),
    queryFn: () => api.addons.search(query),
    enabled,
    staleTime: 60_000,
    retry: 0
  })
}

export function useProject(id?: string): UseQueryResult<ModrinthProject> {
  return useQuery({
    queryKey: qk.project(id ?? ''),
    queryFn: () => api.addons.project(id!),
    enabled: Boolean(id),
    staleTime: 5 * 60_000
  })
}

export function useProjectVersions(
  id?: string,
  gameVersion?: string,
  loader?: LoaderType
): UseQueryResult<ModrinthVersion[]> {
  return useQuery({
    queryKey: qk.projectVersions(id ?? '', gameVersion, loader),
    queryFn: () => api.addons.versions(id!, gameVersion, loader),
    enabled: Boolean(id),
    staleTime: 60_000
  })
}

export function useBackups(instanceId?: string): UseQueryResult<BackupRecord[]> {
  return useQuery({ queryKey: qk.backups(instanceId), queryFn: () => api.system.backups(instanceId) })
}

export function useDiskUsage() {
  return useQuery({ queryKey: qk.disk, queryFn: () => api.system.diskUsage() })
}
