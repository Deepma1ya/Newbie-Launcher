# Newbie Launcher 0.1.17

Dependency-first repair with confirmed disables.

## Repair

- Repair now runs in two phases. The first phase only installs, enables or restores files; it never disables a mod.
- Missing required dependencies are downloaded from Modrinth first.
- If a required dependency is already installed but disabled, Newbie re-enables it when it is safe to do so.
- If a dependency cannot be installed, Newbie offers to disable the mods that require it as a last resort, after a confirmation popup.
- Duplicate mods, wrong-loader files, incompatibilities, unreadable files and add-on state mismatches are grouped under **Needs disable**.
- Nothing is disabled until you confirm the list in the popup. Cancelling leaves every mod active.
- Disabling renames the file to `.disabled`; files are never deleted. A single repair backup is reused across both phases.
- Dependency and enable actions always run before any confirmed disable.
- The repair window now separates **Safe fixes**, **Needs disable** and **Manual** issues, and explains what will happen before asking for confirmation.
- Failed automatic fixes are still recorded and never retried automatically; use **Retry automatic fixes** when you want to try again.

Everything from 0.1.16 (themed dropdowns), 0.1.15 (Bedrock support) and earlier is included.
