# Newbie Launcher 0.1.6

Custom offline skins.

## Added

- Offline and TLauncher accounts now have a **Custom skin** card on the Accounts page.
- Upload a standard Minecraft skin or any image. PNG, JPEG, WebP, BMP, GIF and TIFF are accepted.
- Standard 64×64 / 64×32 skins are used as-is. HD skins are downscaled. Other images become a clean face-based skin automatically.
- The launcher previews the skin on the account and shows it throughout the UI.
- On launch, Newbie writes a client-side resource pack and enables it in the instance's `options.txt`, so the skin appears on the default player model without a skin server or mod.
- Remove the custom skin at any time to restore the normal offline/TLauncher look.

## Notes

- The in-game skin is client-side. Other players on servers will not see it.
- TLauncher remote textures are cached; refreshing the account clears the cache.
- A custom skin set on a TLauncher account is preserved by refresh until you remove it.
- Everything from 0.1.5 (launch locking and automatic updates) is included.
