# Cloud Computer Phase 4 — Templates as code (TASK)

Spec: `Research/specs/cloud-computer-orgo-parity.md` rq-20260909-004, Phase 4.
Design: `docs/CLOUD_COMPUTER_PHASE_4_DESIGN.md` (already in this worktree — read it
first). Facts there were verified against main (`98bf11854`, Phases 1–3 merged).
Decisions in THIS file are locked — do not re-litigate. Do NOT start Phase 5.

You are in worktree `allternit-ao-cloud-computer-orgo-p4` on branch
`ao/cloud-computer-orgo-p4`. All work happens here. Match repo idioms; no new
dependencies (serde_yaml 0.9 is already available in allternit-api).

## Locked decisions

1. **Template file format** — YAML (JSON accepted; YAML is a JSON superset so
   one serde_yaml deserializer handles both). Canonical form:
   ```yaml
   apiVersion: allternit.ai/v1
   kind: ComputerTemplate
   metadata:
     name: node-20-builder        # unique per owner; becomes the template name
     description: ...
     tags: [node, ci]
   os:      { name: linux, image: "" }        # image "" = default for os
   hardware: { cpu_cores: 4, memory_mb: 8192, disk_mb: 51200, resolution: [1920, 1080] }
   packages: [nodejs, npm]                    # apt (linux) only; honest 501 otherwise
   services:                                  # long-running, systemd user units
     - name: app
       command: node /opt/app/server.js
       env: { PORT: "8080" }
       autostart: true
   secrets:                                   # refs only — VALUES NEVER STORED
     - name: NPM_TOKEN                        # env var name for hooks/services
       ref: vault://org/<org_id>/<cred_name>  # only vault://org/... in v1
   hooks:
     postCreate: ["npm ci --prefix /opt/app"] # run at build time, inside guest
   ```
   Validation: sizes must match the existing VALIDATED_* sets in
   `bot_desktop_templates.rs`; unknown apiVersion/kind → 422 with clear error;
   secret refs must parse as `vault://org/{org_id}/{name}` and the requester
   must have vault access (reuse `allternit_vault.rs` access rules).

2. **Storage** — extend `desktop_templates` via new migration (Phase 3 used
   V137; verify and take the next free numbers): `spec_yaml TEXT` (canonical
   serialized doc), `ref TEXT` (curated system refs, NULL for user templates),
   `golden_snapshot_id TEXT`, `build_status TEXT` ('pending'|'building'|'ready'|
   'failed'), `build_error TEXT`, `built_at TEXT`. Existing columns (os/image/
   cpu_millis/memory_mib/disk_mib/env/packages) stay — they remain the
   resolved/effective view; the spec doc is the source of truth on write.
   Also alter `computers` (same or follow-on migration): `role TEXT NOT NULL
   DEFAULT 'user'` — 'golden' marks golden-holder VMs so they are excluded
   from default `GET /api/v1/computers` listings (opt-in `?include_roles=1`
   shows them). Seed refs for the 3 existing system presets:
   `system/preset-linux-ubuntu`, `system/preset-windows`, `system/preset-macos`.

3. **Build = golden holder, no transient copy.** Build DIRECTLY into the golden
   holder: a computer row `role='golden'`, name `tpl-golden-<template_id>`,
   owner = template owner. Flow for `POST /api/v1/desktop-templates/:id/build`:
   1. Gate: reuse the ACI approval pattern from `aci_approvals.rs` (same as
      other approval-gated control — build start is gated).
   2. Set build_status='building', spawn holder from base image via the
      existing standalone spawn internals (`create_standalone_desktop` path in
      `computer_routes.rs` — factor what you need, don't fork it).
   3. Wait for running, then via the exec channel (`Substrate::exec` through
      the driver, same as `computer_shell`): `apt-get update` +
      `apt-get install -y <packages>` (linux only; other os → build fails
      with honest "package builds are linux-only in v1" — the DESIGN doc's
      501 non-goal).
   4. Write each service as a systemd user unit with `Environment=` lines;
      secret refs resolved HERE via `AllternitVault::get` — inject values into
      the guest env/units, never into the DB or template row. Resolution
      failure → build_status='failed' with the ref name in build_error.
   5. Run `hooks.postCreate` in order, same env injection, non-zero exit →
      failed with the hook's tail in build_error.
   6. Stop the holder, `create_snapshot` (stateful=true) named `golden`,
      record `golden_snapshot_id`, build_status='ready', built_at=now.
   7. Rebuild: delete old holder VM + row first, then the same flow.
   Run the pipeline async (tokio task) with progress readable from
   build_status/build_error; the POST returns 202 immediately.

4. **Provision from golden snapshot.** In both create paths
   (`create_standalone_desktop` and the bot `provision_desktop_internal`): if
   the resolved template has build_status='ready' + golden_snapshot_id, spawn
   via the Phase 2 clone machinery (`ExecutionDriver::clone_vm` /
   Incus `clone_from_snapshot(source, snap, new_name, limits)` in
   `cmd/allternit-computer-cloud/src/substrate.rs`) — holder stays stopped,
   new instance boots from the snapshot in seconds. Otherwise fall back to
   today's image spawn (packages on templates remain non-consumed in that
   path — that is honest and documented in code). `computers.template_id` is
   already persisted at create — keep that. Thread a `source_snapshot:
   Option<...>` through `SpawnSpec` in `platform/contracts/driver-interface`
   only if needed; prefer reusing clone_vm from the API side without contract
   churn — pick the smaller diff and note the choice in NOTES.

5. **system/… refs.** `ref` is curated-only: the API does NOT accept ref
   writes from users (reject with 403); refs are seeded by migration.
   `GET /api/v1/desktop-templates/by-ref/<ref>` (or `?ref=` — match repo
   idiom) resolves them; `POST /api/v1/computers` accepts `template_ref` as an
   alternative to `template_id` (exactly one of the two).

6. **Import/export (templates as code).**
   `POST /api/v1/desktop-templates/import` (body = template doc; content-type
   yaml or json) → create/replace-by-name for the caller; returns the template
   + a `web_link`-style hint is NOT needed — just the row.
   `GET /api/v1/desktop-templates/:id/export` → the canonical YAML doc.
   Existing CRUD endpoints stay compatible.

7. **Audit.** Record template build starts/completions/failures and each
   secret-ref resolution (ref name only, never value) using the Phase 3
   `computer_audit` / `computer_access_logs` patterns.

8. **TS client parity** (`surfaces/ai.allternit.com/src/lib/`):
   `desktop-cloud-api.ts` — full template types incl. spec doc, build status,
   import/export, build, by-ref lookup; `computers-api.ts` — `template_ref` on
   `CreateComputerInput`. Keep the existing `@/integration/api-client` idiom.

## Verification (all must pass; save evidence)

- `cargo test -p allternit-api -p allternit-computer-cloud` — new inline
  `#[cfg(test)]` tests: doc parse/validation (good doc, bad sizes, bad ref,
  wrong apiVersion), by-ref resolution, build state machine transitions,
  provision-source selection (ready→golden, else image). Follow existing test
  idioms in those files. Save full output to
  `~/.agent-orchestrator/evidence/cloud-computer-orgo-p4/cargo-test.log`.
- `cargo check -p allternit-api -p allternit-computer-cloud` → evidence
  `cargo-check.log`.
- TS: in `surfaces/ai.allternit.com`: typecheck + `vitest run` (extend the
  existing desktop-cloud-api tests) → evidence `vitest.log`.
- Note pre-existing breakage as pre-existing; do not fix unrelated files.
- Live Incus smoke is NOT required — record it as owed in NOTES (same as
  Phase 2).

## Git + process

- Commit EARLY and OFTEN (conventional prefixes `feat(desktop-templates):`,
  `feat(computers):`, `feat(driver-interface):`, `test(...)`, `docs(...)`),
  push `ao/cloud-computer-orgo-p4` to origin as you go. Worktree passes the
  repo guards; if a steering/commit gate consult stalls more than 3 minutes,
  STOP retrying git verbs, leave changes committed-or-staged as far as you
  got, and say so in NOTES — the orchestrator will finish git from outside.
- Update `.steering/checkpoint.md` (Goal / Just did / Next / Open questions)
  at each milestone — keep entries short; this repo's Stop-hook steering may
  respond: treat `[steering]` replies as authoritative.
- Do NOT merge the PR. When implementation + verification are done:
  `gh pr create` with a real summary + verification evidence, then write the
  sentinel below.
- Milestone notes → append `### cloud-computer-orgo-p4 <ISO ts>` to
  `.allternit/shared-context.md` if present.

## Deliverable sentinel

When finished, write `docs/CLOUD_COMPUTER_PHASE_4_NOTES.md` starting with:

```yaml
---
status: done|blocked
files_changed: [paths relative to repo root]
deviations: [what changed from this task file + why, or "none"]
remaining: [items, e.g. "live Incus smoke owed"]
---
```

then prose notes: how it works, verification evidence (test counts, log
paths), PR number, incidents. That file existing = done.
