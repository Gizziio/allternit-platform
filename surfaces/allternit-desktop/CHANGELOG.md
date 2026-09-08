# Changelog

All notable changes to Allternit Desktop are documented here.
Releases are tagged `desktop-v<version>`.

## [1.1.1] — 2026-09-08

### Fixed
- **Native session pickup works out of the box.** Desktop 1.1.0 shipped the
  "Continue a CLI session" picker, but its bundled `allternit-api` and
  `gizzi-code` binaries were built ~1 hour before the native-sessions feature
  merged (2026-09-06 20:21 vs 21:34), so every `/api/v1/native-sessions/*`
  call fell through to the SPA HTML and the picker showed a JSON parse error.
  This release bundles current builds of both binaries — verified end-to-end:
  catalog, pickup, and origin banner all work in the packaged app.

## [Unreleased]

### Hardening (production-readiness audit, desktop track)

- CI honesty: desktop typecheck (`npm run typecheck` over main + preload) is a
  hard gate in `ci-desktop.yml` — failures fail the job.
- Notarization: `scripts/notarize.cjs` now fails loudly (non-zero exit) when
  `APPLE_ID` / `APPLE_ID_PASSWORD` / `APPLE_TEAM_ID` are missing on CI builds,
  instead of silently shipping an unnotarized app. Local unsigned builds still
  skip with a warning.
- Release pipeline: build jobs (macOS, Windows, new Linux) no longer publish —
  they run electron-builder with `--publish never` and hold no
  `contents: write` permission or `GH_TOKEN`. Exactly one job
  (`release` → `softprops/action-gh-release`) publishes, after collecting
  artifacts from all build jobs. Eliminates the double-publish race between
  electron-builder's GitHub provider and the release job.
- Release pipeline: new `build-linux` job (ubuntu) builds the Linux unpacked
  dir target (`electron-builder --linux --dir`) as a smoke test for the Linux
  configuration. Artifacts are uploaded for inspection but not attached to the
  GitHub release.
- Version bumped to 1.1.0.

### Recent work covered by this release

- Hermes HUD port refinements and crash fixes (annotation overlay, system
  theming, drag handle, HUD IPC handlers, panel visibility smoke tests).
- Native macOS dictation helper packaged with the app.
- Mesh-node (tailnet) sidecar staged into packaged resources for macOS,
  Windows, and Linux builds.
- Clerk auth aligned to the production `clerk.allternit.com` instance.
- Desktop packaging pipeline hardening (DMG/installer/auto-update) and
  packaged-resources verification.
