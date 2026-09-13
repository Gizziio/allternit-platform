# Session attestation — session/toolregistry-0912 (bot-chat 500 root cause: NamedError .Schema) + api health timeout

- **Date:** 2026-09-13 (early morning)
- **Agent family:** kimi-code
- **PR:** #462 → main `13927cea7` (tips `3176326bb` gizzi-util fix, `a3fc94eec` timeout)
- **Topic:** the fresh-from-main desktop build replied empty in bot chats;
  owner asked to fix-forward after the full rebuild.

## Root cause (diagnosed live, source-run gizzi + patched zod copy)

`NamedError.create()` (vendored `@allternit/gizzi-util`, source-less dist)
captured the zod schema in a closure but never exposed it. Consumers reading
`Class.Schema` — MessageV2's `RetryPart` (`error: APIError.Schema`), the legacy
`Message` discriminatedUnion, and the openapi error resolver — got `undefined`.
zod v4 normalizes object shapes lazily, so the defect threw
`Invalid element at key "error": expected a Zod schema` the first time any
schema carrying it was PARSED — i.e. whenever a session whose history contains
a **retry part** prompted (compaction replays history schemas). Fresh sessions
(no retry parts) never parsed it, which is why CI stayed green and new chats
worked while every long-lived bot session 500'd with an 'Unknown' error.

The hunt: reproduced against the source-run gizzi with a patched zod that
printed the construction stack — pointed at `session/compaction.ts` →
`MessageV2.RetryPart` → `APIError.Schema === undefined`.

## Fix

- `cmd/gizzi-code/packages/gizzi-util/dist/error.js`: attach `Schema` to the
  created class (dist is checked in — source-less package).
- `surfaces/allternit-desktop/src/main/backend-manager.ts`: packaged api health
  timeout 30s → 90s (same as dev). Cold starts repeatedly exceeded 30s (slow
  JWKS fetch serializing behind sidecar bring-up), aborting init and flapping
  api restarts — wedged ordinary launches all night. `ALLTERNIT_API_HEALTH_TIMEOUT_MS`
  still overrides.

## Verification

- Live: failing session `ses_f67e94480ffeZVHpp9gAH76N25` (retry parts in
  history) 500'd on every message before, replies after; new sessions
  unchanged. Full bot-chat smoke on the rebuilt desktop: Kimi K3 default,
  transcript renders, neutral bubble restyle visible.
- Desktop main: tsc clean; 129 tests green.
- Installed desktop 1.1.1.2474 (release/mac-arm64 copy; the dmgbuild image
  step failed transiently on hdiutil — repack when cutting the next release).

## Notes

- Debug scaffolding (zod stack patch, server.ts console.error) was fully
  reverted; the shared node_modules zod was restored from a backup taken
  before patching.
- macOS SIGKILLs binaries swapped piecemeal into an installed .app bundle —
  hot-swapping sidecars in /Applications is not viable; reinstall a consistent
  bundle instead.
- Deferred: full Observe → Take Over → Hand Back cycle still unverified live
  (provisioning prerequisites now work on plain launches: #452 + #455).
