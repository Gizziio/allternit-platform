# ao/ts-burn-b0006 — TS @ts-nocheck burn-down batch b0006

- Date: 2026-09-18 13:03
- Agent: kimi-code (subagent, session f729bf97)
- Branch: `ao/ts-burn-b0006` → PR #606, merged as **18c761597** (merge commit)

## What was done

Burned the single file of burn-down batch **b0006** from the `// @ts-nocheck`
population (`cmd/gizzi-code/script/typecheck-burndown/queue.json`):

- `src/cli/ui/ink-app/entrypoints/sdk/coreSchemas.ts` (1,890 LOC) — SDK zod
  core schemas ("single source of truth for SDK data types"). Header stripped;
  the file was already fully typed under the fixed `src/types` shadows
  (#599/#600) and produced **zero** tsc errors on the first iteration — a pure
  header removal, no type-only code edits needed.

## How it works

Process per the burn-down playbook: worktree `allternit-ao-tsburn-b0006` off
fresh `origin/main` (b3fdfbbd1), `pnpm install`,
`bash script/ensure-sdk-dist.sh` (self-healed the os-contracts dist), baseline
tsc exit 0, header strip, iterate, gates, queue.json update, commit/push, PR,
merge, shared-checkout sync, discipline check.

## Verification evidence

- `npx tsc --noEmit -p tsconfig.typecheck.json` — exit 0, **1 iteration / 0
  errors** (cold 14.3s, warm 6.4s)
- `bun run test` smoke — **1311 pass / 0 fail** across 107 files; the
  ts-nocheck guard's 5 invariants all green (count shrank 1839→1838, identity
  live+burns == totalAccounted 1475, quarantine disjoint and headers intact).
  (A first test run raced the mid-strip state and failed the 3 expected guard
  checks; re-run after the queue.json write was fully green.)
- `npx eslint src/cli/ui/ink-app/entrypoints/sdk/coreSchemas.ts` — 0 problems
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed
- `scripts/git-discipline-check.sh` — PASS (on main == origin/main 18c761597,
  tree clean, 4 unmerged branches all live-worktree/allowlisted)

## queue.json handling

- b0006 → `state: DONE`, `files: []`, `burnedFiles: 1`, `burnedLoc: 1890`,
  `escalated: []` (b0005 DONE-entry shape).
- stats: `totalNocheck` 1839→1838, `totalQueueFiles` 1364→1363,
  `totalQueueLoc` 470113→468223. `totalAccounted` untouched (1475).
- Quarantined list (21 files) untouched; no other batch entries touched.

## Incidents / escalations

None. No latent-runtime-bug findings, no byte-semantics flags, no landmine
files in this batch (no `reduceAnsiCodes` 2-arg call, no
TestingPermissionTool touch, no pnpm-lock churn).

## Honest deferrals

None. Desktop rebuild N/A — nothing the desktop bundles changed.
