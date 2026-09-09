# Checkpoint — cu17-creds

## Goal
Credential story v1 for ACI computer-use runs, sole ownership of `cmd/allternit-api`:
1. CRUD API `/api/aci/credentials` (name, type cookie|token|totp_secret|env), values AEAD-encrypted at rest, never in logs/receipts/events.
2. Run binding: ACI run body accepts `credential_names: string[]`; values injected as env/proxy-token material inside sandbox only at provision time (build on `aci_approvals.rs` proxy-token pattern), never into model context.
3. TOTP: `GET /api/aci/credentials/:name/totp` returns fresh RFC 6238 code for totp_secret creds.
4. Tests incl. negative: value never appears in logged/receipted output.
5. Docs: PR body + code doc comments only. Do NOT edit `docs/` files.

VERIFY: `cargo test -p allternit-api` green (baseline 723 pass / 4 pre-existing env fails); `cargo check` clean.

## Just did
- Baseline confirmed: 723 passed / 4 failed (the exact pre-existing env fails: 4 os_control_plane tests needing `allternitos_control_plane`).
- Implemented `cmd/allternit-api/src/aci_credentials.rs` (vault + TOTP + routes + run bindings + scrub), wired into `lib.rs` and `aci_routes.rs` (`credentialNames` run binding, names in action-hash descriptor, `sandbox_env` payload field, frame scrubbing in `buffer_push`). Added `sha1 = "0.10"` direct dep (already in Cargo.lock).
- Fixed one test-design bug: retrying an approved grant with different credential names correctly gets 403 hash-mismatch (grant preserved), not 400.
- Fixed one test-hang bug: on-disk snapshot assertion now snapshots into a temp dir via `snapshot_run_buffer_in` instead of polling the shared run-buffer dir (races with parallel tests mutating `ALLTERNIT_COMPUTER_USE_DIR` caused an unbounded `spawn_blocking` leak that hung the test binary at runtime shutdown).
- `credential_binding` e2e test green; `aci_*` module tests green (38 tests).

## Next
- Committed and pushed; PR open (no merge — orchestrator owns that).
- Final state: 735 passed / 4 failed (pre-existing os_control_plane env fails), cargo check clean.

## Done (verification evidence)
- Baseline (pre-change): 723 passed / 4 failed.
- Final full `cargo test -p allternit-api`: 735 passed / 4 failed — the same 4 pre-existing env fails (`agent_cloud_routes` os_control_plane "did not log its listening port"). 12 new tests all green.
- `cargo check -p allternit-api`: clean (exit 0; 66 pre-existing warnings, none new from this change).

## Incidents / notes
- Test determinism: global `CREDENTIALS` store persists to `~/.allternit/computer-use/credentials/` — HTTP tests now use uuid-suffixed user ids and the e2e deletes before seeding; test artifacts cleaned from the dev machine after runs.
- Docs deliberately NOT edited (owned by another agent); usage docs are in the PR body + module doc comments.

## Next (design settled after exploration)
- New module `cmd/allternit-api/src/aci_credentials.rs`:
  - Store: process-global `Lazy` + JSONL persistence under `<computer_use_dir>/credentials/credentials.jsonl`, keyed by (user_id, name) — mirrors `aci_approvals.rs` pattern.
  - Crypto: reuse `token_crypto` (AES-256-GCM, `enc:v1:`) but STRICT: refuse to store if `!token_crypto::encryption_enabled()` (no `plain:` fallback for credentials). Machine key file 0600 already handled by token_crypto (`connector-encryption.key` under data dir; env `ALLTERNIT_ENCRYPTION_KEY` override).
  - TOTP: RFC 6238 via `hmac` + `sha1` (sha1 0.10.6 already in Cargo.lock; add direct dep), stdlib base32 decode. No new dep family.
  - Routes (mounted in `aci_router()` under /api): POST/GET/PUT/DELETE `/aci/credentials[/:name]`, GET `/aci/credentials/:name/totp`. Responses carry metadata only — value never echoed, never in list/get.
- `aci_routes.rs` run binding: `AciRunBody.credential_names` (camel `credentialNames`); resolve server-side at run start; inject into execute payload under `sandbox_env` (consumed by sandbox/VM provision layer; NEVER into `task`/model context). `totp_secret` creds are NOT injected (seed stays server-side; agents fetch codes via the TOTP endpoint). Names (not values) go into the action-hash descriptor so a grant can't be replayed with a different credential set. Frames pushed to the run-event buffer are scrubbed of bound values; receipts/binding records store names only.
- Tests: HTTP-level CRUD via tower oneshot; TOTP RFC 6238 test vectors (SHA-1); negative tests: value absent from list/get bodies, run buffer snapshots, receipts, ACU payload `task` field; mock ACU via `ALLTERNIT_ACU_URL` env + tiny axum server.
- Baseline first: run `cargo test -p allternit-api` to confirm 723/4.

## Open questions
- None blocking. Note: no literal `proxy_token` symbol exists in-tree; the task's "proxy-token pattern" maps to the existing env-injection-at-provision pattern (`vm_session_routes.rs` extra_env → /etc/environment) and token_crypto's sealed token storage — building on both.
