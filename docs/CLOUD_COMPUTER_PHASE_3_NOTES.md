---
status: done
files_changed:
  - cmd/allternit-api/migrations/V137__computer_access_logs_and_proxy.sql
  - platform/contracts/driver-interface/src/lib.rs
  - cmd/allternit-computer-cloud/src/driver.rs
  - cmd/allternit-api/src/bot_desktop_stream.rs
  - cmd/allternit-api/src/computer_audit.rs
  - cmd/allternit-api/src/computer_control.rs
  - cmd/allternit-api/src/computer_ws.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
  - .allternit/shared-context.md
  - .steering/checkpoint.md
deviations:
  - sign_computer_token takes a trailing `purpose` parameter beyond the spec's
    listed args (purpose must ride in the claims so endpoints can validate it).
  - ProxyDisable added alongside the spec-named ProxyEnable variant: the spec
    requires proxy/disable to be approval-gated too, so it needs its own
    taxonomy entry. Both classified Risky (reversible state-changing).
  - Proxy actions are rejected on the guest tool surface
    (execute_computer_tool); they are REST-managed, ACI-gated route actions.
  - Live smoke against a real Incus host honestly deferred (none reachable in
    this environment); the 501 unsupported-substrate and 503 paths are
    covered by unit tests instead.
remaining:
  - Tart/local guest_service_url (port-forward endpoint in tart-host wrapper)
    — one follow-up covers PTY+proxy for macOS guests per the design doc.
  - Client parity for pty/events/proxy is a Phase 5 concern (per spec).
  - Live end-to-end smoke on an Incus host with the desktop image.
verification:
  - cargo check -p allternit-api -p allternit-computer-cloud -p allternit-driver-interface
  - cargo test -p allternit-api computer
  - cargo test -p allternit-computer-cloud
  - python3 -m py_compile on both embedded guest scripts
---

# Cloud Computer Phase 3 — Real-time plane (NOTES)

Spec `rq-20260909-004` Phase 3, executed against `docs/CLOUD_COMPUTER_PHASE_3_TASK.md`
with `docs/CLOUD_COMPUTER_PHASE_3_DESIGN.md` as the verified reference (main
`08ecef8ac`, Phases 1+2). Phase 4+ not started; audio explicitly out of scope.

## What was built

**Shared plumbing.**
- `DesktopTokenClaims` gained `computer_id` / `purpose` (both serde-default);
  bot-token signing and validation are unchanged and bot tokens are rejected
  by the computer-token validator (and vice versa). Legacy payloads without
  the new fields still validate.
- `sign_computer_token` / `verify_computer_token` in `bot_desktop_stream.rs`;
  the HMAC/base64 helpers are now `pub(crate)` and reused by
  `computer_ws.rs`. Token TTL is 300s, same secret discipline as bot VNC.
- New driver-interface method `guest_service_url(handle, guest_port)`
  (default `NotSupported`). The Incus driver scans the instance config for an
  existing proxy device forwarding to the guest port (reuse) and otherwise
  allocates one via the existing `expose_port` machinery on the handle's own
  host, returning `http://{incus_host}:{port}` where `incus_host` is derived
  from the substrate URL (the `vnc_host` the driver already computes).

**A. Interactive PTY** — `GET /ws/computers/:id/pty?token=`. The embedded
python bridge (`/tmp/allternit-pty-bridge.py`, ~95 lines) listens on guest
127.0.0.1:6010, checks a per-bootstrap token as the first connection line,
`pty.fork()`s bash, pumps both directions, and applies `TIOCSWINSZ` for
one-line `{"cols":N,"rows":M}` control messages. First connect lazily uploads
and `nohup`-starts it; bridge tokens live in `AppState.computer_guest_tokens`
(in-memory only); a refused connection re-bootstraps once. Token, ownership
(`fetch_computer`), running state, and purpose are validated before upgrade;
unsupported providers get a clean ws close frame with
`{"error":"pty is not supported on the <provider> substrate"}`. Binary
WS↔TCP pump mirrors the VNC handler (16KiB chunks, three tasks, select!
cleanup). Malformed text frames are ignored.

**B. Guest event stream** — embedded collector samples every 2s into
`/tmp/allternit-events.jsonl`: `window` (xdotool), `clipboard` (xclip, on
change only), `idle_ms` (xprintidle, fallback 0), `processes` (top-5 CPU,
every 30s), `files` (new files under ~/Desktop + ~/Downloads, every 5s);
missing tools are tolerated. Live `GET /ws/computers/:id/events?token=`
primes with `tail -n 50`, then polls `tail -c +OFFSET` every ~2s (offset from
`stat -c %s`), forwards each JSON line as a ws text message, heartbeats
`{"type":"ping"}` every 15s, and refreshes `last_activity_at` when events
arrive so live streams feed the Phase 2 auto-stop. History
`GET /api/v1/computers/:id/events?limit=N` (default 50, max 500) is read-only
(auth + audit only, no ACI gate) and maps `NotSupported` to 501.

**C. Authenticated in-VM HTTP proxy** —
`POST /api/v1/computers/:id/proxy/enable` (body `{"port":1..65535,"paths"?}`),
`.../disable`, and `GET .../proxy` backed by new
`computer_cloud_desktop.proxy_port/proxy_paths` columns (V137). Enable/disable
are ACI approval-gated via new `ComputerControlAction::ProxyEnable { port }` /
`ProxyDisable` variants classified Risky (reversible state-changing) with
deterministic descriptors. `ANY /api/v1/computers/:id/proxy/{*path}` checks
auth, running state, enabled config, and the path allowlist (prefix match or
`*`; 404/403 respectively), resolves the upstream through
`guest_service_url`, forwards method + filtered headers (denies `host`,
`connection`, and the hop-by-hop set) + body (10 MB cap), uses a 30s reqwest
client, streams status + filtered headers + body back, and audit-logs every
request as `METHOD /path → status`. WS upgrades get a 501; unreachable
substrates map to 502 (501 for `NotSupported`).

**Audit.** New `computer_audit` module writes fire-and-forget inserts into
`computer_access_logs` (V137: id/computer_id/user_id/kind/detail/created_at +
computer_id index) for ws-token issues, proxy enable/disable, and proxied
requests.

## Verification

See frontmatter. The two embedded guest scripts are `python3 -m py_compile`
checked both in a #[test] (skips gracefully without python3) and manually;
evidence in `~/.agent-orchestrator/evidence/cloud-computer-orgo-p3/`. Handler
tests cover the allowlist matcher, header filter, enable/disable validation,
NotSupported→501 mapping, resize-message parsing, audit insert (in-memory
SQLite), proxy config round-trip, and token sign/verify incl. bot
back-compat. Incus mock-HTTP tests cover the proxy-device reuse and
allocation paths.

No new dependencies. Bot routes and Phase 1/2 behavior untouched; the ACI
gate is extended, not weakened.
