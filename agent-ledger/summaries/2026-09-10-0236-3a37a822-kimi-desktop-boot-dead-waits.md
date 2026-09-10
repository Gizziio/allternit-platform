# Attestation — session/3a37a822-p4: desktop cold-boot dead waits

- **Session:** 3a37a822 (kimi, phase 4)
- **Date:** 2026-09-10
- **PR:** #237 (merge `2926d044`)
- **Worktree:** `allternit-session-3a37a822-p4` on `session/3a37a822-p4` (cleaned up after attestation)

## Why

Owner asked why the API "takes so long to boot". Measured from real log
timestamps: the bundled `allternit-api` listens **0.2s** after spawn. The
~60s to a rendered window was dead waiting in the desktop main process.

## What changed (two fixes; both in `surfaces/allternit-desktop/src/main/`)

1. **`backend-manager.ts` — 30s dead port probe (the big one).**
   `ensureBackend` probed :8013 for a reusable backend via `waitForUrl`,
   which swallows ECONNREFUSED and polls the full 30s `HEALTH_TIMEOUT_MS`
   on every cold boot even though nothing will ever answer. Extracted
   `probeExistingBackend()` (`usable` | `misbehaving` | `none`): a one-shot
   fast probe returns `none` immediately on ECONNREFUSED; ambiguous errors
   (timeouts/resets — possibly a backend mid-start) keep the patient probe;
   healthy-but-not-serving-platform stays `misbehaving` and the
   terminate-and-replace path is preserved exactly.
2. **`acu-gateway-manager.ts` — 20s wait for a process that died in 35ms.**
   The packaged `launch.py` crashes instantly (`ModuleNotFoundError:
   No module named 'uvicorn'` on this machine), but the child exit handler
   nulled `this.child` before `waitForHealth` checked `child.exitCode`, so
   the early-exit never fired. A `childDied` flag set in the exit handler
   before the reference is cleared makes the health wait give up as soon as
   the process exits. (`AcuGatewayManager` class exported for tests.)

**Investigated and deliberately NOT changed:** the ~20s "Clerk session
timed out" at boot is `recoverAccountEmail()` — fired `void`/parallel, only
for synthetic-email paired identities, off the boot critical path. Touching
auth behavior wasn't warranted for boot time.

## Verification

- Desktop typecheck (main + preload) clean; desktop vitest **125/125**,
  including a new 4-case `probeExistingBackend` suite and an
  `AcuGatewayManager` crash fast-fail test with a <2s regression bound
  (un-fixed code takes 20s/30s respectively, so regressions fail loudly).
- `node scripts/release-preflight.mjs` → **26/0** (release-lock gate;
  release-path change).
- **Live measurement after rebuilding the installed app's asar from merged
  main:** cold boot to `GET /api/v1/global/health` = **200 went from ~52s to
  9 seconds**.

## Install note

The fix shipped to the owner via a surgical asar swap (rebuilt
`dist/main`+`dist/preload` from `session/3a37a822-p4`, packed into
`~/Desktop/Allternit-Desktop-fresh.app/Contents/Resources/app.asar`;
previous asar backed up at `/tmp/3a37a822-app.asar.bak` during the swap, may
be gone after reboot). The DMGs in the p2 worktree from earlier today
predate this fix; the next full `pnpm run dist` will include it.

## Incidents / environment notes

- Another agent session was mid-e2e (`/tmp/wizard-e2e/run5.cjs`) against
  `/Applications/Allternit Desktop.app` during final verification; that copy
  owns the shared Electron profile, which prevented a second CDP render
  check of the fresh app. The 9s API measurement was taken with the profile
  free and is valid; the renderer code is unchanged by this PR (main-process
  timing only).
- Pre-existing, unrelated: connector sidecar crash-loops (missing
  `@hono/node-server` in packaged resources), voice service pyexpat binary
  built for a newer macOS, mesh enrollment 502s. All non-fatal, none on the
  critical path after this fix, all worth their own tickets.
