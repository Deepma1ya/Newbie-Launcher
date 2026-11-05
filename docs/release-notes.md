# Newbie Launcher 0.1.14

Faster instance deletion.

## Changed

- Deleting an instance now removes it from the launcher immediately.
- The instance folder is moved into a trash folder in one fast rename, then deleted in the background.
- Large worlds and modpacks no longer block the window while they are deleted.
- The instances list and active-instance selection update right away.
- A running game is still stopped before deletion.
- The trash folder is cleared on startup, so an interrupted delete does not leave stale data.

Everything from 0.1.13 (console only on crashes) and 0.1.12 (repair reliability) is included.
