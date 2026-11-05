# Newbie Launcher 0.1.12

Repair reliability.

## Fixed

- Repair now plans and verifies each change; the dialog shows the post-repair state instead of the old list.
- Duplicate repairs no longer silently skip when a `.disabled` copy already exists.
- Mutual mod incompatibilities disable one side only, instead of both.
- Missing dependencies are grouped and attempted once. A dependency that is present but disabled is reported as manual instead of being reinstalled in a loop.
- Failed automatic fixes are persisted per instance and paused. Use **Retry automatic fixes** to retry deliberately.
- Repair only checks tracked mods in the active loadout, so switching loadouts no longer creates false missing-file issues.
- Stale active/disabled copies are resolved, and mods disabled by repair are removed from the active loadout.
- Applying repair when there is nothing to change no longer creates a backup or touches files.
- Added a **Rescan** action and failed/blocked reporting to the repair dialog.

Everything from 0.1.11 (new icon), 0.1.10 (toggle alignment) and 0.1.9 (built-in update center) is included.
