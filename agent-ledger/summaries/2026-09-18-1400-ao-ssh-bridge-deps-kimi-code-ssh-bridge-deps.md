# Session: ao/ssh-bridge-deps — declare ssh-bridge runtime deps

**Date:** 2026-09-18 (afternoon)
**Agent:** kimi-code (subagent of AO)
**Branch:** `ao/ssh-bridge-deps` → PR #614, merge SHA `4a5d39fd0`, commit `610bc0f0e`

## What was done

`services/ssh-bridge/package.json` declared **no dependencies** while its source imports `pg`, `node-ssh`, and `ws`. It typechecked only because `.npmrc` sets `shamefully-hoist=true` repo-wide. Pre-existing on main at the old `api/services/ssh-bridge` path; flagged by the S2 agent during the PR #595 api/→services/ move.

Fixed by declaring exactly what the source imports:

- **dependencies**: `node-ssh ^13.2.1`, `pg ^8.20.0`, `ws ^8.20.0` — versions match pnpm-lock resolutions (`node-ssh@13.2.1` already resolved for `infrastructure/vps-node/allternit-infrastructure`; `pg@8.20.0` / `ws@8.20.0` already resolved repo-wide). It is `node-ssh`, not `ssh2` — `SSHService.ts:8` imports `{ NodeSSH }` from `node-ssh`. (`ssh2` appears only as a transitive type dep of node-ssh.)
- **devDependencies**: `@types/pg ^8.18.0`, `@types/ws ^8.18.1` (neither pg nor ws ships types), `@types/node ^20.19.30` (source uses `NodeJS.Timeout`, `Buffer`). Per-package devDeps convention per `services/replies-runtime`; infrastructure uses the same pattern.

## How it was verified

- `pnpm install --lockfile-only` (naive) produced the same unrelated `@babel/core` 7↔8 peer-variant churn the S2 agent hit in PR #595 (160 ins / 50 del) → reverted, **hand-edited the `services/ssh-bridge` importer block** instead (same technique as S2/S3).
- `pnpm install --frozen-lockfile` exit 0. Lockfile diff: 21 insertions / 1 deletion — the single importer block only.
- `npx tsc --noEmit` in `services/ssh-bridge`: exit 0 with deps now declared.
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed.
- Grep for consumers (`@allternit/ssh-bridge`, `sshService`, `terminalWebSocket`, `SSHConnectionRepository`): **no code consumers** — only docs/ledger references — so no other package needed the same treatment.

## Incidents / honest deferrals

- None blocking. Deferred (noted, not fixed): with `shamefully-hoist=true` repo-wide, other packages may have similar undeclared-dep hygiene issues; only the flagged package was fixed.
- Desktop rebuild (AGENTS.md step 8) not applicable — nothing the desktop bundles was touched.

## Files touched

- `services/ssh-bridge/package.json`
- `pnpm-lock.yaml` (importer block only)
