import type { ServerType } from './types'

export const SERVER_COMMAND_CATEGORIES = [
  'Basics',
  'Players',
  'Moderation',
  'World',
  'Blocks & items',
  'Entities',
  'Chat & display',
  'Scoreboard & teams',
  'Server admin',
  'Advanced'
] as const

export type ServerCommandCategory = (typeof SERVER_COMMAND_CATEGORIES)[number]
export type ServerCommandFieldKind =
  | 'text'
  | 'number'
  | 'select'
  | 'player'
  | 'target'
  | 'item'
  | 'coordinates'

export interface ServerCommandFieldOption {
  value: string
  label: string
}

export interface ServerCommandField {
  key: string
  label: string
  kind: ServerCommandFieldKind
  placeholder?: string
  options?: ServerCommandFieldOption[]
  defaultValue?: string
  suggestions?: string[]
  required?: boolean
  min?: number
  max?: number
}

export interface ServerCommandSnippet {
  id: string
  category: ServerCommandCategory
  label: string
  description: string
  /** Command without the leading slash, as typed into the server console. */
  command: string
  fields?: ServerCommandField[]
  types?: ServerType[]
  danger?: boolean
}

const MODES: ServerCommandFieldOption[] = [
  { value: 'survival', label: 'Survival' },
  { value: 'creative', label: 'Creative' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'spectator', label: 'Spectator' }
]

const TRUE_FALSE: ServerCommandFieldOption[] = [
  { value: 'true', label: 'True' },
  { value: 'false', label: 'False' }
]

const EFFECTS = [
  'minecraft:speed',
  'minecraft:slowness',
  'minecraft:haste',
  'minecraft:mining_fatigue',
  'minecraft:strength',
  'minecraft:instant_health',
  'minecraft:instant_damage',
  'minecraft:jump_boost',
  'minecraft:nausea',
  'minecraft:regeneration',
  'minecraft:resistance',
  'minecraft:fire_resistance',
  'minecraft:water_breathing',
  'minecraft:invisibility',
  'minecraft:blindness',
  'minecraft:night_vision',
  'minecraft:hunger',
  'minecraft:weakness',
  'minecraft:poison',
  'minecraft:wither',
  'minecraft:absorption',
  'minecraft:saturation',
  'minecraft:glowing',
  'minecraft:levitation',
  'minecraft:luck',
  'minecraft:slow_falling',
  'minecraft:conduit_power',
  'minecraft:dolphins_grace',
  'minecraft:bad_omen',
  'minecraft:hero_of_the_village'
]

const ITEMS = [
  'minecraft:diamond',
  'minecraft:emerald',
  'minecraft:golden_apple',
  'minecraft:enchanted_golden_apple',
  'minecraft:iron_ingot',
  'minecraft:netherite_ingot',
  'minecraft:elytra',
  'minecraft:totem_of_undying',
  'minecraft:end_crystal',
  'minecraft:oak_log',
  'minecraft:cobblestone',
  'minecraft:torch',
  'minecraft:bread',
  'minecraft:cooked_beef'
]

const ENCHANTMENTS = [
  'minecraft:sharpness',
  'minecraft:smite',
  'minecraft:protection',
  'minecraft:unbreaking',
  'minecraft:efficiency',
  'minecraft:fortune',
  'minecraft:silk_touch',
  'minecraft:power',
  'minecraft:infinity',
  'minecraft:mending',
  'minecraft:feather_falling'
]

const ATTRIBUTES = [
  'minecraft:generic.max_health',
  'minecraft:generic.movement_speed',
  'minecraft:generic.attack_damage',
  'minecraft:generic.armor',
  'minecraft:generic.knockback_resistance',
  'minecraft:generic.follow_range'
]

const STRUCTURES = [
  'minecraft:village',
  'minecraft:stronghold',
  'minecraft:fortress',
  'minecraft:bastion_remnant',
  'minecraft:ancient_city',
  'minecraft:mansion',
  'minecraft:monument',
  'minecraft:trial_chambers'
]

const BIOMES = [
  'minecraft:plains',
  'minecraft:desert',
  'minecraft:jungle',
  'minecraft:cherry_grove',
  'minecraft:swamp',
  'minecraft:mushroom_fields',
  'minecraft:ice_spikes',
  'minecraft:badlands'
]

const SOUNDS = [
  'minecraft:entity.player.levelup',
  'minecraft:entity.experience_orb.pickup',
  'minecraft:block.note_block.pling',
  'minecraft:ui.toast.challenge_complete',
  'minecraft:entity.ender_dragon.growl'
]

const SCOREBOARD_SLOTS: ServerCommandFieldOption[] = [
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'list', label: 'Player list' },
  { value: 'belowName', label: 'Below name' }
]

const SCOREBOARD_OPERATIONS: ServerCommandFieldOption[] = [
  { value: '=', label: 'Set (=)' },
  { value: '+=', label: 'Add (+=)' },
  { value: '-=', label: 'Subtract (-=)' },
  { value: '*=', label: 'Multiply (*=)' },
  { value: '/=', label: 'Divide (/=)' },
  { value: '%=', label: 'Modulo (%=)' },
  { value: '<', label: 'Keep smaller (<)' },
  { value: '>', label: 'Keep larger (>)' },
  { value: '><', label: 'Swap (><)' }
]

const TEAM_OPTIONS: ServerCommandFieldOption[] = [
  { value: 'friendlyFire', label: 'Friendly fire' },
  { value: 'seeFriendlyInvisibles', label: 'See invisible teammates' },
  { value: 'nametagVisibility', label: 'Name tag visibility' },
  { value: 'deathMessageVisibility', label: 'Death message visibility' },
  { value: 'collisionRule', label: 'Collision rule' },
  { value: 'color', label: 'Team color' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'suffix', label: 'Suffix' }
]

function player(key = 'player', label = 'Player', defaultValue?: string): ServerCommandField {
  return { key, label, kind: 'player', defaultValue, required: true }
}

function target(key = 'target', label = 'Target', defaultValue = '@p'): ServerCommandField {
  return { key, label, kind: 'target', defaultValue, required: true }
}

function text(
  key: string,
  label: string,
  defaultValue = '',
  extra: Partial<ServerCommandField> = {}
): ServerCommandField {
  return { key, label, kind: 'text', defaultValue, ...extra }
}

function num(
  key: string,
  label: string,
  defaultValue: string | number,
  min?: number,
  max?: number
): ServerCommandField {
  return { key, label, kind: 'number', defaultValue: String(defaultValue), min, max }
}

function select(
  key: string,
  label: string,
  options: ServerCommandFieldOption[],
  defaultValue?: string
): ServerCommandField {
  return {
    key,
    label,
    kind: 'select',
    options,
    defaultValue: defaultValue ?? options[0]?.value
  }
}

function item(key = 'item', label = 'Item', defaultValue = 'minecraft:diamond'): ServerCommandField {
  return { key, label, kind: 'item', defaultValue, suggestions: ITEMS, required: true }
}

function coords(
  key = 'position',
  label = 'Position',
  defaultValue = '~ ~ ~'
): ServerCommandField {
  return {
    key,
    label,
    kind: 'coordinates',
    defaultValue,
    placeholder: 'x y z, e.g. ~ ~ ~',
    required: true
  }
}

export const SERVER_COMMAND_SNIPPETS: ServerCommandSnippet[] = [
  // Basics
  {
    id: 'list',
    category: 'Basics',
    label: 'List online players',
    description: 'Show online players and the player limit in the console.',
    command: 'list'
  },
  {
    id: 'seed',
    category: 'Basics',
    label: 'Show world seed',
    description: 'Print the current world seed.',
    command: 'seed'
  },
  {
    id: 'version',
    category: 'Basics',
    label: 'Show server version',
    description: 'Print the server software and Minecraft version.',
    command: 'version'
  },
  {
    id: 'difficulty',
    category: 'Basics',
    label: 'Set difficulty',
    description: 'Change the world difficulty.',
    command: 'difficulty {difficulty}',
    fields: [
      select('difficulty', 'Difficulty', [
        { value: 'peaceful', label: 'Peaceful' },
        { value: 'easy', label: 'Easy' },
        { value: 'normal', label: 'Normal' },
        { value: 'hard', label: 'Hard' }
      ])
    ]
  },
  {
    id: 'time-set',
    category: 'Basics',
    label: 'Set time of day',
    description: 'Jump to day, noon, night or midnight.',
    command: 'time set {time}',
    fields: [
      select('time', 'Time', [
        { value: 'day', label: 'Day' },
        { value: 'noon', label: 'Noon' },
        { value: 'night', label: 'Night' },
        { value: 'midnight', label: 'Midnight' }
      ])
    ]
  },
  {
    id: 'time-set-ticks',
    category: 'Basics',
    label: 'Set world time (ticks)',
    description: 'Set the exact world time from 0 to 24000.',
    command: 'time set {ticks}',
    fields: [num('ticks', 'Ticks', 6000, 0, 24000)]
  },
  {
    id: 'time-add',
    category: 'Basics',
    label: 'Add world time',
    description: 'Advance the world clock by a number of ticks.',
    command: 'time add {ticks}',
    fields: [num('ticks', 'Ticks', 1000, 0)]
  },
  {
    id: 'weather',
    category: 'Basics',
    label: 'Set weather',
    description: 'Clear the sky, start rain or start a thunderstorm.',
    command: 'weather {weather} {seconds}',
    fields: [
      select('weather', 'Weather', [
        { value: 'clear', label: 'Clear' },
        { value: 'rain', label: 'Rain' },
        { value: 'thunder', label: 'Thunder' }
      ]),
      num('seconds', 'Duration (seconds, optional)', '', 1)
    ]
  },
  {
    id: 'gamerule',
    category: 'Basics',
    label: 'Set a gamerule',
    description: 'Change a world rule such as keepInventory, doDaylightCycle or randomTickSpeed.',
    command: 'gamerule {rule} {value}',
    fields: [
      text('rule', 'Gamerule', 'keepInventory', {
        suggestions: [
          'keepInventory',
          'doDaylightCycle',
          'doWeatherCycle',
          'doMobSpawning',
          'mobGriefing',
          'randomTickSpeed',
          'maxEntityCramming',
          'playersSleepingPercentage'
        ]
      }),
      text('value', 'Value', 'true', { placeholder: 'true / false / a number' })
    ]
  },
  {
    id: 'save-all',
    category: 'Basics',
    label: 'Save the world',
    description: 'Force a world save.',
    command: 'save-all'
  },
  {
    id: 'stop',
    category: 'Basics',
    label: 'Stop the server',
    description: 'Save and shut down the server cleanly.',
    command: 'stop',
    danger: true
  },

  // Players
  {
    id: 'gamemode',
    category: 'Players',
    label: 'Set game mode',
    description: 'Change a player game mode.',
    command: 'gamemode {mode} {player}',
    fields: [select('mode', 'Game mode', MODES), player('player', 'Player', '@p')]
  },
  {
    id: 'defaultgamemode',
    category: 'Players',
    label: 'Set default game mode',
    description: 'Game mode used for new players.',
    command: 'defaultgamemode {mode}',
    fields: [select('mode', 'Game mode', MODES)]
  },
  {
    id: 'give',
    category: 'Players',
    label: 'Give an item',
    description: 'Give a player an item stack.',
    command: 'give {player} {item} {count}',
    fields: [
      player('player', 'Player', '@p'),
      item('item', 'Item', 'minecraft:diamond'),
      num('count', 'Count', 1, 1, 6400)
    ]
  },
  {
    id: 'clear',
    category: 'Players',
    label: 'Clear inventory',
    description: 'Clear all items, or one item type, from a player.',
    command: 'clear {player} {item}',
    fields: [player('player', 'Player', '@p'), item('item', 'Item (optional)', '')]
  },
  {
    id: 'kill',
    category: 'Players',
    label: 'Kill a target',
    description: 'Kill a player or entity. Target selectors such as @a are allowed.',
    command: 'kill {target}',
    fields: [target()],
    danger: true
  },
  {
    id: 'effect-give',
    category: 'Players',
    label: 'Give an effect',
    description: 'Apply a potion effect.',
    command: 'effect give {target} {effect} {seconds} {amplifier}',
    fields: [
      target(),
      text('effect', 'Effect', 'minecraft:speed', { suggestions: EFFECTS }),
      num('seconds', 'Duration (seconds)', 60, 1),
      num('amplifier', 'Amplifier', 0, 0, 255)
    ]
  },
  {
    id: 'effect-clear',
    category: 'Players',
    label: 'Clear effects',
    description: 'Remove all effects, or one effect, from a target.',
    command: 'effect clear {target} {effect}',
    fields: [target(), text('effect', 'Effect (optional)', '', { suggestions: EFFECTS })]
  },
  {
    id: 'enchant',
    category: 'Players',
    label: 'Enchant held item',
    description: 'Enchant the item a player is holding.',
    command: 'enchant {player} {enchantment} {level}',
    fields: [
      player('player', 'Player', '@p'),
      text('enchantment', 'Enchantment', 'minecraft:sharpness', { suggestions: ENCHANTMENTS }),
      num('level', 'Level', 1, 1, 255)
    ]
  },
  {
    id: 'xp-add',
    category: 'Players',
    label: 'Add experience',
    description: 'Give experience points or levels.',
    command: 'experience add {player} {amount} {unit}',
    fields: [
      player('player', 'Player', '@p'),
      num('amount', 'Amount', 30, 1),
      select('unit', 'Unit', [
        { value: 'points', label: 'Points' },
        { value: 'levels', label: 'Levels' }
      ])
    ]
  },
  {
    id: 'xp-set',
    category: 'Players',
    label: 'Set experience',
    description: 'Set a player experience points or levels.',
    command: 'experience set {player} {amount} {unit}',
    fields: [
      player('player', 'Player', '@p'),
      num('amount', 'Amount', 30, 0),
      select('unit', 'Unit', [
        { value: 'points', label: 'Points' },
        { value: 'levels', label: 'Levels' }
      ])
    ]
  },
  {
    id: 'xp-query',
    category: 'Players',
    label: 'Query experience',
    description: 'Print a player experience points or levels.',
    command: 'experience query {player} {unit}',
    fields: [
      player('player', 'Player', '@p'),
      select('unit', 'Unit', [
        { value: 'points', label: 'Points' },
        { value: 'levels', label: 'Levels' }
      ])
    ]
  },
  {
    id: 'spawnpoint',
    category: 'Players',
    label: 'Set player spawn',
    description: 'Set where a player respawns.',
    command: 'spawnpoint {player} {position}',
    fields: [player('player', 'Player', '@p'), coords()]
  },
  {
    id: 'tp-player',
    category: 'Players',
    label: 'Teleport player to player',
    description: 'Send one player to another player.',
    command: 'tp {player} {destination}',
    fields: [player('player', 'Player', '@p'), player('destination', 'Destination player', '@r')]
  },
  {
    id: 'tp-coords',
    category: 'Players',
    label: 'Teleport player to coordinates',
    description: 'Send a player to exact coordinates.',
    command: 'tp {player} {position}',
    fields: [player('player', 'Player', '@p'), coords()]
  },
  {
    id: 'spreadplayers',
    category: 'Players',
    label: 'Spread players',
    description: 'Scatter players around a center point.',
    command: 'spreadplayers {center} {spread} {range} {teams} {targets}',
    fields: [
      coords('center', 'Center', '0 0'),
      num('spread', 'Minimum distance', 10, 0),
      num('range', 'Maximum range', 50, 1),
      select('teams', 'Respect teams', TRUE_FALSE, 'false'),
      target('targets', 'Targets', '@a')
    ]
  },
  {
    id: 'damage',
    category: 'Players',
    label: 'Damage a target',
    description: 'Deal damage with an optional damage type.',
    command: 'damage {target} {amount} {type}',
    fields: [
      target(),
      num('amount', 'Amount', 5, 0),
      text('type', 'Damage type (optional)', 'minecraft:generic', {
        suggestions: [
          'minecraft:generic',
          'minecraft:fall',
          'minecraft:fire',
          'minecraft:drowning',
          'minecraft:magic',
          'minecraft:out_of_world'
        ]
      })
    ]
  },
  {
    id: 'ride',
    category: 'Players',
    label: 'Ride an entity',
    description: 'Make a target mount another entity.',
    command: 'ride {target} mount {vehicle}',
    fields: [target(), target('vehicle', 'Vehicle', '@e[type=minecraft:pig,limit=1]')]
  },
  {
    id: 'dismount',
    category: 'Players',
    label: 'Dismount an entity',
    description: 'Remove a target from its vehicle.',
    command: 'ride {target} dismount',
    fields: [target()]
  },
  {
    id: 'rotate',
    category: 'Players',
    label: 'Rotate an entity',
    description: 'Set yaw and pitch for a target.',
    command: 'rotate {target} {yaw} {pitch}',
    fields: [target(), num('yaw', 'Yaw', 0, -180, 180), num('pitch', 'Pitch', 0, -90, 90)]
  },
  {
    id: 'advancement-grant',
    category: 'Players',
    label: 'Grant advancement',
    description: 'Grant one advancement or everything.',
    command: 'advancement grant {player} only {advancement}',
    fields: [
      player('player', 'Player', '@p'),
      text('advancement', 'Advancement', 'everything', {
        suggestions: ['everything', 'story/root', 'nether/root', 'end/root', 'adventure/root']
      })
    ]
  },
  {
    id: 'advancement-revoke',
    category: 'Players',
    label: 'Revoke advancement',
    description: 'Revoke one advancement or everything.',
    command: 'advancement revoke {player} only {advancement}',
    fields: [
      player('player', 'Player', '@p'),
      text('advancement', 'Advancement', 'everything', {
        suggestions: ['everything', 'story/root', 'nether/root', 'end/root', 'adventure/root']
      })
    ]
  },
  {
    id: 'recipe-give',
    category: 'Players',
    label: 'Unlock a recipe',
    description: 'Give a player a crafting recipe.',
    command: 'recipe give {player} {recipe}',
    fields: [player('player', 'Player', '@p'), text('recipe', 'Recipe', 'minecraft:crafting_table')]
  },
  {
    id: 'recipe-take',
    category: 'Players',
    label: 'Lock a recipe',
    description: 'Remove a crafting recipe from a player.',
    command: 'recipe take {player} {recipe}',
    fields: [player('player', 'Player', '@p'), text('recipe', 'Recipe', 'minecraft:crafting_table')]
  },
  {
    id: 'attribute-get',
    category: 'Players',
    label: 'Read an attribute',
    description: 'Print a target attribute value.',
    command: 'attribute {target} {attribute} get',
    fields: [target(), text('attribute', 'Attribute', 'minecraft:generic.max_health', { suggestions: ATTRIBUTES })]
  },
  {
    id: 'attribute-set',
    category: 'Players',
    label: 'Set an attribute',
    description: 'Set a target attribute value.',
    command: 'attribute {target} {attribute} base set {value}',
    fields: [
      target(),
      text('attribute', 'Attribute', 'minecraft:generic.max_health', { suggestions: ATTRIBUTES }),
      num('value', 'Value', 20, 0)
    ]
  },
  {
    id: 'tag-add',
    category: 'Players',
    label: 'Add a scoreboard tag',
    description: 'Add a tag to a player or entity.',
    command: 'tag {target} add {tag}',
    fields: [target(), text('tag', 'Tag', 'newbie')]
  },
  {
    id: 'tag-remove',
    category: 'Players',
    label: 'Remove a scoreboard tag',
    description: 'Remove a tag from a player or entity.',
    command: 'tag {target} remove {tag}',
    fields: [target(), text('tag', 'Tag', 'newbie')]
  },
  {
    id: 'tag-list',
    category: 'Players',
    label: 'List scoreboard tags',
    description: 'Print every tag on a target.',
    command: 'tag {target} list',
    fields: [target()]
  },
  {
    id: 'team-join',
    category: 'Players',
    label: 'Join a team',
    description: 'Add players or entities to a team.',
    command: 'team join {team} {members}',
    fields: [text('team', 'Team', 'red'), target('members', 'Members', '@p')]
  },

  // Moderation
  {
    id: 'kick',
    category: 'Moderation',
    label: 'Kick a player',
    description: 'Disconnect a player with an optional reason.',
    command: 'kick {player} {reason}',
    fields: [player('player', 'Player'), text('reason', 'Reason (optional)', '')]
  },
  {
    id: 'ban',
    category: 'Moderation',
    label: 'Ban a player',
    description: 'Ban a player name with an optional reason.',
    command: 'ban {player} {reason}',
    fields: [player('player', 'Player'), text('reason', 'Reason (optional)', '')],
    danger: true
  },
  {
    id: 'ban-ip',
    category: 'Moderation',
    label: 'Ban an IP or player IP',
    description: 'Ban an IP address or the IP used by a player.',
    command: 'ban-ip {target} {reason}',
    fields: [text('target', 'Player or IP'), text('reason', 'Reason (optional)', '')],
    danger: true
  },
  {
    id: 'pardon',
    category: 'Moderation',
    label: 'Pardon a player',
    description: 'Remove a player from the ban list.',
    command: 'pardon {player}',
    fields: [player('player', 'Player')]
  },
  {
    id: 'pardon-ip',
    category: 'Moderation',
    label: 'Pardon an IP',
    description: 'Remove an IP from the ban list.',
    command: 'pardon-ip {ip}',
    fields: [text('ip', 'IP address', '127.0.0.1')]
  },
  {
    id: 'op',
    category: 'Moderation',
    label: 'Make a player operator',
    description: 'Grant operator permission level 4.',
    command: 'op {player}',
    fields: [player('player', 'Player')],
    danger: true
  },
  {
    id: 'deop',
    category: 'Moderation',
    label: 'Remove operator',
    description: 'Remove operator permissions from a player.',
    command: 'deop {player}',
    fields: [player('player', 'Player')]
  },
  {
    id: 'whitelist-add',
    category: 'Moderation',
    label: 'Whitelist add',
    description: 'Allow a player name on the whitelist.',
    command: 'whitelist add {player}',
    fields: [player('player', 'Player')]
  },
  {
    id: 'whitelist-remove',
    category: 'Moderation',
    label: 'Whitelist remove',
    description: 'Remove a player from the whitelist.',
    command: 'whitelist remove {player}',
    fields: [player('player', 'Player')]
  },
  {
    id: 'whitelist-list',
    category: 'Moderation',
    label: 'List whitelist',
    description: 'Print every whitelisted player.',
    command: 'whitelist list'
  },
  {
    id: 'whitelist-on',
    category: 'Moderation',
    label: 'Enable whitelist',
    description: 'Only whitelisted players can join.',
    command: 'whitelist on'
  },
  {
    id: 'whitelist-off',
    category: 'Moderation',
    label: 'Disable whitelist',
    description: 'Allow any player to join.',
    command: 'whitelist off'
  },
  {
    id: 'whitelist-reload',
    category: 'Moderation',
    label: 'Reload whitelist',
    description: 'Reload whitelist.json from disk.',
    command: 'whitelist reload'
  },
  {
    id: 'idle-timeout',
    category: 'Moderation',
    label: 'Set idle timeout',
    description: 'Kick players after this many idle minutes. 0 disables it.',
    command: 'setidletimeout {minutes}',
    fields: [num('minutes', 'Minutes', 0, 0)]
  },

  // World
  {
    id: 'setworldspawn',
    category: 'World',
    label: 'Set world spawn',
    description: 'Set the world spawn point.',
    command: 'setworldspawn {position}',
    fields: [coords()]
  },
  {
    id: 'worldborder-set',
    category: 'World',
    label: 'Set world border size',
    description: 'Set the border diameter and optionally resize over time.',
    command: 'worldborder set {diameter} {seconds}',
    fields: [num('diameter', 'Diameter', 1000, 1), num('seconds', 'Seconds (optional)', '', 1)]
  },
  {
    id: 'worldborder-center',
    category: 'World',
    label: 'Move world border center',
    description: 'Center the world border on new coordinates.',
    command: 'worldborder center {x} {z}',
    fields: [num('x', 'X', 0), num('z', 'Z', 0)]
  },
  {
    id: 'worldborder-add',
    category: 'World',
    label: 'Grow or shrink border',
    description: 'Add or remove blocks from the border diameter.',
    command: 'worldborder add {distance} {seconds}',
    fields: [num('distance', 'Distance', 100), num('seconds', 'Seconds (optional)', '', 1)]
  },
  {
    id: 'worldborder-damage',
    category: 'World',
    label: 'Set border damage',
    description: 'Damage dealt per block outside the border.',
    command: 'worldborder damage amount {amount}',
    fields: [num('amount', 'Damage', 0.2, 0)]
  },
  {
    id: 'worldborder-warning',
    category: 'World',
    label: 'Set border warning',
    description: 'Distance before the red warning overlay appears.',
    command: 'worldborder warning distance {distance}',
    fields: [num('distance', 'Distance', 5, 0)]
  },
  {
    id: 'forceload-add',
    category: 'World',
    label: 'Force-load chunks',
    description: 'Keep chunks loaded even without players nearby.',
    command: 'forceload add {from} {to}',
    fields: [coords('from', 'From chunk', '0 0'), coords('to', 'To chunk', '15 15')]
  },
  {
    id: 'forceload-remove',
    category: 'World',
    label: 'Release force-loaded chunks',
    description: 'Stop force-loading a chunk range.',
    command: 'forceload remove {from} {to}',
    fields: [coords('from', 'From chunk', '0 0'), coords('to', 'To chunk', '15 15')]
  },
  {
    id: 'forceload-query',
    category: 'World',
    label: 'List force-loaded chunks',
    description: 'Print all force-loaded chunk ranges.',
    command: 'forceload query'
  },
  {
    id: 'locate-structure',
    category: 'World',
    label: 'Locate a structure',
    description: 'Find the nearest structure of a type.',
    command: 'locate structure {structure}',
    fields: [text('structure', 'Structure', 'minecraft:village', { suggestions: STRUCTURES })]
  },
  {
    id: 'locate-biome',
    category: 'World',
    label: 'Locate a biome',
    description: 'Find the nearest biome of a type.',
    command: 'locate biome {biome}',
    fields: [text('biome', 'Biome', 'minecraft:plains', { suggestions: BIOMES })]
  },
  {
    id: 'locate-poi',
    category: 'World',
    label: 'Locate a point of interest',
    description: 'Find the nearest villager work station or other POI.',
    command: 'locate poi {poi}',
    fields: [
      text('poi', 'POI', 'minecraft:armorer', {
        suggestions: [
          'minecraft:armorer',
          'minecraft:butcher',
          'minecraft:cartographer',
          'minecraft:cleric',
          'minecraft:farmer',
          'minecraft:fisherman',
          'minecraft:fletcher',
          'minecraft:leatherworker',
          'minecraft:librarian',
          'minecraft:mason',
          'minecraft:shepherd',
          'minecraft:toolsmith',
          'minecraft:weaponsmith'
        ]
      })
    ]
  },
  {
    id: 'datapack-list',
    category: 'World',
    label: 'List datapacks',
    description: 'Show installed datapacks and their state.',
    command: 'datapack list'
  },
  {
    id: 'datapack-enable',
    category: 'World',
    label: 'Enable a datapack',
    description: 'Enable a datapack by name.',
    command: 'datapack enable {name}',
    fields: [text('name', 'Datapack', 'file/my_datapack.zip')]
  },
  {
    id: 'datapack-disable',
    category: 'World',
    label: 'Disable a datapack',
    description: 'Disable a datapack by name.',
    command: 'datapack disable {name}',
    fields: [text('name', 'Datapack', 'file/my_datapack.zip')]
  },
  {
    id: 'function-run',
    category: 'World',
    label: 'Run a function',
    description: 'Run a datapack function.',
    command: 'function {function}',
    fields: [text('function', 'Function', 'minecraft:my_function')]
  },
  {
    id: 'schedule-function',
    category: 'World',
    label: 'Schedule a function',
    description: 'Run a function after a delay or at a fixed time.',
    command: 'schedule function {function} {time}',
    fields: [text('function', 'Function', 'minecraft:my_function'), text('time', 'Time', '5s', { placeholder: '5s, 1d or 12:00' })]
  },
  {
    id: 'schedule-clear',
    category: 'World',
    label: 'Clear scheduled function',
    description: 'Remove a scheduled function run.',
    command: 'schedule clear {function}',
    fields: [text('function', 'Function', 'minecraft:my_function')]
  },
  {
    id: 'tick-query',
    category: 'World',
    label: 'Query tick state',
    description: 'Show tick rate, frozen state and sprint state.',
    command: 'tick query'
  },
  {
    id: 'tick-rate',
    category: 'World',
    label: 'Set tick rate',
    description: 'Change the server tick rate. Default is 20.',
    command: 'tick rate {rate}',
    fields: [num('rate', 'Ticks per second', 20, 1, 10000)]
  },
  {
    id: 'tick-freeze',
    category: 'World',
    label: 'Freeze ticking',
    description: 'Pause world simulation.',
    command: 'tick freeze'
  },
  {
    id: 'tick-unfreeze',
    category: 'World',
    label: 'Unfreeze ticking',
    description: 'Resume world simulation.',
    command: 'tick unfreeze'
  },
  {
    id: 'save-off',
    category: 'World',
    label: 'Disable world saving',
    description: 'Pause automatic saves. Remember to enable saving again.',
    command: 'save-off'
  },
  {
    id: 'save-on',
    category: 'World',
    label: 'Enable world saving',
    description: 'Resume automatic saves.',
    command: 'save-on'
  },

  // Blocks & items
  {
    id: 'setblock',
    category: 'Blocks & items',
    label: 'Place a block',
    description: 'Set one block at a position.',
    command: 'setblock {position} {block} {mode}',
    fields: [
      coords(),
      text('block', 'Block', 'minecraft:stone'),
      select('mode', 'Mode', [
        { value: 'replace', label: 'Replace' },
        { value: 'destroy', label: 'Destroy old block' },
        { value: 'keep', label: 'Keep existing block' }
      ])
    ]
  },
  {
    id: 'fill',
    category: 'Blocks & items',
    label: 'Fill an area',
    description: 'Fill a cuboid with a block.',
    command: 'fill {from} {to} {block} {mode}',
    fields: [
      coords('from', 'From', '0 64 0'),
      coords('to', 'To', '10 74 10'),
      text('block', 'Block', 'minecraft:stone'),
      select('mode', 'Mode', [
        { value: 'replace', label: 'Replace' },
        { value: 'destroy', label: 'Destroy old blocks' },
        { value: 'keep', label: 'Keep existing blocks' }
      ])
    ]
  },
  {
    id: 'clone',
    category: 'Blocks & items',
    label: 'Clone an area',
    description: 'Copy a cuboid to another location.',
    command: 'clone {from} {to} {destination} {mode}',
    fields: [
      coords('from', 'From', '0 64 0'),
      coords('to', 'To', '10 74 10'),
      coords('destination', 'Destination', '20 64 20'),
      select('mode', 'Mode', [
        { value: 'replace', label: 'Replace' },
        { value: 'masked', label: 'Masked (air excluded)' }
      ])
    ]
  },
  {
    id: 'place-feature',
    category: 'Blocks & items',
    label: 'Place a feature',
    description: 'Generate a configured feature such as trees.',
    command: 'place feature {feature} {position}',
    fields: [text('feature', 'Feature', 'minecraft:trees_plains'), coords()]
  },
  {
    id: 'place-structure',
    category: 'Blocks & items',
    label: 'Place a structure',
    description: 'Generate a structure at a position.',
    command: 'place structure {structure} {position}',
    fields: [text('structure', 'Structure', 'minecraft:village', { suggestions: STRUCTURES }), coords()]
  },
  {
    id: 'place-template',
    category: 'Blocks & items',
    label: 'Place a template',
    description: 'Place a structure template from a datapack.',
    command: 'place template {template} {position}',
    fields: [text('template', 'Template', 'minecraft:my_template'), coords()]
  },
  {
    id: 'item-replace-block',
    category: 'Blocks & items',
    label: 'Put an item in a container',
    description: 'Replace an item in a block inventory slot.',
    command: 'item replace block {position} {slot} with {item} {count}',
    fields: [
      coords(),
      text('slot', 'Slot', 'container.0', { suggestions: ['container.0', 'container.1', 'container.2', 'weapon.mainhand'] }),
      item(),
      num('count', 'Count', 1, 1, 6400)
    ]
  },
  {
    id: 'item-replace-entity',
    category: 'Blocks & items',
    label: 'Give an entity an item',
    description: 'Replace an item in an entity or player slot.',
    command: 'item replace entity {target} {slot} with {item} {count}',
    fields: [
      target(),
      text('slot', 'Slot', 'weapon.mainhand', {
        suggestions: ['weapon.mainhand', 'weapon.offhand', 'armor.head', 'armor.chest', 'armor.legs', 'armor.feet']
      }),
      item(),
      num('count', 'Count', 1, 1, 64)
    ]
  },
  {
    id: 'loot-give',
    category: 'Blocks & items',
    label: 'Give a loot table',
    description: 'Give players the contents of a loot table.',
    command: 'loot give {players} {lootTable}',
    fields: [
      target('players', 'Players', '@p'),
      text('lootTable', 'Loot table', 'minecraft:chests/simple_dungeon')
    ]
  },
  {
    id: 'loot-spawn',
    category: 'Blocks & items',
    label: 'Spawn loot',
    description: 'Drop a loot table at a position.',
    command: 'loot spawn {position} {lootTable}',
    fields: [coords(), text('lootTable', 'Loot table', 'minecraft:chests/simple_dungeon')]
  },
  {
    id: 'loot-insert',
    category: 'Blocks & items',
    label: 'Insert loot into a container',
    description: 'Insert a loot table into a block or entity inventory.',
    command: 'loot insert {position} {lootTable}',
    fields: [coords(), text('lootTable', 'Loot table', 'minecraft:chests/simple_dungeon')]
  },
  {
    id: 'data-get-block',
    category: 'Blocks & items',
    label: 'Read block data',
    description: 'Print the NBT data of a block entity.',
    command: 'data get block {position}',
    fields: [coords()]
  },
  {
    id: 'data-get-entity',
    category: 'Blocks & items',
    label: 'Read entity data',
    description: 'Print the NBT data of a player or entity.',
    command: 'data get entity {target}',
    fields: [target()]
  },
  {
    id: 'data-merge-block',
    category: 'Blocks & items',
    label: 'Merge block data',
    description: 'Merge NBT into a block entity.',
    command: 'data merge block {position} {nbt}',
    fields: [coords(), text('nbt', 'NBT', '{"CustomName":"\\"Newbie\\""}')]
  },
  {
    id: 'data-merge-entity',
    category: 'Blocks & items',
    label: 'Merge entity data',
    description: 'Merge NBT into a player or entity.',
    command: 'data merge entity {target} {nbt}',
    fields: [target(), text('nbt', 'NBT', '{"CustomName":"\\"Newbie\\""}')]
  },

  // Entities
  {
    id: 'summon',
    category: 'Entities',
    label: 'Summon an entity',
    description: 'Spawn an entity at a position.',
    command: 'summon {entity} {position}',
    fields: [
      text('entity', 'Entity', 'minecraft:zombie', {
        suggestions: [
          'minecraft:zombie',
          'minecraft:skeleton',
          'minecraft:cow',
          'minecraft:villager',
          'minecraft:armor_stand',
          'minecraft:item',
          'minecraft:lightning_bolt'
        ]
      }),
      coords()
    ]
  },
  {
    id: 'summon-nbt',
    category: 'Entities',
    label: 'Summon with NBT',
    description: 'Spawn an entity with custom NBT.',
    command: 'summon {entity} {position} {nbt}',
    fields: [
      text('entity', 'Entity', 'minecraft:armor_stand'),
      coords(),
      text('nbt', 'NBT', '{"CustomName":"\\"Newbie\\"","NoGravity":1b}')
    ]
  },
  {
    id: 'entity-kill',
    category: 'Entities',
    label: 'Kill entities',
    description: 'Kill every entity matching a selector.',
    command: 'kill {target}',
    fields: [target('target', 'Target selector', '@e[type=minecraft:item]')],
    danger: true
  },
  {
    id: 'entity-tag-add',
    category: 'Entities',
    label: 'Tag an entity',
    description: 'Add a scoreboard tag to an entity.',
    command: 'tag {target} add {tag}',
    fields: [target(), text('tag', 'Tag', 'newbie')]
  },
  {
    id: 'entity-ride',
    category: 'Entities',
    label: 'Mount an entity',
    description: 'Make a target ride a vehicle entity.',
    command: 'ride {target} mount {vehicle}',
    fields: [target(), target('vehicle', 'Vehicle', '@e[type=minecraft:pig,limit=1]')]
  },
  {
    id: 'entity-rotate',
    category: 'Entities',
    label: 'Rotate an entity',
    description: 'Set an entity yaw and pitch.',
    command: 'rotate {target} {yaw} {pitch}',
    fields: [target(), num('yaw', 'Yaw', 0, -180, 180), num('pitch', 'Pitch', 0, -90, 90)]
  },

  // Chat & display
  {
    id: 'say',
    category: 'Chat & display',
    label: 'Broadcast a message',
    description: 'Send a plain message to every player and the console.',
    command: 'say {message}',
    fields: [text('message', 'Message', 'Server restarting soon')]
  },
  {
    id: 'tell',
    category: 'Chat & display',
    label: 'Message a player',
    description: 'Send a private message to one player.',
    command: 'tell {player} {message}',
    fields: [player('player', 'Player', '@p'), text('message', 'Message', 'Welcome!')]
  },
  {
    id: 'tellraw',
    category: 'Chat & display',
    label: 'Send rich text',
    description: 'Send a JSON text component to players.',
    command: 'tellraw {player} {json}',
    fields: [
      player('player', 'Player', '@a'),
      text('json', 'JSON component', '{"text":"Welcome!","color":"gold"}')
    ]
  },
  {
    id: 'title',
    category: 'Chat & display',
    label: 'Show a title',
    description: 'Show a large title on screen.',
    command: 'title {player} title {json}',
    fields: [
      player('player', 'Player', '@a'),
      text('json', 'Title text / JSON', '{"text":"Welcome","color":"gold"}')
    ]
  },
  {
    id: 'subtitle',
    category: 'Chat & display',
    label: 'Show a subtitle',
    description: 'Show a subtitle under the current title.',
    command: 'title {player} subtitle {json}',
    fields: [
      player('player', 'Player', '@a'),
      text('json', 'Subtitle text / JSON', '{"text":"Have fun!","color":"gray"}')
    ]
  },
  {
    id: 'actionbar',
    category: 'Chat & display',
    label: 'Show action bar text',
    description: 'Show text above the hotbar.',
    command: 'title {player} actionbar {json}',
    fields: [
      player('player', 'Player', '@a'),
      text('json', 'Action bar text / JSON', '{"text":"Welcome!","color":"green"}')
    ]
  },
  {
    id: 'bossbar-add',
    category: 'Chat & display',
    label: 'Create a boss bar',
    description: 'Create a reusable boss bar with an ID.',
    command: 'bossbar add {id} {name}',
    fields: [
      text('id', 'Boss bar ID', 'newbie:event'),
      text('name', 'Display name / JSON', '{"text":"Event","color":"gold"}')
    ]
  },
  {
    id: 'bossbar-set-name',
    category: 'Chat & display',
    label: 'Rename a boss bar',
    description: 'Change a boss bar display name.',
    command: 'bossbar set {id} name {name}',
    fields: [text('id', 'Boss bar ID', 'newbie:event'), text('name', 'Display name / JSON', '{"text":"Event","color":"gold"}')]
  },
  {
    id: 'bossbar-set-players',
    category: 'Chat & display',
    label: 'Show a boss bar to players',
    description: 'Set which players see a boss bar.',
    command: 'bossbar set {id} players {players}',
    fields: [text('id', 'Boss bar ID', 'newbie:event'), target('players', 'Players', '@a')]
  },
  {
    id: 'bossbar-set-value',
    category: 'Chat & display',
    label: 'Set boss bar progress',
    description: 'Set the current value of a boss bar.',
    command: 'bossbar set {id} value {value}',
    fields: [text('id', 'Boss bar ID', 'newbie:event'), num('value', 'Value', 50, 0)]
  },
  {
    id: 'bossbar-set-max',
    category: 'Chat & display',
    label: 'Set boss bar maximum',
    description: 'Set the maximum value of a boss bar.',
    command: 'bossbar set {id} max {max}',
    fields: [text('id', 'Boss bar ID', 'newbie:event'), num('max', 'Maximum', 100, 1)]
  },
  {
    id: 'bossbar-remove',
    category: 'Chat & display',
    label: 'Remove a boss bar',
    description: 'Delete a boss bar by ID.',
    command: 'bossbar remove {id}',
    fields: [text('id', 'Boss bar ID', 'newbie:event')]
  },
  {
    id: 'me',
    category: 'Chat & display',
    label: 'Send an emote',
    description: 'Broadcast a /me action.',
    command: 'me {action}',
    fields: [text('action', 'Action', 'waves at everyone')]
  },
  {
    id: 'playsound',
    category: 'Chat & display',
    label: 'Play a sound',
    description: 'Play a sound to a player.',
    command: 'playsound {sound} master {player}',
    fields: [text('sound', 'Sound', 'minecraft:entity.player.levelup', { suggestions: SOUNDS }), player('player', 'Player', '@a')]
  },
  {
    id: 'stopsound',
    category: 'Chat & display',
    label: 'Stop sounds',
    description: 'Stop all sounds for a player.',
    command: 'stopsound {player}',
    fields: [player('player', 'Player', '@a')]
  },

  // Scoreboard & teams
  {
    id: 'scoreboard-objective-add',
    category: 'Scoreboard & teams',
    label: 'Create a scoreboard objective',
    description: 'Create a new objective with a criteria.',
    command: 'scoreboard objectives add {objective} {criteria}',
    fields: [
      text('objective', 'Objective', 'newbie_points'),
      text('criteria', 'Criteria', 'dummy', {
        suggestions: ['dummy', 'deathCount', 'playerKillCount', 'totalKillCount', 'health']
      })
    ]
  },
  {
    id: 'scoreboard-objective-remove',
    category: 'Scoreboard & teams',
    label: 'Remove a scoreboard objective',
    description: 'Delete an objective and its scores.',
    command: 'scoreboard objectives remove {objective}',
    fields: [text('objective', 'Objective', 'newbie_points')]
  },
  {
    id: 'scoreboard-objective-list',
    category: 'Scoreboard & teams',
    label: 'List scoreboard objectives',
    description: 'Print every objective.',
    command: 'scoreboard objectives list'
  },
  {
    id: 'scoreboard-display',
    category: 'Scoreboard & teams',
    label: 'Show an objective',
    description: 'Display an objective in a scoreboard slot.',
    command: 'scoreboard objectives setdisplay {slot} {objective}',
    fields: [select('slot', 'Slot', SCOREBOARD_SLOTS), text('objective', 'Objective', 'newbie_points')]
  },
  {
    id: 'scoreboard-set',
    category: 'Scoreboard & teams',
    label: 'Set a score',
    description: 'Set a player score for an objective.',
    command: 'scoreboard players set {target} {objective} {score}',
    fields: [target(), text('objective', 'Objective', 'newbie_points'), num('score', 'Score', 0)]
  },
  {
    id: 'scoreboard-add',
    category: 'Scoreboard & teams',
    label: 'Add to a score',
    description: 'Increase a player score.',
    command: 'scoreboard players add {target} {objective} {score}',
    fields: [target(), text('objective', 'Objective', 'newbie_points'), num('score', 'Amount', 1, 1)]
  },
  {
    id: 'scoreboard-remove',
    category: 'Scoreboard & teams',
    label: 'Subtract from a score',
    description: 'Decrease a player score.',
    command: 'scoreboard players remove {target} {objective} {score}',
    fields: [target(), text('objective', 'Objective', 'newbie_points'), num('score', 'Amount', 1, 1)]
  },
  {
    id: 'scoreboard-reset',
    category: 'Scoreboard & teams',
    label: 'Reset a score',
    description: 'Reset one score or the whole objective for a target.',
    command: 'scoreboard players reset {target} {objective}',
    fields: [target(), text('objective', 'Objective (optional)', 'newbie_points')]
  },
  {
    id: 'scoreboard-enable',
    category: 'Scoreboard & teams',
    label: 'Enable a trigger objective',
    description: 'Allow a player to trigger a scoreboard objective.',
    command: 'scoreboard players enable {target} {objective}',
    fields: [target(), text('objective', 'Objective', 'newbie_trigger')]
  },
  {
    id: 'scoreboard-operation',
    category: 'Scoreboard & teams',
    label: 'Scoreboard operation',
    description: 'Combine scores between two targets.',
    command: 'scoreboard players operation {target} {objective} {operation} {source} {sourceObjective}',
    fields: [
      target(),
      text('objective', 'Objective', 'newbie_points'),
      select('operation', 'Operation', SCOREBOARD_OPERATIONS),
      text('source', 'Source target', 'Server'),
      text('sourceObjective', 'Source objective', 'newbie_points')
    ]
  },
  {
    id: 'team-add',
    category: 'Scoreboard & teams',
    label: 'Create a team',
    description: 'Create a new scoreboard team.',
    command: 'team add {team}',
    fields: [text('team', 'Team', 'red')]
  },
  {
    id: 'team-remove',
    category: 'Scoreboard & teams',
    label: 'Delete a team',
    description: 'Remove a team and its membership.',
    command: 'team remove {team}',
    fields: [text('team', 'Team', 'red')]
  },
  {
    id: 'team-empty',
    category: 'Scoreboard & teams',
    label: 'Empty a team',
    description: 'Remove every member from a team.',
    command: 'team empty {team}',
    fields: [text('team', 'Team', 'red')]
  },
  {
    id: 'team-leave',
    category: 'Scoreboard & teams',
    label: 'Leave a team',
    description: 'Make players or entities leave their team.',
    command: 'team leave {members}',
    fields: [target('members', 'Members', '@a')]
  },
  {
    id: 'team-list',
    category: 'Scoreboard & teams',
    label: 'List teams',
    description: 'Print teams and their members.',
    command: 'team list {team}',
    fields: [text('team', 'Team (optional)', '')]
  },
  {
    id: 'team-modify',
    category: 'Scoreboard & teams',
    label: 'Change a team option',
    description: 'Set friendly fire, name tag visibility, color and more.',
    command: 'team modify {team} {option} {value}',
    fields: [
      text('team', 'Team', 'red'),
      select('option', 'Option', TEAM_OPTIONS),
      text('value', 'Value', 'true', { placeholder: 'true / false / always / never / red' })
    ]
  },

  // Server admin
  {
    id: 'reload',
    category: 'Server admin',
    label: 'Reload server data',
    description: 'Reload whitelist, ops, bans and datapacks where supported.',
    command: 'reload'
  },
  {
    id: 'tps',
    category: 'Server admin',
    label: 'Show TPS',
    description: 'Paper/Spigot command that samples 1m, 5m and 15m TPS.',
    command: 'tps',
    types: ['paper']
  },
  {
    id: 'mspt',
    category: 'Server admin',
    label: 'Show MSPT',
    description: 'Paper command that reports average tick time.',
    command: 'mspt',
    types: ['paper']
  },
  {
    id: 'plugins',
    category: 'Server admin',
    label: 'List plugins',
    description: 'Paper/Spigot command that lists installed plugins.',
    command: 'plugins',
    types: ['paper']
  },
  {
    id: 'forge-tps',
    category: 'Server admin',
    label: 'Show Forge TPS',
    description: 'Forge command that reports tick time and TPS.',
    command: 'forge tps',
    types: ['forge']
  },
  {
    id: 'neoforge-tps',
    category: 'Server admin',
    label: 'Show NeoForge TPS',
    description: 'NeoForge command that reports tick time and TPS.',
    command: 'neoforge tps',
    types: ['neoforge']
  },
  {
    id: 'spark-tps',
    category: 'Server admin',
    label: 'Spark TPS report',
    description: 'Requires the Spark plugin or mod. Prints a TPS report link.',
    command: 'spark tps'
  },
  {
    id: 'restart',
    category: 'Server admin',
    label: 'Restart the server',
    description: 'Paper command that restarts the server process.',
    command: 'restart',
    types: ['paper'],
    danger: true
  },
  {
    id: 'debug-start',
    category: 'Server admin',
    label: 'Start debug profiling',
    description: 'Start a debug profiling session.',
    command: 'debug start'
  },
  {
    id: 'debug-stop',
    category: 'Server admin',
    label: 'Stop debug profiling',
    description: 'Stop the current debug profiling session.',
    command: 'debug stop'
  },
  {
    id: 'jfr-start',
    category: 'Server admin',
    label: 'Start JFR profile',
    description: 'Start Java Flight Recorder profiling.',
    command: 'jfr start'
  },
  {
    id: 'jfr-stop',
    category: 'Server admin',
    label: 'Stop JFR profile',
    description: 'Stop Java Flight Recorder profiling.',
    command: 'jfr stop'
  },
  {
    id: 'perf-start',
    category: 'Server admin',
    label: 'Start performance profiling',
    description: 'Start a performance profiling session.',
    command: 'perf start'
  },
  {
    id: 'perf-stop',
    category: 'Server admin',
    label: 'Stop performance profiling',
    description: 'Stop the current performance profiling session.',
    command: 'perf stop'
  },

  // Advanced
  {
    id: 'execute-as',
    category: 'Advanced',
    label: 'Run as a target',
    description: 'Run a command with another entity as the executor.',
    command: 'execute as {target} at @s run {command}',
    fields: [target(), text('command', 'Command', 'say Hello from @s')]
  },
  {
    id: 'execute-at',
    category: 'Advanced',
    label: 'Run at a position',
    description: 'Run a command at a target position.',
    command: 'execute at {target} run {command}',
    fields: [target(), text('command', 'Command', 'setblock ~ ~ ~ minecraft:stone')]
  },
  {
    id: 'execute-if-entity',
    category: 'Advanced',
    label: 'Run if entity exists',
    description: 'Run a command only when a target matches.',
    command: 'execute if entity {target} run {command}',
    fields: [target(), text('command', 'Command', 'say A player is online')]
  },
  {
    id: 'execute-if-block',
    category: 'Advanced',
    label: 'Run if block matches',
    description: 'Run a command only when a block is present.',
    command: 'execute if block {position} {block} run {command}',
    fields: [coords(), text('block', 'Block', 'minecraft:stone'), text('command', 'Command', 'say Found the block')]
  },
  {
    id: 'execute-store-score',
    category: 'Advanced',
    label: 'Store command result in score',
    description: 'Save a command result into a scoreboard score.',
    command: 'execute store result score {target} {objective} run {command}',
    fields: [
      target(),
      text('objective', 'Objective', 'newbie_points'),
      text('command', 'Command', 'list')
    ]
  },
  {
    id: 'random-roll',
    category: 'Advanced',
    label: 'Roll a random number',
    description: 'Print a random value in a range.',
    command: 'random value {min}..{max}',
    fields: [num('min', 'Minimum', 1), num('max', 'Maximum', 6)]
  },
  {
    id: 'data-modify-storage',
    category: 'Advanced',
    label: 'Modify command storage',
    description: 'Set an NBT value inside a command storage namespace.',
    command: 'data modify storage {storage} {path} set value {value}',
    fields: [
      text('storage', 'Storage', 'newbie:data'),
      text('path', 'Path', 'message'),
      text('value', 'Value', 'Hello from storage')
    ]
  }
]

const BEDROCK_COMMAND_SNIPPETS: ServerCommandSnippet[] = [
  {
    id: 'bedrock-list',
    category: 'Basics',
    label: 'List online players',
    description: 'Show connected Bedrock players and the player limit.',
    command: 'list'
  },
  {
    id: 'bedrock-say',
    category: 'Chat & display',
    label: 'Broadcast a message',
    description: 'Send a chat message to every player.',
    command: 'say {message}',
    fields: [text('message', 'Message', 'Server restarting soon')]
  },
  {
    id: 'bedrock-difficulty',
    category: 'Basics',
    label: 'Set difficulty',
    description: 'Change the world difficulty.',
    command: 'difficulty {difficulty}',
    fields: [
      select('difficulty', 'Difficulty', [
        { value: 'peaceful', label: 'Peaceful' },
        { value: 'easy', label: 'Easy' },
        { value: 'normal', label: 'Normal' },
        { value: 'hard', label: 'Hard' }
      ])
    ]
  },
  {
    id: 'bedrock-time-set',
    category: 'World',
    label: 'Set time of day',
    description: 'Jump the world to day, noon, night or midnight.',
    command: 'time set {time}',
    fields: [
      select('time', 'Time', [
        { value: 'day', label: 'Day' },
        { value: 'noon', label: 'Noon' },
        { value: 'night', label: 'Night' },
        { value: 'midnight', label: 'Midnight' }
      ])
    ]
  },
  {
    id: 'bedrock-weather',
    category: 'World',
    label: 'Set weather',
    description: 'Clear the sky or start rain/thunder.',
    command: 'weather {weather}',
    fields: [
      select('weather', 'Weather', [
        { value: 'clear', label: 'Clear' },
        { value: 'rain', label: 'Rain' },
        { value: 'thunder', label: 'Thunder' }
      ])
    ]
  },
  {
    id: 'bedrock-gamerule',
    category: 'World',
    label: 'Set a gamerule',
    description: 'Change a Bedrock world rule such as showcoordinates or keepinventory.',
    command: 'gamerule {rule} {value}',
    fields: [
      text('rule', 'Gamerule', 'showcoordinates'),
      select('value', 'Value', [
        { value: 'true', label: 'True' },
        { value: 'false', label: 'False' }
      ])
    ]
  },
  {
    id: 'bedrock-setworldspawn',
    category: 'World',
    label: 'Set world spawn',
    description: 'Move the world spawn point.',
    command: 'setworldspawn {position}',
    fields: [coords()]
  },
  {
    id: 'bedrock-tp',
    category: 'Players',
    label: 'Teleport a player',
    description: 'Teleport a Bedrock player to coordinates.',
    command: 'tp {player} {position}',
    fields: [target('player', 'Player', '@p'), coords()]
  },
  {
    id: 'bedrock-gamemode',
    category: 'Players',
    label: 'Set game mode',
    description: 'Change a player’s game mode.',
    command: 'gamemode {mode} {player}',
    fields: [
      select('mode', 'Game mode', [
        { value: 'survival', label: 'Survival' },
        { value: 'creative', label: 'Creative' },
        { value: 'adventure', label: 'Adventure' },
        { value: 'spectator', label: 'Spectator' }
      ]),
      target('player', 'Player', '@p')
    ]
  },
  {
    id: 'bedrock-give',
    category: 'Blocks & items',
    label: 'Give an item',
    description: 'Give a Bedrock item to a player.',
    command: 'give {player} {item} {amount}',
    fields: [
      target('player', 'Player', '@p'),
      text('item', 'Item', 'diamond'),
      num('amount', 'Amount', 1, 1, 64)
    ]
  },
  {
    id: 'bedrock-clear',
    category: 'Blocks & items',
    label: 'Clear inventory',
    description: 'Remove every item from a player.',
    command: 'clear {player}',
    fields: [target('player', 'Player', '@p')]
  },
  {
    id: 'bedrock-effect',
    category: 'Players',
    label: 'Apply an effect',
    description: 'Give a Bedrock effect for a number of seconds.',
    command: 'effect {player} {effect} {seconds} {amplifier}',
    fields: [
      target('player', 'Player', '@p'),
      text('effect', 'Effect', 'speed'),
      num('seconds', 'Seconds', 30, 1, 1000000),
      num('amplifier', 'Amplifier', 0, 0, 255)
    ]
  },
  {
    id: 'bedrock-op',
    category: 'Moderation',
    label: 'Make a player an operator',
    description: 'Grant operator permissions to a Bedrock player.',
    command: 'op {player}',
    fields: [text('player', 'Player name', '', { required: true })]
  },
  {
    id: 'bedrock-deop',
    category: 'Moderation',
    label: 'Remove operator',
    description: 'Remove operator permissions from a player.',
    command: 'deop {player}',
    fields: [text('player', 'Player name', '', { required: true })]
  },
  {
    id: 'bedrock-permissions',
    category: 'Moderation',
    label: 'Set player permission',
    description: 'Set a player as visitor, member or operator.',
    command: 'permissions set {player} {role}',
    fields: [
      text('player', 'Player name', '', { required: true }),
      select('role', 'Role', [
        { value: 'visitor', label: 'Visitor' },
        { value: 'member', label: 'Member' },
        { value: 'operator', label: 'Operator' }
      ])
    ]
  },
  {
    id: 'bedrock-kick',
    category: 'Moderation',
    label: 'Kick a player',
    description: 'Disconnect a player with a reason.',
    command: 'kick {player} {reason}',
    fields: [
      text('player', 'Player name', '', { required: true }),
      text('reason', 'Reason', 'Kicked by an operator')
    ],
    danger: true
  },
  {
    id: 'bedrock-ban',
    category: 'Moderation',
    label: 'Ban a player',
    description: 'Ban a player from the Bedrock server.',
    command: 'ban {player} {reason}',
    fields: [
      text('player', 'Player name', '', { required: true }),
      text('reason', 'Reason', 'Banned by an operator')
    ],
    danger: true
  },
  {
    id: 'bedrock-pardon',
    category: 'Moderation',
    label: 'Pardon a player',
    description: 'Remove a Bedrock ban.',
    command: 'pardon {player}',
    fields: [text('player', 'Player name', '', { required: true })]
  },
  {
    id: 'bedrock-allowlist-add',
    category: 'Players',
    label: 'Allow a player',
    description: 'Add a player to the Bedrock allow list by gamertag.',
    command: 'allowlist add {player}',
    fields: [text('player', 'Player name', '', { required: true })]
  },
  {
    id: 'bedrock-allowlist-remove',
    category: 'Players',
    label: 'Remove from allow list',
    description: 'Remove a player from the Bedrock allow list.',
    command: 'allowlist remove {player}',
    fields: [text('player', 'Player name', '', { required: true })]
  },
  {
    id: 'bedrock-allowlist-list',
    category: 'Players',
    label: 'Show allow list',
    description: 'Print every player allowed to join.',
    command: 'allowlist list'
  },
  {
    id: 'bedrock-save-hold',
    category: 'Server admin',
    label: 'Save hold',
    description: 'Pause world saving and prepare a consistent backup.',
    command: 'save hold'
  },
  {
    id: 'bedrock-save-query',
    category: 'Server admin',
    label: 'Save query',
    description: 'Show which files are ready while a save is held.',
    command: 'save query'
  },
  {
    id: 'bedrock-save-resume',
    category: 'Server admin',
    label: 'Save resume',
    description: 'Resume world saving after a backup.',
    command: 'save resume'
  },
  {
    id: 'bedrock-changesetting',
    category: 'Server admin',
    label: 'Change a server setting',
    description: 'Apply a Bedrock server.properties setting at runtime.',
    command: 'changesetting {setting} {value}',
    fields: [
      text('setting', 'Setting', 'allow-cheats'),
      text('value', 'Value', 'true')
    ]
  },
  {
    id: 'bedrock-stop',
    category: 'Server admin',
    label: 'Stop the server',
    description: 'Save and shut down the Bedrock server.',
    command: 'stop',
    danger: true
  }
]

export function snippetsForServer(type: ServerType): ServerCommandSnippet[] {
  if (type === 'bedrock') return BEDROCK_COMMAND_SNIPPETS
  return SERVER_COMMAND_SNIPPETS.filter((snippet) => !snippet.types || snippet.types.includes(type))
}

export function renderCommand(
  snippet: ServerCommandSnippet,
  values: Record<string, string>
): string {
  return snippet.command
    .replace(/\{(\w+)\}/g, (_match, key: string) => (values[key] ?? '').trim())
    .replace(/\s+/g, ' ')
    .trim()
}
