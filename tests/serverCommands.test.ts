import { describe, expect, it } from 'vitest'
import {
  SERVER_COMMAND_SNIPPETS,
  renderCommand,
  snippetsForServer
} from '@shared/serverCommands'

describe('server command snippets', () => {
  it('renders fields into a command template', () => {
    const give = SERVER_COMMAND_SNIPPETS.find((snippet) => snippet.id === 'give')!
    expect(renderCommand(give, { player: 'Alex', item: 'minecraft:diamond', count: '16' })).toBe(
      'give Alex minecraft:diamond 16'
    )
  })

  it('collapses empty optional fields and whitespace', () => {
    const ban = SERVER_COMMAND_SNIPPETS.find((snippet) => snippet.id === 'ban')!
    expect(renderCommand(ban, { player: 'Alex', reason: '' })).toBe('ban Alex')
  })

  it('filters Paper-only and Forge-only commands by server type', () => {
    expect(snippetsForServer('paper').some((snippet) => snippet.id === 'tps')).toBe(true)
    expect(snippetsForServer('vanilla').some((snippet) => snippet.id === 'tps')).toBe(false)
    expect(snippetsForServer('forge').some((snippet) => snippet.id === 'forge-tps')).toBe(true)
    expect(snippetsForServer('paper').some((snippet) => snippet.id === 'forge-tps')).toBe(false)
  })

  it('uses Bedrock-specific commands for Bedrock servers', () => {
    const bedrock = snippetsForServer('bedrock')
    expect(bedrock.some((snippet) => snippet.id === 'bedrock-allowlist-add')).toBe(true)
    expect(bedrock.some((snippet) => snippet.id === 'bedrock-save-hold')).toBe(true)
    expect(bedrock.some((snippet) => snippet.id === 'bedrock-changesetting')).toBe(true)
    expect(bedrock.some((snippet) => snippet.id === 'tps')).toBe(false)
    expect(bedrock.some((snippet) => snippet.id === 'whitelist-add')).toBe(false)
    for (const snippet of bedrock) {
      for (const field of snippet.fields ?? []) {
        expect(snippet.command).toContain(`{${field.key}}`)
      }
    }
  })

  it('keeps every snippet id unique and every required field present', () => {
    const ids = new Set<string>()
    for (const snippet of SERVER_COMMAND_SNIPPETS) {
      expect(ids.has(snippet.id)).toBe(false)
      ids.add(snippet.id)
      for (const field of snippet.fields ?? []) {
        expect(snippet.command).toContain(`{${field.key}}`)
      }
    }
  })
})
