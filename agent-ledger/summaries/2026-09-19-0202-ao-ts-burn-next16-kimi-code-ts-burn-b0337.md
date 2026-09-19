# ts burn-down b0337 (ao/ts-burn-next16, 2026-09-19)

## What was done

Burned 18 `@ts-nocheck` files (7,064 LOC per live-tree regen delta; the original
b0337 listing said 7,064 at generation), 0 escalations, no allowlist entries,
queue guard identity exact.

## Coordination (this burn's defining feature)

- Assigned the fourth non-DONE batch per the playbook, but sibling
  `ao/ts-burn-next15` had taken **b0336** concurrently (merged, PR #669) —
  switched to **b0337** (the next unclaimed batch) instead of landing a
  duplicate burn. Already-stripped b0336 headers in the worktree were reverted
  (`git checkout --`) before re-targeting.
- Mid-flight, the codemod queue regen (ao/artifact-codemod-pilot6, PR #668)
  **retired the b0337 id** and remixed its 18 files into b0365 (7), b0367 (4),
  b0368 (7). Retired-id absorption per the b0301 precedent: seeded from the
  regenerated main queue, de-listed the 18 files from those three batches,
  re-added a b0337 DONE record (18 burned files, 7,064 LOC).
- A second mid-flight merge (ao/ts-burn-tail1, b0101, PR #671) landed between
  the queue edit and push; resolved by rebasing onto fresh origin/main
  (602ad9c7d) and re-seeding/re-deriving queue stats from the live tree.

## Burn shape

- 11 header-only 0-error burns. TS2322 probe: headers restored byte-exact from
  origin/main → whole-project tsc reported **0 probe errors, zero TS2322** →
  re-stripped byte-exact.
- 7 type-only fixes across 10 initial errors, converged in 1 iteration:
  - `session-info.tsx` / `statusModel.ts`: `AppState` has no `messages` field
    (upstream drift shared with status.tsx/dash.ts/live.ts/usage.ts; the
    runtime value is always `undefined`) — cast + `?? []` preserved, same idiom
    as the next15 sibling's dash/live/usage fixes.
  - `terminalSetup.tsx`: `("external" as string) === 'ant'` deliberate DCE
    comparison preserved; stray 2nd `theme` arg to `chalk.dim` dropped
    (typo-class — chalk ignored extra args at runtime; also cleared a
    pre-existing `no-constant-condition` eslint error).
  - `sedValidation.ts`: explicit `success === false` discriminant check
    (package tsconfig is `strict:false` — negated discriminated-union
    narrowing does not apply).
  - `loadPluginHooks.ts`: `HookEvent` derived as `(typeof HOOK_EVENTS)[number]`
    (the upstream type export does not exist in this tree); lodash memoize
    `.cache` accessed via a local `{ cache?: { clear?: () => void } }` shape
    (`utils/betasCache.ts` precedent).
  - `firstPartyEventLoggingExporter.ts` runtime + ink-app twins:
    `core_metadata as unknown as EventMetadata | undefined`; runtime twin's
    string-signature logger pinned as `logError(String(new Error(message)))`
    to preserve the exact previous template-coercion output.

## Queue state (post-merge main)

stats re-derived from the live tree via `build-queue.mjs` harvest:
totalNocheck 1112→1094, totalQueueFiles 818→800, totalQueueLoc
322477→315413, zeroImporter →198 (live-derived; tail1's b0101 removal changed
the intra-queue graph), batchCount 102→103, `totalAccounted` untouched
(1460; identity exact 800+660), quarantined untouched (20), b0101/tail1 record
untouched, b0365/b0367/b0368 file lists de-listed.

## Verification evidence

- `pnpm run typecheck`: 0 errors (post-rebase run on 602ad9c7d base)
- `bash script/ci-smoke-test.sh`: SMOKE PASS — 1374 tests, 0 fail, burn-down
  guard 5/5 (first pre-queue-amend run failed the guard as expected)
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed
- eslint on the 7 fixed files: 19 problems at origin/main baseline → 11 after
  (−8, zero new)
- pnpm-lock / `src/types/*.d.ts` / forbidden paths untouched
- git-discipline: PASS (on main == origin/main 216856152, clean tree)

## Incidents / honest deferrals

- None. One observation for the pipeline: b0336 was double-claimed because a
  sibling took the fourth batch instead of the third; the playbook's ordinal
  rule held only because the collision was caught before push. The
  `getAppState().messages` AppState drift affects status.tsx and
  useSessionMetrics.ts (still nochecked, in other batches) — they will need
  the same cast idiom when burned.

## PR

#672 merged 21685615292bf4f805434e0e51fea16374bc785c (merge commit).
