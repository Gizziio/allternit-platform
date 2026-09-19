# Pilot 6 — React Compiler artifact de-compilation (PromptInput / install-github-app / notifs)

- **Session:** `ao/artifact-codemod-pilot6` (worktree `allternit-ao-codemod6`)
- **Agent:** kimi-code (subagent, PILOT 6 of the artifact codemod)
- **PR:** #668, merged `3e36f741d1417d2eba04781bff520d005d661c02` (merge commit), branch deleted
- **Spec:** `docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md` §6.1/§7

## What was done

Converted **29** React Compiler artifacts under `cmd/gizzi-code/src/cli/ui/ink-app/` back to
ordinary TSX with `script/decompile-artifact.mjs`:

- `components/PromptInput/` (10): HistorySearchInput, Notifications, PromptInputFooterLeftSide,
  PromptInputFooterSuggestions, PromptInputHelpMenu, PromptInputModeIndicator,
  PromptInputStashNotice, SandboxPromptFooterHint, ShimmeredInput, VoiceIndicator
- `commands/install-github-app/` (10): ApiKeyStep, CheckExistingSecretStep, CheckGitHubStep,
  ChooseRepoStep, CreatingStep, ErrorStep, ExistingWorkflowStep, InstallAppStep, SuccessStep,
  WarningsStep
- `hooks/notifs/` (9): useDeprecationWarningNotification, useFastModeNotification,
  useIDEStatusIndicator, useLspInitializationNotification, useMcpConnectivityStatus,
  usePluginAutoupdateNotification, usePluginInstallationStatus,
  useRateLimitWarningNotification, useSettingsErrors

**Script unchanged — fourth consecutive pilot at zero script changes** (pilot 5 was third).
The script has converged; per the pilot-5 watch note, the loop-mutated-let class was hit again
(1 occurrence this pilot) and hand-fixed, still at 2 occurrences total across pilots 5–6 —
below the 3+ teach-threshold.

## Hand-fixes (3 files, all the pilot-5 loop-mutated-let class or trivial residue)

- `ShimmeredInput.tsx` — memo-cache guard over `lo`/`hi` computed in a `for` loop over
  `highlights`; guard dropped, compute path kept verbatim. `useAnimationFrame` verified
  unconditional and after the if-block (hook order safe).
- `ExistingWorkflowStep.tsx` / `InstallAppStep.tsx` — one stray leftover cache-write
  statement each (`$[12] = t8;` / `$[4] = t5;`) left by a partially-matched memo block;
  dropped.

No straight-lined regions this pilot (script reported zero), so no hook-order hazards beyond
the ShimmeredInput verification above; hooks in the 9 notifs files sit at hook-body top level,
unconditional, in compiled order.

## Type-drift fixes (2 files, type-only; zero @ts-nocheck headers kept)

- `PromptInputFooterSuggestions.tsx` — `SuggestionItemRow` inline props type
  `{ item: SuggestionItem; maxColumnWidth?: number; isSelected: boolean }` restored from the
  artifact's own sourcemap `sourcesContent` (pilot 5 AgentWizardData/SpinnerMode precedent).
- `PromptInputFooterLeftSide.tsx` — four verbatim-upstream dead `"external" === 'ant'`
  comparisons plus the never-defined `TungstenPill` dead branch (all dead code from the
  ANT-ONLY build variant, never rendered) suppressed with scoped `@ts-expect-error TODO(types)`
  (pilot 5 ToolSelector precedent).

## Burn-down bookkeeping (spec §7, same PR)

- `ts-nocheck-baseline.txt`: 1210 → **1115** (29 from this pilot + 26 from b0301 + 11 from
  b0336, both absorbed via rebase).
- `queue.json` regen: `excludedCompilerArtifacts` 210 → **181** (-29 = converted count).
- **Two concurrent burn-down landings absorbed mid-flight** (PR #667 b0301, PR #669 b0336).
  Both queue conflicts were resolved by re-seeding from `origin/main`'s queue and re-running
  the deterministic regen. One real error caught and corrected in-flight: during the first
  rebase a `--theirs` on `queue.json` picked the wrong side (in rebase, `--theirs` is the
  patch being applied, not main), silently dropping b0301's DONE record; caught by the
  DONE-ID diff check (29 vs 30) and fixed by re-seeding from main before push.
- Final regen verification: DONE batches preserved **31/31** byte-identical (incl. b0301,
  b0336), exclusion drop exactly 29, totalNocheck 1142 → 1113, deterministic (generatedFrom
  pins the pre-merge HEAD).

## Verification evidence

- `npx tsc --noEmit` exit 0 (baseline main was clean before changes; clean after; re-verified
  after each rebase — 3 tsc runs on final tree state)
- esbuild parse 29/29
- `bun run test` (ci-smoke): **1332 pass / 0 fail / 42 skip**, SMOKE PASS (the first run
  failed only the nocheck guard, exactly the expected ratchet signal; green after `--update`)
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**
- `bash script/check-ts-nocheck.sh` ratchet: baseline 1115 = current 1115
- `test/ts-nocheck-guard.test.ts` 5/5 post-rebase
- Zero `react/compiler-runtime` / `_c(` / `$[n]` in the 29 converted files
- Behavior spot-check (real ink render, `NODE_ENV=test`, watchdogged):
  - `PromptInputHelpMenu` renders actual shortcut content ("! for bash mode", "/ for
    commands", "@ for file paths", "ctrl + _ to undo") — hooks execute in order.
  - `ShimmeredInput` (the hand-fixed file) renders both input lines with shimmer highlights
    across animation frames.
  - Note: `utils/staticRender.tsx`'s renderToString hangs under bare `bun` outside the CLI
    bundle (unrelated to this change — no test uses it); the spot-check used a direct ink
    `render` into a PassThrough stream instead.

## Incidents / notes for pilot 7

- `pnpm install` (root, pnpm 10) fails on current main in an unrelated workspace package:
  `services/runtime/adapter/allternit-runtime` prepare script (tsc) imports
  `OrchestrationContext` from `@allternit/orchestrator`, which the S3 consolidation
  (`69775a1f5`) no longer exports. Pre-existing on main, outside this pilot's scope
  (noted, not fixed). Worked around with `pnpm install --ignore-scripts` (gizzi-code does not
  depend on `@allternit/runtime`; `ensure-sdk-dist.sh` builds the dists the typecheck needs).
- Rebase semantics gotcha (see bookkeeping above): during `git rebase`, `--ours` = new base,
  `--theirs` = your patch. Pilot 7 should seed queue conflict resolution from
  `origin/main:<path>` directly, not from a rebase-stage side label.
- Remaining artifacts on merged main: **181** (incl. 11 vendored `ink/components`). Largest
  non-ink clusters: `components/mcp` (8), `commands/plugin` (8), `components/hooks` (6),
  `components/sandbox` (5), `components/shell`/`Settings`/`FeedbackSurvey` (4 each).
- GO for pilot 7: script still converged (4th zero-change pilot), one repeated hand-fix
  class at 2 total occurrences — teach the script if pilot 7 hits a 3rd.
