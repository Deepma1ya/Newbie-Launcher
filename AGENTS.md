# Agent instructions

## Release after every app update

The maintainer expects a GitHub release after every user-visible update.

1. Bump the patch version in `package.json` and `package-lock.json`.
2. Update `docs/release-notes.md` with the new version and a short summary.
3. Update the static version fallback in `site/index.html` and `site/script.js`.
4. Run `npm run typecheck`, `npm test` and `npm run build`.
5. Commit the feature and release changes separately, then push `main`.
6. Create and push the matching `vX.Y.Z` tag. `.github/workflows/release.yml` builds and publishes the installer.
7. Confirm the release, installer assets and `latest.yml` on GitHub.
8. The product site is deployed by `.github/workflows/pages.yml` and reads the latest release from the GitHub API, so its version and download button follow the release automatically.

Never stage local-only files such as the unrelated `minecraft bedrock fix/` folder.
