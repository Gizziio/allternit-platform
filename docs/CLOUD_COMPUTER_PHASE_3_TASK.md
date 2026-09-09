# Cloud Computer Phase 3 — Real-time plane (TASK)

Executor task for spec rq-20260909-004 Phase 3. Read
`docs/CLOUD_COMPUTER_PHASE_3_DESIGN.md` first — all facts verified against
main `08ecef8ac` (Phases 1+2 merged: any-owner create, resize, clone,
auto-stop, groups). **Do NOT start Phase 4+.** Audio stream is explicitly
out of scope (spec: optional stretch; cut).

## Decisions (implement exactly)

### Shared: token generalization + driver reachability

1. **Computer-scoped ws tokens.** In `bot_desktop_stream.rs`: add
   `computer_id: Option<String>` (serde default) to `DesktopTokenClaims`;
   add `sign_computer_token(secret, computer_id, sandbox_id, user_id, ttl)`
   and validate fn that accepts claims with `computer_id` set (existing
   bot-token validation unchanged). New module
   `cmd/allternit-api/src/computer_ws.rs` holds the sign/verify/secret reuse
   (import the HMAC helpers) and the ws handlers below. Token issue endpoint:
   `POST /api/v1/computers/:id/ws-token` → `{token, expires_in}` (300s),
   auth'd, owner-scoped via `fetch_computer`; body `{"purpose": "pty"|"events"}`.
2. **Driver reachability.** New trait method in driver-interface:
   ```rust
   /// Server-reachable base URL for a TCP service inside the guest.
   async fn guest_service_url(&self, handle: &ExecutionHandle, guest_port: u16)
       -> Result<String, DriverError> // default NotSupported
   ```
   Incus impl (`cmd/allternit-computer-cloud`): reuse/extend the existing
   proxy-device allocation (`allocate_proxy_port` / `add_proxy_device`
   machinery) to forward an allocated host port → `guest_port`, and return
   `http://{incus_host}:{host_port}` where incus_host is derived from the
   substrate URL config (same host the driver already talks to). Reuse an
   existing proxy device when one for that guest_port already exists (check
   via `get_config` devices).

### A. Interactive PTY over WebSocket — `/ws/computers/:id/pty`

3. **Guest bridge (no image rebuild):** `computer_ws.rs` carries an embedded
   python3 PTY bridge script (constant string, ~80 lines: listen on
   127.0.0.1:6010, accept TCP, `pty.fork()` + `os.execvp("bash")`, pump both
   directions, single connection at a time, connection token check from
   env/argv). First connect lazily bootstraps: upload script via existing
   `upload_desktop_file`-equivalent core to `/tmp/allternit-pty-bridge.py`,
   exec `nohup python3 /tmp/allternit-pty-bridge.py 6010 '<bridge-token>' ... &`
   (precedent: mux bootstrap). Bridge token: random per bootstrap, kept
   in-memory in AppState (not persisted; reconnect re-bootstraps if stale —
   detect ECONNREFUSED → re-bootstrap once).
4. **Handler:** `GET /ws/computers/:id/pty?token=` — mount on the ws router
   next to the VNC ws route in main.rs. Validate token (computer_id match,
   purpose=pty, expiry) BEFORE upgrade; `fetch_computer` ownership; computer
   must be running. Then: `guest_service_url(handle, 6010)` → open
   `tokio::net::TcpStream` → binary WS↔TCP bridge copied from the VNC
   handler pattern (16KiB chunks, mpsc, three tasks, select! cleanup).
   Provider without support → clean ws close frame with JSON error reason
   `{"error":"pty is not supported on the <provider> substrate"}` before
   bridging.
5. Resize messages: client may send text `{"cols":N,"rows":M}` → relayed to
   bridge as ioctl on the pty (bridge handles a 1-line JSON control prefix);
   ignore malformed text messages.

### B. Guest event stream

6. **Guest collector (lazy bootstrap, same pattern):** embedded shell/python
   sampler script → `/tmp/allternit-events.py`, started with nohup,
   appends JSON lines to `/tmp/allternit-events.jsonl` every 2s:
   `{"ts","type","data"}` with types: `window` (active window title via
   xdotool), `clipboard` (xclip -o, only on change), `idle_ms` (xprintidle;
   fallback `0` if absent), `processes` (top-5 CPU snapshot, every 30s
   only), `files` (new files under ~/Desktop + ~/Downloads via polling mtimes,
   every 5s). Missing tools are tolerated (skip that type; log once).
7. **Live:** `GET /ws/computers/:id/events?token=` (purpose=events) —
   handler spawns a guest log tail loop: one-shot exec `tail -n 50
   /tmp/allternit-events.jsonl` then repeated `tail -n +2`-style incremental
   reads (or `sleep 2; tail -c +OFFSET`) every ~2s; each new line → ws text
   message. Also refresh `last_activity_at` per Phase 2 helper when events
   arrive (idle events feed auto-stop). Heartbeat `{"type":"ping"}` every 15s.
   Clean close on token expiry is fine (client re-fetches).
8. **History:** `GET /api/v1/computers/:id/events?limit=N` (default 50, max
   500) — one-shot exec `tail -n N ...jsonl`, return parsed JSON array.
   501 for unsupported providers. No ACI gate (read-only), auth + audit only.
9. **Audit:** add `computer_audit` middleware/module (pattern copied from
   `desktop_audit_middleware`, without bot_id): log computer ws-token issues,
   proxy enables/disables, and proxied requests into a new table (migration
   `V137`): `computer_access_logs (id TEXT PK, computer_id TEXT, user_id
   TEXT, kind TEXT, detail TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
   + index on computer_id. Fire-and-forget inserts.

### C. Authenticated in-VM HTTP proxy — `/api/v1/computers/:id/proxy/{*path}`

10. **Enablement (opt-in, approval-gated):** migration `V137` also alters
    `computer_cloud_desktop`: `ADD COLUMN proxy_port INTEGER`,
    `ADD COLUMN proxy_paths TEXT` (JSON array of allowed path prefixes; `'["*"]'`
    = all). `POST /api/v1/computers/:id/proxy/enable` body `{"port":
    1..65535, "paths"?: string[]}` → **ACI approval required** (reuse
    `enforce_control_confirmation` with a new `ComputerControlAction` variant
    `ProxyEnable { port }` — add to `computer_control.rs` taxonomy as
    reversible state-changing; follow the existing classification pattern).
    Validates port range, stores port+paths, allocates nothing yet.
    `POST .../proxy/disable` (also approval-gated) nulls both.
    `GET .../proxy` returns current config (port, paths, enabled) — no gate.
11. **Forwarding:** `ANY /api/v1/computers/:id/proxy/{*path}` (axum 0.7
    wildcards) — auth; computer running; proxy enabled; path allowed
    (prefix match, or `*`); build target URL from `guest_service_url(handle,
    proxy_port)` + path + query; copy method, headers (deny `host`,
    `connection`, hop-by-hop), body (cap 10 MB); reqwest client, 30s timeout;
    stream response back (status, headers minus hop-by-hop, body). Log every
    request to `computer_access_logs` (kind='proxy', detail =
    `"METHOD /path → status"`). WS upgrade requests → 501.
    Errors: upstream unreachable → 502; disabled → 404
    `"proxy is not enabled for this computer"`; path denied → 403.

### 12. Tests (required)

- Token: sign/validate round-trip incl. computer_id claims, expiry, bot
  back-compat (existing claims still validate), purpose mismatch rejected.
- Bridge scripts: python script syntax-compiled in test (`python3 -m py_compile`
  via std::process in a #[test] — skip gracefully if python3 absent).
- Handler-level: path-allowlist matching fn (pure, table-driven), proxy
  header filtering fn (pure), audit insert (in-memory sqlite), enable/disable
  validation, 501-mapping for NotSupported.
- Incus `guest_service_url`: extend the existing mock HttpClient tests in
  computer-cloud (reuse their test substrate harness) — device reuse +
  allocation paths.
- `cargo check -p allternit-api -p allternit-computer-cloud -p
  allternit-driver-interface`; `cargo test -p allternit-api computer`;
  `cargo test -p allternit-computer-cloud`; surface tsc for any touched TS
  (none expected — client parity for pty/events/proxy is a Phase 5 concern;
  if you add a TS helper, typecheck it).

## Constraints

- No new dependencies. axum ws + tokio + futures + rusqlite + reqwest only.
- Do not weaken the ACI gate; the two new gated actions extend it in the
  existing style. Bot routes unchanged. Phase 1/2 behavior intact.
- Live smoke: honestly deferred if no Incus is reachable (expected in this
  env) — capture the 501/503 evidence; unit/integration coverage above is
  the bar.
- `.steering/checkpoint.md` at milestones; steering consults run via
  STEER_CONSULT_CMD (kimi) — respond to STEER and retry; blocked after two
  rounds → `status: blocked` + specifics.
- Evidence → `~/.agent-orchestrator/evidence/cloud-computer-orgo-p3/`;
  append-only `.allternit/shared-context.md` milestones.

## Sentinel

Write `docs/CLOUD_COMPUTER_PHASE_3_NOTES.md` with frontmatter
(`status/files_changed/deviations/remaining/verification`) + prose, then
commit (conventional `feat(computers): ...`), push, report branch SHA.
**File existing = done.**
