# Newbie Launcher 0.1.27

A sectioned sidebar — plus a critical fix for the packaged app.

## Sidebar sections

- The left sidebar is grouped into:
  - **Minecraft Java** — Instances, Browse, Library
  - **Minecraft Bedrock** — Bedrock
  - **Minecraft Servers** — Servers
  - **Launcher** — Downloads, Accounts
- **Home** stays at the top and **Settings** stays in the footer with your account.
- Links become slightly more compact on short windows so every section still fits; the navigation scrolls if the window is smaller than the minimum height.

## Critical fix

- Fixed the renderer and preload paths when Vite splits the main process into chunks. **0.1.26 could open a blank window**; 0.1.27 resolves the bundled files from the real app directory instead of the chunk directory.
- If you are on 0.1.26, install this build manually. In-app auto-updates resume from 0.1.27 onward.

Everything from 0.1.26 (bulk add-on deletion), 0.1.25 and earlier is included.
