# Newbie Launcher 0.1.18

TLauncher skins and capes, powered by the real TLSkinCape plugin.

## TL skin and cape

- Newbie can place TLauncher's official **TLSkinCape** mod into an instance before launch, exactly like TLauncher does.
- The plugin is downloaded from TLauncher's official repository, checked against its published size and SHA-1, then copied into `mods/`.
- It is only placed when a **TLauncher account** is active, the instance is **Fabric or Forge**, and an official build exists for the exact Minecraft version.
- Vanilla, Quilt and NeoForge instances are not supported by the TLSkinCape builds, so they are marked **No TL skin**.
- Newbie never bundles TLSkinCape in the installer. The mod is GPL-3.0-only and is fetched on demand.

## Toggles

- **Accounts → TL skin & cape plugin**: global switch for placing the plugin on supported instances.
- **Instance → Settings → TLauncher skin & cape**: per-instance switch, plus the current managed file path.
- **Settings → General → TLauncher skins**: global switches for skin/cape sync and the plugin.
- Turning an instance switch off removes only the file Newbie placed. A manually installed TLSkinCape jar is never deleted or duplicated.
- If the global switch is off, or the selected account is not a TLauncher account, Newbie removes its managed file instead of loading the plugin with the wrong identity.

## Version support tags

- Instances now show **TL skin** or **No TL skin** before the instance name and in the header.
- Minecraft version pickers in **Create instance** and **Change version** show a TL skin tag before every version, based on the selected loader.
- Support covers the official Fabric and Forge TLSkinCape builds, including 1.16.5 through 1.21.11 and 26.1–26.3 where TLauncher publishes them.
- The tag explains whether the plugin can be added; it does not claim that every TLauncher skin layout works on every listed version.

## Included from earlier

- Dependency-first Repair with confirmed disables (0.1.17).
- Themed dropdowns (0.1.16), Bedrock support (0.1.15), instant instance deletion (0.1.14), crash-only console (0.1.13).
