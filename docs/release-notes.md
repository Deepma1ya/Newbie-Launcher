# Newbie Launcher 0.1.45

Republished the Bedrock fix folder build with a fresh installer and checksums.

## Re-release

- No functional changes since 0.1.44. This build refreshes the installer, `latest.yml`, blockmap and SHA-256 checksums.
- The Bedrock fix folder still applies automatically before every Play: Windows Security exclusion first, then changed files are copied into the installed Minecraft package, then the game starts.
- The Bedrock page card shows the active folder, file count, pending files and last sync, and remembers a folder selected with **Choose folder**.

# Newbie Launcher 0.1.44

Bedrock fix files with non-ASCII names are copied reliably.

## Fixes

- The elevated copy step reads the file list as UTF-8, so mods and folders with accented, Cyrillic, CJK or other non-ASCII names are applied correctly.
- The copy script is written with a UTF-8 byte-order mark, which keeps Windows PowerShell from misreading paths when the launcher is installed outside the default ASCII folders.

# Newbie Launcher 0.1.43

Bedrock fix files are applied automatically before every launch.

## Bedrock fix folder

- Added a **Bedrock fix files** card to the Bedrock page. Choose any folder, and its contents are copied into the installed Minecraft for Windows package before the game starts.
- The default folder is `minecraft bedrock fix` next to the launcher. The card can point Newbie at another folder at any time.
- Subfolders are preserved, and files are checked by size and modified time. Only new or changed files are copied, so a normal Play does not trigger an administrator prompt when nothing changed.
- The Windows Security exclusion still runs first. The copy then uses one administrator prompt when Windows protects the Store package folder, verifies each copied file, and only starts Minecraft after every file succeeds.
- If the copy fails or the administrator prompt is cancelled, Newbie stops and shows the exact file and reason instead of launching with an incomplete fix.
- The fix folder never includes temporary files, partial downloads or Windows junk such as `Thumbs.db` and `desktop.ini`.

## Also included

- Bedrock uninstall and version replacement preserve worlds and package data (0.1.42).
- Editable instance resolution fields, with validation and Backspace support (0.1.41).

# Newbie Launcher 0.1.42

Bedrock uninstall and version replacement work on Store-installed Minecraft.

## Bedrock package removal

- Removed the unsupported `-PreserveApplicationData` flag that caused **“Windows could not uninstall the installed Bedrock package”** on normal Store-installed Minecraft.
- Before removing a package, Newbie now moves the package's `LocalState` and `RoamingState` folders to a temporary backup under `%LOCALAPPDATA%\NewbieLauncher\bedrock-uninstall`.
- The data is restored after removal, so worlds, settings and Marketplace data survive both uninstall and version replacement.
- If Windows refuses to remove the package, the data is restored immediately and the real Windows error is shown instead of the raw PowerShell command line.
- If removal reports success but the package is still installed, Newbie now detects that and asks you to retry or use Windows Settings.
- Version replacement uses the same protected path, so replacing an installed Bedrock build no longer fails on the same flag.

## Also included

- Editable instance resolution fields, with validation and Backspace support (0.1.41).
- Hide-to-tray while a game runs, with automatic reopen (0.1.40).
- `.mrpack` import, Bedrock account and allow-list tools, and the earlier server features.
