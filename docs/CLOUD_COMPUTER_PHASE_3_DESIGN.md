# Cloud Computer Phase 3 — Real-time plane (DESIGN)

Spec rq-20260909-004 Phase 3. Facts verified 2026-09-09 against main
(`08ecef8ac`, Phases 1+2 merged). Executor: read
`CLOUD_COMPUTER_PHASE_3_TASK.md` for locked decisions.

## Verified substrate facts

- **ws-token infra** (`bot_desktop_stream.rs:99-160`): stateless HMAC-SHA256
  token (`header.payload.sig`), secret `ALLTERNIT_DESKTOP_WS_SECRET` (dev
  fallback only with `ALLTERNIT_LOCAL_DEV_BYPASS=true`); claims
  `DesktopTokenClaims{bot_id, sandbox_id, user_id, exp}` — **hardwired to
  bots**; TTL 300s in production (`bot_desktop_routes.rs:1148`). Sole ws
  route `/ws/bots/:bot_id/desktop/vnc` (main.rs:767), raw TCP↔WS binary
  bridge (16KiB chunks, three forward tasks, `tokio::select!` cleanup).
- **axum ws** is the only ws mechanism (`axum 0.7` ws feature); the
  protected router layers auth + per-org/user RPM rate limit (a single
  upgrade = single request). No ws-auth middleware; auth is per-handler.
- **Guest addressing**: Incus guests are reached via **host-side proxy
  devices** (`allocate_proxy_port(host_port → guest host:port)`,
  `driver.rs:212`; VNC = host:vnc_port → guest 5900). Incus GET
  instance-state for guest IPs is never called. Tart wrapper returns guest
  `ip` (`tart-host.rs:199,257`) but the driver drops it (`tart.rs:539-541`).
- **Guest agent**: Firecracker-only vsock agent exists (unused by
  Incus/Tart). Incus/Tart images bake Xvfb/x11vnc via cloud-init
  (`cmd/allternit-computer-cloud/guest/cloud-init.yaml`). No persistent
  process primitive except ad-hoc `nohup` via exec (precedent: mux
  bootstrap, `bot_desktop_mux.rs:103`). Env is exec-time only.
  `stream_logs` = NotSupported (Incus).
- **No HTTP reverse proxy into guest exists.** No SSE emitter in the API
  (only upstream proxies). `desktop_audit_middleware` pattern is copyable
  (`bot_desktop_audit.rs:45`, bot_id from path segment, insert into
  `desktop_audit_logs`).
- Deps available: axum ws, tokio-tungstenite 0.21, futures 0.3.
  **No new dependencies.**

## Phase 3 scope (3 features; audio explicitly cut per spec)

A. Interactive PTY over WebSocket — `/ws/computers/:id/pty`
B. Guest event stream — ws live + history GET
C. Authenticated in-VM HTTP proxy — `/api/v1/computers/:id/proxy/*`

**v1 substrate support: Incus only.** Tart/local → honest 501 (tart-host
wrapper needs a port-forward endpoint; one follow-up covers PTY+proxy).
