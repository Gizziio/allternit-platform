# Cloud Computer Phase 2 — Lifecycle parity (TASK)

Executor task for spec rq-20260909-004 Phase 2. Read
`docs/CLOUD_COMPUTER_PHASE_2_DESIGN.md` first — every fact there was verified
against main (`dc032c217`, which includes Phase 1 / PR #201). Phase 1 landed:
any-owner create, validated specs, restart, snapshots under `/computers`,
bot-optional control cores, `local` kind. Build on it; do not regress it.

**Do NOT start Phase 3+** (real-time plane, templates-as-code, distribution).
List Phase 3+ observations under `remaining:`.

## Decisions (implement these exactly)

### 1. Resize — `PATCH /api/v1/computers/:id/resize`

Body: `{ "cpu_cores"?: i64, "memory_mb"?: i64, "disk_mb"?: i64 }` — each
validated against the existing `VALIDATED_CPU_CORES` / `VALIDATED_MEMORY_MB` /
`VALIDATED_DISK_MB` sets in `bot_desktop_templates.rs` (400 + allowed list on
violation; at least one field required).

- New trait method in `platform/contracts/driver-interface/src/lib.rs`:
  ```rust
  async fn resize_vm(&self, handle: &ExecutionHandle, resources: &ResourceSpec) -> Result<(), DriverError> {
      let _ = (handle, resources);
      Err(DriverError::NotSupported { operation: "resize_vm".into() })
  }
  ```
  (match the crate's existing default-method style; `NotSupported` variant
  fields per existing usage). Extend `DriverCapabilities` with `resize: bool`
  (default false — check the struct's existing `#[serde(default)]` flag style)
  and set `resize: true` in the Incus driver only.
- Incus impl (`cmd/allternit-computer-cloud/src/`): add substrate fn
  `patch_config(native_id, config: serde_json::Value)` using the proven PATCH
  `/1.0/instances/{id}` pattern from `add_proxy_device`; `resize_vm` applies
  `limits.cpu` / `limits.memory` live when present in `resources`.
- **Disk semantics (honest, no fake 207):** disk resize requires the computer
  stopped. If `disk_mb` present and status != `stopped` → **409**
  `"disk resize requires a stopped computer"`. When stopped, Incus disk resize
  = read current devices via `get_config`, find the root disk device, set its
  `size` in the PATCH body alongside any limits. If the instance has no disk
  device entry, return 501 with a clear message.
- Route behavior: `running`/`stopped` only (409 for creating/error/deleted
  like restart). After driver success, update the `computers` row columns.
  Non-cloud_desktop kinds → 501 (local/Tart included: Tart driver's
  `resize_vm` stays the default NotSupported → surface as 501
  `"resize is not supported on the <provider> substrate"`).
- Response: 200 `{ "id", "status", "cpu_cores", "memory_mb", "disk_mb" }`.

### 2. Clone — `POST /api/v1/computers/:id/clone`

Body: `{ "name"?: string }`. Auth via `fetch_computer`; reuse
`check_computer_credits` (same gate as create).

- New trait method (same file, same default style):
  ```rust
  async fn clone_vm(&self, handle: &ExecutionHandle, new_native_id: &str) -> Result<ExecutionHandle, DriverError>
  ```
  Default → NotSupported. Capability flag `clone: bool` (default false; Incus
  true).
- Incus impl: (a) create a stateful snapshot of the source (existing substrate
  snapshot path) with id `clone-<uuid>`; (b) `POST /1.0/instances` with body
  `{"name": new_native_id, "source": {"type": "snapshot", "name": "<source>/<snap-id>"}}`
  plus an inline `"config"` copying `limits.cpu`/`limits.memory` from the
  source's `get_config`; (c) start the new instance via the existing state
  endpoint; (d) return the new handle. Leave the intermediate snapshot in
  place (documented: it is the new instance's restore point).
- Route: after clone, insert `computers` + `computer_cloud_desktop` rows
  mirroring the source (new id, `name` = req.name or `"<source name> (copy)"`,
  same owner, `billing_source` copied, status `running`). Return 201 with the
  create-response shape.
- Tart/others → 501 via default NotSupported.

### 3. Auto-stop — idle timer per computer

Migration `cmd/allternit-api/migrations/V133__computer_idle_autostop.sql`:
```sql
ALTER TABLE computers ADD COLUMN idle_timeout_secs INTEGER;
ALTER TABLE computers ADD COLUMN last_activity_at DATETIME;
CREATE INDEX IF NOT EXISTS idx_computers_idle ON computers(status, idle_timeout_secs);
```
(No CHECK constraints; NULL = disabled.)

- `PATCH /api/v1/computers/:id` — body `{ "idle_timeout_secs": i64|null }`.
  null disables. Validate range 60..=86400 when set (400 otherwise). 404 /
  409 (creating/deleted) semantics like other mutations. Response = updated
  `Computer` JSON.
- Activity touch: new `pub(crate) fn touch_computer_activity(db, id)` in
  `computer_routes.rs` (spawn_blocking `UPDATE computers SET last_activity_at
  = CURRENT_TIMESTAMP WHERE id = ?1`, best-effort). Call it at the top of the
  control + lifecycle handlers: screenshot, mouse, keyboard, shell,
  files upload/download, snapshots create/restore/delete, start, restart.
  Fire-and-forget (`tokio::spawn`) — never block a handler on it.
- Sweeper: new module `cmd/allternit-api/src/computer_idle.rs` with
  `pub fn spawn_idle_sweeper(state: Arc<AppState>, shutdown: tokio::sync::broadcast::Receiver<()>)`
  following the established main.rs loop pattern (interval 60s, env override
  `COMPUTER_IDLE_SWEEP_SECS`, `MissedTickBehavior::Skip`). Each tick selects
  `status='running' AND idle_timeout_secs IS NOT NULL AND last_activity_at IS
  NOT NULL AND last_activity_at < datetime('now', '-' || idle_timeout_secs ||
  ' seconds')` and stops each via the same pause path as `stop_computer`
  (extract a shared `stop_computer_inner(state, &computer)` if cleaner — keep
  the route handler's behavior identical). **Skip** computers whose
  `computer_cloud_desktop.control_state = 'human_controls'` (a human may be
  driving; log the skip). Also refresh `last_activity_at` on start/restart.
  Mark stopped rows' status (`update_computer_status`) — and if the row is
  bot-owned, keep the bot-path cleanup (`record_end`) intact by routing
  bot-owned rows through the existing stop path.

### 4. Workspaces-lite — computer groups (label-first)

Migration `cmd/allternit-api/migrations/V134__computer_groups.sql`:
```sql
CREATE TABLE computer_groups (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK(owner_type IN ('user','org')),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_type, owner_id, name)
);
ALTER TABLE computers ADD COLUMN group_id TEXT REFERENCES computer_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_computer_groups_owner ON computer_groups(owner_type, owner_id);
```

- Routes (all under `/api/v1`, in a new `computer_groups.rs` module, auth'd):
  - `GET /computer-groups` — caller's groups (owner user, or org groups when
    `resolve_org_id` present) with member counts.
  - `POST /computer-groups` — `{name}` → 201. 409 on duplicate name.
  - `GET /computer-groups/:id`, `PATCH /computer-groups/:id` (`{name}`),
    `DELETE /computer-groups/:id` (deleting nulls members' `group_id` via the
    FK; verify owner, 404 otherwise).
  - `POST /computer-groups/:id/computers/:computer_id` — attach (verify both
    are the caller's via the same ownership clause as list/get; a computer
    can be in **one** group — attaching moves it, return 200 with note field
    `"moved_from"` when applicable).
  - `DELETE /computer-groups/:id/computers/:computer_id` — detach.
- `list_computers`: accept `group_id` filter param (validate the group is
  visible to the caller, 404 otherwise).
- Register the router in `main.rs` next to the other v1 merges.

### 5. TS client (`surfaces/ai.allternit.com/src/lib/computers-api.ts`)

Add, matching existing style: `resizeComputer(id, input)` (PATCH),
`cloneComputer(id, name?)` (POST), `updateComputer(id, {idle_timeout_secs})`
(PATCH), group types + `listComputerGroups/createComputerGroup/
getComputerGroup/renameComputerGroup/deleteComputerGroup/attachComputerToGroup/
detachComputerFromGroup`, `groupId` on `Computer` + `listComputers` filter
param. Export response types.

## Constraints

- Same as Phase 1: no new dependencies; no dev servers; work only in this
  worktree on `ao/cloud-computer-orgo-p2`; conventional commits; keep
  `.steering/checkpoint.md` current (the commit gate is functional this time —
  `STEER_CONSULT_CMD` is set to a verified kimi consult backend); append-only
  `.allternit/shared-context.md` milestones; evidence into
  `~/.agent-orchestrator/evidence/cloud-computer-orgo-p2/`.
- Do not weaken/extend the ACI gate. Do not touch bot routes' external
  behavior. Keep `local` kind working (resize/clone on Tart → 501).
- The steering gate will consult kimi on commit/push — respond to STEER
  findings before retrying; if blocked after two rounds, `status: blocked` in
  NOTES with specifics.

## Verification (required; evidence dir)

1. `cargo check -p allternit-api -p allternit-computer-cloud -p allternit-driver-interface`
   clean; `cargo test -p allternit-api computer` + `-p allternit-computer-cloud`
   pass. New unit tests (in-memory sqlite where applicable): resize
   validation + 409 disk-while-running + status machine; clone row logic;
   idle PATCH validation; sweeper selection SQL + human_controls skip (pure
   fn taking a connection — test with in-memory DB); group CRUD scoping +
   single-group move semantics; activity-touch helper.
2. Surface `tsc --noEmit` passes for the changed client file.
3. Live smoke: best-effort, honestly deferred if substrate/credits
   unavailable (same situation as Phase 1 — capture evidence).

## Deliverable sentinel

Write `docs/CLOUD_COMPUTER_PHASE_2_NOTES.md` with frontmatter:
```yaml
---
status: done|blocked
files_changed: [paths]
deviations: [what + why]
remaining: [items]
verification: [what ran + result]
---
```
+ prose. **That file existing = done.** Then commit and push your branch
(steering gate will approve via kimi), and report the branch SHA.
