import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import Jimp from 'jimp'
import { describe, expect, it } from 'vitest'
import type { AuthAccount, Instance } from '@shared/types'
import { applyOfflineSkin, normalizeSkinImage, packFormatForVersion } from '@main/services/skins'

async function pngBuffer(size = 64): Promise<Buffer> {
  const image = new Jimp(size, size, 0x4fa96bff)
  return image.getBufferAsync(Jimp.MIME_PNG)
}

describe('offline skin image normalization', () => {
  it('keeps a 64x64 skin layout at 64x64', async () => {
    const png = await normalizeSkinImage(await pngBuffer(64))
    const image = await Jimp.read(png)
    expect(image.bitmap.width).toBe(64)
    expect(image.bitmap.height).toBe(64)
  })

  it('downscales an HD 128x64 skin to 64x32', async () => {
    const source = new Jimp(128, 64, 0x4fa96bff)
    const png = await normalizeSkinImage(await source.getBufferAsync(Jimp.MIME_PNG))
    const image = await Jimp.read(png)
    expect(image.bitmap.width).toBe(64)
    expect(image.bitmap.height).toBe(32)
  })

  it('generates a skin from an arbitrary square image', async () => {
    const source = new Jimp(512, 512, 0xd14d64ff)
    const png = await normalizeSkinImage(await source.getBufferAsync(Jimp.MIME_PNG))
    const image = await Jimp.read(png)
    expect(image.bitmap.width).toBe(64)
    expect(image.bitmap.height).toBe(64)
  })
})

describe('resource pack format', () => {
  it('maps common versions', () => {
    expect(packFormatForVersion('1.20.1')).toBe(15)
    expect(packFormatForVersion('1.20.2')).toBe(18)
    expect(packFormatForVersion('1.21.1')).toBe(34)
    expect(packFormatForVersion('1.21.4')).toBe(46)
  })
})

describe('offline skin resource pack', () => {
  it('writes the pack and enables it, then removes it again', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-skin-'))
    const gameDir = path.join(root, 'minecraft')
    await fs.mkdir(gameDir, { recursive: true })
    const instance = {
      id: 'skin-test',
      name: 'Skin Test',
      versionId: '1.20.1',
      gameDir
    } as unknown as Instance
    const normalized = await normalizeSkinImage(await pngBuffer(64))
    const account: AuthAccount = {
      id: 'offline_skin_test',
      type: 'offline',
      username: 'SkinTester',
      uuid: '00000000-0000-3000-8000-000000000001',
      active: true,
      createdAt: new Date().toISOString(),
      skinUrl: `data:image/png;base64,${normalized.toString('base64')}`
    }

    await applyOfflineSkin(instance, account)
    const options = await fs.readFile(path.join(gameDir, 'options.txt'), 'utf8')
    expect(options).toContain('resourcePacks:["file/NewbieSkin-offline_skin_test.zip"]')
    expect(options).toContain('incompatibleResourcePacks:["file/NewbieSkin-offline_skin_test.zip"]')

    const packs = await fs.readdir(path.join(gameDir, 'resourcepacks'))
    expect(packs).toEqual(['NewbieSkin-offline_skin_test.zip'])
    const zip = new AdmZip(path.join(gameDir, 'resourcepacks', packs[0]!))
    const names = zip.getEntries().map((entry) => entry.entryName)
    expect(names).toContain('pack.mcmeta')
    expect(names).toContain('assets/minecraft/textures/entity/steve.png')
    expect(names).toContain('assets/minecraft/textures/entity/player/wide/steve.png')

    await applyOfflineSkin(instance, { ...account, skinUrl: undefined })
    const packsAfter = await fs.readdir(path.join(gameDir, 'resourcepacks'))
    expect(packsAfter).toEqual([])
    const optionsAfter = await fs.readFile(path.join(gameDir, 'options.txt'), 'utf8')
    expect(optionsAfter).not.toContain('NewbieSkin-')

    await fs.rm(root, { recursive: true, force: true })
  })
})
