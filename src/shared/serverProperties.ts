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

export const BEDROCK_PROPERTY_GROUPS: {
  value: ServerPropertyGroup
  label: string
  description: string
}[] = [
  {
    value: 'general',
    label: 'General',
    description: 'Server name, ports and player count. Bedrock clients use UDP, not TCP.'
  },
  {
    value: 'gameplay',
    label: 'Gameplay',
    description: 'Game mode, difficulty, cheats and the default world.'
  },
  {
    value: 'performance',
    label: 'Performance',
    description: 'View and tick distance, idle timeout and threading.'
  },
  {
    value: 'security',
    label: 'Security & access',
    description: 'Xbox accounts, allow list, movement checks and chat restrictions.'
  }
]

export const BEDROCK_PROPERTY_FIELDS: ServerPropertyField[] = [
  {
    key: 'server-name',
    label: 'Server name',
    description: 'The name shown to Bedrock clients on the server list.',
    group: 'general',
    kind: 'text'
  },
  {
    key: 'server-port',
    label: 'IPv4 port',
    description: 'Bedrock uses UDP. The default port is 19132.',
    group: 'general',
    kind: 'number',
    min: 1,
    max: 65535
  },
  {
    key: 'server-portv6',
    label: 'IPv6 port',
    description: 'IPv6 port used when IPv6 is available. The default is 19133.',
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
    key: 'level-name',
    label: 'World folder',
    description: 'Folder inside the server directory that stores this world.',
    group: 'general',
    kind: 'text'
  },
  {
    key: 'level-seed',
    label: 'World seed',
    description: 'Leave blank for a random seed. Used when the world is first created.',
    group: 'general',
    kind: 'text'
  },
  {
    key: 'level-type',
    label: 'World type',
    description: 'World generator used when the world is first created.',
    group: 'gameplay',
    kind: 'select',
    options: [
      { value: 'DEFAULT', label: 'Default' },
      { value: 'FLAT', label: 'Flat' },
      { value: 'LEGACY', label: 'Legacy' }
    ]
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
      { value: 'adventure', label: 'Adventure' }
    ]
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    description: 'World difficulty.',
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
    key: 'allow-cheats',
    label: 'Allow cheats',
    description: 'Allow commands and cheats in the world.',
    group: 'gameplay',
    kind: 'boolean'
  },
  {
    key: 'default-player-permission-level',
    label: 'Default player permission',
    description: 'Permission level for new players.',
    group: 'gameplay',
    kind: 'select',
    options: [
      { value: 'visitor', label: 'Visitor' },
      { value: 'member', label: 'Member' },
      { value: 'operator', label: 'Operator' }
    ]
  },
  {
    key: 'texturepack-required',
    label: 'Require texture pack',
    description: 'Require the world texture pack before a player can join.',
    group: 'gameplay',
    kind: 'boolean'
  },
  {
    key: 'view-distance',
    label: 'View distance',
    description: 'Chunks sent to players. Higher values use more bandwidth and CPU.',
    group: 'performance',
    kind: 'number',
    min: 4,
    max: 32
  },
  {
    key: 'tick-distance',
    label: 'Tick distance',
    description: 'Chunks that keep ticking around players.',
    group: 'performance',
    kind: 'number',
    min: 4,
    max: 12
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
    key: 'max-threads',
    label: 'Worker threads',
    description: 'Threads used by the Bedrock server. Raise carefully.',
    group: 'performance',
    kind: 'number',
    min: 1,
    max: 64
  },
  {
    key: 'compression-threshold',
    label: 'Network compression',
    description: 'Packet compression threshold. 1 is the Bedrock default.',
    group: 'performance',
    kind: 'number',
    min: 0,
    max: 65535
  },
  {
    key: 'client-side-chunk-generation-enabled',
    label: 'Client-side chunk generation',
    description: 'Let compatible clients generate some chunks locally.',
    group: 'performance',
    kind: 'boolean'
  },
  {
    key: 'content-log-file-enabled',
    label: 'Content log',
    description: 'Write add-on content errors to a log file.',
    group: 'performance',
    kind: 'boolean'
  },
  {
    key: 'online-mode',
    label: 'Online mode',
    description: 'Require Xbox Live accounts. Turn off only for private offline servers.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'allow-list',
    label: 'Allow list',
    description: 'Only allow players listed in allowlist.json.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'server-authoritative-movement',
    label: 'Movement authority',
    description: 'How the server validates player movement.',
    group: 'security',
    kind: 'select',
    options: [
      { value: 'client-auth', label: 'Client authoritative' },
      { value: 'server-auth', label: 'Server authoritative' },
      { value: 'server-auth-with-rewind', label: 'Server authoritative with rewind' }
    ]
  },
  {
    key: 'server-authoritative-block-breaking',
    label: 'Server block breaking',
    description: 'Let the server validate block breaking instead of the client.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'player-position-acceptance-threshold',
    label: 'Position threshold',
    description: 'Movement distance the server accepts before correcting a player.',
    group: 'security',
    kind: 'number',
    min: 0,
    max: 100,
    step: 0.01
  },
  {
    key: 'player-movement-score-threshold',
    label: 'Movement score threshold',
    description: 'Movement score that triggers a server correction.',
    group: 'security',
    kind: 'number',
    min: 0,
    max: 100,
    step: 0.01
  },
  {
    key: 'player-movement-action-direction-threshold',
    label: 'Movement direction threshold',
    description: 'Allowed direction mismatch before a correction.',
    group: 'security',
    kind: 'number',
    min: 0,
    max: 1,
    step: 0.01
  },
  {
    key: 'chat-restriction',
    label: 'Chat restriction',
    description: 'Restrict chat for players without Xbox Live permissions.',
    group: 'security',
    kind: 'select',
    options: [
      { value: 'None', label: 'None' },
      { value: 'Dropped', label: 'Drop messages' }
    ]
  },
  {
    key: 'disable-player-interaction',
    label: 'Disable player interaction',
    description: 'Stop players from interacting with each other.',
    group: 'security',
    kind: 'boolean'
  },
  {
    key: 'disable-client-vibrant-visuals',
    label: 'Disable Vibrant Visuals',
    description: 'Turn off client-side Vibrant Visuals for this server.',
    group: 'gameplay',
    kind: 'boolean'
  }
]

export const BEDROCK_PROPERTY_DEFAULTS: Record<string, string> = {
  'server-name': 'Dedicated Server',
  'server-port': '19132',
  'server-portv6': '19133',
  'max-players': '10',
  'level-name': 'Bedrock level',
  'level-seed': '',
  'level-type': 'DEFAULT',
  gamemode: 'survival',
  difficulty: 'easy',
  'allow-cheats': 'false',
  'default-player-permission-level': 'member',
  'texturepack-required': 'false',
  'view-distance': '10',
  'tick-distance': '4',
  'player-idle-timeout': '0',
  'max-threads': '8',
  'compression-threshold': '1',
  'client-side-chunk-generation-enabled': 'true',
  'content-log-file-enabled': 'false',
  'online-mode': 'true',
  'allow-list': 'false',
  'server-authoritative-movement': 'server-auth',
  'server-authoritative-block-breaking': 'false',
  'player-position-acceptance-threshold': '0.5',
  'player-movement-score-threshold': '1.5',
  'player-movement-action-direction-threshold': '0.85',
  'chat-restriction': 'None',
  'disable-player-interaction': 'false',
  'disable-client-vibrant-visuals': 'false'
}
