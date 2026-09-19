# ao/ts-burn-tail5 — ts burn-down b0421 (close-out of a timed-out batch)

- **Date:** 2026-09-19 05:56 CDT
- **Branch:** `ao/ts-burn-tail5` → PR #680, merge commit `16c852207` (parents `aab37f1c1` + `7f3d4dcf1`)
- **Burn commit:** `7f3d4dcf1` `feat(gizzi-code): ts burn-down b0421`
- **Agent:** kimi-code (close-out/takeover session — see Incidents)

## What this batch was

Tail-batch selection (LAST non-DONE at queue state after PR #679 / tail4). b0421 was
created mid-flight by the pilot7 queue regen, which retired the b0394 id and remixed
its 10 files into b0421 (17 files). Sibling `ao/ts-burn-tail4` (PR #679) burned 10 of
the 17 and recorded the absorption; **this batch accounts the remaining 7**
(2,594 queue LOC with-header):

- `src/cli/ui/ink-app/thread.ts` — type-only: local `EventSource` contract (old
  `context/sdk` module no longer exists; `tui()` takes options as any);
  `RpcClient = ReturnType<typeof Rpc.client<rpc>>` (worker.ts exports `rpc` as a
  type alias, so `typeof rpc` was wrong), 2 call sites.
- `src/shared/utils/messageQueueManager.ts` — removed unused `Permutations` import
  (type no longer exists anywhere); `@/types/messageQueueTypes.js` resolves to the
  ink-app default-only stub, switched to the real module relatively
  (`../../types/messageQueueTypes.js`).
- `src/runtime/gizzi-core/services/railsPeer.ts` — `QueuedCommand` import
  `src/shared/types/textInputTypes.js` does not resolve; `@/types/textInputTypes.js`
  maps to the real ink-app type module. `uuid` pinned as `QueuedCommand['uuid']`
  (`generateRequestId` returns a non-UUID-shaped opaque id); `origin` pinned as
  `QueuedCommand['origin']` (`MessageOrigin` has no `peerName`).
- `src/cli/ui/ink-app/components/RailsInboxBridge.tsx` — sibling tail4 had already
  stripped this file's header (header-only burn, 0 errors at that queue state); this
  batch's railsPeer typing surfaced `cmd.origin?.peerName` as an error, pinned with
  the structural cast `{ peerName?: string } | undefined` (the value is stamped
  structurally at runtime by railsPeer).
- 4 header-only 0-error burns: `releaseNotes.ts`, `localInstaller.ts`,
  `allternitInChrome/setup.ts`, `autoUpdater.ts` (TS2322 probe: exactly one probe
  error per file, zero others, all 4 confirmed in compilation).

Queue bookkeeping: b0421 → DONE (burnedFiles 7, burnedLoc 2594, note recorded);
stats re-derived from the live tree: totalNocheck 988→981, totalQueueFiles 727→720,
totalQueueLoc 316748→314154; **totalAccounted untouched (1460)** — identity exact
741 live + 719 recorded = 1460. Quarantined untouched. No escalations, no allowlist
entries, pnpm-lock/src-types untouched.

## Verification evidence (run by the close-out session on commit 7f3d4dcf1)

- tsc 0: `ensure-sdk-dist.sh` (SDK-EXIT=0) + `tsc --noEmit` → TSC-EXIT=0, no errors.
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed** (run-only, script untouched).
- eslint (changed files, flat config): branch 9 problems (6 errors + 3 warnings) vs
  origin/main baseline on the same files 17 problems (13 errors + 4 warnings) — net −8;
  every residual finding is pre-existing code verbatim on main (autoUpdater
  `prefixResult`/`@ts-ignore` at identical lines; `catch (e)`/`seenMessageIds`/
  `QueueOperation` warnings predate the burn). **Zero new problems.**
- smoke: `bash script/ci-smoke-test.sh` (real git in PATH): **1324 pass / 42 skip,
  8 fail / 4 errors — every failure is a subprocess-spawn timeout in an untouched
  test file** (ripgrep ×5, tool.grep ×3, Mesh/tailscaled ×3; all "timed out after
  30000ms" or "control socket" stalls). **ts-nocheck burn-down guard 5/5 PASS.**
  Isolated rerun of the ripgrep/grep tests with 60s timeouts reproduced the wedge
  ("killed 1 dangling process" — the spawned `rg` never exec'd), confirming
  environmental, matching tail4's documented deferral precedent.
- ts-nocheck headers stripped on all 7 burn files (+RailsInboxBridge already stripped
  by tail4); verified by direct inspection.

## Incidents (environmental, machine-wide spawn wedge ~04:15–06:30+)

- A machine-wide subprocess-spawn wedge (binaries hang in dyld `fcntl` while mapping
  segments — sampled: `/usr/bin/git` shim, `gh`, `python3`, `/bin/ps aux`; reproduces
  on unmodified paths, load avg ~5.5 from concurrent sibling burn agents) blocked
  `gh` and the git shim for the whole session. Workarounds: real git at
  `/Applications/Xcode.app/Contents/Developer/usr/libexec/git-core/git`, direct
  `node node_modules/.../tsc.js|eslint.js` invocation. The keychain `gh:github.com`
  token is also expired (401 on all auth schemes) — independent of the wedge.
- **The burn was merged by an external actor while this close-out was running:**
  PR #680 (`ao/ts-burn-tail5` → main, merge `16c852207`) appeared on origin/main
  ~06:05 containing exactly commit `7f3d4dcf1`. This session did not create or merge
  the PR (gh was unwedgeable) — landed state verified via `git ls-remote`/`fetch` and
  merge-parent inspection (second parent == `7f3d4dcf1`).
- First smoke attempt wedged on a test-spawned git-shim child (`/usr/bin/git init`);
  rerun with the real git dir first in PATH.

## Honest deferrals

- This was a takeover: the prior tail5 agent hit the 2-hour batch limit after
  committing + pushing `7f3d4dcf1`; the burn itself, queue update, and PR are its
  work. This session verified gates on the identical tree and ran the close-out
  ritual (sync, discipline, attestation, teardown).
- Desktop rebuild (lifecycle step 8) not run: gizzi-code source changed but no
  release path files were touched; per the burn-batch convention and the close-out
  brief, out of scope for this batch ritual.
- eslint reporting quirk noted: on origin/main, thread.ts and railsPeer.ts produced
  zero eslint findings despite their `@ts-nocheck` headers (config-level skip);
  baseline comparison above accounts for it.

## Final state

- main == origin/main == `16c852207`; git-discipline PASS (5 unmerged branches all
  live-worktree/allowlisted).
- Worktree `allternit-ao-tsburn-tail5` removed (node_modules first); branch
  `ao/ts-burn-tail5` deleted local + remote.
