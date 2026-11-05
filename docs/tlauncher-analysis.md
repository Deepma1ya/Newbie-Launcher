# TLauncher investigation

This note records what was observed while analysing `TLauncher-Installer-2.1.0.5.exe` with REA. The goal was interoperability research: understand the launcher's feature surface and design a cleaner, more reliable implementation. No TLauncher code, assets or strings were copied into Newbie Launcher.

## Artifact

| Property | Value |
| --- | --- |
| File | `TLauncher-Installer-2.1.0.5.exe` |
| Size | `103,089,568` bytes |
| SHA-256 | `25189514c0b7739bf5549331fec12db48ab694770cd20d5f2b23057e73fd1e17` |
| Format | PE32, x86 |
| Internal name | `TL` |
| Original filename | `suf_launch.exe` |
| Description | `TL Setup` (ProductVersion `2.9.0.0`) |
| Signer | TLauncher Inc. — Certum Code Signing 2021 CA (Asseco Data Systems S.A.) |

The installer was inspected statically. It was never executed during this research.

## Installer engine

The binary is an **Indigo Rose Setup Factory** bootstrap. This is visible from the strings and the runtime layout:

- `irsetup.exe`
- `lua5.3.dll`
- `_ir_sf_temp`, `__IRSID`, `__IRTSS`, `__IRCT`, `__IRAOFF`
- "Failed to read Lua DLL", "Could not find data segment", "Could not find multi-segment indicator"

The payload is stored in an appended, compressed/encrypted data segment. It is not a plain NSIS/Inno archive. A sequential carve from the first embedded local ZIP header at file offset `6,783,395` recovered 80 regular files, including the launcher locale bundle, updater assets and one application class (`by/gdev/util/CoreUtil.class`). The complete launcher JAR was not recoverable in full from the installer alone, so behavioural conclusions come from the recovered locales plus public API observations.

## Recovered feature surface

The English locale (`lang/loc/en.properties`, 923 lines) is the clearest evidence of how TLauncher is structured.

### Java and launch settings

- Java path selection, custom Java list, dedicated "add / change custom Java" flow
- Separate **global JVM arguments** and **Minecraft program arguments**
- Memory allocation with recommended/warning/danger hints
- 32-bit Java warnings and Java-version mismatch hints
- Resolution / fullscreen settings
- Explicit game-directory setting with validation and access errors
- Developer console: off / Minecraft only / global, full-command display, kill process, save output, Pastebin export

### Versions

- Release, snapshot, old beta, old alpha and modified-version filters
- Version manager with **download missing files**, **force update**, delete version folder / libraries
- Version JSON editor (main class, assets, JVM args, game args)
- Local vs remote version resolution, update prompts when a version changes on the server

### Accounts

- TLauncher account (site account, used for skins)
- Mojang account (legacy)
- Microsoft account
- "Authorization without a password" (offline/free account)
- Skin system only works with a TLauncher account in supported versions

### Mods and packs

- Mods, modpacks, resource packs, maps and shader packs
- Category catalogue (technology, magic, adventure, optimization, shaders, etc.)
- Community modpack creation with Forge version selection
- Installed mod/resource pack/shader lists with enable/disable toggles
- Compatibility checks and backup/manual-installation guidance
- A repeated warning pattern: disable all shaders/resources, enable them one at a time to isolate crashes

### Reliability

- World backups before launch
- Backup frequency (always / once a day), maximum archive size, retention days
- Automatic update checks and a mandatory/optional launcher update flow
- Console crash hints for OutOfMemory, missing main class, Java version mismatch, `META-INF` problems, shader/resource pack failures

## TLauncher skins

Public behaviour observed:

- Profile endpoint: `https://auth.tlauncher.org/skin/profile/texture/login/{username}`
- Response shape: `{"SKIN":{"url":"...","metadata":{"model":"slim"}}}`
- Skin files are served from `https://auth.tlauncher.org/skin/fileservice/skins/skin_{username}.png`
- Legacy 64×32 skins are still served and must be handled separately from 64×64 skins

Newbie uses this public endpoint for **launcher-side avatar sync** only. TLauncher does not provide a licensed Microsoft/Mojang game session, so TLauncher accounts play offline. Online-mode servers require Microsoft.

## What Newbie does differently

| TLauncher observed behaviour | Newbie implementation |
| --- | --- |
| Java path + custom list + manual install | Detect all local runtimes, then download Temurin JRE from Adoptium with SHA-256 verification when needed |
| Version manager with manual “force update” | Install/verify pipeline is idempotent; Repair and reinstall actions are explicit |
| World ZIP backups with frequency and size limits | Same guarantees, streamed through a modern archiver, pruned by age and total size |
| Modpack catalogue with enable/disable lists | Named loadouts with managed materialisation and two storage modes |
| Compatibility warnings after a crash | One-click Repair *before* launch: duplicate IDs, wrong loader, incompatible deps, missing deps, missing files |
| Account types | Microsoft OAuth, TLauncher nickname/skin, offline, generic authlib |
| Proprietary launch stack | Electron + TypeScript, typed IPC, official Mojang metadata and the Modrinth API |
| TLauncher skin injection | Launcher avatar sync now; optional in-game provider on the roadmap |

## Evidence limits

- The installer's payload is compressed/encrypted; only the embedded locale/assets area was carved.
- Locale strings document capabilities, not every implementation detail.
- The official installer was not run, so network endpoints used by the launcher at runtime were not enumerated.
- No TLauncher binaries, art or locale text are shipped in this repository.
