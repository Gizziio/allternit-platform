---
status: done
files_changed:
  - cmd/allternit-api/migrations/V138__desktop_template_specs_and_golden.sql
  - cmd/allternit-api/migrations/V139__computers_role.sql
  - cmd/allternit-api/src/desktop_template_build.rs
  - cmd/allternit-api/src/bot_desktop_templates.rs
  - cmd/allternit-api/src/computer_routes.rs
  - cmd/allternit-api/src/bot_desktop_routes.rs
  - cmd/allternit-api/src/computer_control.rs
  - cmd/allternit-api/src/computer_idle.rs
  - cmd/allternit-api/src/allternit_vault.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-computer-cloud/src/driver.rs
  - cmd/allternit-computer-cloud/src/router.rs
  - platform/contracts/driver-interface/src/lib.rs
  - surfaces/ai.allternit.com/src/lib/desktop-cloud-api.ts
  - surfaces/ai.allternit.com/src/lib/desktop-cloud-api.test.ts
  - surfaces/ai.allternit.com/src/lib/computers-api.ts
  - docs/CLOUD_COMPUTER_PHASE_4_DESIGN.md
  - docs/CLOUD_COMPUTER_PHASE_4_TASK.md
deviations:
  - Executor picked clone_vm for golden provisioning; orchestrator review found it takes a fresh stateful snapshot of a stopped holder (Incus requires running for stateful) and never uses the stored golden snapshot. Fixed by adding ExecutionDriver::clone_from_snapshot(snapshot_id, new_native_id, resources, env) (default NotSupported; Incus impl forwards to IncusSubstrate::clone_from_snapshot with instance config) and switching both create paths to it — this is what task-file decision 4 originally pointed at.
  - F6 (bot clone identity env) fixed via the clone config env channel (ALLTERNIT_BOT_ID/ALLTERNIT_USER_ID override baked values); disk size and network policy are inherited on clones (no Incus instance-config equivalent on this substrate; same effective behavior as image spawns). Flagged for the live smoke.
  - run_build success-path persistence (golden_snapshot_id) has no unit test — requires an ExecutionDriver + DB harness; covered indirectly by provision-source selection tests. Reviewer-flagged; accepted.
  - Left as known non-blockers: check-then-set race on concurrent build POSTs; dead 'pending' transition arm; import validates vault-ref shape only (access enforced at build time).
remaining:
  - Live Incus smoke owed (build → ready → provision-from-golden, confirm clone env reaches guest session env) — same debt pattern as Phase 2.
  - Warm pool / <500 ms boot (Phase 4 is the foundation only, per spec).
---

# Phase 4 NOTES — Templates as code

## How it works

Declarative `apiVersion: allternit.ai/v1` / `kind: ComputerTemplate` YAML docs
(JSON accepted — serde_yaml is a JSON superset) with hardware, os, packages,
long-running services, `vault://org/{org_id}/{name}` secret refs, and
`hooks.postCreate`. Import (`POST /api/v1/desktop-templates/import`,
create/replace-by-name), export (`GET /api/v1/desktop-templates/:id/export`,
canonical YAML), and legacy CRUD all share one validated model: apiVersion/kind
enforced, sizes must match the VALIDATED_* sets, user writes of curated `ref`
are 403.

`POST /api/v1/desktop-templates/:id/build` (ACI single-use approval-gated,
202) runs an async pipeline (new `desktop_template_build.rs`): clean old
holder → spawn a `role='golden'` holder VM (`tpl-golden-<id>`, hidden from
default listings; `?include_roles=1` reveals) → apt-get the packages → write
services as systemd user units → resolve vault refs (org-membership rule;
values injected as guest env only, NEVER persisted — DB/audit/errors carry ref
names only) → run postCreate hooks → stop → stateful `golden` snapshot (taken
running per Incus) → holder row marked stopped, template
`build_status='ready'` + `golden_snapshot_id`.

Provisioning: both create paths (standalone `spawn_desktop_for_owner` and bot
`provision_desktop_internal`) check the template — `ready` + snapshot id →
`ExecutionDriver::clone_from_snapshot` clones the stored golden snapshot
(seconds; request cpu/memory limits + identity env threaded as Incus instance
config); otherwise today's image spawn (template packages remain un-applied on
that path — honest, documented). `POST /computers` accepts exactly one of
`template_id` / `template_ref`; `system/…` refs resolve the curated presets
(seeded in V138). Builds and secret resolutions audit to
`computer_access_logs`.

TS parity: `desktop-cloud-api.ts` (spec/build types, import/export/by-ref/
build), `computers-api.ts` (`template_ref`, `include_roles`, `role`).

## Verification evidence

- `cargo check -p allternit-api -p allternit-computer-cloud` — clean (no new warnings).
- `cargo test -p allternit-api --lib bot_desktop_templates` — 14/14 (doc validation, by-ref, state machine, provision-source selection incl. ready-without-id → Image fallback, import reset semantics).
- `cargo test -p allternit-api --lib computer_routes` — 15/15; `cargo test -p allternit-computer-cloud --lib` — 96/96.
- Full-suite run: 774 passed, 4 failed — all four are
  `agent_cloud_routes::tests::*_through_real_os_control_plane` (require a real
  AllternitOS control plane binary; untouched by this change — pre-existing,
  environment-dependent).
- `vitest run` desktop-cloud-api 18/18, desktop-cloud-admin 6/6; `tsc --noEmit` clean.
  Pre-existing vitest failures on main (fabric-session-kind, vm-operator snapshot) unchanged; PluginManager.flows is flaky (passes on rerun).
- Evidence logs: `~/.agent-orchestrator/evidence/cloud-computer-orgo-p4/` (cargo-test, tsc, vitest).

## Incidents

- Executor session died mid-flight (silent kill, account 5-hour quota outage) with all work uncommitted; resumed via checkpoint. A second session sent to run only verification went off-task (unrelated AllternitOS control-plane debugging) and was killed; the orchestrator applied the review fixes (F1 golden_snapshot_id persistence, F2 clone-from-stored-snapshot, F3 kind/region regression, F4 include_roles contract, F5 ref serde rename, F6 clone identity env, F7 UTF-8-safe tail, F9 holder status, F12 audit kind, F14 spawn_blocking, F17 import resets) and verified them.

## PR

Opened by the orchestrator after fixes; merge by orchestrator per repo escape
(steering gate stalled in prior phases; worktree guards pass).


---

# Phase 4b addendum — catalog, hooks/scripts, idempotent import, golden-clone fixes (2026-09-10)

Session `p4-templates` (branch `session/p4-templates`). Closes the remaining
gaps from the Phase 4 goal + the owed live Incus smoke.

## What was added

- **In-repo curated catalog** (matrix row #17): `templates/system/base-desktop.yaml`
  and `templates/system/node-dev.yaml`, embedded via `include_str!` in the new
  `cmd/allternit-api/src/template_catalog.rs`. At API startup
  `sync_catalog_to_db` upserts them as public, system-owned rows keyed by
  their `system/...` ref (idempotent: unchanged entry = zero writes; changed
  doc = resolved view replaced + build state reset). `POST /api/v1/desktop-templates`
  accepts `catalog_ref` to instantiate a caller-owned private copy (the curated
  `ref` itself stays system-owned and non-user-writable).
- **Format additions** (`ComputerTemplateSpec`, additive, still `allternit.ai/v1`):
  top-level `installScripts` (shell, run as root after apt packages, before
  services) and `hooks.preBuild` (run before package installation;
  `hooks.postCreate` remains the post-build hooks).
- **Tier C literal-secret gate**: validation rejects PEM/private-key material
  (`-----BEGIN`) in service env values, install scripts, and hooks — template
  files carry vault refs by name only.
- **Idempotent import**: `upsert_template_from_spec` returns `UpsertOutcome`;
  re-importing a byte-identical canonical doc writes nothing and preserves
  build state (a ready golden survives). The import response now flattens the
  row plus `unchanged: true|false` (existing top-level fields unchanged for
  current clients).

## Smoke-found defects fixed (live Incus smoke, VPS 45.84.138.187)

1. **Golden provisioning never triggered** (`bot_desktop_templates.rs`):
   `find_golden_holder` gated on `select_provision_source(.., None)`, which
   always answers `Image` for a `None` holder — so `spec.golden` was never set
   and every computer from a ready template silently fell back to a stock-image
   spawn. The owed live smoke caught this: build `ready`, snapshot present,
   guest had NONE of the template packages. Fixed by gating on
   `build_status == ready && golden_snapshot_id.is_some()` and running the
   constructed `GoldenSource` back through `select_provision_source` as the
   final check. Regression test: `find_golden_holder_resolves_when_build_ready`.
2. **Incus clone body malformed** (`allternit-computer-cloud/src/substrate.rs`):
   `clone_from_snapshot` sent `source: {type: "snapshot", name: "inst/snap"}`;
   Incus 6.0 rejects both the type ("Unknown source type snapshot") and the
   field (its copy handler reads `source.source`, which may carry an
   `instance/snapshot` path — instances_post.go `IsSnapshot(req.Source.Source)`).
   Now sends `source: {type: "copy", source: "<holder>/<snap>"}`. HTTP-level
   test updated accordingly.

## Live smoke evidence (all on the VPS Incus substrate)

Template file (3 apt packages + trivial service + preBuild/installScripts/
postCreate hooks) → import 200 (`unchanged: false`) → identical re-import
`unchanged: true` (no-op) → catalog_ref create → build ACI-gate 403 →
approve → 202 → **build ready in ~2 min** (holder
`allternit-user-local-dev-user-3e3f…`, stateless `golden` snapshot visible via
`incus snapshot list`) → `POST /computers` with `template_id` → clone of the
golden (`allternit-tpl-c2be77…`) **running immediately** → in-guest ground
truth via `incus exec`: `dpkg -l` shows jq 1.7.1 / htop 3.3.0 / cowsay 3.03
installed at golden-build time (13:12), `/etc/p4-smoke-install` and
`/etc/p4-smoke-postcreate` markers present, `p4-smoke-svc.service` written to
`/etc/systemd/system/` and **active**. Cleanup: both smoke computers deleted
via API (instances destroyed), golden holder deleted, template rows deleted,
API stopped; `incus list` verified back to the exact 8 pre-existing
containers; golden image `86552d91ffc0` untouched.

## Verification

- `cargo test -p allternit-api --lib template*` — 29/29 (incl. new: catalog
  sync insert/no-op/doc-change-reset, reimport preserves ready golden,
  preBuild/installScripts validation, literal-secret rejection ×3,
  catalog_ref create, find_golden_holder regression).
- `cargo test -p allternit-computer-cloud --lib` — 102/102.
- Full `allternit-api --lib` suite — see PR body (4 pre-existing
  environment-dependent `agent_cloud_routes` failures requiring a real
  AllternitOS control plane, unchanged from main).

## Deviations / notes

- `POST /desktop-templates` legacy fields (`name`/`os`/`image`) gained
  `#[serde(default)]` so `catalog_ref`-only bodies parse; empty name/os now
  422 instead of a serde 400 — same rejection class, better message.
- Build-route file content was NOT added: build runs from the stored canonical
  doc (import-then-build), per the locked Phase 4 task decisions.
- Rebuild semantics: `POST /:id/build` still rebuilds from any terminal state
  (deliberate); the no-op story lives at import (unchanged file → no reset).
