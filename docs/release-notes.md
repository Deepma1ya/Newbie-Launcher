# Newbie Launcher 0.1.29

Manage installed Bedrock packages.

## Uninstall

- Each installed **Minecraft for Windows** or **Minecraft Preview** card now has an **Uninstall** button.
- A confirmation explains that Windows removes the selected package while **worlds, Marketplace content and settings are preserved**.
- The downloaded `.msixvc` package stays on disk, so you can install that version again without downloading it.
- Uninstall is disabled while Minecraft is running.
- Only the selected channel is removed; a separate Preview or Release installation is unaffected.

## Open install folder

- Added **Folder** to each installed Bedrock card.
- It opens the package install location in Explorer.
- Windows can restrict access to `WindowsApps`; if the install folder cannot be opened, Newbie falls back to the game's package data folder.
- The card also shows a compact, selectable install path.

Everything from 0.1.28 (visible update progress) and earlier is included.
