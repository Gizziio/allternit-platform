# Session attestation — 01a0a014 — desktop Lume + mux production contract

- **Session:** grok `01a0a014-1884-7c73-8dde-08ef1e85ecc2` (Allternit Desktop bot-computer / packaging follow-on)
- **PR:** #532, merge `2f84e3684` into main
- **Date:** 2026-09-14 21:40

## What was done

Owner asked to stop treating unsigned local Resources copies as shipped, and to
land production packaging so Lume and allternit-mux actually go out in
`release-desktop.yml` / stock `pnpm run dist`.

1. **Lume** — `prepare-lume.cjs` downloads CUA Lume v0.3.9 for darwin arm64 and
   x64 (67-byte launcher + `lume.app` Mach-O). electron-builder overlays
   `resources/lume/${arch}/` into `bin/` so `allternit-api` finds
   `Resources/bin/lume`. Host copy also lands in `resources/bin` for unpackaged
   runs.
2. **allternit-mux** — `prepare-mux.cjs` stages the PTY daemon. macOS release
   lipos both archs; Windows copies `.exe`. GizziManager already resolves
   `resources/bin/allternit-mux` first.
3. **Gates** — `verify-packaged-resources.cjs` hard-fails if mux or Lume is
   missing. `build:electron` / `dist` / `pack` run the new prepares.
   `release-preflight.mjs` asserts the workflow + npm scripts (51/0).
4. **CI unblock** — empty `.gitmodules` + gitlinks at `droidrun` and
   `agent-desktop-rs` (from `f5482fa8`) made `actions/checkout` die in
   `submodule foreach`. Removed so Desktop CI can finish. Python droidrun
   wrappers stay in-tree.

## Verification evidence

- `node scripts/release-preflight.mjs` — 51 passed, 0 failed (local, /tmp clone).
- Desktop CI on `5f681d09`: unit tests pass (2m18s), typecheck+build pass (2m23s).
- gitleaks, typography, SW cache bump, Cloudflare Pages: pass.
- PR #532 merged to main as `2f84e3684` (merge commit, 2026-09-15T02:37:57Z).

## Incidents

- First two Desktop CI runs failed at checkout (droidrun gitlink, then
  agent-desktop-rs). Not caused by Lume/mux; pre-existing on main after
  `f5482fa8`. Fixed in the same PR so the release-path change could merge green.
- Local `/Applications` b2818 was an unsigned arm64 electron-builder package
  with from-source sidecars. That is **not** a production release.

## Honest deferrals

- **Notarization / Developer ID** — `identity: null`, `APPLE_*` still absent.
  `desktop-v*` tags remain unsigned/Gatekeeper-blocked for other machines.
- **whisper-cli in CI** is still host-arch only (not lipo'd).
- **Stock dual-arch `pnpm run dist`** is now content-correct (Lume+mux in the
  chain) but was not run as a full universal DMG in this session.
- AGENTS.md step 8 (rebuild local preview DMG from merged main) follows this
  attestation; it is still unsigned.
- Bot-computer dedicated window SPA/VNC claim-fight work from the same grok
  session is **not** in #532.
EOF