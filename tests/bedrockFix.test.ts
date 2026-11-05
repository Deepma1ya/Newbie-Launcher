import { describe, expect, it } from 'vitest'
import { isFixFilePending, isIgnoredFixEntry, normalizeFixRelativePath } from '@shared/bedrockFix'

describe('Bedrock fix paths', () => {
  it('normalises nested Windows paths to forward slashes', () => {
    expect(normalizeFixRelativePath('mods\\renderer\\d3d11.dll')).toBe('mods/renderer/d3d11.dll')
    expect(normalizeFixRelativePath('./mods//extra.dll')).toBe('mods/extra.dll')
  })

  it('rejects paths that could escape the fix folder', () => {
    expect(normalizeFixRelativePath('..\\outside.dll')).toBeNull()
    expect(normalizeFixRelativePath('mods\\..\\..\\outside.dll')).toBeNull()
    expect(normalizeFixRelativePath('C:\\Windows\\System32\\evil.dll')).toBeNull()
    expect(normalizeFixRelativePath('\\\\server\\share\\evil.dll')).toBeNull()
    expect(normalizeFixRelativePath('')).toBeNull()
  })

  it('rejects invalid Windows names', () => {
    expect(normalizeFixRelativePath('mods/invalid?.dll')).toBeNull()
    expect(normalizeFixRelativePath('mods/trailing.')).toBeNull()
  })

  it('ignores operating-system droppings and partial downloads', () => {
    expect(isIgnoredFixEntry('Thumbs.db')).toBe(true)
    expect(isIgnoredFixEntry('desktop.ini')).toBe(true)
    expect(isIgnoredFixEntry('.DS_Store')).toBe(true)
    expect(isIgnoredFixEntry('.gitkeep')).toBe(true)
    expect(isIgnoredFixEntry('~$document.docx')).toBe(true)
    expect(isIgnoredFixEntry('download.part')).toBe(true)
    expect(isIgnoredFixEntry('d3d11.dll')).toBe(false)
  })
})

describe('Bedrock fix pending files', () => {
  const file = { path: 'mods/d3d11.dll', size: 512, mtimeMs: 1000 }

  it('copies new files and files that changed on disk', () => {
    expect(isFixFilePending(file, undefined, 512)).toBe(true)
    expect(isFixFilePending(file, { size: 512, mtimeMs: 999 }, 512)).toBe(true)
    expect(isFixFilePending(file, { size: 511, mtimeMs: 1000 }, 512)).toBe(true)
  })

  it('copies files missing from the game folder', () => {
    expect(isFixFilePending(file, { size: 512, mtimeMs: 1000 }, null)).toBe(true)
    expect(isFixFilePending(file, { size: 512, mtimeMs: 1000 }, 511)).toBe(true)
  })

  it('skips files already copied and unchanged', () => {
    expect(isFixFilePending(file, { size: 512, mtimeMs: 1000 }, 512)).toBe(false)
  })

  it('trusts the manifest when the package folder cannot be inspected', () => {
    expect(isFixFilePending(file, { size: 512, mtimeMs: 1000 }, undefined)).toBe(false)
    expect(isFixFilePending(file, undefined, undefined)).toBe(true)
  })
})
