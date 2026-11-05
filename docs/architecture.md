# Architecture

## Process model

Newbie Launcher uses a strict three-process boundary:

- **Main** (`src/main`) — Node.js. Owns files, network, Java processes, OAuth, storage and all decisions.
- **Preload** (`src/preload`) — a small `contextBridge` surface. It exposes typed methods only; it never exposes Node or `ipcRenderer` directly.
- **Renderer** (`src/renderer`) — React 19, Tailwind and Framer Motion. It is sandboxed and can only call the preload API.

No renderer input reaches a shell. Every IPC call is validated with Zod in the main process. External links are limited to HTTPS; navigation outside the app is blocked.

## Persistence

`launcher.json` stores settings, accounts (encrypted token fields), instances and recent tasks. Writes are atomic (temp file + rename) and debounced. `secrets.json` holds the CurseForge API key encrypted with Electron `safeStorage` (DPAPI on Windows).

The bootstrap file (`%APPDATA%/Newbie-Launcher/bootstrap.json`) points at the configurable data directory. Changing the data directory copies data first, then rewrites the bootstrap and all instance paths.

## Install pipeline

1. Fetch the Mojang manifest and version JSON, caching both.
2. Resolve `inheritsFrom` into a merged version (libraries, arguments, asset index, logging, Java requirement).
3. Evaluate OS/arch/feature rules for libraries.
4. Download the client jar, logging config, libraries and native classifiers with hash and size verification.
5. Download the asset index and content-addressed objects with bounded concurrency.
6. Extract native classifiers into the instance `natives` folder at launch time.
7. Build the classpath from the merged library list plus the client jar.

Fabric/Quilt profiles come from their metadata APIs and are stored as normal version JSONs. Forge/NeoForge run the official installer with `--installClient <dataDir>` and validate the generated version JSON.

## Launch

`launchArgs.ts` is a pure argument builder:

- expands conditional `arguments.game` / `arguments.jvm` rules
- substitutes auth, version, game directory, assets, natives, classpath and launcher placeholders
- supports legacy `minecraftArguments`
- adds safe defaults for memory, encoding, natives, logging and resolution

The process manager stores a bounded in-memory log ring, streams a per-launch log file, parses Log4j XML into readable lines, redacts `--accessToken`, and emits crash hints on non-zero exits.

## Accounts

- **Microsoft** — embedded `login.live.com` authorization-code window, Xbox Live → XSTS → Minecraft Services, refresh-token storage.
- **TLauncher** — public nickname + public texture lookup; offline session.
- **Offline** — deterministic offline UUID from `OfflinePlayer:<name>`.
- **Authlib** — ALI resolution, `/authserver/authenticate` and `/authserver/refresh`.

Tokens live encrypted in `launcher.json`; the renderer receives only sanitized `AccountSummary` objects.

## Modpacks

Modpacks can create a new instance or be applied to an existing instance. Applying to an existing instance requires an exact Minecraft version and loader match. Before any files are written, Newbie creates a streaming backup of `mods`, `config`, `defaultconfigs`, `kubejs`, `scripts`, `resourcepacks`, `shaderpacks` and `options.txt`. Pack files are merged by project ID or filename, so updating a mod already present replaces the record instead of creating a duplicate. The active loadout keeps its existing storage mode when adding to an instance.

## Add-ons

- **Modrinth** — search facets, project/version endpoints, bulk hash lookup, recursive required-dependency resolution.
- **CurseForge** — user-supplied API key, class/mod-loader mapping, file dependency relation 3 (required), edge CDN fallback.
- **Modpacks** — `.mrpack` index parsing, file download with SHA-1 verification, `overrides/` and `client-overrides/` extraction, hash-to-project enrichment for later updates.
- **Records** store provider, project ID, version ID, file name, hash, size, dependencies and update state.

Updates compare the stored version ID with the newest version that supports the instance's game version and loader. Version changes run the same update pass after the new loader is installed.

## Loadouts

Loadout activation is a materialisation step:

1. For every add-on in the loadout, copy from the cache if possible or download the exact pinned version.
2. Remove managed files that are not in the loadout.
3. Rename `.disabled` files back when required.
4. Persist the active loadout.
5. Evict cache entries not referenced by any `offline` loadout.

This makes the two modes real: offline loadouts keep a complete cache; download-on-switch loadouts do not.

## Repair

`readJarMeta` understands Fabric, Quilt, Forge and NeoForge metadata, plus legacy `mcmod.info`, `pack.mcmeta` and nested Fabric/Forge JARs. Repair scans:

- **Duplicates** — same mod ID in multiple files. Prefer the file tracked by a record, then the highest version.
- **Loader mismatch** — a Forge jar in a Fabric instance, etc.
- **Incompatible dependencies** — declared `breaks` / `incompatible` relationships.
- **Missing dependencies** — required IDs not present as top-level or nested mods.
- **Missing files** — records whose file disappeared.

Auto-fix disables duplicates and wrong-loader jars, installs exact-slug Modrinth dependencies when possible, and creates a streaming ZIP backup first. A rescan runs after applying so the UI shows the real remaining state.

## Performance

`options.txt` is updated from one of three conservative presets, preserving unknown keys. The Windows GPU preference is written to the current user's DirectX registry key for the actual Java executable. No system-wide or administrator changes are made.
