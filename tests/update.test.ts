import { describe, expect, it } from 'vitest'
import { formatBytes, formatSpeed, parseReleaseNotes, releaseNotesText } from '@shared/update'

describe('update size formatting', () => {
  it('formats byte counts', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(undefined)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(12.5 * 1024 * 1024)).toBe('12.5 MB')
  })

  it('formats download speed', () => {
    expect(formatSpeed(0)).toBe('')
    expect(formatSpeed(undefined)).toBe('')
    expect(formatSpeed(2 * 1024 * 1024)).toBe('2.00 MB/s')
  })
})

describe('update release notes', () => {
  it('normalises a plain release body', () => {
    const notes = releaseNotesText('# 0.1.9\n\n- Built-in updater\n- Release notes\n\n---\n')
    expect(notes).toContain('Built-in updater')
    expect(notes).not.toContain('<')
  })

  it('drops the release title before showing in-app notes', () => {
    const notes = releaseNotesText('# Newbie Launcher 0.1.9\n\n## Added\n\n- Built-in updater')
    expect(notes?.startsWith('## Added')).toBe(true)
  })

  it('joins per-version notes from electron-updater', () => {
    const notes = releaseNotesText([
      { version: '0.2.0', note: '### Added\n\n- Faster installs' },
      { version: '0.1.9', note: '- Polished update panel' }
    ])
    expect(notes).toContain('## Version 0.2.0')
    expect(notes).toContain('Faster installs')
    expect(notes).toContain('## Version 0.1.9')
  })

  it('strips HTML and markdown from GitHub release bodies', () => {
    const notes = releaseNotesText(
      '<p>Hello <strong>world</strong></p><ul><li>One</li><li>Two &amp; three</li></ul>'
    )
    expect(notes).toContain('Hello world')
    expect(notes).toContain('- One')
    expect(notes).toContain('- Two & three')
    expect(notes).not.toContain('<p>')
  })

  it('parses headings, bullets and inline markdown for display', () => {
    const lines = parseReleaseNotes(
      '## Added\n- **Built-in** updater with `progress`\nSee [the release](https://example.com) for details.\n\n\nDone'
    )
    expect(lines[0]).toEqual({ kind: 'heading', text: 'Added' })
    expect(lines[1]).toEqual({ kind: 'bullet', text: 'Built-in updater with progress' })
    expect(lines[2]).toEqual({ kind: 'text', text: 'See the release for details.' })
    expect(lines.filter((line) => line.kind === 'space')).toHaveLength(1)
    expect(lines[lines.length - 1]).toEqual({ kind: 'text', text: 'Done' })
  })

  it('returns no lines for empty notes', () => {
    expect(parseReleaseNotes(undefined)).toEqual([])
    expect(parseReleaseNotes('')).toEqual([])
    expect(releaseNotesText(undefined)).toBeUndefined()
  })
})
