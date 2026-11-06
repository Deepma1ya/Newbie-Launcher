# Newbie Launcher 0.1.52

The installed Minecraft for Windows card now uses the Newbie Launcher app icon instead of the Minecraft block mark. The not-installed card uses the same app icon for consistency.

# Newbie Launcher 0.1.51

Fixes the Bedrock tray handoff and adds Bedrock console snippets.

## Bedrock tray fix

- The Bedrock monitor now tracks only one game session. Launching Bedrock twice can no longer leave the launcher hidden forever.
- A second launch while the first window is starting is rejected instead of creating an unbalanced session count.
- The monitor checks for the actual **Minecraft game window**, not just a leftover suspended `Minecraft.Windows.exe` process, and restores the launcher when the window closes.
- Added monitor start/close logs so a future tray issue is traceable.

## Bedrock console snippets

- The Bedrock server console now has its own snippet panel:
  - players and allow list: `list`, `allowlist add/remove/list`
  - moderation: `op`, `deop`, `permissions set`, `kick`, `ban`, `pardon`
  - world: `time set`, `weather`, `gamerule`, `setworldspawn`, `tp`, `gamemode`
  - items and effects: `give`, `clear`, `effect`
  - server admin: `save hold/query/resume`, `changesetting`, `stop`
- Bedrock snippets replace Java-only commands such as `tps` and `whitelist`, so the console only shows commands that BDS understands.
- Scheduled restarts already work for Bedrock and remain in Server Settings; the warning and restart use `say`, `stop` and the normal BDS start path.

## Also included

- Automatic playit sharing, Bedrock creation fixes, BDS download fallback, TLauncher management and the skin catalog from 0.1.50.
- The 0.1.48/0.1.49 internet relay work, hide-to-tray and `.mrpack` import.

# Newbie Launcher 0.1.50

Automatic playit sharing, Bedrock creation fixes, TLauncher management and a skin catalog.

## Servers and Bedrock

- A successful playit.gg tunnel now enables **Open playit automatically when this server starts**. Once playit is connected, starting the server opens the same tunnel without extra clicks. The switch is on the Share tab, and stopping sharing manually turns it off.
- Bedrock server creation no longer shows the online-mode switch. Bedrock servers always use Xbox/Microsoft online mode, so the value is forced on.
- Fixed **“Downloading Bedrock Dedicated Server … failed: fetch failed.”** The launcher now sends the headers minecraft.net expects and falls back to PowerShell/curl if Node’s downloader is refused. Existing partial ZIP files are detected and replaced.
- Bedrock server creation keeps its automatic allow-list entry and player tools.

## Accounts and skins

- Added a **Manage TLauncher** card: refresh skin and cape, switch the active TLauncher profile, toggle texture sync, or open TLauncher.
- Added an online **skin catalog** beside **Choose image**. Search the Photo2Skin library, browse pages, preview skins and install one directly on an offline or TLauncher profile.
- Custom skin copy now explains exactly when a local skin is visible only to you. Capes remain managed by TLauncher and the TL Skin & Cape plugin; the catalog installs skins.

## Also included

- playit.gg agent 2.0.0-r1 and the `AgentVersionTooOld` fix.
- One-click playit/bore relays from 0.1.48.
- Hide-to-tray, `.mrpack` import, Bedrock package-data preservation and the earlier server tools.

# Newbie Launcher 0.1.49

Fixes the playit.gg tunnel failing after the account claim.

## playit.gg

- The launcher was bundling playit agent `1.2.0`; playit.gg now requires a newer agent, so tunnel creation failed with `AgentVersionTooOld` after login.
- Updated the bundled agent to the current signed `2.0.0-r1` build.
- A local agent version marker now invalidates older cached agents automatically, so existing installs download the new build on the next attempt.
- The saved playit claim secret is reused; you do not need to claim the account again.
- If playit.gg ever rejects a future agent version, the UI now says to update Newbie Launcher instead of showing the raw API error.
- The Java `bore.pub` quick relay is unchanged.

# Newbie Launcher 0.1.48

Servers can now be opened to the internet without a public IP, router access or port forwarding.

## One-click internet

- The **Share** tab has a new **Play from the internet** card.
- **Guided playit.gg setup** downloads the official signed playit.gg agent, verifies its Authenticode signature, opens the one-time claim page, saves the agent secret with Windows DPAPI, creates the Java or Bedrock tunnel, and shows the public address.
- One free playit.gg account is needed once. After that, starting a playit tunnel for any server is one click.
- playit.gg supports Java TCP and Bedrock UDP, so it works behind CGNAT and on routers where port forwarding is unavailable.
- **Java quick relay** uses `bore.pub` with no account. It is TCP-only, uses a random public `bore.pub:<port>` address, and depends on the free relay's uptime.
- The downloaded bore client is pinned and checked against a SHA-256 hash; the playit daemon is signature-checked before it runs.
- The server address is filled into the Share field automatically, ready to copy.
- Relays close when the server stops, when sharing is stopped, or when Newbie exits. playit tunnels are deleted through the API.
- The existing manual playit.gg, port-forwarding, Radmin, ngrok, Cloudflare and LAN guidance remains below the one-click card.

## Also included

- Home page instance actions in a consistent footer, plus the 0.1.43–0.1.47 Bedrock fix-folder work.
- Bedrock uninstall and version replacement preserve worlds and package data (0.1.42).
- Editable instance resolution fields (0.1.41).
- Hide-to-tray while a game runs (0.1.40).
- `.mrpack` import and the earlier server tools.

# Newbie Launcher 0.1.47

The home page instance actions are aligned and moved into a footer.

## Home

- The **Play/Start** and **Manage** buttons now use the same large size and fixed width.
- Both buttons sit in a bottom action bar on the active instance card instead of under the instance name.
- **Console** and any pending update actions are grouped on the right side of the same footer and wrap cleanly on narrow windows.

# Newbie Launcher 0.1.46

Bedrock fix files now ship with the launcher instead of a user-managed folder.

## Bundled Bedrock fix

- Removed the **Bedrock fix files** card and folder picker from the Bedrock page.
- The `minecraft bedrock fix` folder is packaged into the installer and delivered through auto-updates.
- Before every Play, Newbie runs the Windows Security exclusion, copies changed bundled fix files into the installed Minecraft for Windows package, then launches the game.
- The bundled fix folder is now part of the Windows Security exclusion request, alongside Newbie's Bedrock download folder, Microsoft's Minecraft data folders and the installed package folder.
- If the folder is empty, nothing is copied and the game launches normally.
- Maintainers: place the fix files in `minecraft bedrock fix/` before cutting a release. `.gitkeep` keeps the folder in the repository and is never copied into Minecraft.

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
