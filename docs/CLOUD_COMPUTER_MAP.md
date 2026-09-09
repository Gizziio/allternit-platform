# Cloud Computer — Orgo parity map (spec rq-20260909-004)

Full gap analysis for reimplementing Orgo's cloud-computer capability matrix on
Allternit's Incus/Tart substrate. This is the executor's reference; product
decisions are already made in `CLOUD_COMPUTER_PHASE_1_TASK.md` — do not
re-litigate them. Source spec (external): Allternit Brain
`Research/specs/cloud-computer-orgo-parity.md` — the relevant excerpts are
inlined below.

## Strategy (fixed)

Reverse-engineer Orgo's capability matrix onto our substrate. No Orgo code, no
Orgo account, no Orgo runtime dependency. Five phases, each one PR:

1. **Computers for Everything** — any-owner create, full create-time specs,
   client parity, restart, `local` kind (THIS TASK)
2. Lifecycle — resize, clone, auto-stop, workspaces-lite
3. Real-time plane — PTY, event stream, authenticated in-VM proxy
4. Templates as code — declarative file → golden snapshot
5. Distribution — MCP server, CLI, SDK parity, embed

Deliberate non-goals (ALL phases): GPU/Android guests, Orgo runtime dependency,
multi-tenant SaaS pricing tiers, replacing the ACU engine, un-gating
approval-gated control.

## What we already exceed Orgo on (do NOT rebuild)

Human observe/take-over/hand-back with bot pause, desktop mesh + mux + input
arbitration, approval-gated control (`aci_approvals.rs` /
`aci_safety::enforce_confirmation`), usage/pricing/quota/capacity + audit log,
org auth, ACU engine with run monitor + HITL + replay, TS **and** Python SDKs,
e2e verification harness. Parity work plugs gaps; it never regresses these.

## Current server surface (`cmd/allternit-api/src/computer_routes.rs`)

Router mounted at `/api/v1/computers` (merged into v1_routes in
`main.rs:711`, nested at `/api/v1` in `main.rs:745`).

Existing routes: `GET/POST /computers`, `GET /computers/:id`,
`POST /computers/:id/{start,stop-delete-via-/delete,session-end}`,
`GET /computers/:id/screenshot`, `POST /computers/:id/{mouse,keyboard,shell}`,
`POST /computers/:id/files/upload`, `GET /computers/:id/files/download`,
`POST /computers/admin/credits`.

Hard-wired bot assumptions (the Phase 1 targets):

- `create_computer` only accepts `ComputerKind::CloudDesktop`; every other kind
  → 501 (`computer_routes.rs:383-392`).
- `create_cloud_desktop` requires `bot_id`, verifies bot ownership, proxies to
  `bot_desktop_routes::provision_desktop_internal` (`:394-486`).
- Every control handler (screenshot/mouse/keyboard/shell/upload/download)
  resolves the sandbox via `read_bot_sandbox(bot_id)` and errors 400
  `"computer has no bot_id"` for non-bot rows (`:547-554` etc.).
- start/stop/delete/session-end likewise require `bot_id`
  (`start_cloud_desktop` `:861`, `stop_cloud_desktop` `:916`,
  `delete_cloud_desktop` `:971`, `session_end_cloud_desktop` `:1047`).
- No restart verb anywhere in the desktop surface.
- No snapshot routes under `/computers` (snapshots only under
  `/api/v1/bots/:bot_id/desktop/snapshots[...]`, `bot_desktop_snapshots.rs`).
- `CreateComputerRequest` has no cpu/disk/resolution; memory comes only from
  template resolution (`bot_desktop_templates::resolve_provision_spec`,
  defaults `cpu_millis=2000, memory_mib=4096, disk_mib=20480`).

## Supporting facts (verified 2026-09-09)

### Templates/presets (`bot_desktop_templates.rs`)

- `ProvisionRequest { os: Option<String>, template_id: Option<String> }`,
  `ProvisionSpec { os, image, cpu_millis: u32, memory_mib: u32,
  disk_mib: Option<u32>, network_enabled, env }` (`:273-289`).
- `resolve_provision_spec(state, user, req)` (`:292-341`): env override
  `$BOT_DESKTOP_IMAGE`; per-OS image map (windows→`allternit-desktop-windows`,
  macos→`tart-ubuntu-test`, else `allternit-desktop`); template row overrides
  everything when `template_id` present.
- Preset template rows (migration V95, `desktop_templates` table,
  `preset-linux-ubuntu` 2000/4096/20480, `preset-windows` 4000/8192/40960,
  `preset-macos` 4000/8192/40960). Custom ids `dtpl-<uuid>`.
- Template visibility: `public=1 OR user_id=? OR org_id=?`.

### Bot desktop plumbing (`bot_desktop_routes.rs`)

- `provision_desktop_internal(state, user, bot_id, &ProvisionDesktopQuery{os,
  template_id, provider}) -> Result<ProvisionDesktopResponse{sandbox_id,
  status, provider, host, display_index}, Response>` (`:380-385`). Does:
  `computer_screens::attach_bot_to_user_computer` → `supports_desktop` check →
  `bot_desktop_quotas::check_quota` → build `SpawnSpec` (tenant
  `user-<user_id>`, env vars `ALLTERNIT_BOT_ID/ALLTERNIT_USER_ID/
  ALLTERNIT_DESKTOP_OS[/ALLTERNIT_DESKTOP_PROVIDER]`, `ResourceSpec{cpu_millis,
  memory_mib, disk_mib, None, None}`) → `driver.spawn` → upsert
  `bot_desktop_sandboxes` → `bot_desktop_quotas::record_start` →
  `computer_screens::upsert_user_computer` + `assign_screen`.
- `verify_bot_ownership(state, user_id, bot_id)` (`:1035`),
  `read_bot_sandbox(db, bot_id) -> Option<BotDesktopSandboxRecord{bot_id,
  sandbox_id, provider, host, status, os}>` (`:1188`),
  `build_handle(native_id, os, provider) -> ExecutionHandle` (tenant
  `"lifecycle"`, `:1096-1116`), `build_handle_from_record` (tenant
  `bot-<bot_id>`, `:1013`).
- `BotDesktopSandboxRecord` table `bot_desktop_sandboxes` (V91): `bot_id PK,
  sandbox_id, provider, host, status, os`.
- `deprovision_desktop` calls `bot_desktop_quotas::record_end` (`:711`).
- **No non-bot provisioning path exists.** All spawns require a bot row.

### Input (`bot_desktop_input.rs`)

All handlers `pub(crate)`, shape `(State, Extension<AuthUser>, Path<bot_id>,
Query<DesktopQuery{sandbox_id}>, Json<input>)`:

- `send_desktop_mouse` (`:61`), `send_desktop_keyboard` (`:222`),
  `run_desktop_shell` (`:357`), `download_desktop_file` (`:466`),
  `upload_desktop_file` (`:530`, extra `body: Bytes`).
- `MouseInput { action: String, x: Option<i32>, y: Option<i32>,
  button: Option<String> }` — actions `move|click|rightclick|doubleclick|
  mousedown|mouseup` via xdotool (`build_mouse_command` `:134`). Windows path
  only `move`+`click` (`:196-210`). **No drag, no scroll anywhere in
  cmd/allternit-api/src.**
- `KeyboardInput { action: String ("type"|"key"), text, key }`. Windows: `type`
  only.
- `ShellInput { command: Vec<String>, env: HashMap (default),
  timeout: Option<u64> (ignored; 60s sync) }`.
- `FilePathQuery { path: String }`.

### Snapshots (`bot_desktop_snapshots.rs`)

`create_desktop_snapshot` (`:47`, 201 `{success, snapshot_id: "snap-<uuid>"}`),
`list_desktop_snapshots` (`:88`), `restore_desktop_snapshot` (`:130`),
`delete_desktop_snapshot` (`:167`). All take `Path<bot_id>`, call
`verify_bot_ownership` then `resolve_driver_and_handle` →
`driver.{create,list,restore,delete}_snapshot`. Snapshots live in the driver,
no DB table. Mounted only under the bot router (`bot_desktop_routes.rs:96-107`).

### Driver (`platform/contracts/driver-interface/src/lib.rs`)

`ExecutionDriver` (`:531`): `capabilities`, `spawn(SpawnSpec)`, `pause_vm`,
`resume_vm`, `exec(handle, CommandSpec)`, `stream_logs`, `get_artifacts`,
`destroy`, `get_consumption`, `get_receipt`, `health_check`,
`substrate_capacities`; desktop opt-ins `get_desktop_endpoint[_by_native_id]`,
`supports_desktop`, `register_native_sandbox`, `pull_file`, `push_file`;
snapshots `create_snapshot(handle, snapshot_id, stateful)`,
`restore_snapshot`, `delete_snapshot`, `list_snapshots -> Vec<SnapshotInfo{id,
created_at, stateful}>`.

**No resize method. No resolution parameter.** `ResourceSpec{cpu_millis: u32,
memory_mib: u32, disk_mib: Option<u32>, network_egress_kib, gpu_count}`
(`:150-166`); presets `minimal()` 100/64/100, `standard()` 1000/2048/10240,
`high_performance()` 4000/8192/51200+gpu (`:168-201`). SpawnSpec has
`resources: ResourceSpec`.

Providers: `IncusDriver` (`INCUS_URL[S]`), `TartDriver` (`TART_HOST_URL[S]` /
`TART_BIN`), behind `SubstrateRouter` with provider strings "incus"/"tart"
(`main.rs:1250-1374`). Unified driver: `state.vm_driver`.

### DB schema (migrations)

- V99 `computers`: `id PK, kind CHECK(kind IN ('local','byo_vps','managed',
  'byoc','cloud_desktop')), provider, status CHECK(status IN ('creating',
  'running','stopped','error','deleted')) DEFAULT 'creating', owner_type
  CHECK(owner_type IN ('user','org','bot')), owner_id, bot_id REFERENCES
  agents(id) ON DELETE SET NULL, session_id, name, os, cpu_cores, memory_mb,
  disk_mb, region, host, native_id, credential_id, template_id, billing_source
  CHECK(billing_source IN ('free','credits','provider_direct','platform_fee'))
  DEFAULT 'credits', created_at, updated_at` + owner/bot/session/status/kind
  indexes.
- V99 `computer_cloud_desktop`: `computer_id PK REFERENCES computers ON DELETE
  CASCADE, sandbox_id NOT NULL, control_state CHECK(control_state IN
  ('bot_controls','human_controls','human_observing')) DEFAULT 'bot_controls',
  ws_url, protocol, taken_over_by_user_id, taken_over_at`. (`protocol` is
  currently abused to store persistence policy — see
  `session_end_cloud_desktop`.)
- V99 also creates `computer_managed`, `computer_byo_vps`, `computer_byoc`
  side tables (unused so far).
- V132 `computer_screens`: `display_index, vnc_port, control_state`,
  `UNIQUE(computer_id,bot_id)`, `UNIQUE(computer_id,display_index)`.
- V91 `bot_desktop_sandboxes`, V94 adds `os`, V95 `desktop_templates`, V96
  `desktop_quotas`/`desktop_usage`, V97 `desktop_pricing`, V98 provision queue,
  V101 backfills computers from bot sandboxes.
- `owner_type` CHECK constraint already allows `'user','org','bot'` — schema
  needs **no migration** for user/org owners. (`'session'` is NOT in the CHECK —
  see decision below.)

### Auth (`crate::auth::AuthUser`)

`user_id, email, name, avatar_url, tenant_id, organization_id,
organization_role, organization_slug` (`auth.rs:125-134`). No global org-scope
helper; computers code uses local `resolve_org_id(user) =
organization_id.or(tenant_id).filter(non-empty)` (`computer_routes.rs:182-187`).

### Quotas/billing

- `bot_desktop_quotas::check_quota(state, user)` (user row overrides org row in
  `desktop_quotas`; counts open `desktop_usage`), `record_start(state, user,
  bot_id, sandbox_id, provider, os)` (`:195`), `record_end(state, bot_id)`
  (`:242`, computes minutes, updates `desktop_usage`, emits unified
  `usage_events` priced via `pricing::compute_computer_minute_cost_cents`).
- Bot path gates: `check_quota` + org spend cap + `credits::has_minimum_balance`
  (`create_cloud_desktop` `:419-449`).
- Quota fns are bot-keyed (`desktop_usage.bot_id`); **org-level equivalents
  (spend cap + credits) already exist in the computers path.** Quota skipping
  with org credits retained is the natural shape for non-bot computers.

### Frontend (`surfaces/ai.allternit.com/src`)

- `src/lib/computers-api.ts` (124 lines): only list/get/create/start/stop/
  delete/usage-summary. No screenshot/mouse/keyboard/shell/files/snapshots/
  restart. `Computer`/`CreateComputerInput` types exist.
- `src/lib/desktop-cloud-api.ts`: full parallel client to the **bot** routes
  via `api` — provision/start/stop/deprovision/screenshot (`api.raw`)/shell/
  mouse/keyboard/download (`api.raw`)/upload (**posts JSON
  `{content_base64}`** via `api.post` — the Rust handler takes raw `Bytes`, so
  this path is broken/unused for real uploads; do not copy this pattern).
- `src/lib/bots/vm-operator.ts`: raw `fetch` to `/bots/:id/desktop/snapshots`
  (`:423`), `.../snapshots/:sid/restore` (`:464`), `.../desktop?sandbox_id=`
  (`:628`), `.../desktop/provision` (`:640`).
- `@/integration/api-client`: `get/post/put/patch/delete<T>` always
  `response.json()`; **no blob/bytes/FormData support**, but `raw(path,
  options): Promise<Response>` exists (`:576`) — use it for screenshot
  download (blob) and file upload (bytes).
- Everything else (`useBotComputer.ts`, `CreateBotForm.tsx`, vm-operator
  lifecycle) already goes through `lib/computers-api.ts`.

### Steering / repo guards

- `.steering/off` does not exist → steering enabled. Working agents must update
  `.steering/checkpoint.md` (Goal / Just did / Next / Open questions) at every
  milestone. A Stop hook consults a steering agent when checkpoint.md changes;
  a PreToolUse gate blocks `git commit`/`git push` until the steering agent
  APPROVEs (respond to STEER feedback before retrying). Worktrees pass the
  main-checkout guard automatically.
- `.steering/test-command` feeds the steering agent test output — keep it
  passing or honestly report failures.

### Platform integration (ao contract)

Append milestone notes to `.allternit/shared-context.md` when present
(append-only, `### <slug> <ISO ts>`), and drop artifacts under
`~/.agent-orchestrator/evidence/cloud-computer-orgo-p1/`, announcing each via
`curl -X POST http://127.0.0.1:8013/api/rails/mail/share` with
`{"thread":"wih:executor-cloud-computer-orgo-p1","asset_ref":"<path>"}`.

## Orgo matrix rows Phase 1 closes

| # | Capability | Gap closed by |
|---|---|---|
| 1 | Create with cpu/ram/disk/resolution | validated create-time specs |
| 2 | Computers for ANY owner | owner_type user/org/session/bot |
| 4 | restart verb | `POST /computers/:id/restart` |
| 6 (partial) | Clone prep | snapshot routes under /computers (full clone = Phase 2) |
| 9 | drag + client parity | drag/scroll in MouseInput + TS exports |
| 16 (partial) | specs at create | ProvisionSpec extension (full templates-as-code = Phase 4) |
| 18 | TS client parity | computers-api.ts full control surface |
| 19 (partial) | local kind | `local` = Tart-backed, billing 'free' |
