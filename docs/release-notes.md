# Newbie Launcher 0.1.5

Launch reliability and hands-off updates.

## Reliability

- An instance is now reserved **before** any asynchronous preparation starts, closing the race where two fast Play clicks could launch the same instance twice.
- A second concurrent launch returns a clear “already running or starting” error.
- The launch lock is released automatically if preparation fails, so the instance can be retried.
- Play buttons show a non-interactive “Starting…” state while Java, libraries or loadouts are being prepared instead of offering a Stop action that cannot work yet.
- Deleting or changing versions is blocked while an instance is still starting.

## Automatic updates

- The launcher checks GitHub releases at startup and every 30 minutes.
- Updates download automatically in the background.
- A banner shows download progress and, once ready, offers **Restart and update**.
- If you close the launcher normally, the downloaded update installs on exit.
- The existing update banner in Settings remains available.

Everything from 0.1.4 (one-click Browse installs) and 0.1.3 (CurseForge removal) is included.
