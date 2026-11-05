import { afterEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  preservePackageData,
  restorePreservedData,
  type PreservedPackageData
} from '@main/services/bedrockData'

const roots: string[] = []

async function tempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-bedrock-data-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('Bedrock package data preservation', () => {
  it('moves LocalState and RoamingState aside and restores them', async () => {
    const root = await tempRoot()
    const familyName = 'Microsoft.MinecraftUWP_8wekyb3d8bbwe'
    const packageRoot = path.join(root, 'Packages', familyName)
    const world = path.join(
      packageRoot,
      'LocalState',
      'games',
      'com.mojang',
      'minecraftWorlds',
      'world',
      'level.dat'
    )
    const settings = path.join(packageRoot, 'RoamingState', 'settings.json')
    await fs.mkdir(path.dirname(world), { recursive: true })
    await fs.mkdir(path.dirname(settings), { recursive: true })
    await fs.writeFile(world, 'world-data')
    await fs.writeFile(settings, 'settings-data')

    const preserved = await preservePackageData(root, { familyName, channel: 'release' })
    expect(preserved).toHaveLength(2)
    await expect(fs.access(path.join(packageRoot, 'LocalState'))).rejects.toThrow()
    await expect(fs.access(path.join(packageRoot, 'RoamingState'))).rejects.toThrow()

    await restorePreservedData(preserved)
    expect(await fs.readFile(world, 'utf8')).toBe('world-data')
    expect(await fs.readFile(settings, 'utf8')).toBe('settings-data')
  })

  it('replaces a package data folder recreated during removal', async () => {
    const root = await tempRoot()
    const familyName = 'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe'
    const packageRoot = path.join(root, 'Packages', familyName)
    const level = path.join(packageRoot, 'LocalState', 'games', 'com.mojang', 'minecraftWorlds', 'w', 'level.dat')
    await fs.mkdir(path.dirname(level), { recursive: true })
    await fs.writeFile(level, 'saved-world')

    const preserved = await preservePackageData(root, { familyName, channel: 'preview' })
    await fs.mkdir(path.join(packageRoot, 'LocalState'), { recursive: true })
    await fs.writeFile(path.join(packageRoot, 'LocalState', 'stale.txt'), 'stale')

    await restorePreservedData(preserved)
    expect(await fs.readFile(level, 'utf8')).toBe('saved-world')
    await expect(fs.access(path.join(packageRoot, 'LocalState', 'stale.txt'))).rejects.toThrow()
  })

  it('returns an empty list when the package has no data yet', async () => {
    const root = await tempRoot()
    const preserved = await preservePackageData(root, {
      familyName: 'Microsoft.MinecraftUWP_8wekyb3d8bbwe',
      channel: 'release'
    })
    expect(preserved).toEqual([])
  })

  it('exports preserved paths for diagnostics', async () => {
    const root = await tempRoot()
    const familyName = 'Microsoft.MinecraftUWP_8wekyb3d8bbwe'
    const packageRoot = path.join(root, 'Packages', familyName)
    await fs.mkdir(path.join(packageRoot, 'LocalState'), { recursive: true })
    const preserved: PreservedPackageData[] = await preservePackageData(root, {
      familyName,
      channel: 'release'
    })
    expect(preserved[0]?.source.endsWith('LocalState')).toBe(true)
    expect(preserved[0]?.backup).toContain('bedrock-uninstall')
  })
})
