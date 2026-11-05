# Newbie Launcher 0.1.21

Java 25 and more Java choices.

## Java

- Added Java 25 to the Java settings page, alongside Java 21, 17, 11 and 8.
- Install buttons now show when a major is already installed; only missing versions are offered for download.
- The per-instance **Java runtime** picker now includes direct install options for missing majors:
  - choose **Java 25 · install Temurin** and Newbie downloads it, then selects it for that instance;
  - the same works for Java 21, 17, 11 and 8;
  - detected runtimes from any vendor remain selectable.
- Automatic Java now prefers the exact major a Minecraft version needs. A newer installed runtime no longer silently replaces it — for example, Java 25 will not be used for a Java 21 instance unless you select it explicitly.
- Java 25 is optional and intended for newer versions or mods that explicitly support it. The instance picker warns about this.

## Notes

- Adoptium JRE downloads are still verified against their SHA-256 checksum.
- Java 8, 11, 17, 21 and 25 are all available from the same installer.
- Everything from 0.1.20 (essential mod protection), 0.1.19 (datapacks) and earlier is included.
