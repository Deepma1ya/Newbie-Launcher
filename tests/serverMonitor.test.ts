import { describe, expect, it } from 'vitest'
import { parseServerPlayers, parseServerTps } from '@shared/serverMonitor'

describe('server console stats parsing', () => {
  it('parses Paper TPS output and strips colour codes', () => {
    expect(
      parseServerTps([
        '[12:00:00] [Server thread/INFO]: §6TPS from last 1m, 5m, 15m: §a20.0, §a19.8, §a19.5'
      ])
    ).toEqual({ tps: 19.5, tps1m: 20, tps5m: 19.8, tps15m: 19.5 })
  })

  it('parses Forge overall tick time and TPS', () => {
    const result = parseServerTps([
      '[12:00:00] [Server thread/INFO]: Dim minecraft:overworld: Mean tick time: 8.2 ms. Mean TPS: 20.000',
      '[12:00:00] [Server thread/INFO]: Overall: Mean tick time: 9.6 ms. Mean TPS: 18.750'
    ])
    expect(result?.tps).toBe(18.75)
    expect(result?.mspt).toBe(9.6)
  })

  it('parses generic TPS and current TPS lines', () => {
    expect(parseServerTps(['Current TPS: 17.3'])?.tps).toBe(17.3)
    expect(parseServerTps(['TPS: 19.9'])?.tps).toBe(19.9)
  })

  it('parses the online player list and maximum', () => {
    expect(
      parseServerPlayers([
        '[12:00:00] [Server thread/INFO]: There are 2 of a max of 20 players online: Alice, Bob'
      ])
    ).toEqual({ players: ['Alice', 'Bob'], maxPlayers: 20 })
    expect(
      parseServerPlayers(['There are 0 of a max of 10 players online:'])
    ).toEqual({ players: [], maxPlayers: 10 })
  })

  it('returns null when no stats line is present', () => {
    expect(parseServerTps(['Done (1.234s)! For help, type "help"'])).toBeNull()
    expect(parseServerPlayers(['Starting minecraft server version 1.21.1'])).toBeNull()
  })
})
