# Session attestation: cors-3014 (kimi) — 2026-09-07 22:59

## What was done

Added the desktop shell dev-server origins — `http://localhost:3014` and
`http://127.0.0.1:3014` — to `DEFAULT_ALLOWED_ORIGINS` in
`cmd/allternit-api/src/cors.rs`, with the doc comment updated to say :3014 is
the Electron `devUiUrl` Vite port.

## Why

In `ALLTERNIT_FORCE_DEV_MODE=1` the desktop Electron loads its renderer from
Vite on :3014. The Remote peers / roster rail fetches
(`/api/peers/remote`, `/api/peers/roster` on :8013) were CORS preflight-blocked
(403, no `Access-Control-Allow-Origin`) because the default allowlist covered
Vite :5173 and Next :3000 but not the desktop dev port. The only workaround was
starting the API with a hand-built `ALLTERNIT_CORS_ORIGINS` value that has to
carry the entire default list plus :3014 — easy to get wrong (a bare `:3014`
list silently drops the public-surface origins).

## How it works

Pure allowlist addition; `parse_allowed_origins` falls back to
`DEFAULT_ALLOWED_ORIGINS` when the env var is unset, so dev-mode desktop shells
now pass CORS out of the box. Existing tests are self-referential
(`origins.len() == DEFAULT_ALLOWED_ORIGINS.len()`), so no test churn.

## Verification evidence

- `cargo test -p allternit-api cors`: 9/9 pass (defaults-when-unset,
  allowed/disallowed preflight + simple requests, dev-bypass mirror).
- Live: with the env override on a local daemon, `OPTIONS /api/peers/remote`
  with `Origin: http://localhost:3014` returned 200 — this PR makes that the
  no-env default. Daemon rebuild/restart is an ops step, not part of this PR.

## Honest deferrals

- The running preview daemon on :8013 still uses the env override; rebuild from
  main and restart to drop the env dependency.
- :3014 is plain-HTTP localhost; no security surface beyond local dev.

## Commits

- `a180db292` fix(api): allow desktop shell dev-server origin (localhost:3014) in default CORS list
- Merged via PR #131 → b493cbeee (merge commit).
