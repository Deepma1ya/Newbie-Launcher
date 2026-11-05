export const APP_NAME = 'Newbie Launcher'
export const APP_ID = 'com.newbielauncher.app'
export const APP_VERSION = '0.1.20'
export const GITHUB_OWNER = 'Deepma1ya'
export const GITHUB_REPO = 'Newbie-Launcher'
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
export const USER_AGENT = `NewbieLauncher/${APP_VERSION} (${GITHUB_URL})`

export const MOJANG_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
export const MOJANG_RESOURCES_URL = 'https://resources.download.minecraft.net'
export const MOJANG_LIBRARIES_URL = 'https://libraries.minecraft.net'
export const MODRINTH_API = 'https://api.modrinth.com/v2'
export const FABRIC_META = 'https://meta.fabricmc.net/v2'
export const QUILT_META = 'https://meta.quiltmc.org/v3'
export const FORGE_PROMOTIONS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
export const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml'
export const ADOPTIUM_API = 'https://api.adoptium.net/v3'

/**
 * Public, MIT-licensed GdkLinks catalog used by the Bedrock Launcher project.
 * It lists exact Xbox Live CDN resources for full Minecraft for Windows GDK
 * builds. The GitHub raw copy is primary; the Bedrock Launcher mirror is the
 * fallback.
 */
export const BEDROCK_LINKS_URLS = [
  'https://raw.githubusercontent.com/MinecraftBedrockArchiver/GdkLinks/master/urls.json',
  'https://www.raythnetwork.co.uk/gdk.urls.min.json'
]
export const BEDROCK_STORE_URL = 'ms-windows-store://pdp/?productid=9NBLGGH2JHXJ'
export const BEDROCK_STORE_WEB_URL = 'https://www.xbox.com/games/store/minecraft-for-windows/9NBLGGH2JHXJ'
export const GAMING_SERVICES_STORE_URL = 'ms-windows-store://pdp/?productid=9MWPM2CQNLHN'
export const GAMING_SERVICES_STORE_WEB_URL = 'https://apps.microsoft.com/detail/9mwpm2cqnlhn'

/** Microsoft's public Minecraft launcher client id. No client secret is used. */
export const MICROSOFT_CLIENT_ID = '00000000402b5328'
export const MICROSOFT_SCOPE = 'XboxLive.signin offline_access'
export const MICROSOFT_DEVICE_CODE_URL =
  'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode'
export const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'

export const TLAUNCHER_SKIN_PROFILE = 'https://auth.tlauncher.org/skin/profile/texture/login'
export const TLAUNCHER_SKIN_FILE = 'https://auth.tlauncher.org/skin/fileservice/skins'

export const DOWNLOAD_CONCURRENCY = 6
export const MAX_LOG_LINES = 4000
