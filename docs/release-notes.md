# Newbie Launcher 0.1.35

Windows Security exclusions are now reliable and fail gracefully.

## Bedrock

- Fixed the false **“Could not add the exclusion”** error when Windows accepted some folders but rejected another.
- Exclusions now run from a shared script/result folder, so an elevated process can always hand the result back to Newbie.
- Newbie verifies each exclusion after Windows applies it. If Windows silently ignores a change (for example under Tamper Protection or a managed policy), it reports the exact folders instead of claiming success.
- Partial success is no longer treated as a hard failure. The setup card lists the folders that still need approval.
- Added **Open Windows Security** and **Copy paths** actions for manual approval when Windows blocks the automatic change.
- Tamper Protection status is detected and explained in the setup card.

## Also included

- Pack sharing and instance-to-instance add-on copying from 0.1.34.
- Server command snippets, TPS, resource packs and scheduled restarts from 0.1.33.
- Everything from earlier releases is included.
