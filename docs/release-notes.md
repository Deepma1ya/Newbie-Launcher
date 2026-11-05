# Newbie Launcher 0.1.28

Visible update progress — no more update black screen.

## Update progress

- Added a full-screen **Installing Newbie Launcher** screen with an animated progress bar.
- The screen shows the downloaded version and the current install step.
- Download and install progress now also appear on the Windows taskbar.
- The launcher holds the progress screen for a few seconds before closing, then reopens automatically after the silent install.
- The overlay explicitly says the window will close briefly, so a short pause is expected rather than mistaken for a crash.

## Automatic install changes

- Automatic installation no longer waits for Minecraft, local servers or launcher tasks to finish.
- Local servers are stopped gracefully first so their worlds save; Minecraft itself can stay open because only the launcher is replaced.
- **Install now** shows the same progress screen and installs immediately.
- No installer Next/Next pages are shown.

Everything from 0.1.27 (sidebar sections and the packaged-app path fix) and earlier is included.
