# Steering checkpoint — P3 telemetry governance (2026-09-04, session gizzi-p3-telemetry-20260904)

## Goal
Telemetry/observability governance for cmd/gizzi-code: payload audit, kill switch + consent (env + settings flag + first-run notice), disable dead upstream Datadog sink, docs/telemetry.md. Worktree: `allternit-gizzi-p3-telemetry-20260904`, branch `session/gizzi-p3-telemetry-20260904`. Rebased on main (trivial, no conflicts). No push; commit on branch.

## Just did
- Audit complete: sinks = 1P event logging → api.allternit.com/api/event_logging/batch (Allternit-owned, keep), BigQuery metrics → api.allternit.com/api/gizzi/metrics (keep), GrowthBook remote eval → api.allternit.com (keep), Datadog → http-intake.logs.us5.datadoghq.com with upstream hardcoded client token (DISABLED by default in both copies), customer OTLP (opt-in env only), RuntimeTelemetry (fork-local, log file only). Legacy src/services/analytics is inert pub/sub.
- New: src/shared/utils/telemetryRedact.ts (path/email/URL/JWT/token redaction + sink choke-point sanitizer), src/shared/utils/telemetrySettings.ts (telemetry.json persistent flag + notice marker), GIZZI_TELEMETRY=off in privacyLevel.ts (canonical kill switch, checked pre-sink), settings flag wired into isTelemetryDisabled() and RuntimeTelemetry telemetryDisabled().
- First-run one-line notice in src/cli/main.ts (interactive + enabled + not shown); `gizzi config telemetry on|off|status` subcommand.
- Redacted error-string call sites (oauth client, auth keychain); BashTool command_type now basename only.
- docs/telemetry.md + README link; test/telemetry-governance.test.ts (18 tests, all pass); appended to test/smoke.txt.

## Next
- Run full typecheck + ci-smoke-test.sh; fix any fallout; commit `feat(gizzi-code): telemetry governance — kill switch, redaction, dead-sink removal, docs`.

## Open questions
- Retention period for api.allternit.com event store is TBD — docs/telemetry.md marks it TBD per brief; owner to fill in.
- GrowthBook fetch still sends email/org UUIDs to api.allternit.com when telemetry is on (functional feature flags) — documented; strip-email-when-disabled deferred (would change targeting).

---

# Steering checkpoint — P3 @ts-nocheck ratchet (2026-09-04, session gizzi-p3-tsnocheck-20260904)

## Goal
Three production-readiness hardening slices in cmd/gizzi-code, on branch `session/gizzi-p3-webauth-20260904` (rebased onto main @ fb1b64f84). No push, no merge. (1) `gizzi web` auth parity with `gizzi serve`: alt_ gateway token acceptance, shared exposure guard, WS upgrade auth. (2) CORS drift: no `Access-Control-Allow-Origin: *` by default; `GIZZI_DEV_CORS` gated dev mode with startup warning; loopback-first bind defaults. (3) Empty-catch audit across src/ — handle/comment/debug-log each.

## Just did
- RESOLVED the execa blocker: root cause was `src/shared/utils/auth.ts` doing `import execa from 'execa'` (default import). Root `node_modules/execa` symlinks execa@8.0.1 (ESM, no default export), so any test importing src/runtime/session failed at link time on a fresh pnpm install. Fixed to `import { execa } from 'execa'`. (The stale main checkout only "passed" because of its older install layout.)
- Merged test/server/cors-dev-flag.test.ts into test/server/clerk-auth-middleware.test.ts: bun test runs all files in ONE process with a shared module registry, so per-file frozen env vars (GIZZI_REQUIRE_CLERK_AUTH vs GIZZI_DEV_CORS) leaked across files. Single file now covers all 17 tests; removed the cors-dev-flag line from test/smoke.txt (was added by this session, never committed).
- Converted `Flag.GIZZI_DEV_CORS` to a dynamic getter (Object.defineProperty pattern, same as GIZZI_CONFIG_DIR/GIZZI_CLIENT in flag.ts) so tests can toggle it per-test; server.ts origin() + listen() warning read it live.
- `serverAuthConfigured()` in src/cli/server-exposure.ts now reads process.env live instead of frozen Flag consts (guard runs at command startup, after flag init; tests toggle env mid-process). Dropped the now-unused Flag import.
- Deleted temp build entry cmd/gizzi-code/zz-entry.ts. New test file: 17 pass / 0 fail.
- Full-suite (1173 tests) first rerun exposed cross-file env leakage again: bun test shares one process, and an earlier test file froze the flag module before this file's env vars applied. Fixed by making the auth decision points read env LIVE: `ClerkAuth.required()`, the basic-auth password/username read in clerk-auth.ts middleware, and `serverAuthConfigured()` in server-exposure.ts (dropped unused Flag import there). `Flag.GIZZI_DEV_CORS` converted to a dynamic getter (same Object.defineProperty pattern as GIZZI_CONFIG_DIR/GIZZI_CLIENT). Also fixed the type side: `src/types/missing-modules.d.ts` ambient `declare module 'execa'` shim lacked a named `execa` export and typed args as `string[]`; added `export function execa(file, args?: any, options?: any)` (the real execa@8 has a named export; the default import was the runtime bug). Removed now-dead `loopback`/`exposed` locals in serve.ts.
- typecheck: PASS (exit 0). Standalone new-test run: 17 pass / 0 fail.

## Next
- DONE: full ci-smoke-test.sh PASS (949 pass / 0 fail / 1173 tests / 91 files), typecheck exit 0.
- Committed on branch session/gizzi-p3-webauth-20260904 as 59f770458 (43 files, +606/-97). No push, no merge.
- Remaining for the orchestrator: merge/push decision, then worktree cleanup + agent-ledger attestation per repo AGENTS.md.

## Open questions
- Ratchet job currently planned as continue-on-error: true per task brief ("goes hard after count reaches a target") — target TBD by owner.

---

# Steering checkpoint — P1/P2 backlog execution CLOSEOUT (2026-09-04, session p1followup)

## Goal
Execute the full P1/P2 list from reports/2026-09-03-production-readiness-gap-analysis.md. DONE — all six tracks merged to main as c9e6ddcb2.

## Just did (final)
- Track 6 (desktop/gizzi) reviewed, verified (desktop tsc 0/0, vitest 101/101, gizzi tsc 7 pre-existing-only), committed acc913bdb.
- Merged main into session branch (5d2be5ac1): resolved 9 conflicts from the parallel cloud-api track — kept md5-fallback token lookup + main's alt_ keys; both dev-token overrides kept, both now hard-refused in production; sqlx::migrate! is the single migration path (db::migrations unwired, documented); kept main's ci-smoke test gate.
- Verified merged tree: cargo check clean, cloud-api 188 pass (+1 known docker-env fail), wizard 53/53, gizzi smoke 1156/0 fail.
- Merged to main c9e6ddcb2, pushed. Ledger summary: agent-ledger/summaries/2026-09-04-0826-p1followup-kimi-code-p1p2-backlog-execution.md.
- Incident: concurrent session ran `git reset` in the main checkout mid-merge (~08:09) — recovered by merging in the session worktree instead. Do not run conflicted merges in the shared checkout while other sessions are active.

## Next
- Worktree + branch cleanup (this session is finished).
- OWNER: TS_AUTHKEY gh secret (CI deploy), secrets rotation (reports/2026-09-04-secrets-rotation-hygiene-handoff.md), Apple signing cert, launch-scope decision, session/routing dedupe when it lands.

## Open questions
- None from this session.
