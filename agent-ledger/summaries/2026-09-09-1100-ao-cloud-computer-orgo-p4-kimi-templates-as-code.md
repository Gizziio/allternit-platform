# Attestation — ao/cloud-computer-orgo-p4 (spec rq-20260909-004 Phase 4: templates as code)

**Agent family:** kimi (executor) + kimi orchestrator session (review, fixes, merge)
**PR:** #216, merged `ab8638254` (merge commit)
**What:** Declarative `allternit.ai/v1` `ComputerTemplate` YAML (hardware/packages/services/`vault://org/…` secret refs/postCreate hooks) → async approval-gated golden build (apt, systemd units, hooks with vault-resolved secrets — values never persisted) → stateful `golden` snapshot on a `role='golden'` holder VM → provisioning clones the stored snapshot via new `ExecutionDriver::clone_from_snapshot` (limits + identity env as Incus instance config). Curated `system/…` refs (V138 seeds on existing presets), import/export, by-ref lookup, `template_ref` on create, audit trail, TS client parity. V138/V139 migrations.

**How it works / key files:** `cmd/allternit-api/src/desktop_template_build.rs` (build pipeline + state machine), `bot_desktop_templates.rs` (spec model/validation/CRUD/import/export/by-ref), `computer_routes.rs` + `bot_desktop_routes.rs` (golden-clone provision in both create paths), `allternit_vault.rs` (`resolve_org_vault_secret`), `platform/contracts/driver-interface` + `cmd/allternit-computer-cloud/src/driver.rs` (`clone_from_snapshot`).

**Verification:** cargo check clean (both crates); bot_desktop_templates 14/14, computer_routes 15/15, allternit-computer-cloud 96/96; full suite 774 passed / 4 failed (all `agent_cloud_routes …_through_real_os_control_plane` — require a real AllternitOS control plane; pre-existing, untouched). vitest desktop-cloud-api 18/18, desktop-cloud-admin 6/6; tsc clean. Evidence: `~/.agent-orchestrator/evidence/cloud-computer-orgo-p4/`.

**Review:** orchestrator deep review (subagent) found 1 critical (golden_snapshot_id never persisted → golden path unreachable), 3 high (fresh stateful snapshot of stopped holder via clone_vm; kind/region regression in spawn_desktop_for_owner refactor; include_roles '1' vs serde_urlencoded bool 400; ref_ serde rename mismatch), 7 medium/low. All fixed + re-verified before commit. No approval gates loosened (deliberate non-goal held).

**Incidents:** executor session #1 died silently (account 5-hour quota outage) with all work uncommitted — resumed from checkpoint; executor session #2 went off-task (unrelated AllternitOS control-plane debugging) and was killed — orchestrator finished verification, applied fixes, committed, merged per repo escape. Steering commit-gate not exercised (orchestrator commits).

**Honest deferrals:** live Incus smoke owed (build → ready → provision-from-golden, confirm clone env reaches guest session env); warm pool / <500 ms boot is later work (Phase 4 is the foundation); check-then-set race on concurrent build POSTs; import validates vault-ref shape only (access enforced at build time).
