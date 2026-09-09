# Session summary — ao/cloud-computer-orgo-p1 — codex+kimi — cloud-computer-orgo-parity Phase 1

**Date:** 2026-09-09 · **Branch:** `ao/cloud-computer-orgo-p1` · **PR:** #201 (merged, merge SHA `13668e99`) · **Spec:** rq-20260909-004 Phase 1 (Computers for Everything)

## What was done

Spec rq-20260909-004 reimplements Orgo's cloud-computer capability matrix as Allternit's internal Cloud Computer. Phase 1 (core parity) landed:

- `POST /api/v1/computers` accepts `owner_type` user/org/session (bot remains the default): standalone provisioning via the VM driver with the org spend-cap + credits gate; bot quotas skipped; transactional `computers` + `computer_cloud_desktop` rows (`human_controls` for standalone).
- Validated create-time specs: cpu {2,4,8}, memory {4–64 GB}, disk {20/40/80 GB}, resolution {720p/1080p/1440p}; explicit > template > defaults; resolution passed as `ALLTERNIT_DESKTOP_RESOLUTION` guest env.
- Control handlers refactored to bot-optional cores (extracted from `bot_desktop_input.rs`); ACI confirmation gate byte-identical; bot routes unchanged externally.
- Distinct `POST /computers/:id/restart` verb; snapshot routes under `/computers/:id/snapshots*` (create/list/restore/delete).
- `managed` kind formally cut (410, spec-cited); `local` kind implemented (Tart-forced, `billing_source='free'`, `region='local'`); `byo_vps`/`byoc` remain documented 501 follow-ups.
- MouseInput `drag`/`scroll` (Windows guest → honest 501).
- `computers-api.ts` full control-surface parity incl. raw-bytes upload via `api.raw` (fixes the JSON-base64 anti-pattern in desktop-cloud-api) and blob download; vm-operator snapshot/restore migrated where computer IDs exist at call sites.
- Org-aware visibility in list/get.

## How it works

Standalone create resolves a `ProvisionSpec` (extended with cpu/mem/disk/resolution), gates on org credits, spawns through `state.vm_driver` with tenant `user-<id>`, then persists both rows in one sqlite transaction. All control/lifecycle/snapshot handlers resolve the sandbox from the computers row (`native_id`/`os`/`provider`), falling back to the bot sandbox record only for bot-owned rows (preserving `record_end` quota cleanup).

## Verification evidence

- `cargo check -p allternit-api` clean (pre-existing warnings only); re-verified post-rebase onto main `74075ff8d`.
- `cargo test -p allternit-api computer`: **20/20 pass** (orchestrator independently re-ran); `bot_desktop_input`: 8/8.
- Surface TS: `tsc --noEmit` on `surfaces/ai.allternit.com` passed.
- `git diff --check` clean; `enforce_control_confirmation` byte-identical to HEAD.
- Live smoke: API booted isolated on :18113; user create reached 429 (credits gate — runtime org has no credit balance), local create 503 (Tart substrate unavailable in this shell env). No VM created; transcripts in `~/.agent-orchestrator/evidence/cloud-computer-orgo-p1/`.

## Incidents / honest deferrals

- **Live VM drive not verified end-to-end** — blocked by credits (429) and substrate availability (503), not by code. First real spawn + screenshot/shell/files/restart smoke remains owed; recommend running it against a credited org on the Incus/Tart host.
- Resolution is stored/spawn-env only; guest-side application unverified (revisit with Phase 4 templates).
- Executor (codex) stopped at the steering commit gate: the default steering consult backend (claude) has an expired OAuth on this machine. Orchestrator performed Phase 5 review and the merge commit per the repo's documented orchestrator escape; steering backend for future phases now overridable via `STEER_CONSULT_CMD` (~/.agent-orchestrator/bin/steer-consult-kimi.sh, verified working).
- Rails evidence-share announcements returned 401 (gateway token unavailable in executor env); evidence kept local.
- A duplicate-id data-integrity issue in `Research/queue.json` (two items share `rq-20260909-004`) was worked around by slug-level approval; fix owed in the Brain Ops scripts.

## Remaining (Phase 2+ of the same spec)

Lifecycle (resize/clone/auto-stop/workspaces-lite), real-time plane (PTY/events/proxy), templates-as-code, distribution (MCP/CLI/SDK/embed).
