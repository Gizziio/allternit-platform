# Session Attestation — Remote Control Gap Fix

**Date/Time:** 2026-08-26 21:13 local  
**Session ID / Branch:** `session/remote-control-gap-fix`  
**Agent:** kimi  
**Commit:** `564b67f65`  
**Remote:** `origin/session/remote-control-gap-fix`  

## Summary
Closed the remaining production gaps in the Remote Control surface: secured the push worker, hardened the PWA, and polished the setup UX.

## What was done

1. **Push worker security (Phase 4)**
   - `POST /subscribe` now requires a valid Clerk bearer token and verifies the user owns the requested `runtimeId`.
   - `POST /notify` accepts either the service secret (cloud → worker) or a paired runtime device token (gizzi → worker). Device-token auth enforces that the payload `runtimeId` matches the token’s runtime.
   - Added 90-day KV TTL for subscriptions, 5-minute TTL for pending payloads, and automatic deletion of dead subscriptions on `404`/`410` push responses.
   - Added per-runtime rate limiting on `/notify` (30 notifications per minute).
   - Rewrote `cmd/gizzi-code/src/runtime/integrations/remote-control-push.ts` to scope notifications to the cloud-paired `runtimeId`, include typed notification payloads (`permission`, `question`, `completed`, `error`), and subscribe to `Session.Event.Error`.
   - Added notification-type toggles in Remote Control settings.

2. **PWA hardening (Phase 5)**
   - Updated `remote-control.webmanifest` with a stable `id`, correct `start_url` (`/remote-control.html?source=pwa`), `scope: "/"`, and PNG icon references.
   - Added iOS PWA meta tags, `apple-touch-icon`, and `apple-touch-startup-image` to `remote-control.html`.
   - Rewrote `remote-control-service-worker.js` with an install-time precache for the app shell and icons, a network-fallback-to-cache fetch strategy, and `notificationclick` handling that opens `/remote-control.html?source=notification&runtime=...&session=...`.
   - Generated placeholder PNG icons (`remote-control-icon-192.png`, `remote-control-icon-512.png`) and splash screen (`remote-control-splash-1170x2532.png`), and added a `.gitignore` exception so they can be tracked.
   - Fixed the dashboard push flow:
     - Gate `pushManager.subscribe()` on `Notification.requestPermission()`.
     - Include `Authorization: Bearer <clerk>` headers on `/subscribe` and `/unsubscribe`.
     - Avoid calling `pushManager.unsubscribe()` when disabling a single runtime (which would break push for all other machines).
   - Added a new `GET /subscriptions?endpoint=...` endpoint to the push worker so the dashboard shows accurate per-runtime subscription state instead of guessing from the global browser subscription.

3. **UX cleanup (Phase 6)**
   - Replaced fake macOS accessibility/screen-recording toggles with honest copy and "Open System Settings" deep-links in `DispatchView.tsx` and `DispatchSettingsPanel.tsx`.
   - Added a `MockRuntimesBanner.tsx` banner when dev mock runtimes are active.
   - Added loading/status states to `RemoteControlHub.tsx`.
   - Improved empty states in `MachinesPanel.tsx`, `RemoteSessionPanel.tsx`, and `RemoteControlHub.tsx` with CTAs to pair a machine or open settings.

## Verification

- `pnpm typecheck` in `services/remote-control-push` passed.
- `pnpm typecheck:fast` in `surfaces/ai.allternit.com` showed no new errors in touched `remote-control` / `dispatch` files.
- `bun run typecheck` in `cmd/gizzi-code` showed no errors in touched `remote-control-push.ts` / `pairing.ts`.

## Outstanding work / deferred

- Replace placeholder PWA icons and splash screen with final design assets before launch.
- Run full manual E2E: pair runtime → open PWA → trigger permission/question → receive push → approve/respond.
- The remote-control Vite build still fails on a pre-existing top-level-await issue in a vendored dependency; that blocker is unrelated to these changes.
- Merge to `main` is pending steering review / PR approval.

## How to resume

The branch `session/remote-control-gap-fix` is pushed to origin at commit `564b67f65`. The original session worktree was removed before this attestation was written; any follow-up work should create a new linked worktree from the same branch or open a PR from `origin/session/remote-control-gap-fix`.
