# Attestation — cowork caveat landing (Kimi session a9f18780 resume)

- **Date:** 2026-09-14 14:39 CDT
- **Agent:** grok (Grok Build), resuming Kimi Code `session_a9f18780-0993-4465-8f6e-fb571097dcd7` after a 5-hour quota stop
- **Landing:** merge commit `d8752d94f` on `main` (`Merge branch 'ao/cowork-permission-enforcement'`), included in `74bac27a9` then fast-forwarded by later PRs. Current `origin/main` at attestation time: `602e5bf85`.
- **Owner instruction:** "merge push to main not a different branch" then "do the rest"

## What landed on main

Three commits, merged no-ff:

1. `791708a5a` — kimi-cli ACP subprocess: forward `tool_call`/`tool_result` as session tool parts; gate ACP `requestPermission` through `PermissionNext` when a session id is present; stop treating ACP `usage_update` `{used,size}` as billing tokens.
2. `f177fd676` — session id no longer depends only on AsyncLocalStorage (`x-gizzi-session` header fallback). Quota/auth stderr (`provider.auth_error` / 5-hour or monthly 403) is a stream error, not an empty successful finish.
3. `e72447420` — agent-chat idle with no text and no tools is `status: error` (`turn produced no model output`). Nested-if bug that dropped text `content_block_delta` is fixed. `session.error` is forwarded. DAG `record_turn_result` uses the same status.

## Verification (code)

- `bun test` `test/runtime/local-cli-driver.test.ts` + `test/runtime/stream-context.test.ts` — 21 pass
- `cargo test -p allternit-api --lib gizzi_chat_stream::` — 4 pass
- `cargo test -p allternit-api --lib v1_routes::` — 15 pass

## CI on merge SHA `74bac27a9`

Green: Gizzi Code Quality, Desktop CI, Secrets scan, Typography Validation, **Deploy allternit-api to Contabo**.

Red, pre-existing on other main SHAs (not introduced by this merge):

- Deploy Desktop Cloud VPS — `Unable to resolve action dtolnay/rust-action, repository not found` (same failure on #512, #518, #521, #525)
- Deploy AI + Platform to Cloudflare Pages — `FabricTransportView.tsx` `continuation_api_url` type error on later main SHAs (#526–#528); no Pages run recorded for `74bac27a9` itself

## Live Kimi re-proof (2026-09-14 14:22–14:39)

Stack: `allternit-api` debug from this worktree on `:18013`, gizzi from this worktree on `:4097` (Desktop gizzi on `:4096` left alone). Model `kimi-cli/kimi-k3`, `permissionMode=default` then `plan`.

`kimi -p pong` succeeded (quota window was open). Gizzi spawned a `kimi-code` ACP child.

Observed:

- Session create minted `intent.accepted` + `cowork.session` job (DAG session path works)
- Turn 1 SSE: `message_start` + keepalives only for 900s curl timeout; **no** `tool_permission`, **no** `content_block_delta`, **no** finish
- `/tmp/cowork-proof.txt` missing; `cowork_approvals` empty; no tool jobs
- Turn 2 started while the turn-1 ACP process was still alive; also `message_start` only

The ACP subprocess never published tool/permission/finish events within the timeout. The idle-complete API path was not exercised because gizzi never went idle.

## Honest deferrals

- Live default-mode approval modal + DAG tool-job round-trip is **not proven**
- Live plan-mode denial is **not proven**
- Desktop DMG rebuild not run (gizzi+api are bundled; next desktop build picks this up)
- Pages / Desktop Cloud VPS workflow failures are pre-existing and were not fixed here
