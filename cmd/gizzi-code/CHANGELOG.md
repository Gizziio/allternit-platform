# Changelog

## Unreleased

## 2.0.4 — 2026-09-05

Non-interactive first-run setup. `gizzi onboarding --defaults` picks an
installed CLI brain (or Allternit Cloud on a paid sub) without a TTY.

### Added
- `gizzi onboarding --defaults` — telemetry on, auth skipped, auto brain.

## 2.0.3 — 2026-09-05

Session children no longer survive close. Installed CLI brains (including
Grok) work without an Allternit API key. A Plus/Super/Ultra subscription
auto-defaults the brain to Allternit Cloud.

### Fixed
- Sidecar, CLI, shell, mux, and computer-use children are tracked and
  reaped on SIGINT/SIGTERM/SIGHUP/exit instead of detaching+unrefing.
- Desktop quit kills the gizzi process tree and stops the always-on daemon.
- `gizzi exec -m grok/default` crashed with `Auth.profilesForProvider is
  not a function`. Subprocess CLIs are treated as already-authed.
- Grok ACP spawn uses `--no-leader` so it does not attach to a parent TUI.

### Added
- First-run onboarding can pick an installed CLI as the default brain.
- Paid Plus/Super/Ultra (from `/api/v1/billing/subscription`) auto-sets
  `allternit/<cloud-model>` unless `/model` is pinned (`model_auto: false`).

## 2.0.2 — 2026-09-05

Windows is a supported platform. Credentials use DPAPI (CurrentUser) instead
of a plaintext file. Windows install paths: PowerShell installer, Scoop, winget.

### Changed
- Windows secure storage: DPAPI `ProtectedData` CurrentUser, with the
  existing plaintext file as last-resort fallback.
- Removed the boot-time “experimental / unsupported” Windows warning.
- Platform support table lists Windows as supported.

## 2.0.1 — 2026-09-05

Distribution completeness. Product naming is Allternit-only on the first-party
path. GitHub Release assets ship alongside npm so curl/Homebrew/Scoop can
install the same version.

### Changed
- Drop shipped Bedrock `anthropic.claude-*` model IDs.
- Product-owned Anthropic identifiers, first-party hosts, and remaining
  `x-claude-*` headers renamed to Allternit. Third-party npm names, models.dev
  provider id `"anthropic"`, Claude model IDs, and leftover-detect of upstream
  installs remain.
- npm publish also cuts a GitHub Release (`gizzi-code/v*`) with version-named
  tar.gz/zip assets and `checksums.txt`.
- Installer, Homebrew, Scoop, Chocolatey, Arch, RPM, and winget manifests
  point at `gizzi-code/v<version>` and try the unprefixed tag as fallback.

## 2.0.0 — 2026-09-04

Breaking naming purge. `CLAUDE_CODE_*` environment variables are no longer
read. Use `GIZZI_*` (same suffix). There is no fallback window.

### Breaking
- Env vars: `CLAUDE_CODE_X` → `GIZZI_X` with zero legacy fallback.
  `readGizziEnv` / `setGizziEnv` touch only the `GIZZI_` form.
- Product copy, docs, and feedback URLs no longer say "Claude Code".
- Hint protocol tag is `<gizzi-hint />` (`<claude-code-hint />` still parsed).

### Changed
- npm distribution is now cross-platform: the launcher shim
  (bin/gizzi.js) resolves the binary from a bundled dist/ or from the
  optional platform packages `@allternit/gizzi-code-<platform>-<arch>`
  (darwin-arm64, darwin-x64, linux-arm64, linux-x64, win32-x64), which are
  built per-platform in CI and published alongside the main package.
  `npm install -g @allternit/gizzi-code` now yields a working CLI on every
  supported platform.
- User-visible Claude/Anthropic fork traces removed: system-prompt presets,
  built-in agent prompts, TUI strings, and config-dir defaults are
  Gizzi-branded (`~/.gizzi` first, `~/.claude` retained as read-only
  legacy fallback). Model names and provider-genuine text (Anthropic API
  auth, wire protocol) are unchanged. See `docs/anthropic-allowlist.md`.
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
