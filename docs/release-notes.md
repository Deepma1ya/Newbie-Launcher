# Newbie Launcher 0.1.32

Bedrock exclusions now follow every installed version.

## Windows Security

- After each Bedrock install, Newbie asks once whether to exclude the newly installed Minecraft package folder before you play.
- The **Play** button checks that installed version's folder first and offers **Exclude and play** when it is not covered yet.
- The setup card now reports the real exclusion state — all folders, some folders, or none — instead of trusting a one-time flag.
- Windows requires administrator approval to read the exclusion list. When it is hidden, Newbie falls back to its last confirmed record and still re-checks every new install folder.
- Exclusions stay opt-in: nothing changes without the in-app confirmation and Windows UAC prompt. Only Newbie's Bedrock download folder, Microsoft's official Minecraft data folders and the installed Microsoft package folder are excluded. Third-party files are never excluded.

Everything from 0.1.31 and earlier is included.
