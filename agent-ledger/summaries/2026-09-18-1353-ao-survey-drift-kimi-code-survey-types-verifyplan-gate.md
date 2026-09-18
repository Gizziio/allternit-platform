# 2026-09-18-1353 — ao-survey-drift — kimi-code — FeedbackSurvey types + VerifyPlan gate alignment

**PR:** #613 (merged, merge SHA 217b29f0d047c6e264625e70995c88eb3881d424)
**Branch:** `ao/survey-implement-drift-fixes` (deleted after merge)
**Worktree:** `allternit-ao-survey-drift` (removed after attestation)
**Base:** rebased onto origin/main three times during the session (`0f9cceeaf` → `958f8acd4` → `9270412cb`) as concurrent burn/codemod agents merged.

## What was done

Three approved items from `docs/programs/gizzi/DORMANT_STUB_DECISIONS.md` (PR #610 follow-ups):

1. **Implemented `FeedbackSurvey/utils.ts` type exports** (decision row #5, the one IMPLEMENT).
   Added `FeedbackSurveyResponse = 'dismissed' | 'bad' | 'fine' | 'good'` and
   `FeedbackSurveyType = 'session' | 'memory' | 'post_compact'` with shapes derived from the
   live consumers (`FeedbackSurveyView.tsx` digit map, `useSurveyState.tsx:6` local union,
   `useFeedbackSurvey.tsx` default param and transcript triggers, `useMemorySurvey.tsx` /
   `usePostCompactSurvey.tsx` `survey_type` payloads). The two zero-caller functions
   (`formatSurveyData`, `validateSurveyResponse`) left as-is per the decision doc. Types-only;
   no runtime change.

2. **deleted-paths.txt "stale paths" — verified, no change.** Git history (`git log
   --diff-filter=D`) shows the three dev-tool entries exactly match the paths actually deleted
   in `4054582a0` (836-file ink-app mirror cleanup, recorded when the manifest was created in
   `944220503`). The drift note conflated the deleted mirror copies with the still-live stubs
   at `src/cli/ui/ink-app/tools/…` (CUT targets rows #12–#14), which the future cut PR appends
   per the doc's own appendix. dead-code-guard 4/4.

3. **VerifyPlan gate mismatch — ALIGNED to the env flag.** Both `classifierDecision.ts` copies
   now gate `VERIFY_PLAN_EXECUTION_TOOL_NAME` on `process.env.GIZZI_CODE_VERIFY_PLAN === 'true'`
   (was `USER_TYPE === 'ant'`, inherited from the upstream dump `2bda61382`). Evidence:
   the file's own header says "Gates mirror tools.ts" (sibling entries do); every other
   VerifyPlan surface (`tools.ts:96-98`, both `messages.ts` copies, both `attachments.ts`
   copies) uses the env flag; the env gate is long-standing upstream
   (`CLAUDE_CODE_VERIFY_PLAN`, renamed `d5d3add9d`). Behavior impact nil-to-beneficial: the
   safe-list name can now only load when the tool module can also load.

## Verification evidence

- `bash script/ensure-sdk-dist.sh` — OK (computer-use + os-contracts dists rebuilt).
- `npx tsc --noEmit` (NODE_OPTIONS=8GB) — exit 0, verified on each rebase.
- `bun run test` — 107 entries, 1310 pass / 42 skip / **1 fail**: the failure is
  `ts-nocheck burn-down guard > nocheck count has not increased vs the committed baseline`
  (live `totalNocheck` vs the queue.json pin). **Pre-existing on origin/main**: reproduced in a
  pristine detached checkout of `958f8acd4` (live 1835 vs pin 1836) and still present after the
  concurrent `ao/ts-burn-b0009` collateral update (live 1803). It is burn-queue collateral
  drift owned by the burn-down agent (queue.json is out of scope for this session). Note: the
  failure did not reproduce on one earlier full-suite run at `0f9cceeaf` — the count appears
  sensitive to full-suite test scheduling; standalone runs fail deterministically.
- dead-code-guard: 4/4 pass.
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed.
- eslint on the 3 changed files — no new problems (2 pre-existing `@ts-nocheck`
  ban-ts-comment errors at 1:1 in both classifierDecision.ts burn files).

## Incidents / honest deferrals

- The ts-nocheck guard drift (above) is left for the burn-down owner; queue.json and the burned
  files were out of this session's scope.
- Item 2's expectation of a manifest edit was disproven by git-history evidence; no edit was
  the correct outcome and is documented in the PR body.

## Commits

- `047e019b0` feat(gizzi-code): implement FeedbackSurvey type exports in utils.ts
- `5be72d934` fix(gizzi-code): gate VerifyPlanExecution classifier name on GIZZI_CODE_VERIFY_PLAN
