# Newbie Launcher 0.1.22

Copy Minecraft settings between instances.

## Copy settings

- Added **Instance → Settings → Minecraft settings → Copy settings**.
- Choose exactly what to copy:
  - **Keybinds**
  - **Video & graphics** — render distance, FPS, graphics mode, clouds, particles and brightness
  - **Audio** — master, music and per-category volumes
  - **Controls** — sensitivity, sprint/crouch toggles and auto-jump
  - **Chat & social** — visibility, opacity, links and secure-chat options
  - **Accessibility** — narrator, subtitles, contrast and skin parts
  - **Language**
  - **Resource pack order** — enabled packs and their order
  - **Shaders** — Iris selection/configuration and the selected shader pack
  - **Other options** — any remaining `options.txt` keys
- Copy to **one instance** or **all other instances** in one operation. The all-instances mode makes the selected settings the default for every other instance.
- Target `options.txt` files are backed up as `options.txt.newbie-copy.bak` before anything changes.
- Resource pack entries for packs missing in the target are skipped instead of leaving broken pack order entries.
- The selected shader pack is copied into the target when it is not already installed.
- `lastServer` and `version` are never copied.
- Copying is blocked while the source or any target instance is running.

Everything from 0.1.21 (Java 25), 0.1.20 (essential mod protection) and earlier is included.
