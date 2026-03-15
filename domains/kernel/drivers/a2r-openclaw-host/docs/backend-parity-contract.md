# A2R Backend Parity Contract (OpenClaw Control Gateway)

## Scope

This contract defines the required native backend behavior for running the
native A2R OpenClaw Control UI without relying on the vendored OpenClaw backend.

Primary source baseline:

- `3-adapters/vendor-integration/vendor/openclaw/docs/web/control-ui.md`
- `3-adapters/vendor-integration/vendor/openclaw/dist/control-ui/assets/index-*.js`

## Protocol Contract

The native backend MUST support:

- WebSocket transport endpoint for Control UI clients.
- Frame protocol:
  - request: `{ "type": "req", "id": "...", "method": "...", "params": {...} }`
  - response: `{ "type": "res", "id": "...", "ok": true|false, "payload": {...}, "error": {...} }`
  - event: `{ "type": "event", "event": "...", "payload": {...}, "seq": N }`
- `connect` handshake with client identity `openclaw-control-ui`, role/scopes,
  token/password auth passthrough, and challenge support.

## Required Method Surface

The vendor Control UI currently references this method set:

- `agent.identity.get`
- `agents.list`
- `channels.logout`
- `channels.status`
- `chat.abort`
- `chat.history`
- `chat.send`
- `config.apply`
- `config.get`
- `config.schema`
- `config.set`
- `connect.challenge`
- `cron.add`
- `cron.list`
- `cron.remove`
- `cron.run`
- `cron.runs`
- `cron.status`
- `cron.update`
- `device.pair.approve`
- `device.pair.list`
- `device.pair.reject`
- `device.pair.requested`
- `device.pair.resolved`
- `device.token.revoke`
- `device.token.rotate`
- `exec.approval.requested`
- `exec.approval.resolve`
- `exec.approval.resolved`
- `exec.approvals.get`
- `exec.approvals.node`
- `exec.approvals.set`
- `logs.tail`
- `models.list`
- `node.list`
- `node.trim`
- `sessions.delete`
- `sessions.list`
- `sessions.patch`
- `skills.install`
- `skills.status`
- `skills.update`
- `update.run`
- `web.login.start`
- `web.login.wait`

## Current Native Coverage Baseline

From `native_gateway_ws_handlers.rs`, native WS method handlers are currently:

- `chat.send`
- `chat.history`
- `sessions.list`
- `sessions.get`
- `skills.list`

Overlapping vendor methods:

- `chat.send`
- `chat.history`
- `sessions.list`

Current gap count:

- vendor methods: `45`
- native WS methods: `5`
- overlap: `3`
- missing: `42`

## Exit Criteria For Backend Cutover

Native backend is cutover-ready only when all are true:

- Protocol parity:
  - `req/res/event` envelope compatibility.
  - `connect` behavior parity for accepted/rejected auth and challenge flows.
- Method parity:
  - 100% required method surface implemented or intentionally unsupported with
    documented replacement and UI fallback.
- Behavioral parity:
  - parity smoke tests pass against native backend for all tabs:
    `chat`, `overview`, `channels`, `instances`, `sessions`, `cron`,
    `skills`, `nodes`, `config`, `debug`, `logs`.
- Operational parity:
  - restart/update/config-apply/log-tail semantics behave compatibly for operator workflows.

## Migration Slices

1. Transport + connect parity (`connect`, `status`, `health`, baseline events)
2. Chat/session parity (`chat.*`, `sessions.*`)
3. Channel parity (`channels.*`, `web.login.*`)
4. Cron/skills/nodes/exec parity (`cron.*`, `skills.*`, `node.*`, `exec.*`)
5. Config/debug/logs/update parity (`config.*`, `models.list`, `logs.tail`, `update.run`)
6. Pairing/device/admin parity (`device.*`, `agent.*`)

