# Newbie Launcher 0.1.38

Your Microsoft account can now be used for Bedrock player access.

## Bedrock account

- The Bedrock page now shows your Newbie Microsoft account next to the Microsoft account found in Windows, and can open the Xbox app directly.
- Minecraft for Windows always signs in with the account used by the Xbox app on the PC. Newbie explains this clearly because it cannot pass its Java token into the Store app.
- Microsoft accounts now keep the Xbox gamertag and XUID from sign-in, so the account you add to a Bedrock server is the same Xbox identity you play with.
- The account card shows the current Windows/Xbox email and whether the Xbox app is installed.

## Bedrock servers

- New **Players** tab on Bedrock servers: see who is allowed, add your Microsoft account by gamertag + XUID, remove players, and switch the Bedrock allow list on or off.
- **Create server** can add your active Microsoft account to the allow list automatically, so it can still join after you restrict the server.
- The allow list is written to `allowlist.json`; a running server is asked to reload it after every change.
- A warning appears when online mode is off, because Bedrock cannot verify Xbox identities without it.
- Friends can still be added from the console with `allowlist add <gamertag>`.

## Also included

- Microsoft sign-in now becomes the active player immediately, even when another account was selected (0.1.37).
- Bedrock Dedicated Server creation from 0.1.36.
- Windows Security exclusion fixes from 0.1.35.
- Pack sharing, server tools, resource packs and scheduled restarts from earlier releases.
