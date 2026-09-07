# Session Attestation — session/bots-p03 (kimi) — Bot Teammates Phase 3

- **Date:** 2026-09-07
- **Branch:** `session/bots-p03` @ 603b1c4bc (fast-forwarded to `main`).
- **Spec:** `docs/BOT_TEAMMATES_SPEC.md` — Phase 3 (Cross-machine fabric, AD-1 direct-peer model).

## What was done

- **`cmd/allternit-api/src/remote_peers.rs`** (new, ~2400 lines incl. tests): remote peer registry (`remote-peers.json` holds `{name,url,keyRef}` only; keys in env / `.allternit/peers.env` chmod 600, never echoed, constant-time compare, redaction scrubbing); `dm` (held-connection synchronous, receiver holds until local turn completes) / `run` (202 + reply_url callback, `ALLTERNIT_PEER_URL`) / `status` / `stop`; idempotency-key replay at both edges, 900s TTL, fail-fast `runtime_offline` (3s connect timeout); runs map lightly persisted (`peer-runs.json`, restart orphans → `runtime_offline`); union roster with 5-min poll, ghost rows `sourceReachable:false`, reconcile on reconnect. Mounted on the PUBLIC router (peer keys, not Clerk JWTs — documented at mount site). Existing-file edits: 2 one-line wirings (lib.rs, main.rs).
- **Surface**: `src/lib/peers/remote-peers-api.ts`, `use-remote-peers.ts` (incl. `unreachableSources`/`reachabilityByPeer` for ghost rows), `RemotePeersPanel.tsx` rail section (reachability dot, muted unreachable rows, add/remove), one marked block in ShellRail after TeammatesRailSection. 13 vitest tests.

## Verification

- `cargo check -p allternit-api` clean (zero warnings in module); `cargo test -p allternit-api --lib remote_peers` **9/9** incl. full two-node dm round trip over real axum servers.
- tsc clean on touched files; vitest 1392 passed; sole failure = known pre-existing `fabric-session-kind.test.ts`.
- Integration merge with Phases 4+5 on main: lib.rs `pub mod` union resolved; both route nests coexist; both Rust suites re-run green post-merge.

## Follow-ups (deliberately out of scope)

- Agent-side auto-reply for fabric dms (gizzi-code `@run <id> <reply>` to `fabric-replies` — protocol contract documented in envelope footer).
- Ghost-row rendering of remote bots in TEAMMATES (hook capability exists; remote bots don't render there yet).
- "Create bot on remote connection" picker (needs Bot Hub UI, now available post-Phase 5).
