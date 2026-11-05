import type { LoaderType } from './types'

/**
 * Official TLSkinCape builds published by TLauncher. The launcher downloads
 * these on demand from TLauncher's repository and verifies size + SHA-1.
 * Only Fabric and Forge builds are simple mods that can be placed in mods/.
 */
export interface TlsCapeArtifact {
  loader: 'fabric' | 'forge'
  modVersion: string
  fileName: string
  url: string
  sha1: string
  size: number
  /** Exact Minecraft versions covered by this artifact. */
  versions: string[]
}

export interface TlsCapeSyncResult {
  active: boolean
  installed: boolean
  reason?: 'disabled' | 'unsupported' | 'account' | 'existing'
  fileName?: string
  modVersion?: string
}

export const TLSKINCAPE_ARTIFACTS: TlsCapeArtifact[] = [
  {
    loader: 'fabric',
    modVersion: '1.37',
    fileName: 'tl_skin_cape_fabric_1.16.5-1.37.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.16.5/1.37/tl_skin_cape_fabric_1.16.5-1.37.jar',
    sha1: '619df1b1c607b508461a85211efde75b407b4b61',
    size: 582143,
    versions: ['1.16.5']
  },
  {
    loader: 'fabric',
    modVersion: '1.39',
    fileName: 'tl_skin_cape_fabric_1.17-1.39.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.17/1.39/tl_skin_cape_fabric_1.17-1.39.jar',
    sha1: '23dc6373bfff67e8074f9bf9d521065095182553',
    size: 1647396,
    versions: ['1.17']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.17.1-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.17.1/1.38/tl_skin_cape_fabric_1.17.1-1.38.jar',
    sha1: 'e6d2ba369a0fc81d31c3d97c316f168dcdc0f809',
    size: 1208621,
    versions: ['1.17.1']
  },
  {
    loader: 'fabric',
    modVersion: '1.39',
    fileName: 'tl_skin_cape_fabric_1.18-1.39.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.18/1.39/tl_skin_cape_fabric_1.18-1.39.jar',
    sha1: '5444a3d7eaf272db3b252b775c7881f7b4003853',
    size: 1647425,
    versions: ['1.18']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.18.1_1.18.2-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.18.1_1.18.2/1.38/tl_skin_cape_fabric_1.18.1_1.18.2-1.38.jar',
    sha1: 'fe745a9a98284badec8513e3cc2ccf6c60d88fce',
    size: 1208651,
    versions: ['1.18.1', '1.18.2']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.19-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.19/1.38/tl_skin_cape_fabric_1.19-1.38.jar',
    sha1: '9976494f6049fa94841110646740aee4e932ecf2',
    size: 1208398,
    versions: ['1.19']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.19.1_1.19.4-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.19.1_1.19.4/1.38/tl_skin_cape_fabric_1.19.1_1.19.4-1.38.jar',
    sha1: '6f8e0e76b06a0ac843fdf359eef21dbf976628dd',
    size: 1208433,
    versions: ['1.19.1', '1.19.2', '1.19.3', '1.19.4']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.20_1.20.1-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.20_1.20.1/1.38/tl_skin_cape_fabric_1.20_1.20.1-1.38.jar',
    sha1: '183cbb2ffba9fa711c0cc9fb32154f4bf0679ba8',
    size: 1208428,
    versions: ['1.20', '1.20.1']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.20.2_1.21.1-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.20.2_1.21.1/1.38/tl_skin_cape_fabric_1.20.2_1.21.1-1.38.jar',
    sha1: 'b17123ef439c622ca8d4038579bebd7b6b7c4feb',
    size: 1208062,
    versions: ['1.20.2', '1.20.3', '1.20.4', '1.20.5', '1.20.6', '1.21', '1.21.1']
  },
  {
    loader: 'fabric',
    modVersion: '1.39',
    fileName: 'tl_skin_cape_fabric_1.21.2_1.21.3-1.39.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.21.2_1.21.3/1.39/tl_skin_cape_fabric_1.21.2_1.21.3-1.39.jar',
    sha1: 'c04376a768215b6601657f8f39462b09538a85de',
    size: 1646042,
    versions: ['1.21.2', '1.21.3']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.21.4-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.21.4/1.38/tl_skin_cape_fabric_1.21.4-1.38.jar',
    sha1: 'a876c3f529b4cd472f2cc077dc9f9238bed6770c',
    size: 1207216,
    versions: ['1.21.4']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.21.5-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.21.5/1.38/tl_skin_cape_fabric_1.21.5-1.38.jar',
    sha1: '4077a22029b9e68eb8aaeaac9e291ef98a77c2dd',
    size: 1207205,
    versions: ['1.21.5']
  },
  {
    loader: 'fabric',
    modVersion: '1.381',
    fileName: 'tl_skin_cape_fabric_1.21.6_1.21.8-1.381.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.21.6_1.21.8/1.381/tl_skin_cape_fabric_1.21.6_1.21.8-1.381.jar',
    sha1: '731a603c08442fcbdd7c78404e73139e514fac75',
    size: 1580592,
    versions: ['1.21.6', '1.21.7', '1.21.8']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.21.9_1.21.10-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.21.9_1.21.10/1.38/tl_skin_cape_fabric_1.21.9_1.21.10-1.38.jar',
    sha1: '97cddf7bdafdde67cab7d068d0412c6cb834fb13',
    size: 1580648,
    versions: ['1.21.9', '1.21.10']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_1.21.11-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_1.21.11/1.38/tl_skin_cape_fabric_1.21.11-1.38.jar',
    sha1: 'b66f61f8f97296228dab77c83e9f691a05fd5d33',
    size: 2840456,
    versions: ['1.21.11']
  },
  {
    loader: 'fabric',
    modVersion: '1.39',
    fileName: 'tl_skin_cape_fabric_26.1_26.1.2-1.39.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_26.1_26.1.2/1.39/tl_skin_cape_fabric_26.1_26.1.2-1.39.jar',
    sha1: 'faea1dec5b36120b17adc72b3ea1dd69eeb299e9',
    size: 2905988,
    versions: ['26.1', '26.1.1', '26.1.2']
  },
  {
    loader: 'fabric',
    modVersion: '1.39',
    fileName: 'tl_skin_cape_fabric_26.2-1.39.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_26.2/1.39/tl_skin_cape_fabric_26.2-1.39.jar',
    sha1: 'a156854724d3b09ebbdd7666b179a267bdab4dba',
    size: 2963390,
    versions: ['26.2']
  },
  {
    loader: 'fabric',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_fabric_26.3-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_fabric_26.3/1.38/tl_skin_cape_fabric_26.3-1.38.jar',
    sha1: '51346cd916ab62d466f64c32aa952206fada5fb8',
    size: 3021206,
    versions: ['26.3']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.12.2-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.12.2/1.38/tl_skin_cape_forge_1.12.2-1.38.jar',
    sha1: 'e60b3de266de47e906c22b1a19e8da1389fedcad',
    size: 778074,
    versions: ['1.12.2']
  },
  {
    loader: 'forge',
    modVersion: '1.37',
    fileName: 'tl_skin_cape_forge_1.13.2_1.15.1-1.37.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.13.2_1.15.1/1.37/tl_skin_cape_forge_1.13.2_1.15.1-1.37.jar',
    sha1: 'a5968bad20df779b35d4ad7e50f7fdfa21aca4b1',
    size: 593207,
    versions: ['1.13.2', '1.14.2', '1.14.3', '1.14.4']
  },
  {
    loader: 'forge',
    modVersion: '1.10',
    fileName: 'tl_skin_cape_forge_1.15_1.15.1-1.10.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.15_1.15.1/1.10/tl_skin_cape_forge_1.15_1.15.1-1.10.jar',
    sha1: 'f774d0f105901bbc680e4aad7fecafff166fc21a',
    size: 54867,
    versions: ['1.15', '1.15.1']
  },
  {
    loader: 'forge',
    modVersion: '1.37',
    fileName: 'tl_skin_cape_forge_1.15.2_1.16.5-1.37.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.15.2_1.16.5/1.37/tl_skin_cape_forge_1.15.2_1.16.5-1.37.jar',
    sha1: 'd16728dcbf77e3513b480e01dc75de80399eafdf',
    size: 590859,
    versions: ['1.15.2', '1.16.1', '1.16.2', '1.16.3', '1.16.4', '1.16.5']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.17.1-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.17.1/1.38/tl_skin_cape_forge_1.17.1-1.38.jar',
    sha1: '6a11c1a4bc8c16d40b04958d64ef4b023f22aa23',
    size: 1180127,
    versions: ['1.17.1']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.18_1.18.2-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.18_1.18.2/1.38/tl_skin_cape_forge_1.18_1.18.2-1.38.jar',
    sha1: 'd292553c6f856e2f98dd1f11cf73f7bda6c1557a',
    size: 1180298,
    versions: ['1.18', '1.18.1', '1.18.2']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.19_1.19.2-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.19_1.19.2/1.38/tl_skin_cape_forge_1.19_1.19.2-1.38.jar',
    sha1: '8228ae39ad3dc9b72fa133b45a5e7a1dd9225ab6',
    size: 1180107,
    versions: ['1.19', '1.19.1', '1.19.2']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.19.3_1.19.4-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.19.3_1.19.4/1.38/tl_skin_cape_forge_1.19.3_1.19.4-1.38.jar',
    sha1: '4ddcd52be02d3de3f5a761a2c727920fde942733',
    size: 1180122,
    versions: ['1.19.3', '1.19.4']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.20-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.20/1.38/tl_skin_cape_forge_1.20-1.38.jar',
    sha1: 'a3f0483f5e7b4c4ed60174a07faf4c50dc113684',
    size: 1180127,
    versions: ['1.20', '1.20.1']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.20.2_1.20.4-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.20.2_1.20.4/1.38/tl_skin_cape_forge_1.20.2_1.20.4-1.38.jar',
    sha1: 'a544cd02f8aa635e3f9ec29e7bfa12cfb64848f0',
    size: 1179995,
    versions: ['1.20.2', '1.20.3', '1.20.4']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.20.6_1.21-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.20.6_1.21/1.38/tl_skin_cape_forge_1.20.6_1.21-1.38.jar',
    sha1: '9bf95f8cf53f5f4c6f1b62149b92ab07061ab1b6',
    size: 1179833,
    versions: ['1.20.6', '1.21']
  },
  {
    loader: 'forge',
    modVersion: '1.39',
    fileName: 'tl_skin_cape_forge_1.21.1-1.39.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.21.1/1.39/tl_skin_cape_forge_1.21.1-1.39.jar',
    sha1: 'a765f626c795d0f6e5910b924fe17dff031382a9',
    size: 1554374,
    versions: ['1.21.1']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.21.3_1.21.4-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.21.3_1.21.4/1.38/tl_skin_cape_forge_1.21.3_1.21.4-1.38.jar',
    sha1: '46b3d7805b203485880daa0be077a763520b9d21',
    size: 1180598,
    versions: ['1.21.3', '1.21.4']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.21.5-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.21.5/1.38/tl_skin_cape_forge_1.21.5-1.38.jar',
    sha1: 'a8278e796537ff3df3a24c7b878db630f9f7706f',
    size: 1180210,
    versions: ['1.21.5']
  },
  {
    loader: 'forge',
    modVersion: '1.37',
    fileName: 'tl_skin_cape_forge_1.21.6_1.21.8-1.37.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.21.6_1.21.8/1.37/tl_skin_cape_forge_1.21.6_1.21.8-1.37.jar',
    sha1: '70a4b267410a66f38311e9acdd731858b0392892',
    size: 1180423,
    versions: ['1.21.6', '1.21.7', '1.21.8']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.21.9_1.21.10-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.21.9_1.21.10/1.38/tl_skin_cape_forge_1.21.9_1.21.10-1.38.jar',
    sha1: '1a363d28703a97e626f79961d0d0b9a1522dd4aa',
    size: 1509869,
    versions: ['1.21.9', '1.21.10']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_1.21.11-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_1.21.11/1.38/tl_skin_cape_forge_1.21.11-1.38.jar',
    sha1: '6ce9d6c7cef6b915512b3de8c8f9ac6c3341c733',
    size: 2792464,
    versions: ['1.21.11']
  },
  {
    loader: 'forge',
    modVersion: '1.39',
    fileName: 'tl_skin_cape_forge_26.1_26.1.2-1.39.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_26.1_26.1.2/1.39/tl_skin_cape_forge_26.1_26.1.2-1.39.jar',
    sha1: 'a82dfa1c4cfdf73383b5770f1ec83a74e8d377dd',
    size: 2857830,
    versions: ['26.1', '26.1.1', '26.1.2']
  },
  {
    loader: 'forge',
    modVersion: '1.39',
    fileName: 'tl_skin_cape_forge_26.2-1.39.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_26.2/1.39/tl_skin_cape_forge_26.2-1.39.jar',
    sha1: 'd16b6b314254ea2c3f402596c4f2f8387122d97d',
    size: 2915259,
    versions: ['26.2']
  },
  {
    loader: 'forge',
    modVersion: '1.38',
    fileName: 'tl_skin_cape_forge_26.3-1.38.jar',
    url: 'https://res.tlauncher.org/unb/libraries/org/tlauncher/tl_skin_cape_forge_26.3/1.38/tl_skin_cape_forge_26.3-1.38.jar',
    sha1: 'd7d1e68c166b79eaadb6f2e27abb11fd4b5314b9',
    size: 2974006,
    versions: ['26.3']
  }
]

const ARTIFACT_INDEX = new Map<string, TlsCapeArtifact>()
for (const artifact of TLSKINCAPE_ARTIFACTS) {
  for (const version of artifact.versions) {
    ARTIFACT_INDEX.set(`${artifact.loader}:${version}`, artifact)
  }
}

export function findTlsCapeArtifact(
  loader: LoaderType,
  versionId: string | undefined | null
): TlsCapeArtifact | null {
  if (!versionId || (loader !== 'fabric' && loader !== 'forge')) return null
  return ARTIFACT_INDEX.get(`${loader}:${versionId.trim()}`) ?? null
}

export function supportsTlsCape(loader: LoaderType, versionId: string | undefined | null): boolean {
  return Boolean(findTlsCapeArtifact(loader, versionId))
}

export function tlsCapeSupportLabel(loader: LoaderType, versionId: string | undefined | null): string {
  const artifact = findTlsCapeArtifact(loader, versionId)
  if (!artifact) return 'No TL skin'
  return `TL skin ${artifact.modVersion}`
}
