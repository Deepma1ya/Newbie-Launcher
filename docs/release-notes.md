# Newbie Launcher 0.1.56

The Home main card now follows whichever edition you played last.

## Last played on Home

- The main Home card compares the latest Java instance and Bedrock instance play time and shows the newest one.
- A Java card keeps the existing instance details and changes its label to **Last played**.
- A Bedrock card shows the profile name, channel, installed/running state, worlds, packs, playtime and last session.
- The Bedrock card has **Play**, **Manage**, **Folder** and **Browse** actions. Play asks before switching the `com.mojang` profile when the instance is not linked yet.
- If the Bedrock package is not installed, Play is disabled and the card links to the Bedrock version page.
- The page header and quick actions switch between Java and Bedrock based on the selected card.
- With no play history yet, Home falls back to the active Java instance.

## Also included

- Bedrock now records `lastPlayedAt` when the game starts and updates it again with playtime when the window closes, so the Home card stays current during a session.
- The Home eyebrow now reads **Java + Bedrock**.

# Newbie Launcher 0.1.55

Java Edition now has a Maps page.

## Java maps

- The Java sidebar has a new **Maps** page for Java worlds and adventure maps.
- Search, sort by popularity, downloads or recent updates, and page through the CurseForge world catalog.
- Open a map to see screenshots, categories, file versions and download size.
- Installing downloads the selected `.zip` and unpacks the world into the selected instance's `saves` folder. The map then appears in Minecraft's normal world list.
- Existing saves are never overwritten. If a world with the same name exists, Newbie creates a numbered folder.
- Archives are checked for path traversal and a valid `level.dat`. Downloads are capped at 1 GB and unpacked maps at 4 GB.
- If the author has disabled third-party downloads, Newbie reports it and links to the CurseForge page instead of bypassing the restriction.
- The map catalog uses the public keyless `api.curse.tools` CurseForge proxy. CurseForge is a third-party catalog; Newbie is not affiliated with it.

## Also included

- The Maps page uses the active Java instance by default, with an instance selector and an Open game folder shortcut.
- World queries refresh after a map is installed.

# Newbie Launcher 0.1.54

Bedrock now has instances, a marketplace and a library.

## Bedrock instances

- The Bedrock section has its own **Instances**, **Browse** and **Library** pages, matching the Java setup.
- Each instance keeps its own worlds, resource packs, behavior packs and skin packs.
- Bedrock only reads one `com.mojang` folder, so Newbie links the selected instance with a Windows junction before launch.
- The first switch keeps the existing data as a protected **My Bedrock** profile. Your worlds are moved aside, never deleted.
- Newbie asks before the first profile switch and refuses to switch or install while Minecraft is running.
- Instance cards show world and pack counts, playtime and the active/linked state. The protected My Bedrock profile cannot be deleted.
- Instances share the installed Minecraft for Windows package. The Bedrock page still installs, replaces or uninstalls the game version itself.
- Xbox cloud sync can still merge a profile with another PC using the same Microsoft account. Bedrock profiles are local to this PC.

## Bedrock marketplace

- Browse [MCPEDL](https://mcpedl.com/) add-ons, maps, texture packs and skin packs from inside Newbie.
- Search, sort by trending or popularity, page through results and open a project detail window with its versions.
- Install directly into the selected instance. Add-ons are unpacked into `resource_packs`, `behavior_packs` or `skin_packs`; worlds go to `minecraftWorlds`.
- Installed packs appear in Minecraft's global resource settings or the world's resource/behavior pack screen. Newbie installs them but does not force them on.
- Reinstalling the same pack UUID replaces the old copy instead of stacking duplicates.
- Archive paths are validated, downloads are capped at 1 GB and unpacked archives at 4 GB.
- Minecraft colour codes (`§`) in pack names are stripped for the library.
- MCPEDL is a third-party community catalog. Newbie is not affiliated with MCPEDL.

## Bedrock library

- Review every installed pack and world for the selected instance.
- Filter by resource packs, behavior packs, skin packs, worlds or templates.
- Open the source page or remove an item from that instance only.

## Also included

- The Bedrock page shows which instance Play will use and links to the profile manager.
- Moving the launcher data folder is blocked while a managed Bedrock instance is linked, so the game's junction cannot point at an old copy.
- Existing version install, uninstall and Defender exclusion behaviour is unchanged.
- Java and Bedrock still keep separate accounts, settings and data folders.

# Newbie Launcher 0.1.53

TLauncher accounts can now be managed without leaving Newbie.

## In-app TLauncher sign-in

- The **Manage TLauncher** card now has **Sign in & manage**. It opens TLauncher's own sign-in page in a Newbie window, so you can change your skin, cape and profile without leaving Newbie.
- TLauncher controls the login and captcha. Newbie never sees or stores your TLauncher password.
- The window uses a persistent, sandboxed session. Sign in once, then return to the account page whenever you need to make a change.
- Closing the window refreshes your public skin and cape automatically when TLauncher skin sync is enabled.
- Only TLauncher and Cloudflare challenge pages stay inside the account window. Other links open in your normal browser.

## Also included

- The new button replaces the old external **Open TLauncher** shortcut.
- The Accounts page explains that the TLauncher session is separate and the password is never stored by Newbie.

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
