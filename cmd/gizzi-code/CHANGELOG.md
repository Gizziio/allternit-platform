# Changelog

## Unreleased

### Changed
- Windows is now explicitly labeled experimental/unsupported (macOS primary,
  Linux supported). The CLI prints a one-line stderr warning on boot on
  win32: no secure credential store — credentials fall back to a
  permission-hardened local file.
- Shell profile edits are marker-disciplined: the installer writes PATH
  lines between `# gizzi-code begin` / `# gizzi-code end`, and the
  uninstaller removes only that block. Profiles without markers are left
  untouched (with a warning) instead of being rewritten line-by-line.
- install.ps1: exact semicolon-delimited User PATH comparison, an explicit
  note when using the x64 build on ARM64, and a clear error under a
  Restricted execution policy.

### Docs
- README "Platform support" section; mirrored one-liner in
  docs/TROUBLESHOOTING.md.

## 1.0.2 — 2026-09-04

Production-readiness release.

### Fixed
- `gizzi exec` and other one-shot commands hanging forever after completing
  (background runtime handles held the event loop).
- Production build crash (`import type` in db.ts) and bundler syntax errors.
- SSRF in the web proxy (redirect chasing, DNS rebinding, CGNAT range).
- Dead cloud defaults repointed to api.allternit.com / headscale.allternit.com.
- Installer scripts (curl | bash, PowerShell) — tag parsing, asset names,
  checksum verification; proven against a live release.
- `gizzi upgrade` version check and npm package targeting.

### Security
- Committed Clerk test key removed; gitleaks CI gate added (rotate any
  previously committed keys).
- Hardcoded dev-token acceptance removed from the platform auth server and
  cloud-api (operator-configured escape hatch defaults off and refuses in
  production).
- Token storage moved to sha256 (cloud-api); scoped `alt_` API tokens.
- `gizzi api-keys` command with durability heuristics (durable `alt_` keys vs
  short-lived Clerk JWTs).

### Added
- CI quality gates on release workflows (typecheck + smoke suite + built
  binary smoke).
- `gizzi api-keys list/set/remove`.
- Centralized cloud/gateway URL constants (single flip point for the Backend B
  public deploy).
- PG migration runner in cloud-api.
- cron automation and vault test coverage; dist-staleness preflight.

## 0.2.3 and earlier

Early development releases. See git history.
