# Newbie Launcher 0.1.15

Bedrock support.

## Added

- A dedicated **Bedrock** page for Minecraft for Windows, with release and preview channels.
- Full signed GDK packages from the public, MIT-licensed [GdkLinks](https://github.com/MinecraftBedrockArchiver/GdkLinks) catalog. Trial and demo entries are rejected.
- Version downloads with progress, resume and cancel; installation through Windows/Gaming Services; launch of the installed package.
- Installed Bedrock detection, Play button, Microsoft Store link, and Gaming Services / Developer Mode status.
- Version switching. Windows keeps one Minecraft package installed at a time; worlds and settings are preserved.
- An opt-in Windows Security exclusion with an explicit in-app consent dialog, followed by the Windows UAC prompt.
- The exclusion covers only Newbie's Bedrock folder, the official Minecraft data folders and installed Microsoft package folders. Third-party DLLs, online fixes and cracks are never excluded.
- A Bedrock section and screenshot in the README.

## Notes

- Bedrock requires a Microsoft account with Minecraft for Windows or Game Pass. Newbie does not bypass licensing.
- Gaming Services is required for GDK package installation; Developer Mode is recommended.
- Bedrock is not moddable. Modrinth, loadouts, shaders and repair remain Java-only.

Everything from 0.1.14 (fast instance deletion), 0.1.13 (console only on crashes), 0.1.12 (repair reliability), 0.1.11 (new icon) and earlier is included.
