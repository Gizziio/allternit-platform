# Attestation — session/43d9456-ns: native-sessions catalog through the data-plane relay

- Date: 2026-09-10
- Session: 01a08b5b-2c71-73a2-a42d-901df43d9456 (grok), worktree `allternit-session-43d9456-ns`
- Branch: `session/43d9456-ns` → PR #252, merged as `fa43c57782543f51b3f8136681dc21e6cee26a88`
- Feature commit: `6bb9af30b`

## What was fixed

Follow-up to PR #249 (`/sync` caller). The native-sessions catalog client
(`list` / `pickup` / `show` / export-native / fetch-origin) always used
`getGatewayOrigin()`, which is empty on web, so the picker fetched relative
`/api/v1/native-sessions` from the SPA origin and parsed HTML.

The catalog contract is 8013 → gizzi `/v1/native-session/*`. Cloud-api already
relays that namespace verbatim. Agent-sessions already targeted
`getCloudApiBaseUrl()` when `NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API=1`.

Pickup also forwarded `surface: "bot"`. Gizzi `Session.Info.surface` is
`chat|cowork|code|browser|design`, so bot-mode pickup 400ed.

## Changes (PR #252)

- `native-sessions-api.ts` uses the same flag/desktop split as
  `getAgentSessionBase()`. Web + flag → cloud-api; desktop operator shell →
  local :8013. Web with the flag off fails closed (no SPA HTML probe).
- Pickup maps `bot` → `chat` on the client.
- 8013 `pickup_native_session` uses `normalize_surface_for_gizzi` (now includes
  `bot`) and stamps `session_origin_surface` so list/get restore the original
  surface. Does not send `surface: null` to gizzi.

## Verification

- `vitest run src/lib/agents/native-sessions-api.test.ts` — **8/8**
- `cargo test -p allternit-api --lib surface_normalize_tests` — **1/1**
- GitHub Desktop CI: unit tests + typecheck/build **green**. Vercel/Cloudflare
  preview failed (rate-limit); same class as #249; main is unprotected.

## Honest notes / deferred

- `todo.updated` still not on the `/sync` node feed.
- Desktop DMG not rebuilt (shared `main` still has unrelated dirty files).
- Live picker against a paired node was not re-run in this session.
