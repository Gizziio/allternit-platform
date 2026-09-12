# Session summary — landingpills-0911 (§6 P2 aspect picker + P3 disclaimer)

- **Session:** `session/landingpills-0911`
- **Agent family:** kimi-code
- **Date:** 2026-09-11 19:29
- **PR:** #380, merge commit `348cec7c9`

## What was done

Two small locked-plan items from the competitive mapping doc §6 (kimi.com/design
port), on the A:// Studio landing (`NewProjectScreen`):

**P2 — aspect/format picker.** Kimi's prompt box carries an output-shape pill
row ("Adaptive" → 1:1 / 16:9 / 9:16 / 4:3 / 3:4). Added the same row to the
studio composer (`ASPECT_OPTIONS` in NewProjectScreen). `Adaptive` is the
default and passes `aspect: undefined` (no constraint); a chosen aspect flows
through `onStart` into `startProject`, which folds it into the run prompt —
`Aspect: 16:9` line in skill openers, sentence form in the generic opener —
mirroring the existing `Direction` pattern. Radio-group semantics
(`role="radiogroup"` / `role="radio"` / `aria-checked`).

**P3 — disclaimer footer.** `Artifacts are AI-generated. For reference only —
review before use.` at the foot of the landing, in the Register 1 voice
(plain, direct, no hype) — the same regulated-claim hygiene kimi.com/design
practices ("AI-generated, for reference only").

## Verification

- `pnpm typecheck` — 0 errors
- `NewProjectScreen.test.tsx` — 7/7 (+2: aspect default + flow-through,
  disclaimer renders)
- `pnpm vitest run src/lib/design src/shell` — 55/55

## Incidents
- None.

## Honest deferrals
- P1 one-box zero-friction start (next session); P1.5 render-and-compare;
  P2 quick wins (file versions / Team tab honesty label / sandbox policy).
