# Newbie Launcher 0.1.39

Modrinth `.mrpack` import is now available where you export packs.

## Modpack import

- The **Share or move your modpack** dialog now includes an **Import a .mrpack** card, right next to Export.
- **Import .mrpack** on the Instances page keeps working and has a clearer label.
- Newbie reads `modrinth.index.json`, creates a matching instance from the pack's Minecraft version and loader, downloads its client files, extracts `overrides` and `client-overrides`, then scans the imported add-ons.
- Your current instance is never changed by an import.
- A failed import cleans up the incomplete instance instead of leaving a broken entry behind.
- After a successful import, Newbie opens the new instance.

## Also included

- Bedrock Microsoft account card, Xbox app shortcut, and Bedrock server player allow lists from 0.1.38.
- Microsoft sign-in activation fix from 0.1.37.
- Bedrock Dedicated Server creation, Windows Security exclusion fixes, server tools, resource packs and scheduled restarts from earlier releases.
