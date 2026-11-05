# Newbie Launcher 0.1.1

Patch release focused on input reliability.

## Fixed

- Toggle switches now use a real accessible checkbox inside a full-row label.
- Clicking the switch label or description now toggles it — not only the tiny track.
- Rapid clicks no longer read stale state; the switch updates optimistically while the setting is saved.
- Settings switches (close-to-tray, Java auto-download, auto-update, backups, performance auto-apply and others) now persist correctly and re-sync after the IPC round-trip.
- The TLauncher skin/cape sync choice is now actually persisted and respected when adding or refreshing a TLauncher account.
- The “Releases only” toggle in Create Instance now toggles from its full label and updates the version list without a double event.

## Notes

- Everything from 0.1.0 remains included.
- Auto-update metadata is published with this release, so installed 0.1.0 copies can update in place.
