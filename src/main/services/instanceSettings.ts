import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Instance } from '@shared/types'
import {
  type CopyInstanceSettingsInput,
  type CopyInstanceSettingsResult,
  type MinecraftSettingCategory
} from '@shared/instanceSettings'
import { store } from './store'
import { isInstanceBusy } from './launch'
import { ensureDir, pathExists, safeJoin } from '../util/fs'
import { logger } from '../util/log'

const VIDEO_KEYS = new Set([
  'ao',
  'attackIndicator',
  'biomeBlendRadius',
  'bobView',
  'chunkSectionFadeInTime',
  'cloudRange',
  'cutoutLeaves',
  'darknessEffectScale',
  'enableVsync',
  'entityDistanceScaling',
  'entityShadows',
  'exclusiveFullscreen',
  'forceUnicodeFont',
  'fov',
  'fovEffectScale',
  'fullscreen',
  'gamma',
  'glDebugVerbosity',
  'glintSpeed',
  'glintStrength',
  'graphicsMode',
  'graphicsPreset',
  'guiScale',
  'hideLightningFlashes',
  'hideSplashTexts',
  'improvedTransparency',
  'inactivityFpsLimit',
  'maxAnisotropyBit',
  'maxFps',
  'mipmapLevels',
  'particles',
  'preferredGraphicsBackend',
  'prioritizeChunkUpdates',
  'renderClouds',
  'renderDistance',
  'screenEffectScale',
  'simulationDistance',
  'textureFiltering',
  'vignette',
  'weatherRadius'
])

const AUDIO_KEYS = new Set(['directionalAudio', 'masterVolume', 'soundDevice'])
const CONTROLS_KEYS = new Set([
  'autoJump',
  'discrete_mouse_scroll',
  'invertXMouse',
  'invertYMouse',
  'mainHand',
  'mouseSensitivity',
  'mouseWheelSensitivity',
  'rawMouseInput',
  'sprintWindow',
  'toggleAttack',
  'toggleCrouch',
  'toggleSprint',
  'toggleUse'
])
const CHAT_KEYS = new Set([
  'advancedItemTooltips',
  'autoSuggestions',
  'backgroundForChatOnly',
  'chatColors',
  'chatHeightFocused',
  'chatHeightUnfocused',
  'chatLineSpacing',
  'chatLinks',
  'chatLinksPrompt',
  'chatOpacity',
  'chatVisibility',
  'chatWidth',
  'hideMatchedNames',
  'hideServerAddress',
  'onlyShowSecureChat',
  'reducedDebugInfo',
  'textBackgroundOpacity'
])
const ACCESSIBILITY_KEYS = new Set([
  'darkMojangStudiosBackground',
  'forceUnicodeFont',
  'highContrast',
  'highContrastBlockOutline',
  'hideBundleTutorial',
  'narrator',
  'narratorHotkey',
  'pauseOnLostFocus',
  'rotateWithMinecart',
  'showSubtitles'
])

/** Categories that only affect options.txt. */
const OPTION_CATEGORIES = new Set<MinecraftSettingCategory>([
  'keybinds',
  'video',
  'audio',
  'controls',
  'chat',
  'accessibility',
  'language',
  'resourcePacks',
  'other'
])

export function categorizeOption(key: string): MinecraftSettingCategory | 'skip' {
  if (key === 'version' || key === 'lastServer') return 'skip'
  if (key.startsWith('key_')) return 'keybinds'
  if (key === 'resourcePacks' || key === 'incompatibleResourcePacks') return 'resourcePacks'
  if (key === 'lang' || key === 'japaneseGlyphVariants') return 'language'
  if (key.startsWith('soundCategory_') || AUDIO_KEYS.has(key)) return 'audio'
  if (key.startsWith('modelPart_') || ACCESSIBILITY_KEYS.has(key)) return 'accessibility'
  if (key.startsWith('chat') || CHAT_KEYS.has(key)) return 'chat'
  if (CONTROLS_KEYS.has(key)) return 'controls'
  if (VIDEO_KEYS.has(key)) return 'video'
  return 'other'
}

export async function copyInstanceSettings(
  input: CopyInstanceSettingsInput
): Promise<CopyInstanceSettingsResult> {
  const source = store.instance(input.sourceId)
  if (!source) throw new Error('Source instance not found')
  const categories = new Set(input.categories)
  if (categories.size === 0) throw new Error('Choose at least one category to copy')

  const targetIds = [...new Set(input.targetIds)].filter((id) => id !== source.id)
  if (targetIds.length === 0) throw new Error('Choose another instance to copy the settings to')
  const targetInstances = targetIds
    .map((id) => store.instance(id))
    .filter((target): target is Instance => Boolean(target))
  if (targetInstances.length === 0) throw new Error('No matching target instances were found')
  if (isInstanceBusy(source.id)) throw new Error(`Close ${source.name} before copying settings`)
  const busyTarget = targetInstances.find((target) => isInstanceBusy(target.id))
  if (busyTarget) throw new Error(`Close ${busyTarget.name} before copying settings`)

  const sourceOptions = await readOptions(source)
  const sourceIris = categories.has('shaders') ? await readIrisConfig(source) : null

  let copiedKeys = 0
  let skippedResourcePacks = 0
  let shaderPacksCopied = 0
  let shaderConfigsCopied = 0
  let targets = 0

  for (const target of targetInstances) {
    const targetOptions = await readOptions(target)
    const merged = new Map(targetOptions)
    let changed = false

    for (const category of categories) {
      if (!OPTION_CATEGORIES.has(category)) continue
      const result = await mergeCategory(merged, sourceOptions, category, target)
      copiedKeys += result.copied
      skippedResourcePacks += result.skippedPacks
      changed = changed || result.changed
    }

    if (changed) {
      await backupOnce(target, 'options.txt')
      await writeOptions(target, merged)
    }

    if (categories.has('shaders') && sourceIris) {
      const copiedConfig = await copyIrisConfig(target, sourceIris)
      if (copiedConfig) shaderConfigsCopied += 1
      if (sourceIris.shaderPack) {
        const copiedPack = await copyShaderPack(source, target, sourceIris.shaderPack)
        if (copiedPack) shaderPacksCopied += 1
      }
    }

    targets += 1
    logger.info(
      'instance-settings',
      `Copied ${[...categories].join(', ')} settings from ${source.name} to ${target.name}`
    )
  }

  return {
    targets,
    copiedKeys,
    skippedResourcePacks,
    shaderPacksCopied,
    shaderConfigsCopied
  }
}
async function mergeCategory(
  target: Map<string, string>,
  source: Map<string, string>,
  category: MinecraftSettingCategory,
  targetInstance: Instance
): Promise<{ copied: number; skippedPacks: number; changed: boolean }> {
  let copied = 0
  let skippedPacks = 0
  let changed = false

  if (category === 'resourcePacks') {
    for (const key of ['resourcePacks', 'incompatibleResourcePacks']) {
      const raw = source.get(key)
      const filtered = await filterResourcePacks(raw, targetInstance)
      skippedPacks += filtered.skipped
      const next = filtered.value
      if (next === undefined) {
        if (target.delete(key)) changed = true
      } else if (target.get(key) !== next) {
        target.set(key, next)
        changed = true
      }
    }
    return { copied, skippedPacks, changed }
  }

  if (category === 'other') {
    // Merge unknown options instead of deleting mod-specific keys from the target.
    for (const [key, value] of source) {
      if (categorizeOption(key) !== 'other') continue
      if (target.get(key) === value) continue
      target.set(key, value)
      changed = true
      copied += 1
    }
    return { copied, skippedPacks, changed }
  }

  // Replace the selected category exactly with the source values.
  for (const key of [...target.keys()]) {
    if (categorizeOption(key) === category) {
      target.delete(key)
      changed = true
    }
  }
  for (const [key, value] of source) {
    if (categorizeOption(key) !== category) continue
    target.set(key, value)
    changed = true
    copied += 1
  }
  return { copied, skippedPacks, changed }
}

async function filterResourcePacks(
  raw: string | undefined,
  target: Instance
): Promise<{ value?: string; skipped: number }> {
  if (raw === undefined) return { value: undefined, skipped: 0 }
  let list: unknown
  try {
    list = JSON.parse(raw)
  } catch {
    return { value: raw, skipped: 0 }
  }
  if (!Array.isArray(list)) return { value: raw, skipped: 0 }

  const kept: string[] = []
  let skipped = 0
  const root = path.join(target.gameDir, 'resourcepacks')
  for (const entry of list) {
    if (typeof entry !== 'string') continue
    if (!entry.startsWith('file/')) {
      kept.push(entry)
      continue
    }
    const name = entry.slice(5)
    let packPath: string
    try {
      packPath = safeJoin(root, name)
    } catch {
      skipped += 1
      continue
    }
    if (await pathExists(packPath)) kept.push(entry)
    else skipped += 1
  }
  return { value: JSON.stringify(kept), skipped }
}

function optionsFile(instance: Instance): string {
  return path.join(instance.gameDir, 'options.txt')
}

function irisFile(instance: Instance): string {
  return path.join(instance.gameDir, 'config', 'iris.properties')
}

async function readOptions(instance: Instance): Promise<Map<string, string>> {
  let text = ''
  try {
    text = await fs.readFile(optionsFile(instance), 'utf8')
  } catch {
    return new Map()
  }
  const map = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf(':')
    if (index > 0) map.set(line.slice(0, index), line.slice(index + 1))
  }
  return map
}

async function writeOptions(instance: Instance, options: Map<string, string>): Promise<void> {
  await ensureDir(instance.gameDir)
  const text = [...options.entries()].map(([key, value]) => `${key}:${value}`).join('\n') + '\n'
  await fs.writeFile(optionsFile(instance), text, 'utf8')
}

async function readIrisConfig(instance: Instance): Promise<{ raw: string; shaderPack?: string } | null> {
  try {
    const raw = await fs.readFile(irisFile(instance), 'utf8')
    const line = raw.split(/\r?\n/).find((entry) => entry.startsWith('shaderPack='))
    const shaderPack = line?.slice('shaderPack='.length).trim() || undefined
    return { raw, shaderPack }
  } catch {
    return null
  }
}

async function copyIrisConfig(
  target: Instance,
  sourceIris: { raw: string; shaderPack?: string }
): Promise<boolean> {
  const targetFile = irisFile(target)
  await ensureDir(path.dirname(targetFile))
  await backupOnce(target, path.join('config', 'iris.properties'))
  await fs.writeFile(targetFile, sourceIris.raw, 'utf8')
  return true
}

async function copyShaderPack(source: Instance, target: Instance, pack: string): Promise<boolean> {
  if (!pack || pack === '(disabled)') return false
  let sourcePath: string
  let targetPath: string
  try {
    sourcePath = safeJoin(path.join(source.gameDir, 'shaderpacks'), pack)
    targetPath = safeJoin(path.join(target.gameDir, 'shaderpacks'), pack)
  } catch {
    return false
  }
  if (!(await pathExists(sourcePath))) return false
  if (await pathExists(targetPath)) return false
  await ensureDir(path.dirname(targetPath))
  const stat = await fs.stat(sourcePath)
  if (stat.isDirectory()) {
    await fs.cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: false })
  } else {
    await fs.copyFile(sourcePath, targetPath)
  }
  return true
}

async function backupOnce(instance: Instance, relative: string): Promise<void> {
  const source = safeJoin(instance.gameDir, relative)
  if (!(await pathExists(source))) return
  const backup = `${source}.newbie-copy.bak`
  if (await pathExists(backup)) return
  await fs.copyFile(source, backup).catch(() => undefined)
}
