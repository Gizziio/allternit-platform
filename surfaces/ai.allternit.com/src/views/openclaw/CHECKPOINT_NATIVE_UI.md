# OpenClaw Native UI Checkpoint

## Checkpoint ID
- `openclaw-native-ui-v0.2.0`
- Date: `2026-02-12`

## Scope
- Active OpenClaw view in Shell is native Allternit implementation (no iframe host).
- Gateway protocol client implemented in `gateway-client.ts` using WS `req/res/event`.
- Tabs wired to live gateway RPC methods:
  - `chat`, `overview`, `channels`, `instances`, `sessions`, `cron`, `skills`, `nodes`, `config`, `debug`, `logs`

## Runtime Validation Commands
- Gateway reachability:
  - `openclaw status --json`
  - Expected: `gateway.reachable: true`
- UI config endpoint:
  - `curl -s "http://localhost:5177/allternit-config.json?nocache=1"`
- Direct WS probe (connect + status + chat send):
  - Connect succeeds (`hello-ok`)
  - `status` RPC succeeds
  - `chat.send` ack returns `status: started`
  - `chat.history` shows latest assistant transcript entry

## Latest Update
- Left-rail integration split is wired:
  - `OpenClaw Agent Chat` (`openclaw-chat`)
  - `OpenClaw Sessions` (`openclaw-sessions`)
  - `New LLM Chat` remains explicitly labeled for regular chat flow.
