import { describe, expect, it } from 'vitest'
import { parseBoreAddress } from '@main/services/boreRelay'
import { playitTunnelAddress } from '@main/services/playit'

describe('internet relay addresses', () => {
  it('parses the bore.pub address with ANSI logging', () => {
    const output = [
      '\u001b[2m2026-11-06T04:25:35Z\u001b[0m \u001b[32m INFO\u001b[0m connected',
      '\u001b[2m2026-11-06T04:25:35Z\u001b[0m \u001b[32m INFO\u001b[0m listening at bore.pub:61571'
    ].join('\n')
    expect(parseBoreAddress(output)).toBe('bore.pub:61571')
    expect(parseBoreAddress('listening at bore.pub:0')).toBeNull()
    expect(parseBoreAddress('not connected')).toBeNull()
  })

  it('uses playit SRV for Java and host:port for Bedrock', () => {
    expect(
      playitTunnelAddress('tcp', {
        status: 'allocated',
        data: { assigned_domain: 'example.playit.gg', assigned_srv: 'java.example.gg', port_start: 25565 }
      })
    ).toBe('java.example.gg')
    expect(
      playitTunnelAddress('udp', {
        status: 'allocated',
        data: { assigned_domain: 'bedrock.playit.gg', assigned_srv: null, port_start: 19132 }
      })
    ).toBe('bedrock.playit.gg:19132')
    expect(
      playitTunnelAddress('tcp', {
        status: 'allocated',
        data: { assigned_domain: 'example.playit.gg', assigned_srv: null, port_start: 25565 }
      })
    ).toBe('example.playit.gg:25565')
    expect(playitTunnelAddress('tcp', { status: 'pending' })).toBeNull()
  })
})
