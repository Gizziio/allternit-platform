# Session attestation — desktopfix-0912 (startup window lifecycle hardening)

- **Agent:** kimi-code (interactive session with Eoj)
- **Date:** 2026-09-12 23:25 local
- **PR:** #453 (merged 2026-09-12, merge commit `6e66965cec382e7520b9731ee9ec270538b4f1c0`)
- **Branch:** `session/desktopfix-0912`

## What was done

Fixed the "app not rendering" failure seen while installing the #445
port-ownership build. Two bugs, one symptom (windowless zombie app — sidecars
running, no UI, no error dialog):

1. **Fragile splash sends** (`unified-main.ts`). Any IPC send to the startup
   window threw `Object has been destroyed` once the window was destroyed
   mid-init. The throw aborted `initializeBundledMode`; the catch block's own
   unguarded `splashWindow?.webContents.send('error', …)` then re-threw
   **before** `dialog.showErrorBox` + `app.quit()` ran — the process stayed
   alive with no windows. Fix: every splash send now goes through
   `sendToSplash()`, which guards `isDestroyed()`; the error dialog + quit
   always execute.

2. **First-launch static miss** (`backend-manager.ts`). First launch after a
   fresh install spawned `allternit-api` with empty
   `ALLTERNIT_PLATFORM_STATIC` (resources path momentarily unresolvable at
   spawn), so `GET /` served the 501 stub, the shell fell back to the remote
   platform, and the startup gate wedged ("allternit-api did not start within
   30s"). Fix: `BackendManager` now self-heals — if the api is healthy but
   serves no platform UI while a static export is resolvable on disk, it
   restarts the sidecar once with the export set (`staticRespawnAttempted`
   one-shot).

## Verification evidence

- Desktop `npm run typecheck` (main + preload tsconfigs) — clean.
- `backend-manager.test.ts` — 4/4.
- `node scripts/release-preflight.mjs` — 35 passed, 0 failed.

## Incidents / honest deferrals

- The root cause of the momentary resources-path miss on first launch after
  install is unproven (Gatekeeper translocation suspected but does not fully
  fit; macOS TCC also revoked Desktop access mid-session tonight). The
  one-shot self-heal covers the symptom regardless; if it recurs, capture
  `resolvePlatformStaticPath()` diagnostics before the respawn.
- Desktop rebuild from fresh main (34 commits ahead of the prior install) +
  install is performed in this same session after this attestation; see
  follow-up note in LEDGER.md.
