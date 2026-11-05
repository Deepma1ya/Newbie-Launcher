export type ServerPropertyKind = 'boolean' | 'number' | 'select' | 'text'
export type ServerPropertyGroup = 'general' | 'gameplay' | 'world' | 'performance' | 'security'

export interface ServerPropertyOption {
  value: string
  label: string
}

export interface ServerPropertyField {
  key: string
  label: string
  description: string
  group: ServerPropertyGroup
  kind: ServerPropertyKind
  min?: number
  max?: number
  step?: number
  options?: ServerPropertyOption[]
}

export const SERVER_PROPERTY_GROUPS: { value: ServerPropertyGroup; label: string; description: string }[] = [
  {
    value: 'general',
    label: 'General',
    description: 'Name, port, player count and visibility on the server list.'
  },
  {
    value: 'gameplay',
    label: 'Gameplay',
    description: 'Game mode, difficulty, PvP, flight, command blocks and world features.'
  },
  {
    value: 'world',
    label: 'World',
    description: 'World name, seed, type and generation options.'
  },
  {
    value: 'performance',
    label: 'Performance',
    description: 'View distance, simulation distance, compression and transport.'
  },
  {
    value: 'security',
    label: 'Security & access',
    description: 'Online mode, whitelist, proxy checks and remote console.'
  }
]

export const SERVER_PROPERTY_FIELDS: ServerPropertyField[] = [
  {
    key: 'motd',
    label: 'Server list message',
    description: 'The message players see under the server name.',
    group: 'general',
    kind: 'text'
  },
  {
    key: 'server-port',
    label: 'Server port',
    description: 'Players connect to localhost or your LAN IP on this port.',
    group: 'general',
    kind: 'number',
    min: 1,
    max: 65535
  },
  {
    key: 'max-players',
    label: 'Maximum players',
    description: 'How many players can join at the same time.',
    group: 'general',
    kind: 'number',
    min: 1,
    max: 1000
  },
  {
    key: 'enable-status',
    label: 'Show in server list',
    description: 'Respond to server list ping requests.',
    group: 'general',
    kind: 'boolean'
  },
  {
    key: 'hide-online-players',
    label: 'Hide player list',
    description: 'Do not send the online player names to server list pings.',
    group: 'general',
    kind: 'boolean'
  },
  {
    key: 'enable-query',
    label: 'Enable query',
    description: 'Allow external tools to query basic server information.',
    group: 'general',
    kind: 'boolean'
  },
  {
    key: 'gamemode',
    label: 'Game mode',
    description: 'Default game mode for new players.',
    group: 'gameplay',
    kind: 'select',
    options: [
      { value: 'survival', label: 'Survival' },
      { value: 'creative', label: 'Creative' },
      { value: 'adventure', label: 'Adventure' },
      { value: 'spectator', label: 'Spectator' }
    ]
  },
  {
    key: 'force-gamemode',
    label: 'Force game mode',
    description: 'Reset every player to the default game mode when they join.',
    group: 'gameplay',
    kind: 'boolean'
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    description: 'World difficulty. Hardcore uses hard difficulty.',
    group: 'gameplay',
    kind: 'select',
    options: [
      { value: 'peaceful', label: 'Peaceful' },
      { value: 'easy', label: 'Easy' },
      { value: 'normal', label: 'Normal' },
      { value: 'hard', label: 'Hard' }
    ]
  },
  {
    key: 'hardcore',
    label: 'Hardcore',
    description: 'Ban players from the world after death. Requires a new world to take full effect.',
    group: 'gameplay',
    kind: 'boolean'
  },
  {
    key: 'pvp',
    label: 'Player versus player',
    description: 'Allow players to damage each other.',
    group: 'gameplay',
    kind: 'boolean'
  },
  {
    key: 'allow-flight',
    label: 'Allow flight',
    description: 'Prevent the server from kicking players who fly in survival.',
    group: 'gameplay',
    kind: 'boolean'
  },
  {
    key: 'enable-command-block',
    label: 'Command blocks',
    description: 'Allow command blocks to run.',
    group: 'gameplay',
    kind: 'boolean'
  },
  {
    key: 'allow-nether',
    label: 'Allow the Nether',
    description: 'Let players travel to the Nether.',
    group: 'gameplay',
    kind: 'boolean'
  },
  {
    key: 'spawn-protection',
    label: 'Spawn protection',
    description: 'Radius around spawn where only operators can build. 0 disables it.',
    group: 'gameplay',
    kind: 'number',
    min: 0,
    max: 64
  },
  {
    key: 'level-name',
    label: 'World folder',
    description: 'Folder inside the server directory that stores this world.',
    group: 'world',
    kind: 'text'
  },
  {
    key: 'level-seed',
    label: 'World seed',
    description: 'Leave blank for a random seed. Used when the world is first created.',
    group: 'world',
    kind: 'text'
  },
  {
    key: 'level-type',
    label: 'World type',
    description: 'World generator used when the world is first created.',
    group: 'world',
    kind: 'select',
    options: [
      { value: 'minecraft:normal', label: 'Normal' },
      { value: 'minecraft:flat', label: 'Superflat' },
      { value: 'minecraft:large_biomes', label: 'Large biomes' },
      { value: 'minecraft:amplified', label: 'Amplified' }
    ]
  },
  {
    key: 'generate-structures',
    label: 'Generate structures',
    description: 'Villages, strongholds, temples and other generated structures.',
    group: 'world',
    kind: 'boolean'
  },
  {
    key: 'spawn-monsters',
    label: 'Spawn monsters',
    description: 'Allow hostile mobs to spawn.',
    group: 'world',
    kind: 'boolean'
  },
  {
    key: 'spawn-animals',
    label: 'Spawn animals',
    description: 'Allow passive animals to spawn.',
    group: 'world',
    kind: 'boolean'
  },
  {
    key: 'spawn-npcs',
    label: 'Spawn villagers',
    description: 'Allow villagers and other NPCs to spawn.',
    group: 'world',
    kind: 'boolean'
  },
  {
    key: 'max-world-size',
    label: 'Maximum world size',
    description: 'World border size in blocks. Lower values keep worlds smaller.',
    group: 'world',
    kind: 'number',
    min: 1,
    max: 29999984
  },
  {
    key: 'view-distance',
    label: 'View distance',
    description: 'Chunks sent to players. Lower values use less memory and CPU.',
    group: 'performance',
    kind: 'number',
    min: 2,
    max: 32
  },
  {
    key: 'simulation-distance',
    label: 'Simulation distance',
    description: 'Chunks that keep ticking around players.',
    group: 'performance',
    kind: 'number',
    min: 2,
    max: 32
  },
  {
    key: 'network-compression-threshold',
    label: 'Network compression',
    description: 'Packet compression threshold. -1 disables compression.',
    group: 'performance',
    kind: 'number',
    min: -1,
    max: 65535
  },
  {
    key: 'player-idle-timeout',
    label: 'Idle timeout',
    description: 'Minutes before an idle player is kicked. 0 disables the timeout.',
    group: 'performance',
    kind: 'number',
    min: 0,
    max: 1440
  },
  {
    key: 'sync-chunk-writes',
    label: 'Synchronous chunk writes',
    description: 'Safer writes, but slower on some disks.',
    group: 'performance',
    kind: 'boolean'
  },
  {
    key: 'use-native-transport',
    label: 'Native transport',
    description: 'Use the platform network transport when available.',
    group: 'performance',
    kind: 'boolean'
  },
  {
    key: 'max-tick-time',
    label: 'Max tick time',
    description: 'Milliseconds before a stuck tick is treated as a crash. -1 disables the watchdog.',
    group: 'performance',
    kind: 'number',
    min: -1,
    max: 600000
  },
  {
    key: 'entity-broadcast-range-percentage',
    label: 'Entity broadcast range',
    description: 'Percentage of the view distance used for entity updates.',
    group: 'performance',
    kind: 'number',
    min: 10,
    max: 1000
  },
  {
    key: 'online-mode',
    label: 'Online mode',
    description: 'Require Microsoft accounts. Turn off only for TLauncher or offline friends.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'white-list',
    label: 'Whitelist',
    description: 'Only allow names added to the whitelist.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'enforce-whitelist',
    label: 'Enforce whitelist',
    description: 'Kick players who are online when the whitelist changes.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'prevent-proxy-connections',
    label: 'Block proxy connections',
    description: 'Reject connections from known VPN and proxy ranges.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'enforce-secure-profile',
    label: 'Require secure profiles',
    description: 'Require signed chat profiles from players.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'enable-rcon',
    label: 'Enable RCON',
    description: 'Allow remote console access. Only use on trusted networks.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'rcon.port',
    label: 'RCON port',
    description: 'Port for remote console access.',
    group: 'security',
    kind: 'number',
    min: 1,
    max: 65535
  },
  {
    key: 'op-permission-level',
    label: 'Operator permission level',
    description: 'Default permission level for new operators.',
    group: 'security',
    kind: 'number',
    min: 0,
    max: 4
  },
  {
    key: 'function-permission-level',
    label: 'Function permission level',
    description: 'Permission level used by functions and command blocks.',
    group: 'security',
    kind: 'number',
    min: 0,
    max: 4
  }
]

export const SERVER_PROPERTY_DEFAULTS: Record<string, string> = {
  motd: 'A Newbie Minecraft Server',
  'server-port': '25565',
  'max-players': '20',
  'enable-status': 'true',
  'hide-online-players': 'false',
  'enable-query': 'false',
  gamemode: 'survival',
  'force-gamemode': 'false',
  difficulty: 'normal',
  hardcore: 'false',
  pvp: 'true',
  'allow-flight': 'false',
  'enable-command-block': 'true',
  'allow-nether': 'true',
  'spawn-protection': '16',
  'level-name': 'world',
  'level-seed': '',
  'level-type': 'minecraft:normal',
  'generate-structures': 'true',
  'spawn-monsters': 'true',
  'spawn-animals': 'true',
  'spawn-npcs': 'true',
  'max-world-size': '29999984',
  'view-distance': '10',
  'simulation-distance': '10',
  'network-compression-threshold': '256',
  'player-idle-timeout': '0',
  'sync-chunk-writes': 'true',
  'use-native-transport': 'true',
  'max-tick-time': '60000',
  'entity-broadcast-range-percentage': '100',
  'online-mode': 'true',
  'white-list': 'false',
  'enforce-whitelist': 'false',
  'prevent-proxy-connections': 'false',
  'enforce-secure-profile': 'true',
  'enable-rcon': 'false',
  'rcon.port': '25575',
  'op-permission-level': '4',
  'function-permission-level': '2'
}
