# Newbie Launcher 0.1.0

First public Java Edition release.

## Highlights

- Install any Mojang Java version, plus Fabric, Quilt, Forge and NeoForge
- Automatic Java detection and Eclipse Temurin JRE downloads
- Microsoft sign-in, TLauncher nickname + skin sync, offline and authlib accounts
- Modrinth browsing with recursive dependency installs and one-click updates
- CurseForge browsing and installs with a personal API key
- Modrinth `.mrpack` modpack installer with overrides
- Named loadouts with full offline backups or download-on-switch
- One-click repair for duplicate mods, wrong-loader jars, conflicts and missing dependencies
- World backups before launch with retention controls
- Balanced/FPS/Quality profiles and the Windows high-performance GPU preference
- Custom install location, close-to-tray, live console, crash hints and auto-updater

## Notes

- Online-mode servers require a Microsoft account.
- TLauncher accounts are offline profiles with public skin sync; TLauncher does not issue game licences.
- CurseForge requires a free personal API key from `console.curseforge.com`.
- Bedrock Edition support is planned for a later release.
- Windows builds are currently unsigned, so SmartScreen may show a warning.

## Verified in this build

- Vanilla Minecraft 1.20.1 install and launch
- Fabric 1.20.1 + Sodium install and launch
- Fabulously Optimized `.mrpack` install (51 mods)
- Shader and resource-pack install
- Offline loadout switching with cache restore
- Duplicate-mod repair with pre-repair backup
- Temurin JRE 17 download and extraction
- NSIS install, packaged launch and uninstall
