# Session summary — ao/cloud-computer-orgo-p3 — kimi — cloud-computer-orgo-parity Phase 3

**Date:** 2026-09-09 · **Branch:** `ao/cloud-computer-orgo-p3` · **PR:** #206 (merged, merge SHA `772c5c158`, head `64a464257`) · **Spec:** rq-20260909-004 Phase 3 (Real-time plane)

## What was done

- **Computer-scoped ws tokens** — `DesktopTokenClaims` gained serde-default `computer_id`/`purpose`; `sign_computer_token`/`verify_computer_token` reuse the HMAC infra; bot tokens unchanged and cross-rejected; legacy payloads still validate. `POST /computers/:id/ws-token` (300s TTL, purpose-scoped).
- **`guest_service_url(handle, guest_port)`** — new driver trait method (default NotSupported); Incus scans instance config for an existing proxy device to the guest port (reuse) else allocates via the existing expose-port machinery, returning `http://{incus_host}:{port}`.
- **Interactive PTY** — `GET /ws/computers/:id/pty?token=`: embedded ~95-line python bridge (guest 127.0.0.1:6010, per-bootstrap token first line, pty.fork bash, TIOCSWINSZ for `{"cols","rows"}`), lazy nohup bootstrap on first connect, one re-bootstrap on refused, binary WS↔TCP pump mirroring the VNC handler, clean ws close JSON for unsupported substrates.
- **Guest event stream** — embedded collector (2s loop → `/tmp/allternit-events.jsonl`): window (xdotool), clipboard (xclip, on change), idle_ms (xprintidle, fallback 0), processes top-5 (30s), files under ~/Desktop + ~/Downloads (5s); missing tools tolerated. Live `/ws/computers/:id/events?token=` (prime tail -n 50, then offset-poll every ~2s, 15s heartbeat, refreshes `last_activity_at` so streams feed Phase 2 auto-stop). History `GET /computers/:id/events?limit=N` (≤500), read-only (auth + audit only).
- **Authenticated in-VM HTTP proxy** — V137 adds `computer_cloud_desktop.proxy_port/proxy_paths` + `computer_access_logs`; `POST .../proxy/enable` (port + path-prefix allowlist, `["*"]` = all) and `.../disable` are **ACI approval-gated** via new `ProxyEnable{port}`/`ProxyDisable` variants (Risky, reversible state-changing); `GET .../proxy` ungated; `ANY .../proxy/{*path}` forwards (hop-by-hop header denial, 10 MB body cap, 30s reqwest timeout, 502 upstream / 404 disabled / 403 path / 501 ws-upgrade), per-request audit.
- **`computer_audit` module** — fire-and-forget inserts for ws-token issues, proxy enable/disable, proxied requests.

## Verification evidence

- `cargo check -p allternit-api -p allternit-computer-cloud -p allternit-driver-interface`: 0 errors (orchestrator re-ran).
- `cargo test -p allternit-api computer`: **41 pass**; `-p allternit-computer-cloud`: **102 pass** (orchestrator aggregated).
- Both embedded guest scripts `python3 -m py_compile`-checked (test skips gracefully without python3).
- Incus mock-HTTP tests cover proxy-device reuse + allocation. Token round-trip incl. bot back-compat, allowlist matcher, header filter, enable/disable validation, NotSupported→501 mapping, audit insert (in-memory sqlite) covered.
- Live Incus smoke deferred honestly (none reachable in this environment); 501/503 paths unit-covered.

## Incidents / honest deferrals

- Executor kimi finished implementation + tests but stalled at the steering commit gate (consult transport hung, same failure as Phase 2's gate); orchestrator pushed/merged after Phase 5 review per the repo's documented escape. Executor selection was forced: codex weekly quota <5%, claude CLI logged out machine-wide.
- Tart/local PTY+proxy: one follow-up (tart-host wrapper needs a port-forward endpoint).
- Client (TS) parity for pty/events/proxy: Phase 5 per spec.
- No new dependencies; bot routes and Phase 1/2 behavior untouched; ACI gate extended, never weakened.
