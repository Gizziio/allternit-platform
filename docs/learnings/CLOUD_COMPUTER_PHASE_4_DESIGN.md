# Cloud Computer Phase 4 — Templates as code (DESIGN)

Spec rq-20260909-004 Phase 4. Facts verified 2026-09-09 against main
(`98bf11854`, Phases 1-3 merged). Decisions are locked in
`CLOUD_COMPUTER_PHASE_4_TASK.md` — do not re-litigate.

## Verified building blocks (reuse, don't rebuild)

- `desktop_templates` table + CRUD in `bot_desktop_templates.rs`;
  `resolve_provision_spec` (explicit > template > defaults; VALIDATED_*
  sets); presets are public DB rows (`preset-*`, user_id 'system').
- **Phase 2 clone machinery**: `ExecutionDriver::clone_vm(handle,
  new_native_id)`; Incus `clone_from_snapshot(source, snap, new_name,
  limits)` — a golden snapshot can already be turned into a new running
  instance in seconds. This is the fast-boot path.
- **Phase 1 standalone spawn** (`create_standalone_desktop`) — reusable
  for build VMs.
- **Phase 3 audit** (`computer_audit` / `computer_access_logs`) — extend
  for template builds and secret resolutions.
- **`AllternitVault{put,get,revoke(user_id,id)}`** (`allternit_vault.rs`)
  — existing per-user vault. Secret refs resolve through it at BUILD time
  only; template rows store ref NAMES, never values.
- `serde_yaml 0.9` is already a dependency of `allternit-api` — YAML
  template files are allowed. No new dependencies.
- Migrations: V137 used by Phase 3. Next free (verify at execution):
  V138/V139.

## What Phase 4 delivers

1. Declarative `apiVersion: allternit.ai/v1` `ComputerTemplate` YAML file
   → validated, stored → **built once into a golden snapshot** →
   provisioning from that template clones the snapshot (fast boot
   foundation; a true warm pool is later work).
2. Build pipeline (async): spawn build VM → install packages → write
   long-running services → run postCreate hooks (with vault-resolved
   secrets injected as env, values never persisted) → stop → stateful
   golden snapshot → destroy build VM.
3. Curated `system/…` template refs (seeded, public, system-owned).
4. Every build/secret-resolution audited; build start is ACI-gated.

## Non-goals for Phase 4

Warm pool / <500 ms boots (foundation only), Windows/macOS package builds
(linux apt only in v1 — honest 501), template versioning, external registry.
