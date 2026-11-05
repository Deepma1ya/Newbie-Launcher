import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Instance } from '@shared/types'

const settingsStore = vi.hoisted(() => ({
  instances: new Map<string, Instance>()
}))

vi.mock('@main/services/store', () => ({
  store: {
    instance: (id: string) => settingsStore.instances.get(id) ?? null
  }
}))

vi.mock('@main/services/launch', () => ({
  isInstanceBusy: () => false
}))

import { categorizeOption, copyInstanceSettings } from '@main/services/instanceSettings'

let root = ''
let sourceDir = ''
let targetDir = ''

function makeInstance(id: string, name: string, gameDir: string): Instance {
  const now = new Date().toISOString()
  return {
    id,
    name,
    versionId: '1.20.1',
    resolvedVersionId: '1.20.1',
    loader: 'fabric',
    loaderVersion: '0.15.0',
    color: '#6EE7A0',
    createdAt: now,
    totalPlayTimeSec: 0,
    memoryMb: 4096,
    width: 854,
    height: 480,
    fullscreen: false,
    javaPath: null,
    jvmArgs: '',
    gameDir,
    activeLoadoutId: 'loadout_1',
    loadouts: [
      {
        id: 'loadout_1',
        name: 'Default',
        mode: 'offline',
        addonIds: [],
        createdAt: now,
        updatedAt: now
      }
    ],
    addons: []
  }
}

async function readOptions(gameDir: string): Promise<Map<string, string>> {
  const text = await fs.readFile(path.join(gameDir, 'options.txt'), 'utf8')
  const map = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index > 0) map.set(line.slice(0, index), line.slice(index + 1))
  }
  return map
}

beforeEach(async () => {
  vi.clearAllMocks()
  settingsStore.instances.clear()
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-settings-'))
  sourceDir = path.join(root, 'source')
  targetDir = path.join(root, 'target')
  await fs.mkdir(path.join(sourceDir, 'resourcepacks'), { recursive: true })
  await fs.mkdir(path.join(sourceDir, 'shaderpacks'), { recursive: true })
  await fs.mkdir(path.join(sourceDir, 'config'), { recursive: true })
  await fs.mkdir(path.join(targetDir, 'resourcepacks'), { recursive: true })
  await fs.writeFile(path.join(targetDir, 'resourcepacks', 'Present.zip'), 'pack')

  await fs.writeFile(
    path.join(sourceDir, 'options.txt'),
    [
      'version:5023',
      'key_key.jump:key.keyboard.space',
      'key_key.inventory:key.keyboard.e',
      'renderDistance:16',
      'maxFps:144',
      'soundCategory_master:0.4',
      'mouseSensitivity:0.5',
      'chatOpacity:0.7',
      'narrator:1',
      'lang:en_us',
      'resourcePacks:["vanilla","file/Present.zip","file/Missing.zip"]',
      'incompatibleResourcePacks:[]',
      'lastServer:secret.example',
      'customModOption:true'
    ].join('\n') + '\n',
    'utf8'
  )
  await fs.writeFile(
    path.join(targetDir, 'options.txt'),
    [
      'version:5023',
      'key_key.jump:key.keyboard.j',
      'key_key.old:key.keyboard.o',
      'renderDistance:8',
      'soundCategory_master:1.0',
      'resourcePacks:["vanilla"]',
      'incompatibleResourcePacks:[]',
      'targetOnlyOption:keep'
    ].join('\n') + '\n',
    'utf8'
  )
  await fs.writeFile(
    path.join(sourceDir, 'config', 'iris.properties'),
    'enableShaders=true\nshaderPack=TestShader.zip\n',
    'utf8'
  )
  await fs.writeFile(path.join(sourceDir, 'shaderpacks', 'TestShader.zip'), 'shader')

  settingsStore.instances.set('source', makeInstance('source', 'Source', sourceDir))
  settingsStore.instances.set('target', makeInstance('target', 'Target', targetDir))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('setting categories', () => {
  it('routes options into the right categories', () => {
    expect(categorizeOption('key_key.jump')).toBe('keybinds')
    expect(categorizeOption('renderDistance')).toBe('video')
    expect(categorizeOption('soundCategory_master')).toBe('audio')
    expect(categorizeOption('mouseSensitivity')).toBe('controls')
    expect(categorizeOption('chatOpacity')).toBe('chat')
    expect(categorizeOption('narrator')).toBe('accessibility')
    expect(categorizeOption('lang')).toBe('language')
    expect(categorizeOption('resourcePacks')).toBe('resourcePacks')
    expect(categorizeOption('lastServer')).toBe('skip')
    expect(categorizeOption('version')).toBe('skip')
    expect(categorizeOption('customModOption')).toBe('other')
  })
})

describe('copying Minecraft settings', () => {
  it('copies only the selected categories and filters missing resource packs', async () => {
    const targetBefore = await fs.readFile(path.join(targetDir, 'options.txt'), 'utf8')

    const result = await copyInstanceSettings({
      sourceId: 'source',
      targetIds: ['target'],
      categories: ['keybinds', 'video', 'resourcePacks', 'shaders']
    })

    const options = await readOptions(targetDir)
    expect(options.get('key_key.jump')).toBe('key.keyboard.space')
    expect(options.get('key_key.inventory')).toBe('key.keyboard.e')
    expect(options.has('key_key.old')).toBe(false)
    expect(options.get('renderDistance')).toBe('16')
    expect(options.get('maxFps')).toBe('144')
    expect(options.get('soundCategory_master')).toBe('1.0')
    expect(options.get('resourcePacks')).toBe('["vanilla","file/Present.zip"]')
    expect(options.has('lastServer')).toBe(false)
    expect(options.get('targetOnlyOption')).toBe('keep')
    expect(result).toMatchObject({
      targets: 1,
      copiedKeys: 4,
      skippedResourcePacks: 1,
      shaderPacksCopied: 1,
      shaderConfigsCopied: 1
    })

    const backup = await fs.readFile(
      path.join(targetDir, 'options.txt.newbie-copy.bak'),
      'utf8'
    )
    expect(backup).toBe(targetBefore)
    expect(await fs.readFile(path.join(targetDir, 'config', 'iris.properties'), 'utf8')).toContain(
      'shaderPack=TestShader.zip'
    )
    expect(await fs.readFile(path.join(targetDir, 'shaderpacks', 'TestShader.zip'), 'utf8')).toBe(
      'shader'
    )
  })

  it('can copy the selected settings to every target', async () => {
    const secondDir = path.join(root, 'second')
    await fs.mkdir(secondDir, { recursive: true })
    settingsStore.instances.set('second', makeInstance('second', 'Second', secondDir))

    const result = await copyInstanceSettings({
      sourceId: 'source',
      targetIds: ['target', 'second'],
      categories: ['keybinds', 'video']
    })

    expect(result.targets).toBe(2)
    expect((await readOptions(targetDir)).get('key_key.jump')).toBe('key.keyboard.space')
    expect((await readOptions(secondDir)).get('renderDistance')).toBe('16')
  })

  it('does not copy the source into itself', async () => {
    await expect(
      copyInstanceSettings({
        sourceId: 'source',
        targetIds: ['source'],
        categories: ['keybinds']
      })
    ).rejects.toThrow(/another instance/i)
  })
})
