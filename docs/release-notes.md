# Newbie Launcher 0.1.4

Faster add-on installation.

## Added

- Every Browse card now has a **+** button. It installs the latest compatible version of that project into the currently selected instance without opening the detail view.
- Required dependencies are resolved automatically, and the card switches to a checkmark once the project is installed.
- Modpacks use the same button to open their target/version chooser, because a whole pack needs a compatible instance selection.

## Fixed

- Quick installation chooses the correct version filters for resource packs and shaders instead of applying the mod loader filter to them.
- Browse cards no longer nest interactive controls incorrectly. Mouse clicks still open details, while the title and + button remain keyboard-accessible.

## Notes

- + is disabled until an instance is selected.
- A vanilla instance cannot accept mods quickly; the button opens the detail view so the instance can be switched to Fabric/Forge/Quilt/NeoForge.
- Everything from 0.1.3 (CurseForge removal) is included.
