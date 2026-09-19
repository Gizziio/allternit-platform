# Session attestation — ts burn-down b0219 (ao/ts-burn-next7)

- **Date:** 2026-09-18 23:58
- **Agent:** kimi-code (subagent, batch runner)
- **Branch:** `ao/ts-burn-next7` → **PR #658** → merge commit `955042623`
- **Batch:** b0219 (22 files, 7,301 LOC) — 25th burn batch (~503 files cumulative)

## What was done

Burned batch **b0219** of the gizzi-code `@ts-nocheck` burn-down queue
(`cmd/gizzi-code/script/typecheck-burndown/queue.json`): stripped the
`@ts-nocheck` header from 22 files and fixed every exposed error type-only.
Batch included the `promptCacheBreakDetection.ts` runtime/ink-app twin pair.

- **17 header-only 0-error burns** — strip only. TS2322 probe
  (`const __tsProbe2322: string = 42`) appended to all 22 files in one pass:
  exactly one probe error per file and zero other errors — all 22 confirmed
  in the compilation; probes reverted (one pass append + one pass revert,
  verified clean via byte-exact reconstruction against HEAD for the
  pure-strip files).
- **5 type-only fixes** (9 exposed errors, 2 iterations):
  - `utils/lockfile.ts` — the ambient `proper-lockfile` declaration in
    `src/types/global.d.ts` omits `lockfilePath`, which the real package
    supports (custom mtime lockfile location). Widened the local wrapper's
    `LockOptions` (re-exported interface extending the ambient one) instead
    of casting the 4 identical call sites in teammateMailbox.ts. Type-only;
    options pass through unchanged.
  - `utils/teammateMailbox.ts` — TS2488: `NestedMessage.content` includes
    `unknown` in its union (types/message.ts), which is not iterable; pinned
    the assistant blocks to `ContentBlock[]` in `getLastPeerDmSummary` (the
    function already guards `typeof block.input === 'object'` before use).
    The 4 TS2353 `lockfilePath` excess-property errors cleared via the
    wrapper widening above.
  - `utils/model/modelCapabilities.ts` — TS2339: lodash-es `memoize` does
    not declare `.cache`; intersected
    `{ cache: { delete: (key: string) => boolean } }` onto `loadCache` at
    its definition (call-site cast failed TS2352 overlap). `src/utils/memoize.ts`
    was checked first per playbook — properly typed, but this file uses
    lodash memoize directly.
  - `utils/exportRenderer.tsx` — TS2614: dormant `keybindings/types.ts` stub
    (`types_ts()`) exports nothing; local
    `type KeybindingContextName = string` mirror with the sibling
    `TODO(types)` pattern already used by `keybindings/resolver.ts` and
    `keybindings/validate.ts`.
  - `assistant/sessionHistory.ts` — TS2459: `agentSdkTypes.js` keeps
    `SDKMessage` as a local `unknown` mirror (its own TODO(types) block) and
    does not export it; mirrored locally with the same rationale.
  - `runtime/session/compaction.ts` — TS2345: hook name
    `"experimental.session.compacting"` is not declared in the
    packages/plugin `Hooks` interface (checked main — genuinely undeclared;
    the runtime index.ts hook-dispatch re-exports do not include it either).
    Triggered with an explicit local contract via `Plugin.trigger<any, Input,
    Output>` generics, keeping `compacting.prompt`/`compacting.context`
    typed. Type-only; runtime flow identical.

## Queue state

- b0219: `NEW` → `DONE` in place (`burnedFiles: 22`, `burnedLoc: 7301`,
  note recorded); stats: totalNocheck 1386 → 1364, totalQueueFiles 972 → 950,
  totalQueueLoc 366969 → 359668. `totalAccounted` untouched (1473).
- Identity verified after the queue edit and again after the pre-push rebase
  onto origin/main: live 950 + recorded 503 + quarantined 20 = 1473 =
  totalAccounted. `quarantined` untouched; guard count never grew.
- No concurrent regen remix this batch: b0219's 22 files had zero overlap
  with any other live batch or the quarantine list; the rebase onto
  origin/main (which picked up PRs #656/#657) touched none of this batch's
  files and queue.json merged cleanly.

## Verification evidence

- `pnpm run typecheck` (ensure-sdk-dist + tsc --noEmit): **0 errors**
  — strip exposed 9 errors → 2 iterations → 0; re-verified 0 after the
  probe revert and after the EOF-repair pass (4 tsc runs total).
- `pnpm test` (ci-smoke incl. ts-nocheck burn-down guard): **1329 pass /
  0 fail** (1371 tests, 111 files), guard green post-queue-update.
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**.
- eslint: zero new — burning removed the HEAD `@ts-nocheck`
  ban-ts-comment errors on the changed files; the remaining findings
  (`no-namespace` on the pre-existing `SessionCompaction` namespace,
  unused-import warnings, `custom-rules/no-sync-fs` plugin-resolution
  artifact of running eslint from the repo root) all pre-exist at HEAD.
- pnpm-lock.yaml: untouched. `src/types/*.d.ts`: untouched (the
  proper-lockfile gap was worked around in the source wrapper, not the
  ambient declaration). Never-touched list honored (release-desktop.yml,
  desktop/voice/local-engine surfaces, build-production.js run-only,
  build-queue.mjs, decompile-artifact.mjs).
- Diff self-audit: 23 files changed, 38 insertions, 30 deletions — 22
  header strips, 5 type-only fixes, 1 wrapper widening (lockfile.ts);
  no logic edits.

## Incidents / deferrals

- None. No escalations (0/22). No latent-runtime-bug candidates found.
- Follow-up note: the `experimental.session.compacting` plugin hook is
  real at the call site but undeclared in the SDK `Hooks` interface —
  when it lands there, the explicit generics in compaction.ts should
  collapse to a plain declared-name trigger. Same for the two
  `TODO(types)` local mirrors (keybindings/types.ts, agentSdkTypes
  SDKMessage) — 5+ and 1 importers respectively now rely on mirrors.
