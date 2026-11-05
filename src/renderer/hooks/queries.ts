import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  AccountSummary,
  AddonType,
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
  ServerRecord,
  ServerRuntimeStatus,
  ServerSearchQuery,
  SystemInfo,
  TaskRecord,
  WorldSummary
} from '@shared/types'
import { useUi } from '../store/ui'

const api = window.newbie

export const qk = {
  instances: ['instances'] as const,
  instance: (id: string) => ['instances', id] as const,
  worlds: (id: string) => ['instances', id, 'worlds'] as const,
  accounts: ['accounts'] as const,
  settings: ['settings'] as const,
  system: ['system'] as const,
  java: ['java'] as const,
  tasks: ['tasks'] as const,
  versions: ['versions', 'minecraft'] as const,
  loaders: (type: LoaderType, version: string) => ['versions', 'loaders', type, version] as const,
  search: (query: SearchQuery) => ['search', query] as const,
  project: (id: string) => ['project', id] as const,
  projectVersions: (id: string, game?: string, loader?: string, type?: string) =>
    ['project-versions', id, game, loader, type] as const,
  backups: (id?: string) => ['backups', id ?? 'all'] as const,
  disk: ['disk'] as const,
  servers: ['servers'] as const,
  server: (id: string) => ['servers', id] as const,
  serverStatuses: ['servers', 'statuses'] as const,
  serverStatus: (id: string) => ['servers', id, 'status'] as const,
  serverLogs: (id: string) => ['servers', id, 'logs'] as const,
  serverProperties: (id: string) => ['servers', id, 'properties'] as const,
  serverSearch: (query: ServerSearchQuery) => ['server-search', query] as const
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

export function useWorlds(id?: string | null, enabled = true): UseQueryResult<WorldSummary[]> {
  return useQuery({
    queryKey: qk.worlds(id ?? ''),
    queryFn: () => (id ? api.instances.worlds(id) : Promise.resolve([])),
    enabled: Boolean(id) && enabled,
    staleTime: 15_000
  })
}

export function useActiveInstance(): Instance | null {
  const instances = useInstances().data ?? []
  const activeId = useUi((state) => state.activeInstanceId)
  return instances.find((instance) => instance.id === activeId) ?? instances[0] ?? null
}

export function useServers(): UseQueryResult<ServerRecord[]> {
  return useQuery({ queryKey: qk.servers, queryFn: () => api.servers.list() })
}

export function useServer(id?: string | null): UseQueryResult<ServerRecord | null> {
  return useQuery({
    queryKey: qk.server(id ?? ''),
    queryFn: () => (id ? api.servers.get(id) : Promise.resolve(null)),
    enabled: Boolean(id)
  })
}

export function useServerStatuses(): UseQueryResult<ServerRuntimeStatus[]> {
  return useQuery({
    queryKey: qk.serverStatuses,
    queryFn: () => api.servers.statuses(),
    refetchInterval: 2_000
  })
}

export function useServerStatus(id?: string | null): UseQueryResult<ServerRuntimeStatus> {
  return useQuery({
    queryKey: qk.serverStatus(id ?? ''),
    queryFn: () => api.servers.status(id!),
    enabled: Boolean(id),
    refetchInterval: 1_500
  })
}

export function useServerLogs(
  id?: string | null,
  enabled = true
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: qk.serverLogs(id ?? ''),
    queryFn: () => api.servers.logs(id!),
    enabled: Boolean(id) && enabled,
    refetchInterval: enabled ? 1_200 : false
  })
}

export function useServerProperties(id?: string | null): UseQueryResult<Record<string, string>> {
  return useQuery({
    queryKey: qk.serverProperties(id ?? ''),
    queryFn: () => api.servers.properties(id!),
    enabled: Boolean(id)
  })
}

export function useServerSearch(
  query: ServerSearchQuery,
  enabled = true
): UseQueryResult<SearchPage> {
  return useQuery({
    queryKey: qk.serverSearch(query),
    queryFn: () => api.servers.searchAddons(query),
    enabled,
    staleTime: 30_000
  })
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
  loader?: LoaderType,
  type?: AddonType
): UseQueryResult<ModrinthVersion[]> {
  return useQuery({
    queryKey: qk.projectVersions(id ?? '', gameVersion, loader, type),
    queryFn: () => api.addons.versions(id!, gameVersion, loader, type),
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
