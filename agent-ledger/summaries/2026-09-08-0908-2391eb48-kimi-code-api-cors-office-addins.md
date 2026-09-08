# Attestation — api.allternit.com CORS allowlist += hosted Office add-in origins

- **Session:** office-addin-cors (attested by 2391eb48, kimi-code)
- **Date:** 2026-09-08
- **Branch:** `session/office-addin-cors`, merged to main via **PR #133** → 2cef523ae
- **Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Acceptance testing of the hosted Microsoft Office add-in (Word/Excel/PowerPoint task panes at `https://allternit-office-addins.pages.dev/office-addins/`) found chat CORS-blocked: `api.allternit.com` only sent `Access-Control-Allow-Origin` for `https://ai.allternit.com`. Probe evidence (pre-change): `curl -H 'Origin: https://ai.allternit.com' https://api.allternit.com/api/v1/workspaces` → 401 with ACAO; same request with `Origin: https://allternit-office-addins.pages.dev` → 401 with **no** ACAO. The `vary: origin, access-control-request-method, access-control-request-headers` fingerprint confirmed the tower-http CorsLayer + `origin_gate` in the Rust API serves api.allternit.com.

Change:

- `cmd/allternit-api/src/cors.rs` — added `https://allternit-office-addins.pages.dev` and `https://office-addins.allternit.com` (future custom domain) to `DEFAULT_ALLOWED_ORIGINS` with a doc comment (cors.rs:43–49), plus a regression test asserting both origins are in the default list (cors.rs:214–215).
- `infrastructure/vps-desktop-cloud/api.env.template:24` — mirrored the origins into `ALLTERNIT_CORS_ORIGINS`, documenting that `deploy.sh` preserves an existing `/etc/allternit-api/api.env` so a live host needs an in-place edit + `systemctl restart allternit-api`.

Note: `AllowOrigin::list` is exact-match; no `localhost:*` wildcard exists in the pattern — enumerated localhost origins unchanged.

## How it works

The Rust API's CORS layer uses `DEFAULT_ALLOWED_ORIGINS` unless the `ALLTERNIT_CORS_ORIGINS` env var overrides it. Adding the office-addin origins to the compile-time default means fresh builds accept the hosted pane out of the box; the env-template change keeps VPS deployments documented.

## Verification evidence (from PR #133 body)

- `cargo test -p allternit-api cors` → **10/10 pass** (9 existing + 1 new `default_allowlist_includes_office_addin_origins`).
- Live smoke: API run from the branch on :18013 with default env (no `ALLTERNIT_CORS_ORIGINS`):
  - `OPTIONS /api/v1/workspaces`, `Origin: https://allternit-office-addins.pages.dev` → 200 + matching ACAO
  - same for `https://office-addins.allternit.com` → 200 + matching ACAO
  - GET with office-addins origin → 401 (auth required, expected) with ACAO present
  - GET with `Origin: https://evil.example.com` → 403, no ACAO (gate still tight)

## Incidents

- None in the change itself.

## Honest deferrals

- **VPS env override still pending**: if the VPS already has `/etc/allternit-api/api.env` with an explicit `ALLTERNIT_CORS_ORIGINS`, it overrides the new default until edited. Required human action on the VPS: add the two origins to `ALLTERNIT_CORS_ORIGINS` in `/etc/allternit-api/api.env` (or delete the key to fall back to the rebuilt default), redeploy/rebuild the binary, and `systemctl restart allternit-api`. The pane fetch keeps failing CORS until then — the code change alone does not reach the live deployment.
- Ref: hosted add-in issue 1 of 2; chat routing is the separate task (see PR #134 attestation).
