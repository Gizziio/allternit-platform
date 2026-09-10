# Attestation — session gizzi/onboarding-pair (onboarding auto-pair)

- Date: 2026-09-10
- Agent family: kimi (orchestrator-implemented)
- Branch: `gizzi/onboarding-pair` → PR #238, merged `dbaedf2697`

## What was done

User-flagged gap: machines that completed the gizzi-code first-run wizard were
never Allternit runtime devices — nothing in onboarding ever invoked the
pairing flow (`Pairing.pair()` had no caller outside `gizzi pair` / `gizzi
login`; `onboarding.ts` never referenced it). This Mac shipped unpaired for
exactly that reason.

The wizard now offers device pairing as its last step (after theme, before the
completion marker): clack confirm default-yes; runs the existing `Pairing`
service (same code/URL output + browser approval as `gizzi pair`).

## How it works

- New injectable seams on `OnboardingDeps`: `pairingComplete()` and
  `pairMachine()`; defaults lazily import `@/runtime/services/pairing/pairing`
  (matches the file's existing dynamic-import pattern).
- New exported `runPairingStep(deps, confirm)` holds the decision logic;
  `confirm` is injected so tests drive it without clack.
- Skip rules: `GIZZI_NO_AUTO_PAIR` set → skip; already paired → skip
  silently; decline / Ctrl+C / thrown prompt → skip; pair failure → summary
  note, never throws. Onboarding completion is never blocked.
- Non-interactive paths (CI, piped stdin, `gizzi onboarding --defaults`)
  untouched.

## Verification

- `bun test test/commands/onboarding.test.ts` — 22/22 (14 pre-existing + 8
  new: confirm-pairs, already-paired-skips, decline-skips, cancel-as-skip,
  thrown-prompt-as-skip, failure-degrades, env-kill-switch, broken-status-
  check-still-offers).
- `bun run typecheck` clean (first run caught TS2873 on a `void x++ || s`
  idiom in the new tests; rewritten with counting closures).
- CI on PR #238: Typecheck, CI smoke, gitleaks, ts-nocheck ratchet all green.
- Not exercised: interactive end-to-end (real clack + real browser approval);
  the pair path is the same code `gizzi pair` runs, live-proven in P3.

## Incidents

- Fresh worktree trap: an early `bun install` at the repo root created bun
  artifacts; cleanup ran `git checkout -- .` which silently reverted the
  uncommitted source edits. First green test run (14/14) was the OLD suite —
  caught by `git status` showing only pnpm-lock churn. Lesson: never
  `git checkout -- .` with uncommitted work; re-applied all edits and
  re-verified. Repo actually uses pnpm (`shamefully-hoist`); gizzi-code tests
  additionally need `bash script/ensure-sdk-dist.sh` for `packages/sdk/dist`.
