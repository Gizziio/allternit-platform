# Provenance

This directory is a **fully vendored copy** of [xnohat/webobsidian](https://github.com/xnohat/webobsidian), imported directly into the Allternit monorepo — not a git submodule, not an npm/runtime dependency on any xnohat-hosted service.

- **Upstream repo:** https://github.com/xnohat/webobsidian
- **Imported at commit:** `c41967a93317b2a0f08511c349ef3dbaf78fc882`
- **Commit date:** 2026-06-27
- **Imported into Allternit:** 2026-08-05
- **License:** MIT (see `LICENSE` in this directory, preserved unmodified)

## Why vendored instead of a submodule

Allternit runs this as a self-hosted local mini app (spawned by `surfaces/allternit-desktop`'s mini-apps-manager, exactly like OpenClaw/Hermes/oh-my-pi) pointed at the user's own Vault/Brain markdown directory. A fully vendored copy means there is no live link back to the upstream repository or to xnohat as an individual — updates only happen when we deliberately re-import a newer commit and review the diff. This is a small, young project (223 stars at import time) chosen specifically because its stack (Node/Express/TS backend, React/Vite/CodeMirror 6 frontend) matches the rest of Allternit exactly, so we can read and patch its TypeScript directly rather than treating it as an opaque binary — vendoring, not a submodule, keeps that option open.

## Why WebObsidian over the alternatives considered

Compared against building a bespoke note viewer/editor from scratch and against vendoring SilverBullet (5.8k stars, MIT, but Rust backend + Preact frontend). WebObsidian's exact stack alignment with gizzi-code (Node/TS) and ai.allternit.com (React) was the deciding factor — deep customization later needs TypeScript we already own everywhere else, not Rust we'd need to learn to safely modify. WebObsidian already ships wikilinks, a force-directed graph view, full-text search, live CodeMirror 6 editing, tags, version history, trash, and a scoped REST "Agent API" — the full feature set requested, with no bespoke frontend needed.

## Runtime independence audit (performed at import time)

Searched the full `server/src/` and `web/src/` trees for any call back to a project-controlled or third-party endpoint, plus telemetry/analytics keywords (`telemetry`, `analytics`, `sentry`, `posthog`, `mixpanel`, `amplitude`, `google-analytics`, `segment.io`). Findings:

- **Zero telemetry/analytics matches anywhere.**
- `server/src/services/plugins.ts:105` — `https://api.github.com/repos/${repo}/releases/latest`, used only when a user explicitly installs a community plugin by GitHub repo reference (WebObsidian's own opt-in plugin system, analogous to a package manager's registry call — not a background phone-home). Left in place, untouched.
- `server/src/services/git.ts` — constructs authenticated clone URLs (`https://<token>@<host>/...`) entirely from user-configured `settings.git.remote`/`settings.git.token` (the optional "GitHub sync" feature) — no hardcoded remote. Not used by Allternit's integration (we don't configure git sync; the vault directory itself is Allternit's own git-backed root, already synced independently).
- No `postinstall`/`preinstall`/`prepare` scripts in any `package.json` (root, `server/`, `web/`).

## Changes made relative to upstream

- Dropped `desktop/` (Obsidian's own Electron wrapper — Allternit has its own desktop shell; this was dead weight and a second, redundant auto-update/packaging surface).
- Dropped `sample-vault/` (Allternit always points `VAULT_PATH` at the real vault via `resolveBrainPath()`; a bundled sample vault risked being accidentally served).
- Removed `desktop` from root `package.json`'s `workspaces` array and dropped its `desktop*` npm scripts, since the workspace directory no longer exists.
- Deleted the upstream `package-lock.json` (regenerated fresh on first `npm install` without the `desktop` workspace).
- No further source edits at import time. Allternit-specific configuration (vault path, data directory, port, generated password) is supplied entirely via environment variables at process-spawn time (see `surfaces/allternit-desktop/src/main/mini-apps-manager.ts`'s `MINI_APP_CONFIGS['vault-viewer']` entry) — no source patches were required to fit Allternit's conventions. If that changes, record the diff here.

## Confirmed runtime configuration (read directly from `server/src/config.ts` at import time)

| Env var | Purpose | Default |
|---|---|---|
| `PORT` | HTTP listen port | `8787` |
| `HOST` | Bind address | `0.0.0.0` (Allternit overrides to `127.0.0.1`) |
| `VAULT_PATH` | Markdown vault directory | `./sample-vault` (Allternit overrides to `resolveBrainPath()`) |
| `DATA_DIR` | Where `settings.json` + `qmd-index.json` live — confirmed never written inside the vault directory itself | `./data` (Allternit overrides to a path under Electron's `userData`) |
| `ALLOWED_ROOTS` | Comma-separated file-browser allowlist | unset (Allternit sets to `resolveBrainPath()` only) |
| `WEBOBSIDIAN_PASSWORD` | Recovery/override login password, always accepted regardless of the stored user password (see `server/src/services/auth.ts`'s `checkPassword`) | unset |
| `COOKIE_SECURE` | Force the auth cookie's `Secure` attribute | `auto` (matches request transport) |

## Auth model (read directly from `server/src/services/auth.ts` + `routes/auth.ts` at import time — relevant to how Allternit auto-authenticates this mini app)

- A stored `userPasswordHash` (scrypt) is the primary credential once set; until then, the literal default `123456` is accepted.
- `WEBOBSIDIAN_PASSWORD` (our generated secret) is checked as a **separate, always-valid override** — independent of whether `userPasswordHash` has been set — so logging in with it always succeeds regardless of state.
- `GET /auth/status` and every login/session response report `mustChangePassword: !hasCustomPassword()` (true whenever `userPasswordHash` is still unset), and the SPA (`web/src/App.tsx`) renders a full-screen forced `ForceChangePassword` component whenever that's true — **this fires even after a successful override-password login**, since the override path never sets `userPasswordHash`.
- Allternit's integration therefore does two calls on first install (see `mini-apps-manager.ts`), not one: `POST /login` with the generated password, then immediately `POST /change-password` with `{currentPassword: <generated>, newPassword: <generated>}` — this permanently sets `userPasswordHash` to a hash of our own generated secret, so `mustChangePassword` becomes false forever after and the forced-change screen never appears in the embedded webview.
