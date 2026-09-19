# ts burn-down b0301 (ao/ts-burn-next13, PR #667)

Date: 2026-09-19 01:30 CDT. Agent: kimi-code. Batch: **b0301** (26 files, 5,349 loc at generation).

## What was done

Burned all 26 files of batch b0301 (4th non-DONE at session start; siblings took b0299/b0300/b0026):

- **17 header-only 0-error burns** — TS2322 probe (`const __probe: string = 42` appended per file)
  confirmed all 17 in compilation: exactly 17 probe errors, one per file, zero others; probe reverted
  byte-exact via `git show HEAD:` and headers re-stripped.
- **9 type-only fixes:**
  - `ink-app/utils/model/model.ts`, `ink-app/utils/thinking.ts`, `ink-app/utils/effort.ts` —
    restored missing `resolveAntModel` / `getAntModelOverrideConfig` imports from
    `./model/antModels.js` (b0220 context.ts precedent). `effort.ts` also mirrors `EffortLevel`
    locally (`'low' | 'medium' | 'high' | 'max'`, canonical in `src/utils/effort.ts`;
    runtimeTypes.ts does not export it) — b0219 sessionHistory.ts pattern.
  - `ink-app/bridge/createSession.ts` — local `type SDKMessage = unknown` mirror
    (agentSdkTypes keeps it local, not exported).
  - `ink-app/tools/WebSearchTool/WebSearchTool.ts` — local `WebSearchProgress` interface matching
    the payload shape the tool actually emits (`query_update` / `search_results_received` +
    `resultCount`); importing the canonical `src/types/tools.ts` shape instead leaked breakage into
    non-batch `UI.tsx` (iteration 3), so the local-mirror pattern was used. Local
    `WebSearchStreamEvent` union pinned over `queryModelWithStreaming`'s declared
    compact-`StreamEvent` yield type, which lacks the raw SDK `stream_event` members the tool
    consumes.
  - runtime `AgentTool/built-in/gizziGuideAgent.ts` + `verificationAgent.ts` — the runtime
    `BuiltInAgentDefinition` (loadAgentsDir.ts) is a dormant-shim mirror of the ink-app original:
    `getSystemPrompt` typed `() => string` (built-ins receive `{ toolUseContext }`), and missing
    `model`/`permissionMode`/`color`/`background`/`disallowedTools`/`criticalSystemReminder_EXPERIMENTAL`.
    Local widened contracts (sibling TODO(types) pattern).
  - `ink-app/utils/betas.ts` — `MemoizedBetasFn` cache-shape intersection (ambient memoize decl
    returns plain T without `.cache`; b0219 modelCapabilities.ts precedent); the preserved
    `provider === 'bedrock'` dead comparison pinned via initializer cast (`as APIProvider | 'bedrock'`)
    — a union *annotation* on a const narrows to the initializer type under CFA, the cast does not.

## Latent runtime bugs fixed in-flight (verify-by-execution evidence)

1. **betas.ts — P0-class.** `export const getX = registerBetasCache(memoize(...))` assigned the
   return of `registerBetasCache`, which returns `void` — so `getAllModelBetas`, `getModelBetas`,
   and `getBedrockExtraBodyParamsBetas` have been `undefined` at runtime since e3c7fa284
   (202-08-12 merge) and throw `TypeError: getModelBetas is not a function` on every caller,
   including the `queryModel` hot path (`getMergedBetas` → `getModelBetas` in
   `runtime/services/api/claude.ts:1058`). Verified by importing the module under bun
   (`typeof getModelBetas === 'undefined'`; call throws). Fix: registration is a separate
   statement; the exports are the memoized functions again.
2. **coordinatorMode.ts.** `delete readGizziEnv('COORDINATOR_MODE')` applied `delete` to a
   temporary return value — a silent no-op in sloppy mode, a `TypeError` in module strict mode.
   Now `delete process.env['GIZZI_COORDINATOR_MODE']` (matches `readGizziEnv` semantics).

## Queue state handling (sibling overlap)

A queue regen (artifact-codemod pilot5, PR #666 / commit a0d510070) landed mid-flight: it retired
the b0301 id entirely and remixed the 26 files into **b0333 (20)** and **b0334 (6)**. Per the
b0256/b0102 retired-id absorption precedent: seeded queue.json from the regenerated main queue,
removed the 26 files from b0333/b0334 (b0333 7058→3773 loc, b0334 7423→5271 loc), and appended the
DONE record under the retired id **b0301** (burnedFiles 26, burnedLoc 5437 — with-header loc after
in-batch type fixes, no escalations). One sibling collision mattered for the guard identity:
ao/ts-burn-next12 (b0026, PR #665) burned `src/runtime/session/prompt.ts` and its recorded +1 is in
the regenerated queue but its source change was not in my pre-rebase tree (local smoke failed the
guard identity by exactly one) — resolved by rebasing onto fresh origin/main immediately before
push, after which the identity closed exactly. No files of mine were burned by siblings.

Final stats: totalNocheck 1208→1182, totalQueueFiles 885→859, totalQueueLoc 336666→331229,
batchCount 102→103. **totalAccounted unchanged at 1460** (guard identity: live 879 + recorded 581 =
1460, exact). Quarantined (20) and all other batches untouched. No ts-nocheck-allowlist changes
needed (no escalations).

## Verification evidence

- `tsc --noEmit`: 0 errors (baseline, strip iter1 35 errors → iter2 6 → iter3 5 → iter4 0; +1
  post-rebase confirm run; burn converged in 3 fix iterations, well under the ~8 stop rule;
  escalation rate 0%).
- TS2322 probe: 17/17 files in compilation, exactly one probe error each, zero others.
- `script/ci-smoke-test.sh`: **SMOKE PASS — 1374 tests / 0 fail** (111 files), incl.
  ts-nocheck guard 5/5. (First smoke run failed the guard 3/3 before the queue.json update, as
  expected.)
- `node scripts/release-preflight.mjs`: 52 passed / 0 failed.
- `bun run lint`: exit 0 (zero new).
- Diff self-audit: 27 files (26 src + queue.json), all inside cmd/gizzi-code; never-touched list
  respected (no release-desktop.yml, desktop/voice/local-engine surfaces, build-production.js,
  src/types/*.d.ts, build-queue.mjs); pnpm-lock untouched.
- Wall times: pnpm install 52s; ensure-sdk-dist ~5s; baseline tsc ~18s; strip tsc 18s; 4 fix
  iterations ~15s each; probe tsc 22s; smoke 41–54s; preflight ~10s.

## Incidents / honest deferrals

- The betas.ts void-export finding means every build since 2026-08-12 has shipped with
  `getModelBetas` family undefined; whether callers were silently swallowing the resulting
  TypeError upstream of this repo (or the shipped binary predates the merge) was not fully traced —
  the smoke suite and this session's module-level execution confirm the source-tree state only.
  Worth a human look at runtime beta-header behavior on the next desktop build.
- src/types/tools.ts `WebSearchProgress` (`type: 'web_search'`) does not match the shape the tool
  emits; left as-is (out of burn scope), local mirror used instead. Flagged in code comment.
