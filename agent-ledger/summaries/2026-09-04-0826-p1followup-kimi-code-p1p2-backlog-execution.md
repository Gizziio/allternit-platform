# Session attestation — P1/P2 production-readiness backlog execution (kimi-code)

- **Date:** 2026-09-03 → 2026-09-04
- **Agent family:** kimi-code (parent orchestrator + delegated coder subagent for track 6)
- **Worktree:** `allternit-session-p1followup` (deleted after merge, per AGENTS.md)
- **Branch:** `session/p1followup` → merged to `main` as **c9e6ddcb2** (merge of merge `5d2be5ac1`)
- **Source of work:** `reports/2026-09-03-production-readiness-gap-analysis.md` — user instruction: "do all the issues you listed"

## What was done (six tracks, all committed and pushed)

| Track | Commit | Contents |
|-------|--------|----------|
| Web P1 | `25ba93e9f` | ai.allternit.com launch-day hardening: wrangler.toml, dev-gated debug routes, ErrorBoundary + client-error POST, verify-ai CI gate (typecheck+vitest, 1160 tests), Clerk env dedupe, cowork-runs via cloud API, CSP/HSTS `_headers` + boot.js; 3 stale test fixes |
| Docs | `4acd3403b` | Correction pass across 10 docs files (Vite/Pages/Contabo reality) |
| Ops/infra | `89c00b1c4` | Live nginx interim proxy on mail (5 location blocks → 127.0.0.1:8013), CORS allowlist map (ai/platform only, `proxy_hide_header` strips 8013's mirror-origin ACAO — evil-origin leak found + fixed), limit_req zones (jobs 30r/m, beta 60r/m), off-host backups: `/usr/local/bin/allternit-offhost-backup.sh` + systemd timer (nightly 03:31 UTC, write-tested to standby), runbook `docs/Operations/OFFHOST_BACKUPS.md`, Headscale Fly volume auto-snapshot verified, `ALLTERNIT_LOCAL_DEV_BYPASS=false` confirmed in live env, backdoor dead (401 verified) |
| Desktop CI/release | `b8d19b98a` | Single-publish release flow, Linux build job, loud notarization, version 1.1.0 + CHANGELOG.md |
| Rust/cloud-api | `10c1c9091` | sqlx::migrate! runner in init_db (idempotent migrations_pg 001–010 rewritten + `ALLTERNIT_SKIP_MIGRATIONS=1` escape), sha256 token hashing with legacy-md5 fallback + transparent upgrade, Clerk JWT on `/ws/runs/:id`, email-verification gate (user_trust, `ALLTERNIT_SKIP_EMAIL_VERIFICATION` bypass), wizard checkpoint_store `$n` bind fix |
| Desktop/gizzi | `acc913bdb` | Electron hardening: crash handlers, startup-window contextIsolation+sandbox+preload bridge, openExternal scheme allowlist, origin-scoped CSP + default-deny permissions, will-navigate/window-open guards, 59 sensitive IPC channels sender-validated (handleGuarded), backend respawn backoff w/ jitter. gizzi-code: chalk phantom-dep shim (103 files), `bin/gizzi.js` launcher + check-publish gate, `ALLTERNIT_API_URL` required in prod, `MACRO.PACKAGE_URL`, remote_control.ts circular-import fix (unblocked 43 test files), `GIZZI_TEST_HOME` lazy fix, blocking test gates in release/publish workflows |

**Merge resolutions of note** (main had a parallel cloud-api hardening track from another session — `bc12ac55b`/`9874c2a24`):

- Token validation merged to: sha256 lookup **with** legacy-md5 fallback + transparent upgrade (prod DB has md5 rows; main's sha256-only would have broken existing tokens) **plus** main's `alt_…` scoped-key path.
- Both dev-token overrides kept, both default-off and now both hard-refused when `RUST_ENV`/`ENVIRONMENT=production`: the deployed `ALLTERNIT_ALLOW_DEV_API_TOKEN`+literal gate (renamed `is_legacy_dev_api_token`) and main's `ALLTERNIT_DEV_MODE`+`ALLTERNIT_DEV_BEARER` env-bearer.
- Migration runner: kept `sqlx::migrate!` (always-on, idempotent files — the merged migrations_pg state was rewritten for it). Main's opt-in `db::migrations` runner remains in-tree but unwired (documented in lib.rs); the two must not be enabled simultaneously.
- gizzi `test` script: kept main's `ci-smoke-test.sh` smoke gate + `test:full`; workflows run the smoke suite as a blocking gate.
- nginx interim-proxy.conf: took the DEPLOYED version (with the 2026-09-03 deployment record).

**Post-merge verification (merged tree):** cargo check clean; cloud-api lib **188 pass** + 1 known docker-not-available env failure; wizard **53/53**; gizzi smoke **90 files / 1156 tests / 0 fail**; desktop tsc 0 errors + vitest 101/101 (from track-6 verification, main never touched desktop).

## Incidents worth recording

- 2026-09-03 23:19–23:48: a rebase of `session/p1followup` (by the track-committing process) wiped track-6 subagent's uncommitted edits; the subagent detected and re-applied everything against the new HEAD. Untracked new files survived.
- 2026-09-04 ~08:09: while resolving the main-merge conflicts in the shared checkout, a **concurrent session ran `git reset` in the main checkout**, aborting the in-flight merge and discarding staged resolutions. Recovered by moving the merge into the session worktree (merge `main` into the session branch, resolve, verify, then merge back — which applied cleanly). Lesson: never run a conflicted merge in the shared main checkout while other sessions are active; the index is a shared resource.

## Deferred / not done

- **@ts-nocheck stripping** (305 files under `src/runtime/`): deliberately deferred by track 6; subsequently picked up by a parallel session (commits `95de39eb0`/`fb1b64f84` on this branch + CI ratchet) — now partially done via auth/server paths.
- **Phantom deps** in gizzi-code (execa, ws, semver, …) need pnpm-lock.yaml edits — left for a session that may install.
- **Desktop changes not runtime-verified** (no Electron launch in this environment) — logic/types/tests only.
- **Deploy risk flag** (from `10c1c9091`, still true): first prod cloud-api deploy off merged main applies all 11 migrations_pg via sqlx::migrate! against the already-migrated prod DB (convergent by design; `ALLTERNIT_SKIP_MIGRATIONS=1` is the escape hatch). Migrations 002–010 from main's side are also now idempotent rewrites — prod converge was the design intent, but watch the first deploy log.

## User-gated leftovers (restated for the owner)

1. **CI deploys fail at "Join Tailscale"** until a tag:ci auth key is created and set: `gh secret set TS_AUTHKEY`.
2. **Secrets rotation** per `reports/2026-09-04-secrets-rotation-hygiene-handoff.md` (user chose to do the rotation itself later).
3. **Apple signing certificate** + `allternit/desktop` repo for desktop releases.
4. **Launch-scope decision** (what ships on day one).
5. **Dedupe with `session/routing`** when it lands: parallel dev-token gate (`ALLTERNIT_ALLOW_DEV_TOKEN` vs deployed `ALLTERNIT_ALLOW_DEV_API_TOKEN`), contracts vendored at both `platform/contracts/` and `platform/protocols/`.
