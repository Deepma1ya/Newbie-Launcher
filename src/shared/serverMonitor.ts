export interface ServerTpsSample {
  tps?: number
  tps1m?: number
  tps5m?: number
  tps15m?: number
  mspt?: number
}

export interface ServerPlayersSample {
  players: string[]
  maxPlayers?: number
}

export function cleanServerLine(line: string): string {
  return line
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/§[0-9a-fk-orx]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseServerPlayers(lines: string[]): ServerPlayersSample | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = cleanServerLine(lines[index] ?? '')
    const match = /There are (\d+) of a max(?: of)? (\d+) players online:?\s*(.*)$/i.exec(line)
    if (!match) continue
    const listed = (match[3] ?? '')
      .replace(/\.$/, '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => /^[A-Za-z0-9_]{1,16}$/.test(name))
    return {
      players: [...new Set(listed)],
      maxPlayers: Number(match[2])
    }
  }
  return null
}

export function parseServerTps(lines: string[]): ServerTpsSample | null {
  const cleaned = lines.map(cleanServerLine)
  for (let index = cleaned.length - 1; index >= 0; index -= 1) {
    const line = cleaned[index] ?? ''
    const paper =
      /TPS from last 1m,\s*5m,\s*15m:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/i.exec(line)
    if (paper) {
      return {
        tps: Number(paper[3]),
        tps1m: Number(paper[1]),
        tps5m: Number(paper[2]),
        tps15m: Number(paper[3])
      }
    }
  }

  const overall = cleaned.filter((line) => /overall/i.test(line) && /mean tps/i.test(line))
  const forgeLines = overall.length > 0 ? overall : cleaned
  for (let index = forgeLines.length - 1; index >= 0; index -= 1) {
    const line = forgeLines[index] ?? ''
    const tps = /Mean TPS:\s*([\d.]+)/i.exec(line)
    if (!tps) continue
    const tick = /Mean tick time:\s*([\d.]+)\s*ms/i.exec(line)
    return {
      tps: Number(tps[1]),
      mspt: tick ? Number(tick[1]) : undefined
    }
  }

  for (let index = cleaned.length - 1; index >= 0; index -= 1) {
    const line = cleaned[index] ?? ''
    if (/from last/i.test(line)) continue
    const current = /Current TPS:\s*([\d.]+)/i.exec(line)
    if (current) return { tps: Number(current[1]) }
    const tps = /\bTPS:\s*([\d.]+)/i.exec(line)
    if (tps) return { tps: Number(tps[1]) }
  }
  return null
}
