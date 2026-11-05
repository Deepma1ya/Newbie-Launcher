export type MinecraftSettingCategory =
  | 'keybinds'
  | 'video'
  | 'audio'
  | 'controls'
  | 'chat'
  | 'accessibility'
  | 'language'
  | 'resourcePacks'
  | 'shaders'
  | 'other'

export interface MinecraftSettingCategoryInfo {
  id: MinecraftSettingCategory
  label: string
  description: string
}

export const MINECRAFT_SETTING_CATEGORIES: MinecraftSettingCategoryInfo[] = [
  {
    id: 'keybinds',
    label: 'Keybinds',
    description: 'Movement, hotbar, inventory and action keys.'
  },
  {
    id: 'video',
    label: 'Video & graphics',
    description: 'Render distance, FPS, graphics mode, clouds, particles and brightness.'
  },
  {
    id: 'audio',
    label: 'Audio',
    description: 'Master volume, music and per-category sound levels.'
  },
  {
    id: 'controls',
    label: 'Controls',
    description: 'Mouse sensitivity, sprint/crouch toggles and auto-jump.'
  },
  {
    id: 'chat',
    label: 'Chat & social',
    description: 'Chat visibility, opacity, links and secure-chat options.'
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Narrator, subtitles, contrast, skin parts and focus behaviour.'
  },
  {
    id: 'language',
    label: 'Language',
    description: 'The selected in-game language.'
  },
  {
    id: 'resourcePacks',
    label: 'Resource pack order',
    description: 'Enabled packs and their order. Missing pack files are skipped.'
  },
  {
    id: 'shaders',
    label: 'Shaders',
    description: 'Iris shader selection and settings, plus the selected shader pack.'
  },
  {
    id: 'other',
    label: 'Other options',
    description: 'Any remaining options.txt settings that are not in another category.'
  }
]

export const DEFAULT_COPY_CATEGORIES: MinecraftSettingCategory[] = MINECRAFT_SETTING_CATEGORIES.map(
  (category) => category.id
)

export interface CopyInstanceSettingsInput {
  sourceId: string
  targetIds: string[]
  categories: MinecraftSettingCategory[]
}

export interface CopyInstanceSettingsResult {
  targets: number
  copiedKeys: number
  skippedResourcePacks: number
  shaderPacksCopied: number
  shaderConfigsCopied: number
}
