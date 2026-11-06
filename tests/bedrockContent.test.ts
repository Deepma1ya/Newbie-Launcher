import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  countBedrockContent,
  installBedrockArchive,
  removeBedrockContent,
  scanBedrockContent
} from '@main/services/bedrockContent'

const source = {
  provider: 'mcpedl' as const,
  slug: 'test-pack',
  title: 'Test pack',
  url: 'https://mcpedl.com/test-pack/'
}

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-bedrock-content-'))
  await fs.mkdir(root, { recursive: true })
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true }).catch(() => undefined)
})

function manifest(name: string, uuid: string, type: string): string {
  return JSON.stringify({
    format_version: 2,
    header: { name, uuid, version: [1, 2, 3] },
    modules: [{ type, uuid: `${uuid}-module`, version: [1, 2, 3] }]
  })
}

describe('Bedrock content archives', () => {
  it('installs resource and behavior packs from one .mcaddon', async () => {
    const zip = new AdmZip()
    zip.addFile(
      'Cool Pack/manifest.json',
      Buffer.from(manifest('§d§lCool Pack', '11111111-1111-1111-1111-111111111111', 'resources'))
    )
    zip.addFile('Cool Pack/pack_icon.png', Buffer.from('png'))
    zip.addFile(
      'Cool Behavior/manifest.json',
      Buffer.from(manifest('Cool Behavior', '22222222-2222-2222-2222-222222222222', 'data'))
    )
    zip.addFile('Cool Behavior/functions/tick.json', Buffer.from('{}'))

    const result = await installBedrockArchive(root, zip.toBuffer(), source, {
      filename: 'cool.mcaddon'
    })

    expect(result.installed).toHaveLength(2)
    expect(result.installed.map((item) => item.kind).sort()).toEqual([
      'behaviorpack',
      'resourcepack'
    ])
    const names = result.installed.map((item) => item.name)
    expect(names).toContain('Cool Pack')
    expect(names).not.toContain('§d§lCool Pack')

    const content = await scanBedrockContent(root)
    expect(content).toHaveLength(2)
    expect(content.some((item) => item.kind === 'resourcepack' && item.name === 'Cool Pack')).toBe(
      true
    )
    expect(
      content.some((item) => item.kind === 'behaviorpack' && item.name === 'Cool Behavior')
    ).toBe(true)
    expect(await countBedrockContent(root)).toEqual({ contentCount: 2, worldCount: 0 })
  })

  it('installs a world archive and reports world counts', async () => {
    const zip = new AdmZip()
    zip.addFile('level.dat', Buffer.from('level'))
    zip.addFile('levelname.txt', Buffer.from('Skyblock'))
    zip.addFile('db/000001.ldb', Buffer.from('db'))

    const result = await installBedrockArchive(root, zip.toBuffer(), source, {
      filename: 'skyblock.mcworld'
    })

    expect(result.installed).toHaveLength(1)
    expect(result.installed[0]?.kind).toBe('world')
    expect(result.installed[0]?.name).toBe('Test pack')
    expect(await countBedrockContent(root)).toEqual({ contentCount: 0, worldCount: 1 })
  })

  it('removes installed content by id', async () => {
    const zip = new AdmZip()
    zip.addFile(
      'Pack/manifest.json',
      Buffer.from(manifest('Pack', '33333333-3333-3333-3333-333333333333', 'resources'))
    )
    const result = await installBedrockArchive(root, zip.toBuffer(), source, {
      filename: 'pack.mcpack'
    })
    const id = result.installed[0]!.id
    const remaining = await removeBedrockContent(root, id)
    expect(remaining).toHaveLength(0)
  })

  it('rejects archives with no Bedrock content', async () => {
    const zip = new AdmZip()
    zip.addFile('readme.txt', Buffer.from('nothing here'))
    await expect(
      installBedrockArchive(root, zip.toBuffer(), source, { filename: 'empty.zip' })
    ).rejects.toThrow(/does not contain/i)
  })
})
