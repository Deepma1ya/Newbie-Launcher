import { describe, expect, it } from 'vitest'
import {
  bedrockPackageVersion,
  isAllowedBedrockUrl,
  isDefenderUnreadableExclusion,
  isExcludedPath,
  isTrialPackageIdentity,
  normalizeExclusionPath,
  parseBedrockCatalog,
  summarizeExclusion
} from '@shared/bedrock'

const URL_RELEASE_1_26_62 =
  'http://assets1.xboxlive.com/15/abc/def/1.26.6201.0.abc/MICROSOFT.MINECRAFTUWP_1.26.6201.0_x64__8wekyb3d8bbwe.msixvc'
const URL_RELEASE_1_26_60 =
  'http://assets2.xboxlive.com/1/abc/def/1.26.6005.0.def/MICROSOFT.MINECRAFTUWP_1.26.6005.0_x64__8wekyb3d8bbwe.msixvc'
const URL_PREVIEW =
  'http://assets1.xboxlive.com/2/abc/def/1.26.7003.0.ghi/MICROSOFT.MINECRAFTWINDOWSBETA_1.26.7003.0_x64__8wekyb3d8bbwe.msixvc'

describe('Bedrock package versions', () => {
  it('maps Minecraft versions to Windows package versions', () => {
    expect(bedrockPackageVersion('1.26.62.1')).toBe('1.26.6201.0')
    expect(bedrockPackageVersion('1.21.120.4')).toBe('1.21.12004.0')
    expect(bedrockPackageVersion('1.26.7.23')).toBe('1.26.723.0')
    expect(bedrockPackageVersion('nope')).toBeNull()
  })

  it('detects trial and demo package names', () => {
    expect(isTrialPackageIdentity('MICROSOFT.MINECRAFTUWP_TRIAL_1.0')).toBe(true)
    expect(isTrialPackageIdentity('MICROSOFT.MINECRAFTUWP_DEMO')).toBe(true)
    expect(isTrialPackageIdentity('MICROSOFT.MINECRAFTUWP_1.26.6201.0_x64__8wekyb3d8bbwe')).toBe(false)
  })
})

describe('Windows Security exclusion matching', () => {
  const install =
    'C:\\Program Files\\WindowsApps\\Microsoft.MinecraftUWP_1.26.6201.0_x64__8wekyb3d8bbwe'

  it('normalises case, slashes and trailing separators', () => {
    expect(normalizeExclusionPath('  C:/Games/Bedrock/  ')).toBe('c:\\games\\bedrock')
    expect(normalizeExclusionPath('"C:\\Games\\Bedrock"')).toBe('c:\\games\\bedrock')
  })

  it('treats an excluded parent folder as covering its subfolders', () => {
    expect(isExcludedPath(install, ['C:\\Program Files\\WindowsApps'])).toBe(true)
    expect(isExcludedPath(install, [install.toUpperCase()])).toBe(true)
    expect(isExcludedPath(install, ['C:\\Program Files\\WindowsAppsOther'])).toBe(false)
  })

  it('reports missing, partial and complete exclusion states', () => {
    const dataDir = 'C:\\Users\\Player\\AppData\\Local\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe'
    expect(summarizeExclusion([install, dataDir], []).state).toBe('missing')
    const partial = summarizeExclusion([install, dataDir], [install])
    expect(partial.state).toBe('partial')
    expect(partial.missing).toEqual([dataDir])
    expect(summarizeExclusion([install, dataDir], [install, dataDir]).state).toBe('added')
  })

  it('never treats a sibling path with the same prefix as excluded', () => {
    expect(isExcludedPath('C:\\Bedrock Preview\\game', ['C:\\Bedrock'])).toBe(false)
  })

  it('recognises the non-admin Windows Security sentinel', () => {
    expect(isDefenderUnreadableExclusion('N/A: Must be an administrator to view exclusions')).toBe(true)
    expect(isDefenderUnreadableExclusion('C:\\Games\\Bedrock')).toBe(false)
  })
})

describe('Bedrock catalog', () => {
  it('accepts full release and preview GDK packages', () => {
    const versions = parseBedrockCatalog({
      release: {
        '1.26.62.1': [URL_RELEASE_1_26_62],
        '1.26.60.5': [URL_RELEASE_1_26_60]
      },
      preview: { '1.26.70.3': [URL_PREVIEW] }
    })
    expect(versions).toHaveLength(3)
    const release = versions.filter((entry) => entry.channel === 'release')
    expect(release[0]?.version).toBe('1.26.62.1')
    expect(release[0]?.latest).toBe(true)
    expect(release[1]?.latest).toBe(false)
    expect(versions.find((entry) => entry.channel === 'preview')?.id.toLowerCase()).toContain(
      'minecraftwindowsbeta'
    )
  })

  it('rejects trial, mismatched, and non-Xbox URLs', () => {
    const versions = parseBedrockCatalog({
      release: {
        '1.26.62.1': ['http://assets1.xboxlive.com/a/TRIAL/MICROSOFT.MINECRAFTUWP_1.26.6201.0_x64__8wekyb3d8bbwe.msixvc'],
        '1.26.60.5': [URL_RELEASE_1_26_62],
        '1.26.61.1': ['http://evil.example/MICROSOFT.MINECRAFTUWP_1.26.6101.0_x64__8wekyb3d8bbwe.msixvc'],
        '1.26.63.1': ['https://assets1.xboxlive.com/a/MICROSOFT.MINECRAFTWINDOWSBETA_1.26.6301.0_x64__8wekyb3d8bbwe.msixvc']
      }
    })
    expect(versions).toHaveLength(0)
  })

  it('only allows Xbox Live CDN hosts and msixvc package filenames', () => {
    expect(isAllowedBedrockUrl(URL_RELEASE_1_26_62)).toBe(true)
    expect(isAllowedBedrockUrl('https://assets1.xboxlive.com/a/file.zip')).toBe(false)
    expect(isAllowedBedrockUrl('https://example.com/MICROSOFT.MINECRAFTUWP_1.26.6201.0_x64__8wekyb3d8bbwe.msixvc')).toBe(false)
  })
})
