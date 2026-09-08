# Steering checkpoint — session/cors-3014

Goal: Add the desktop shell dev-server origins (localhost:3014, 127.0.0.1:3014)
to `DEFAULT_ALLOWED_ORIGINS` in `cmd/allternit-api/src/cors.rs` so the Remote
peers / roster fetches from the Electron dev UI (`devUiUrl` = Vite :3014) stop
getting CORS-blocked without needing `ALLTERNIT_CORS_ORIGINS` set.

Just did: worktree `allternit-session-cors3014` on `session/cors-3014` from
origin/main (c9efe60e0); edited cors.rs allowlist + doc comment.

Next: cargo test the cors module, commit, push, PR, merge, ledger attestation,
worktree cleanup.

Open questions: none — 2-origin addition, existing tests are self-referential
(len() vs DEFAULT_ALLOWED_ORIGINS) so they stay green.
