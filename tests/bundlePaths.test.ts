import { afterEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveBundleDir } from '@main/services/bundlePaths'

const roots: string[] = []

async function tempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'newbie-bundle-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('bundle directory resolution', () => {
  it('finds out/renderer from a chunked main process', async () => {
    const root = await tempRoot()
    await fs.mkdir(path.join(root, 'out', 'renderer'), { recursive: true })
    await fs.writeFile(path.join(root, 'out', 'renderer', 'index.html'), '')
    expect(
      resolveBundleDir([
        path.join(root, 'out', 'main', 'chunks'),
        path.join(root, 'out', 'main'),
        root
      ])
    ).toBe(path.join(root, 'out'))
  })

  it('finds the bundled renderer inside a packaged app directory', async () => {
    const root = await tempRoot()
    await fs.mkdir(path.join(root, 'package', 'out', 'renderer'), { recursive: true })
    await fs.writeFile(path.join(root, 'package', 'out', 'renderer', 'index.html'), '')
    expect(resolveBundleDir([path.join(root, 'package')])).toBe(
      path.join(root, 'package', 'out')
    )
  })

  it('returns null when no renderer bundle exists', async () => {
    const root = await tempRoot()
    expect(resolveBundleDir([root])).toBeNull()
  })
})
