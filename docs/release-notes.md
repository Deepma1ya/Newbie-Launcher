# Newbie Launcher 0.1.24

Updates now install themselves — no Next/Next wizard.

## Silent, automatic updates

- When an update finishes downloading, Newbie Launcher restarts itself and runs the installer in silent mode.
- The installer wizard is no longer shown for updates. The new version opens again automatically after installing.
- **Install now** is still available if you do not want to wait, and it also uses the silent path.
- Fresh installs keep the folder-selection wizard; only in-app updates are silent.
- Update checks, download progress and release notes remain in the background and in **Settings → About**.

## Safe restarts

- Automatic installation waits while Minecraft is running, a local server is started, or a launcher task is still finishing.
- The update panel explains what it is waiting for and installs as soon as that work is done.
- Servers are stopped gracefully before the installer runs, so worlds are saved first.
- Quitting the launcher with a downloaded update still installs it silently.

Everything from 0.1.23 (one-click local servers), 0.1.22 (instance settings copy) and earlier is included.
