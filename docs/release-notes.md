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
