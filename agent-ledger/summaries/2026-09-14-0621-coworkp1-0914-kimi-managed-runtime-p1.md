# Attestation — session/coworkp1-0914: Consumer-packaged Cowork Phase 1 "Managed Runtime"

- **Date:** 2026-09-14
- **Agent:** kimi (Kimi Code CLI), session `coworkp1-0914`
- **PR:** #507 — merged to main `9e05bbcbcdbebcff324a0f2d2d1ded5581a2bcfe` (owner-authorized)
- **Phase:** P1 Managed Runtime of the Consumer-Packaged Cowork plan (DAG in `MASTER_TRACKING.md`)

## What was done

The dark finding: the desktop auto-started allternit-api (`unified-main.ts`),
gizzi runtime, and office-engine — but NOTHING provisioned or launched the
Fabric Transport worker; it was a manual token + `bun worker-entry.ts` flow.
P1 makes the whole engine alive with zero terminal interaction:

- **1.1 Auto-provision** — local-only `POST /api/v1/fabric/transport/local/ensure-worker-principal`
  (desktop access-token gated, fail-closed unconfigured; `auth::verify_desktop_access_token`;
  `sqlite_store::ensure_gizzi_principal`; token returned once, hash stored);
  `BackendManager` per-boot `ALLTERNIT_DESKTOP_ACCESS_TOKEN` +
  `getLocalAuthHeaders()`; desktop Keychain-backed `secure-store.ts`.
- **1.2 Managed launch** — `gizzi-code fabric-worker` subcommand (daemon
  entry inside the single-file sidecar; relative dynamic import, Bun-safe);
  `fabric-worker-manager.ts` (spawn, `worker.daemon_start` readiness,
  backoff+jitter respawn, SIGTERM graceful stop, SIGKILL escalation);
  Step 2.5 wiring in `unified-main.ts`; worker SIGTERM precedes API
  shutdown on quit.
- **1.3 Engine status** — aggregate green/yellow/red pill over API / gizzi /
  fabric worker / office engine in the shell chrome (`engines:get-status`
  IPC + push; preload `window.allternit.engines`; splash rows).
- **1.4 Folder grants** — startup-wizard "Grant workspace folders" step
  (native directory picker, skip allowed) → `trusted_folders` via
  `/cowork-preferences` with desktop local auth; boot waits for the save.

## Verification

- 40/40 `allternit-cowork-runtime` tests (2 new managed-runtime store tests);
  `cargo build -p allternit-api` clean; clippy clean on touched files.
- Desktop main/preload tsc clean; gizzi typecheck clean; SPA typecheck clean.
- `release-preflight.mjs` 36/0.
- Live evidence (`tmp/coworkp1-evidence/`): ensure route 403/403/200,
  once-only token, rotation kills old token (claim 401), folder grants
  GET→PUT→persisted, worker daemon_start + SIGTERM stop via the daemon
  entry AND the new CLI subcommand.
- Unsigned `-local` DMG built from the branch; bundle grep-verified.

## Incidents / honest notes

- Full fresh-profile GUI click-through NOT exercised: the owner's live
  desktop session held the canonical ports (8013/4096); a parallel launch
  would have intruded. Non-interactive pieces verified live instead.
- gizzi `bun --compile` embeds JS bytecode — `fabric-worker` strings not
  greppable; verified by execution.
- Merge to main required a forward merge of origin/main (another session's
  ledger attestation landed mid-phase); only `.steering/checkpoint.md`
  conflicted.

## Deferrals

- P2–P5 (owner-directed next phases in the same session umbrella).
