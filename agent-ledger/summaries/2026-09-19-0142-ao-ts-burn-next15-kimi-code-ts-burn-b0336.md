# TS burn-down b0336 — ao/ts-burn-next15 (2026-09-19 0142)

## What was done

Burned batch **b0336** of the gizzi-code typecheck burndown: 40 files, 7139 loc (queue-listed), one twin pair (`src/runtime/services/vcr.ts` + `src/cli/ui/ink-app/services/vcr.ts`). Worktree `allternit-ao-tsburn-next15`, branch `ao/ts-burn-next15`, PR **#669**, merge **cef80b754**.

Batch selection: queue read fresh from the shared checkout; siblings took the first three non-DONE batches (b0333/b0334/b0335), this session took the fourth (b0336).

## Burn shape

- **33 header-only 0-error burns.** TS2322 probe (per-file `const __tsburn15ProbeN: string = 0`) confirmed all 33 in compilation: exactly 33 probe errors, one per file, zero non-probe errors. Reverted byte-exact via `git show HEAD:` and re-stripped.
- **7 type-only fixes across 9 files, converged in 1 iteration** (25 initial strip errors):
  - `commands/dash/dash.ts`, `commands/live/live.ts`, `commands/usage/usage.ts` — `context.getAppState().messages` does not exist on `AppState` (upstream drift shared with still-nocheck'd `status.tsx`/`session-info.tsx`/`statusModel.ts`); runtime value always `undefined`, so the pre-existing `?? []` fallback was always in effect. Pinned via `(context.getAppState() as { messages?: Message[] })` + type-only `Message` import. These three commands have always shown empty/zero usage at runtime — a latent behavior bug (like the sibling commands still carrying headers), out of type-only scope.
  - `commands/dash/dash.ts` — `client.status` does not exist on `MCPServerConnection` (the discriminator is `type`); runtime always printed `('unknown')`. Cast preserved.
  - ink-app `services/vcr.ts` — three patterns: (a) `message.type === 'stream_event'` has no overlap with `StreamEvent['type']` (dead comparison, deliberate DCE — preserved via a widened cast, same as the runtime twin's suppressed intent); (b) `message.message.model/usage` pinned via `AssistantMessage` + `BetaUsage` casts (runtime twin used `@ts-ignore` + `any`; `MessageUsage` vs SDK `BetaUsage` shape drift); (c) `mapAssistantMessage` content map pinned to `BetaContentBlock[]` then cast to the local content union (index-signature drift, same class as the runtime twin which compiles only because its `@/types/message.js` mirror is looser).
  - `utils/bash/commands.ts` — `ReturnType<typeof createCommandPrefixExtractor>` references had no import (the import is a deliberate deferred dynamic import to avoid a static circular through `../shell/prefix.js`). Fixed with an `import type { createCommandPrefixExtractor, createSubcommandPrefixExtractor }` — erased at compile time, anti-circularity intent preserved.
  - `utils/plugins/pluginOptionsStorage.ts` — lodash-es `memoize` does not declare `.cache`; intersected the MapCache `{ clear?: () => void }` shape (b0219 modelCapabilities precedent).
  - `utils/shell/prefix.ts` — `NestedMessage.content` includes `unknown` in its union, making the inferred `prefix` `unknown`; pinned the array branch to `{ type: string; text?: string }[]` (b0219 teammateMailbox precedent).
  - `runtime/session/index.ts` — removed two stale `// @ts-expect-error` (metadata indexing no longer errors under `strict:false`); `share`/`unshare` dynamic import of `@/share/share-next` now resolves to a local stub (`export const ShareNext = () => {}`) instead of failing — the old `@ts-expect-error` went unused and `ShareNext.create/remove` errored. **Latent runtime bug surfaced and NOT fixed (type-only scope):** the real `ShareNext` namespace lives at `@/runtime/session/share/share-next`; in builds without an alias, `session share`/`unshare` calls `.create`/`.remove` on the stub and throws `TypeError`. Pinned the import result to the real `create`/`remove` surface with a cast, deliberately not changing which module loads.
  - `shared/file/watcher.ts` — chokidar `on("error")` param is `unknown`; cast to `Error` at the `ParcelWatcher.SubscribeCallback` boundary.

No escalations (no headers restored); no `test/ts-nocheck-allowlist.txt` changes; `src/types/*.d.ts` never edited; pnpm-lock untouched.

## Queue-state handling

Seeded from **main's** queue.json (the pilot-5 regen had landed via sibling PR #667 while this burn was in flight — batchCount 103, totalNocheck 1182; this session's initial queue read at session start was the pre-regen 102/1208). All 40 burned files were still listed solely under b0336 on main (verified programmatically: no missing, no multi-batch, no foreign-batch listings).

- b0336 → `DONE`, `burnedFiles: 40`, `burnedLoc: 7146` (stripped loc sum), `files: []`, `loc: 0`, twin record kept for provenance, full note appended.
- Stats re-derived from the live tree: `totalNocheck` 1182→**1142**, `totalQueueFiles` 859→**819**, `totalQueueLoc` 331229→**324083**.
- `totalAccounted` **untouched** (1460); quarantined untouched; other batches untouched.
- **Identity: live 839 + recorded 621 = 1460 = totalAccounted** (guard test reconciles).

## Verification

- `tsc --noEmit`: **0 errors** (baseline 0; strip 25; post-fix 0; probe 33/33 TS2322 only; post-revert re-check 6 → fixes re-applied → 0; final post-amend 0).
- `bash script/ci-smoke-test.sh`: first run failed the 3 burn-down guard tests (expected mid-burn: queue.json not yet updated); after the queue amend: **1332 pass / 0 fail, SMOKE PASS, guard 5/5** (1374 tests, 111 files).
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed** (pre- and post-rebase).
- eslint: no eslint config in this repo (lint script is tsc) — zero new by construction.
- Diff self-audit: exactly 40 files, all under `cmd/gizzi-code/src/`; no lockfile/config churn.

## Incidents / coordination

- **Sibling collision (regen):** the pilot-5 queue regen (PR #666/#667) landed mid-flight, after this session's initial queue read. Detected at push-prep (`git fetch` → queue.json diff vs origin/main); resolved per playbook by seeding from main's queue. No file-level conflicts (zero path overlap between this burn and main's newer commits); rebase clean.
- Probe revert wiped the fixes in dash.ts and commands.ts (both were among the 33 probe-reverted files); re-applied and re-verified.
- Sibling worktrees next13/next14 were live in the workspace during this session; no interference beyond the queue regen above.

## Honest deferrals

- **Latent runtime bug (share/unshare):** `src/runtime/session/index.ts` `share`/`unshare` import `@/share/share-next`, a stub returning `() => {}`; the real implementation is at `src/runtime/session/share/share-next.ts`. Likely broken at runtime in builds without an alias. Recorded here and in the queue.json note; needs a deliberate runtime fix (point the import at the real module or implement the stub), outside type-only scope.
- **Usage-command drift:** `/dash`, `/live`, `/usage` (and the still-nocheck'd `/status`, `/session-info`, statusline) read `getAppState().messages`, which does not exist — they have always rendered empty usage. Worth a single follow-up that gives these commands a real messages source.
