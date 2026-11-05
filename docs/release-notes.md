# Newbie Launcher 0.1.23

Run a Minecraft server without leaving the launcher.

## Local servers

- Added a **Servers** page for Minecraft servers that run on this PC.
- Supported server software: **Vanilla, Paper, Fabric, Quilt, Forge and NeoForge**.
- **Create & start** downloads the server software, prepares the right Java runtime, writes a starter configuration, accepts the Minecraft EULA after your consent and launches the server on `localhost`.
- Server cards show live status, version, loader, port and last start time, with **Start**, **Stop**, **Restart**, **Folder** and **Delete**.
- Each server lives in its own folder under `<dataDir>/servers/<id>` with a `server.json` record, its world, plugins/mods/datapacks, logs and configuration.

## Settings without text files

- The **Settings** tab exposes the common `server.properties` options as switches, selectors and number fields — MOTD, port, maximum players, game mode, difficulty, hardcore, PvP, flight, command blocks, Nether, spawn protection, world name/seed/type, structures, mob spawning, view and simulation distance, compression, idle timeout, chunk writes, native transport, watchdog, entity broadcast range, online mode, whitelist, proxy/secure-profile checks, RCON and operator permission levels.
- A **Server runtime** card lets you rename the server and change its allocated memory after creation.
- Changes are written to `server.properties`/`server.json`, with a clear note when a restart is needed.
- The EULA is never written before the **I accept the Minecraft EULA** checkbox is selected.

## Live console

- The **Console** tab streams launcher-captured server output, with colouring for errors, commands and launcher messages.
- Send any server command from the input, or use the quick **list**, **save-all** and **whitelist list** buttons.
- Launcher-captured output is stored separately from Minecraft's own `logs/latest.log`, so neither file corrupts the other.
- Servers are child processes of Newbie. Quitting or relaunching the launcher stops them gracefully first, waits for the world to save, then exits.

## Plugins, mods and datapacks

- **Paper** servers get Modrinth plugins and datapacks.
- **Fabric, Quilt, Forge and NeoForge** servers get Modrinth mods and datapacks.
- **Vanilla** servers get datapacks.
- Required Modrinth dependencies are resolved automatically — for example, installing Iris Shaders also installs Sodium.
- Add-ons can be enabled or disabled without deleting the file, removed with the trash button, or updated individually.
- **Check updates** compares every installed add-on with the latest compatible Modrinth build; **Update** replaces all pending files in one click and keeps disabled add-ons disabled.
- Datapacks are installed into the current world's `datapacks` folder, including after renaming the world folder.

## Reliability

- Paper downloads use the current **Paper Fill v3** API after the v2 sunset.
- Vanilla software comes from Mojang metadata; Fabric from Fabric Meta; Quilt from the official Quilt installer; Forge and NeoForge from their official installers.
- Forge and NeoForge launch through their generated `win_args.txt`/`unix_args.txt`, so the installed server starts exactly as the installer intended.
- Installers run with a relative install directory, so launcher data folders containing spaces still work; a rejected Quilt install now fails loudly instead of leaving an empty server.
- Java is selected from the Minecraft version metadata and installed automatically when missing.
- Server actions, properties and add-on paths are validated in the main process.

Everything from 0.1.22 (instance settings copy), 0.1.21 (Java 25), 0.1.20 (essential mod protection) and earlier is included.
