# Newbie Launcher 0.1.19

Datapacks, installed as smoothly as mods.

## Datapacks

- Added a **Datapacks** tab to Browse with Modrinth search, version filters and dependency-aware installs.
- Datapacks work on vanilla instances too — no mod loader required.
- The project details window now has an **Install to** selector:
  - choose any world in the instance and the pack is copied into `saves/<world>/datapacks`;
  - choose **Instance datapacks folder** to keep a staging copy in the instance.
- If the instance has worlds, the most recently used one is selected by default.
- Required datapack dependencies are installed into the same world.
- The Library and Instance add-ons views now have **Datapacks** filters.
- Datapack rows show which world they belong to, and updates keep writing to that same world.
- **Scan local** now finds datapacks in the instance folder and inside every world's `datapacks` folder.
- Removing or disabling a datapack uses its real world-specific path, so other worlds are not touched.

## Notes

- Datapacks are world data. Minecraft loads them when the world loads; use `/reload` or reopen the world after installing.
- Datapacks are Java Edition only. Bedrock behaviour packs are not part of this feature.

Everything from 0.1.18 (TLSkinCape) and earlier is included.
