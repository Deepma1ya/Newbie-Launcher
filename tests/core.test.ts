import { describe, expect, it } from 'vitest'
import type { VersionJson } from '@main/services/mojang'
import { mergeVersionJson, rulesAllow, type Rule } from '@main/services/mojang'
import {
  buildArguments,
  buildClasspath,
  splitJvmArgs,
  substitute,
  tokenise
} from '@main/services/launchArgs'
import { parseJavaVersion } from '@main/services/java'
import { offlineUuid, sha1Buffer } from '@main/util/hash'
import { formatBytes, safeJoin, sanitizeFilename } from '@main/util/fs'
import { isPackCompatible } from '@shared/packCompatibility'

const baseVersion: VersionJson = {
  id: '1.20.1',
  type: 'release',
  mainClass: 'net.minecraft.client.main.Main',
  assets: '5',
  assetIndex: {
    id: '5',
    sha1: 'abc',
    size: 10,
    url: 'https://example.invalid/assets.json'
  },
  downloads: {
    client: { url: 'https://example.invalid/client.jar', sha1: 'def', size: 100 }
  },
  libraries: [
    { name: 'com.example:alpha:1.0', downloads: { artifact: { path: 'com/example/alpha/1.0/alpha-1.0.jar', url: 'https://example.invalid/a.jar', sha1: 'a', size: 1 } } },
    { name: 'com.example:beta:1.0', downloads: { artifact: { path: 'com/example/beta/1.0/beta-1.0.jar', url: 'https://example.invalid/b.jar', sha1: 'b', size: 1 } } }
  ],
  arguments: {
    game: ['--username', '${auth_player_name}', '--version', '${version_name}'],
    jvm: ['-Dfoo=${launcher_name}']
  },
  javaVersion: { component: 'java-runtime-gamma', majorVersion: 17 }
}

const childVersion: VersionJson = {
  id: 'fabric-loader-0.15.0-1.20.1',
  type: 'release',
  inheritsFrom: '1.20.1',
  mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
  libraries: [
    { name: 'net.fabricmc:fabric-loader:0.15.0', downloads: { artifact: { path: 'net/fabricmc/fabric-loader/0.15.0/fabric-loader-0.15.0.jar', url: 'https://example.invalid/f.jar', sha1: 'f', size: 1 } } },
    { name: 'com.example:alpha:1.0', downloads: { artifact: { path: 'com/example/alpha/1.0/alpha-1.0.jar', url: 'https://example.invalid/a.jar', sha1: 'a', size: 1 } } }
  ],
  arguments: { game: ['--launchTarget', 'fabricclient'] }
}

describe('version merge', () => {
  it('inherits main class, libraries and arguments', () => {
    const merged = mergeVersionJson(baseVersion, childVersion)
    expect(merged.mainClass).toBe('net.fabricmc.loader.impl.launch.knot.KnotClient')
    expect(merged.javaVersion?.majorVersion).toBe(17)
    expect(merged.libraries).toHaveLength(3)
    expect(merged.arguments?.game).toEqual([
      '--username',
      '${auth_player_name}',
      '--version',
      '${version_name}',
      '--launchTarget',
      'fabricclient'
    ])
    expect(merged.assetIndex?.id).toBe('5')
  })

  it('keeps the child version id', () => {
    expect(mergeVersionJson(baseVersion, childVersion).id).toBe('fabric-loader-0.15.0-1.20.1')
  })
})

describe('rules', () => {
  const context = {
    osName: 'windows',
    osVersion: '10.0.22631',
    arch: 'x86_64',
    features: { is_demo_user: false, has_custom_resolution: true }
  }

  it('allows libraries without rules', () => {
    expect(rulesAllow(undefined, context)).toBe(true)
  })

  it('honours OS-specific allow rules', () => {
    const rules: Rule[] = [{ action: 'allow', os: { name: 'windows' } }]
    expect(rulesAllow(rules, context)).toBe(true)
    expect(rulesAllow(rules, { ...context, osName: 'linux' })).toBe(false)
  })

  it('applies later disallow rules', () => {
    const rules: Rule[] = [{ action: 'allow' }, { action: 'disallow', os: { name: 'windows' } }]
    expect(rulesAllow(rules, context)).toBe(false)
  })

  it('evaluates feature gates', () => {
    const rules: Rule[] = [{ action: 'allow', features: { is_demo_user: true } }]
    expect(rulesAllow(rules, context)).toBe(false)
    expect(rulesAllow(rules, { ...context, features: { ...context.features, is_demo_user: true } })).toBe(true)
  })
})

describe('arguments', () => {
  it('tokenises quoted legacy arguments', () => {
    expect(tokenise('--username "Test Player" --version 1.20.1')).toEqual([
      '--username',
      'Test Player',
      '--version',
      '1.20.1'
    ])
  })

  it('substitutes placeholders and preserves unknown ones', () => {
    expect(substitute('${a}-${unknown}', { a: 'x' })).toBe('x-${unknown}')
  })

  it('splits JVM argument strings', () => {
    expect(splitJvmArgs('-Xmx4G -Dfoo="hello world"')).toEqual(['-Xmx4G', '-Dfoo=hello world'])
  })

  it('builds a complete command line', () => {
    const version = mergeVersionJson(baseVersion, childVersion)
    const classpath = buildClasspath(version, 'C:/libs', 'C:/versions/1.20.1/1.20.1.jar').join(';')
    const args = buildArguments({
      version,
      profile: {
        username: 'TestPlayer',
        uuid: '12345678-1234-1234-1234-123456789012',
        accessToken: 'token',
        userType: 'legacy'
      },
      instanceId: 'test',
      versionName: '1.20.1',
      gameDir: 'C:/game',
      assetsDir: 'C:/assets',
      nativesDir: 'C:/natives',
      libraryDir: 'C:/libs',
      classpath,
      memoryMb: 4096,
      width: 1280,
      height: 720,
      fullscreen: false,
      extraJvmArgs: '-XX:+UseG1GC',
      launcherName: 'Newbie Launcher',
      launcherVersion: '0.1.0',
      javaMajor: 17
    })
    expect(args.jvm).toContain('-Xmx4096M')
    expect(args.jvm).toContain('-XX:+UseG1GC')
    expect(args.jvm).toContain('-Djava.library.path=C:/natives')
    expect(args.game).toContain('TestPlayer')
    expect(args.game).toContain('--width')
    expect(args.game).toContain('1280')
    expect(args.classpath).toContain('fabric-loader-0.15.0.jar')
  })
})

describe('modpack compatibility', () => {
  it('accepts the same Minecraft version and loader', () => {
    expect(isPackCompatible('1.20.1', 'fabric', '1.20.1', 'fabric')).toBe(true)
  })

  it('rejects a different game version', () => {
    expect(isPackCompatible('1.20.1', 'fabric', '1.21.1', 'fabric')).toBe(false)
  })

  it('rejects a different loader', () => {
    expect(isPackCompatible('1.20.1', 'fabric', '1.20.1', 'forge')).toBe(false)
    expect(isPackCompatible('1.20.1', 'vanilla', '1.20.1', 'fabric')).toBe(false)
  })
})

describe('java version parsing', () => {
  it('parses legacy 1.8 versions', () => {
    expect(parseJavaVersion('java version "1.8.0_401"')).toEqual({ version: '1.8.0_401', major: 8 })
  })

  it('parses modern versions', () => {
    expect(parseJavaVersion('openjdk version "21.0.4" 2024-07-16')).toEqual({ version: '21.0.4', major: 21 })
  })

  it('rejects unrelated output', () => {
    expect(parseJavaVersion('not java')).toBeNull()
  })
})

describe('utilities', () => {
  it('creates deterministic offline UUIDs', () => {
    const uuid = offlineUuid('TestPlayer')
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(offlineUuid('TestPlayer')).toBe(uuid)
    expect(offlineUuid('OtherPlayer')).not.toBe(uuid)
  })

  it('hashes buffers', () => {
    expect(sha1Buffer(Buffer.from('abc'))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })

  it('prevents path traversal', () => {
    expect(() => safeJoin('C:/game', '../escape')).toThrow()
    expect(safeJoin('C:/game', 'mods/test.jar')).toContain('test.jar')
  })

  it('sanitises filenames and formats bytes', () => {
    expect(sanitizeFilename('bad<>name?.jar')).toBe('bad__name_.jar')
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB')
  })
})
