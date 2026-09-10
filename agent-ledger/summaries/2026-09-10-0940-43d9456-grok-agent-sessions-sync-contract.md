# Attestation — session/43d9456: agent-sessions /sync caller vs data-plane contract

- Date: 2026-09-10
- Session: 01a08b5b-2c71-73a2-a42d-901df43d9456 (grok), worktree `allternit-session-43d9456`
- Branch: `session/43d9456` → PR #249, merged as `763a4f0484df9046751a8baac556c5df99fe51d2`
- Feature commit: `75218a8cbf6353ab1e32629864de31f512f6058e`

## What was fixed

The PWA/web `/api/v1/agent-sessions/sync` caller was written against an invented envelope (`session.created` + nested `payload.session`). The live contract is on the data-plane node:

- `cmd/allternit-api/src/agent_session_routes.rs` `transform_bus_event`
- gizzi-code in-process mirror `cmd/gizzi-code/.../agent-compat.ts`

Wire types: `created` / `updated` / `deleted` / `message_added` (session/message fields at the top level), plus `permission_asked` / `question_asked` / part events. Cloud-api is a verbatim relay (auth → default node → outbound WS) and was not changed to reshape events.

Last night's PWA `/api` 404 and runtime-device proxy 401 were already root-caused as not bugs (stale state / GET vs POST). This session only did the remaining `/sync` caller work.

## Changes (PR #249)

- New `surfaces/ai.allternit.com/src/lib/agents/agent-session-sync.ts` parser pinned to the node wire types. Historical `{type, payload}` envelope still parses so a leftover producer cannot silently drop events; tests pin the service shape as canonical.
- `mode-session-store.connectSessionSync` consumes that parser via `sessionApi.createSyncSource(lastEventId)` instead of a duplicated EventSource vs cloud-fetch branch.
- `CloudApiEventSource` records SSE `id:` onto `MessageEvent.lastEventId` and sends `Last-Event-ID` on reconnect. Local EventSource reconnects with `?since=`.
- 8013 `sync_sessions` honors `?since=` (header still wins), matching gizzi agent-compat. Cloud-api already forwarded `Last-Event-ID` on the relay allow-list.
- session-composer reconnects with the same cursor.

## Verification

- `vitest run src/lib/agents/agent-session-sync.test.ts src/lib/cloud-api-event-source.test.ts` — **9/9**
- `cargo check -p allternit-api` — exit 0 (pre-existing warnings only)
- GitHub Desktop CI: unit tests + typecheck/build **green**. Vercel preview / Cloudflare Pages failed (rate-limit / preview deploy); same class of failure on other merges today; not a required check (main is unprotected).

## Honest notes / deferred

- `todo.updated` is still consumed by session-composer and is **not** in `transform_bus_event`. Left alone; do not invent a service event.
- Native-sessions catalog (`/list` / `/pickup`) was not this slice.
- Desktop DMG rebuild from merged main was **not** run this session: shared checkout `main` has unrelated dirty files (office add-in manifests, `resources/company.json`, computer-use staged trees) that must not be mixed into an attestation commit, and the change is live on the SPA + 8013 sidecar source. Next desktop release that rebuilds `allternit-api` + platform static will pick it up.
- Live re-test of a signed-in PWA EventSource against a paired node was not repeated here; the previous session already confirmed `/api/v1/sessions` 401 through the fabrictransport proxy.
