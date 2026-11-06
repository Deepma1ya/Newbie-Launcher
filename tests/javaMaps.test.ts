import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractJavaMapArchive } from '@main/services/javaMaps'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-java-map-'))
  await fs.mkdir(path.join(root, 'game'), { recursive: true })
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true }).catch(() => undefined)
})

describe('Java map archives', () => {
  it('unpacks a nested world into saves using its level name', async () => {
    const zip = new AdmZip()
    zip.addFile('My Map/level.dat', Buffer.from('level'))
    zip.addFile('My Map/levelname.txt', Buffer.from('Skyblock'))
    zip.addFile('My Map/region/r.0.0.mca', Buffer.from('region'))
    const archive = path.join(root, 'map.zip')
    zip.writeZip(archive)

    const result = await extractJavaMapArchive(path.join(root, 'game'), archive, 'My Map')
    expect(result.folder).toBe('Skyblock')
    expect(result.name).toBe('Skyblock')
    expect(result.files).toBe(3)
    expect(await fs.readFile(path.join(result.path, 'level.dat'), 'utf8')).toBe('level')
    expect(await fs.readFile(path.join(result.path, 'region', 'r.0.0.mca'), 'utf8')).toBe('region')
  })

  it('unpacks a root-level world and makes duplicate folder names unique', async () => {
    const zip = new AdmZip()
    zip.addFile('level.dat', Buffer.from('level'))
    zip.addFile('data/level.dat', Buffer.from('wrong nested level'))
    const archive = path.join(root, 'root-map.zip')
    zip.writeZip(archive)

    const first = await extractJavaMapArchive(path.join(root, 'game'), archive, 'Root Map')
    const second = await extractJavaMapArchive(path.join(root, 'game'), archive, 'Root Map')
    expect(first.folder).toBe('Root Map')
    expect(second.folder).toBe('Root Map (2)')
    expect(await fs.readFile(path.join(first.path, 'level.dat'), 'utf8')).toBe('level')
  })

  it('rejects archives without a Java world', async () => {
    const zip = new AdmZip()
    zip.addFile('readme.txt', Buffer.from('nothing here'))
    const archive = path.join(root, 'empty.zip')
    zip.writeZip(archive)
    await expect(
      extractJavaMapArchive(path.join(root, 'game'), archive, 'Empty')
    ).rejects.toThrow(/does not contain a Java world/i)
  })
})
