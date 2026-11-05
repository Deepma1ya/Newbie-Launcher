# Newbie Launcher 0.1.9

A complete built-in update center.

## Added

- **Settings → About → Launcher updates** now shows the installed version, update status, live download progress, transfer speed, and release notes.
- **What's new** displays the matching GitHub release notes before you restart.
- The sidebar version chip shows an update dot and links directly to the update panel.
- The update banner now shows downloaded size and speed, plus a **Details** button.
- **Restart and install** is available from both the banner and the update panel.

## Improved

- Update checks now follow the saved automatic-update setting at runtime instead of only when the launcher starts.
- Release notes are fetched from the public GitHub Releases API and cached per version.
- Clear messages for offline and missing-feed errors.
- Update-available notifications are emitted once instead of repeating.
- Stable/beta channel and automatic update checks are organized in the update panel.

## Free

Updates use GitHub Releases and `electron-updater`. There is no update server, subscription, or account involved.

## Notes

- Builds older than 0.1.5 only notify about updates; 0.1.5 and newer download in the background.
- Everything from 0.1.8 (organized account panel), 0.1.7 (unclipped menus) and 0.1.6 (custom offline skins) is included.
