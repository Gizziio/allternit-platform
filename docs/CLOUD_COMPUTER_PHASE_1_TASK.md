# Cloud Computer Phase 1 — Computers for Everything (TASK)

You are the executor for Phase 1 of spec rq-20260909-004 (Allternit Cloud
Computer = internal Orgo). Your full reference is `docs/CLOUD_COMPUTER_MAP.md`
in this repo — read it first; every fact in it was verified 2026-09-09.

**Do NOT start Phase 2+.** Lifecycle (resize/clone/auto-stop/workspaces),
real-time plane (PTY/events/proxy), templates-as-code, and distribution
(MCP/CLI) are separate tasks. If you notice something that belongs there, list
it under `remaining:` in your NOTES file.

## Decisions already made (implement these; do not re-litigate)

1. **Any-owner create.** `POST /api/v1/computers` gains `owner_type`
   (`user|org|bot`, default `bot` for backward compat) and optional
   `owner_id`. `session`-scoped computers are recorded as
   `owner_type='session'`... — **correction, final decision:** the DB CHECK on
   `computers.owner_type` only allows `user|org|bot`. So: a session-scoped
   request (`owner_type='session'` or `session_id` set without bot) is stored
   as `owner_type='user'`, `owner_id=<user_id>`, with `computers.session_id`
   set. Do NOT alter the CHECK constraint in Phase 1.
   - `owner_type='bot'` (or omitted): current behavior, unchanged — require
     `bot_id`, verify ownership, existing provisioning path. This path must not
     regress.
   - `owner_type='user'` / `'org'`: new standalone path. `owner_id` defaults:
     user → `user.user_id`; org → `resolve_org_id(&user)` (400 if absent).
2. **Full specs at create.** `CreateComputerRequest` gains `cpu_cores:
   Option<i64>`, `memory_mb: Option<i64>`, `disk_mb: Option<i64>`,
   `resolution: Option<String>` (e.g. `"1920x1080"`). Validation (400 with the
   allowed list on violation):
   - `cpu_cores ∈ {2, 4, 8}` (map to millis 2000/4000/8000)
   - `memory_mb ∈ {4096, 8192, 16384, 32768, 65536}`
   - `disk_mb ∈ {20480, 40960, 81920}`
   - `resolution ∈ {"1280x720", "1920x1080", "2560x1440"}`
   Put the sets in a `pub(crate) const VALIDATED_*` in
   `bot_desktop_templates.rs` next to the spec resolution. Explicit request
   fields override template defaults (template fills what the request omits).
   Resolution: store on the computers row (add nothing to DB — reuse the
   `computer_cloud_desktop.protocol`-style side storage? **No** — cleaner:
   pass it to the guest as env var `ALLTERNIT_DESKTOP_RESOLUTION` at spawn and
   store it in `computers.region`? **No.** Final: keep a JSON blob is
   overkill; store resolution in the `computer_cloud_desktop.ws_url`-adjacent
   side table is abuse. **Decision:** add no column; pass
   `ALLTERNIT_DESKTOP_RESOLUTION` env at spawn and include `resolution` in the
   create/list/get JSON responses read back from `computer_cloud_desktop` is
   not possible without a column — so: add it to the create response only from
   the request echo, and persist via env only. Document that resolution is
   applied guest-side and revisited in Phase 4 templates.)
   Extend `ProvisionRequest`/`ProvisionSpec` with cpu/memory/disk so
   `resolve_provision_spec` honors them (explicit > template > default).
3. **Standalone provisioning.** New `create_standalone_desktop` in
   `computer_routes.rs` for user/org owners:
   - Resolve spec (extended), org spend-cap + `credits::has_minimum_balance`
     gate (reuse the existing check, factor it into a helper shared with
     `create_cloud_desktop`).
   - Spawn via `state.vm_driver` directly with `SpawnSpec` mirroring
     `provision_desktop_internal` (tenant `user-<user_id>`, same env vars
     minus `ALLTERNIT_BOT_ID`, resources from the resolved spec). No
     `bot_desktop_quotas::record_start/check_quota` (bot-keyed); org credits
     gate already applied.
   - Insert `computers` row: `kind='cloud_desktop'`, owner_type/owner_id as
     decided, `name` from request (default `"Computer <short-id>"`),
     cpu_cores/memory_mb/disk_mb from spec, `native_id` = sandbox id,
     `billing_source='credits'`; plus `computer_cloud_desktop` row
     (`control_state='human_controls'` for non-bot owners, ws_url NULL —
     Phase 3 generalizes ws access).
   - On spawn failure return the driver error like the bot path does.
4. **Control handlers work without bot_id.** Refactor so ownership of the
   sandbox comes from the **computers row** (`native_id`, `os`, `provider`),
   not `read_bot_sandbox(bot_id)`:
   - Extract the cores of `bot_desktop_input::{send_desktop_mouse,
     send_desktop_keyboard, run_desktop_shell, upload_desktop_file,
     download_desktop_file}` into `pub(crate)` functions that take
     `(state, sandbox_id, os, provider, input [, body])` instead of
     `Path<bot_id>`; the existing bot route handlers become thin wrappers
     (keeping their signatures/routes intact). Where bot_id was used only for
     logging/audit, take `Option<&str>`.
   - `computer_routes` handlers call the extracted cores directly with the
     computer row's data; **keep the existing ACI confirmation gate exactly as
     is** (`enforce_control_confirmation` — do not weaken, do not extend).
   - Same treatment for screenshot/start/stop/delete/session-end: resolve
     sandbox from the row; when `bot_id` is present the behavior must remain
     byte-identical (bot sandbox record still takes precedence where behavior
     differs, e.g. `record_end` on delete for bots).
5. **Restart.** `POST /computers/:id/restart` → distinct verb; cloud_desktop:
   `pause_vm` then `resume_vm` (409 if status is `creating`/`deleted`/`error`;
   if already `stopped`, just start). Response shape matches start/stop.
6. **Kinds.** In `create_computer`:
   - `managed` → **410 Gone**, message: `"managed computers are formally cut
     (spec rq-20260909-004); use cloud_desktop or local"`. Keep the enum
     variant (DB CHECK round-trip).
   - `byo_vps`, `byoc` → keep 501, message names the follow-up phase.
   - `local` → **implement**: same standalone path as (3) but provider forced
     to `"tart"`, `billing_source='free'`, `region='local'`. If the driver has
     no tart substrate, fail with 503 and a clear message. (Tart runs on this
     Mac; incus provider must not be picked for `local`.)
7. **Visibility.** Extend `list_computers`/`fetch_computer` WHERE:
   `(c.owner_id = ?user_id) OR (c.owner_type='org' AND c.owner_id = ?org_id)
   OR (c.kind='cloud_desktop' AND a.user_id = ?user_id)` where org_id =
   `resolve_org_id(&user)`. (Replaces the current owner clause; the bot join
   clause stays.) `org_id` param omitted when None.
8. **Snapshots under /computers.** Add
   `POST /computers/:id/snapshots` (body `{stateful: bool}`),
   `GET /computers/:id/snapshots`,
   `POST /computers/:id/snapshots/:snapshot_id/restore`,
   `DELETE /computers/:id/snapshots/:snapshot_id` — resolving the driver
   handle from the computers row (bot-optional, same as control handlers).
   Match bot-route response shapes. No ACI gate beyond auth (parity with bot
   snapshot routes).
9. **Drag + scroll.** Extend `MouseInput` with optional `end_x: Option<i32>,
   end_y: Option<i32>` and new actions:
   - `drag`: xdotool `mousedown 1` → move to `end_x/end_y` in steps →
     `mouseup 1`. Requires `x,y,end_x,end_y` (400 otherwise).
   - `scroll`: `button: "up"|"down"` (default down) + optional `amount`
     (default 3) → xdotool button 4/5 clicks. Model `amount` as reuse of
     `end_x`? **No** — add `amount: Option<i32>` to MouseInput.
   Windows guest: drag/scroll → 501 honest (`windows input path supports move
   and click only`). Unknown action → 400 listing valid actions.
10. **TS client parity.** `surfaces/ai.allternit.com/src/lib/computers-api.ts`:
    add `restartComputer`, `screenshotComputer` (returns `Blob` via
    `api.raw`), `sendComputerMouse` (typed union incl. drag/scroll),
    `sendComputerKeyboard`, `runComputerShell`, `uploadComputerFile` (bytes
    via `api.raw` with `Content-Type: application/octet-stream` — do NOT copy
    desktop-cloud-api's JSON-base64 pattern), `downloadComputerFile` (blob via
    `api.raw`), `listComputerSnapshots`, `createComputerSnapshot`,
    `restoreComputerSnapshot`, `deleteComputerSnapshot`. Extend
    `CreateComputerInput` + `Computer` types (owner_type/owner_id,
    cpu_cores/memory_mb/disk_mb/resolution). Match the file's existing style
    (typed wrappers, no classes, `api` from `@/integration/api-client`).
    Migration note: check call sites in `vm-operator.ts` /
    `desktop-cloud-api.ts`; if a call site already has a computer id, migrate
    it; otherwise leave and list it under `remaining:`.

## Constraints

- **No builds/typechecks of unrelated crates, no dev servers, no git
  operations beyond your own branch** (`ao/cloud-computer-orgo-p1` — you are
  in a linked worktree; guards pass here). Conventional commits
  (`feat(computers): ...`), push your branch when the steering commit gate
  approves.
- Match repo idiom: Rust handlers return `impl IntoResponse`/`Response` with
  `error_response(...)`; DB access via `tokio::task::spawn_blocking` +
  `state.db.connect()`; rusqlite params style as in `computer_routes.rs`; TS
  uses the existing `api` client wrapper and function-per-endpoint exports.
- Do not add dependencies. Do not touch the ACU engine, `aci_*` gating logic,
  bot routes' external behavior, migrations that already ran (new behavior
  must work on the V99 schema; no ALTER needed), or `pnpm-lock.yaml`.
- Keep `.steering/checkpoint.md` updated (Goal / Just did / Next / Open
  questions) at every milestone — the commit gate reads it.
- Append milestone notes to `.allternit/shared-context.md` (append-only,
  `### cloud-computer-orgo-p1 <ISO ts>`) and drop verification artifacts in
  `~/.agent-orchestrator/evidence/cloud-computer-orgo-p1/`.

## Verification (all required; evidence into the evidence dir)

1. `cargo check -p allternit-api` and `cargo test -p allternit-api
   computer` (plus any new tests you add) — must pass. Add unit tests for:
   size validation (accept/reject each dimension), owner resolution
   (user/org/session-mapping/bot-default), visibility SQL (in-memory sqlite
   like the existing `check_org_spend_limit` tests), restart status machine.
2. TS: `npx tsc --noEmit` scoped to the surface (repo root typecheck script if
   one exists and is fast enough; otherwise surface-local) — your changed file
   must typecheck.
3. Live smoke, best effort with honest deferral: start the API locally
   (`cargo run -p allternit-api` or the documented dev command; check for
   required env) and curl: create (user-owned, no bot_id) → expect 503 if no
   driver/substrate, otherwise a real computer → screenshot → shell → file
   upload/download → restart → stop → delete. If the substrate (Tart/Incus)
   or server env is unavailable, capture the exact failure as evidence and
   defer the live portion in NOTES — do not fake it.
4. Record: commit SHAs, test output tails, curl transcripts in the evidence
   dir.

## Deliverable sentinel

When finished, write `docs/CLOUD_COMPUTER_PHASE_1_NOTES.md` starting with YAML
frontmatter:

```yaml
---
status: done|blocked
files_changed: [paths]
deviations: [what + why]
remaining: [items]
verification: [what ran + result]
---
```

then prose notes (what you built, how it works, what you deferred and why).
**That file existing = done.** If the steering commit gate blocks you and
consulting it doesn't resolve within two rounds, set `status: blocked`, say
exactly what's blocked, and stop — the orchestrator will resolve it.
