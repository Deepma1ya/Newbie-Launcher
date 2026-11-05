import { describe, expect, it } from 'vitest'
import { isLocalHost, normaliseAddress } from '@main/services/serverShare'

describe('server share address handling', () => {
  it('cleans tunnel and URL prefixes', () => {
    expect(normaliseAddress('tcp://example.com:25565')).toBe('example.com:25565')
    expect(normaliseAddress('https://play.example.com/path')).toBe('play.example.com')
    expect(normaliseAddress('  192.168.1.4:25565  ')).toBe('192.168.1.4:25565')
  })

  it('rejects malformed addresses and ports', () => {
    expect(normaliseAddress('not a host')).toBeNull()
    expect(normaliseAddress('example.com:0')).toBeNull()
    expect(normaliseAddress('example.com:70000')).toBeNull()
    expect(normaliseAddress('')).toBeNull()
  })

  it('recognises LAN, loopback, CGNAT and Radmin ranges', () => {
    expect(isLocalHost('localhost')).toBe(true)
    expect(isLocalHost('127.0.0.1')).toBe(true)
    expect(isLocalHost('192.168.1.20')).toBe(true)
    expect(isLocalHost('10.0.0.5')).toBe(true)
    expect(isLocalHost('172.20.1.2')).toBe(true)
    expect(isLocalHost('100.64.0.1')).toBe(true)
    expect(isLocalHost('26.81.169.130')).toBe(true)
    expect(isLocalHost('playit.gg')).toBe(false)
    expect(isLocalHost('103.220.16.162')).toBe(false)
  })
})
