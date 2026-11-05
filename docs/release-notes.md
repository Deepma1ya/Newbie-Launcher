# Newbie Launcher 0.1.40

The launcher now gets out of the way while you play.

## Tray mode

- Starting a Java or Bedrock game hides Newbie in the notification area instead of leaving it over the game.
- When the last running game closes, Newbie reopens automatically and comes back to the foreground.
- Multiple games are tracked together: the launcher stays hidden until every game has closed.
- **Open Newbie Launcher** or a double-click on the tray icon restores the window, including when it was minimized.
- The setting is now called **Hide to tray while a game runs** and is enabled by default. Its description explains the automatic reopen.
- If the tray icon cannot be created, Newbie falls back to minimizing the window instead.
- Duplicate game-exit signals no longer update playtime or restore the window twice.

## Also included

- `.mrpack` import from the pack-sharing dialog and the Instances page (0.1.39).
- Bedrock Microsoft account card, Xbox app shortcut, and Bedrock server allow lists (0.1.38).
- Microsoft sign-in activation fix, Bedrock Dedicated Server creation, server tools, resource packs and scheduled restarts from earlier releases.
