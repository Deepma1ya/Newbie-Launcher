# Newbie Launcher 0.1.2

Modpack targeting and a few reliability fixes.

## Added

- Modpacks can now be added to an **existing instance** instead of only creating a new one.
- The install target selector only lists instances with the **same Minecraft version and loader** as the selected pack version.
- Adding a pack to an existing instance creates a safety backup of mods, configs, scripts and packs before writing anything.
- Pack installation merges by project ID or filename, replacing existing mod versions instead of creating duplicate records.

## Fixed

- Modal dialogs now use unique accessible title IDs, so stacked confirmations (such as adding a modpack) are announced and targeted correctly.
- Modpack version selectors no longer truncate older pack versions, so a 1.20.1 build remains selectable in large packs.

## Notes

- Applying a modpack leaves the instance's Minecraft version and loader untouched. If the pack does not match, the backend refuses the operation with a clear error.
- The active loadout keeps its storage mode when adding an existing-instance pack.
- Everything from 0.1.1 is included.
