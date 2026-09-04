# Steering checkpoint — P3 @ts-nocheck ratchet (2026-09-04, session gizzi-p3-tsnocheck-20260904)

## Goal
Strip `// @ts-nocheck` from the highest-risk auth/server paths in cmd/gizzi-code where it can be done without ballooning errors, and add a CI ratchet (script/check-ts-nocheck.sh + committed baseline) so the count (starting: 3698 files under src/) can never grow. Worktree: `allternit-gizzi-p3-tsnocheck-20260904`, branch `session/gizzi-p3-tsnocheck-20260904`. No push; commit on branch.

## Just did
- Inventory: 3698 files under cmd/gizzi-code/src contain @ts-nocheck.
- Verified already-clean: src/runtime/server/routes/web-proxy.ts, src/runtime/services/api/allternitApi.ts, src/shared/utils/allternitToken.ts. No src/runtime/server/auth*.ts exists; closest matches routes/auth.ts (62 lines) and routes/terminal-clerk-auth.ts (495 lines).
- pnpm install --frozen-lockfile done; packages/sdk dist built via node scripts/build.mjs (pre-existing need).
- Baseline typecheck: tsc --noEmit exit 0, 0 errors (after sdk dist build).
- Ratchet script written: cmd/gizzi-code/script/check-ts-nocheck.sh (count vs script/ts-nocheck-baseline.txt, --update flag, auto-init missing baseline, exits 1 only on increase).
- Stripped @ts-nocheck from src/runtime/server/middleware/clerk-auth.ts; typecheck running.

## Next
- Fix any clerk-auth.ts type errors properly; then try routes/auth.ts, then terminal-clerk-auth.ts if error count stays manageable. >25 errors or architectural → put directive back as `// @ts-nocheck TODO(<reason>)`.
- Wire ratchet into .github/workflows/gizzi-code-quality.yml as continue-on-error: true job with comment about going hard at target count.
- Generate baseline with final count; verify: typecheck exit 0, ci-smoke-test 0 fail, ratchet exits 0 twice, nonzero on added directive (test+revert).
- Commit: `chore(gizzi-code): strip @ts-nocheck from auth/server paths + CI ratchet`.

## Open questions
- Ratchet job currently planned as continue-on-error: true per task brief ("goes hard after count reaches a target") — target TBD by owner.
