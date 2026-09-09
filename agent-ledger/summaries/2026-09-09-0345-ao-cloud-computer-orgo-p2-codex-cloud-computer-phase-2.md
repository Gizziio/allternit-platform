# Session summary — ao/cloud-computer-orgo-p2 — codex+kimi — cloud-computer-orgo-parity Phase 2

**Date:** 2026-09-09 · **Branch:** `ao/cloud-computer-orgo-p2` · **PR:** #204 (merged, merge SHA `75aa78756`, head `03c1d6664`) · **Spec:** rq-20260909-004 Phase 2 (Lifecycle parity)

## What was done

- **`PATCH /api/v1/computers/:id/resize`** — validated cpu/mem/disk (existing allowlists); new `ExecutionDriver::resize_vm` trait method (default NotSupported); Incus applies `limits.cpu`/`limits.memory` live via a new substrate `patch_config` (proven PATCH pattern); **disk requires stopped → 409** (honest semantics, no fake 207); row updated after success; Tart/others → 501. `DriverCapabilities` gains serde-default `resize`/`clone` flags (Incus alone true).
- **`POST /api/v1/computers/:id/clone`** — new `clone_vm` trait method; Incus: stateful `clone-<uuid>` snapshot → `POST /1.0/instances` `source:{type:"snapshot"}` with limits copied inline → **fresh VNC proxy device** (a copied proxy would collide on the source port) → start; intermediate snapshot retained as restore point; new computers rows mirror owner/resources/billing/group/timeout; credits gate reused; Tart 501.
- **Idle auto-stop** — migration V135 (`idle_timeout_secs`, `last_activity_at`); `PATCH /computers/:id` sets/clears timeout (60..86400); activity touched post-auth in control/lifecycle handlers (unauthorized requests can't keep a computer alive); 60s sweeper (`COMPUTER_IDLE_SWEEP_SECS` override) reuses the manual-stop path (bot usage cleanup intact), skips `human_controls`, rechecks eligibility immediately before stopping.
- **Workspaces-lite** — migration V136 (`computer_groups` + `computers.group_id`, FK `ON DELETE SET NULL`, group connections enable foreign_keys); group CRUD scoped to user/org owner, attach/detach with single-group move semantics (`moved_from`), `?group_id=` list filter.
- **TS client** — resize/clone/updateComputer + full group surface; typed throughout.

## Verification evidence

- `cargo check -p allternit-api -p allternit-computer-cloud -p allternit-driver-interface` clean (0 errors, re-verified by orchestrator after rebase).
- `cargo test -p allternit-api computer`: **28/28**; `-p allternit-computer-cloud`: **100/100** (orchestrator aggregated independently — matches claims).
- Surface `tsc --noEmit` clean (dedicated `tsconfig.computers-api.json` with existing-dep symlinks, no installs).
- ACI confirmation/classification and bot start/stop byte-compared with HEAD: unchanged.
- Live substrate smoke deferred honestly: no Incus configured in the executor process; read-only availability probe captured.

## Incidents / honest deferrals

- Migration numbering departed from the task (V133/V134 were taken by migrations that landed mid-phase; UNIQUE(version) failures demonstrated; used V135/V136 instead).
- Executor stopped at the steering commit gate: the consult transport hung (kimi backend processes ran but the hook never returned a verdict) and codex reported **<5% weekly quota remaining**. Orchestrator took the commit/push/merge per the repo's documented escape after Phase 5 review.
- Real VM resize/clone/auto-stop behavior remains unverified against a live Incus — the HTTP sequences are unit-tested with mock transport, but a live smoke on the Incus host is owed.
- Phase 3+ (real-time plane, templates-as-code, distribution) not started.
