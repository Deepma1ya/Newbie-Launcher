# Newbie Launcher 0.1.36

The create-server flow now offers Java and Bedrock.

## Bedrock servers

- **Edition selector:** choosing **Create server** now asks for Java Edition or Bedrock first.
- **Official software:** Bedrock servers use the Mojang Bedrock Dedicated Server for Windows, downloaded from Minecraft.net. No Java runtime is needed.
- **Stable or preview:** pick the current stable BDS build or the preview channel; Newbie reads both versions from the official Mojang download catalog.
- **UDP defaults:** new Bedrock servers use UDP port `19132` (IPv6 `19133`) and the standard `bedrock_server.exe` launch.
- **Bedrock settings:** the settings tab shows the native Bedrock `server.properties` fields — server name, ports, world type, game mode, difficulty, cheats, view and tick distance, allow list, Xbox online mode, movement authority and chat restrictions.
- **Bedrock console:** live console, quick commands such as `list`, `save hold` and `allowlist list`, plus start, stop and restart all work against the BDS process.
- **Share tab:** a UDP warning replaces the TCP-only reachability test, because Bedrock clients connect over UDP.
- **Java-only features hidden:** resource packs, add-ons, TPS and Java command snippets stay out of the Bedrock UI.

## Also included

- Windows Security exclusion fixes from 0.1.35.
- Pack sharing and instance-to-instance add-on copying from 0.1.34.
- Server command snippets, TPS, resource packs and scheduled restarts from 0.1.33.
- Everything from earlier releases is included.
