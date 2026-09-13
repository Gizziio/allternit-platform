# Plan — session/landingpills-0911 (§6 P2 aspect picker + P3 disclaimer)

## Goal
Two small locked-plan items from mapping doc §6 on the studio landing:

1. **P2 — Aspect/format picker ("Adaptive" equivalent).** Kimi's prompt box has
   an output-shape pill row (Adaptive / 1:1 / 16:9 / 9:16 / 4:3 / 3:4). Our
   creation types already imply aspect; surface it as an explicit pill row in
   the composer. `Adaptive` (default) adds no constraint; a chosen aspect is
   passed through `onStart` → `startProject` and folded into the run prompt
   (`Aspect: 16:9`), same pattern as `Direction`.
2. **P3 — Footer disclaimer.** "AI-generated, for reference only" hygiene line
   at the foot of the landing in Register 1 voice (plain, direct): "Artifacts
   are AI-generated. For reference only — review before use."

## Files
- `NewProjectScreen.tsx`: aspect pill row in the composer toolbar area
  (remembers last choice in component state; default Adaptive), disclaimer
  footer in `.ad-launch__main`, `aspect?: string` on the onStart config type.
- `DesignModeView.tsx`: accept `aspect` in startProject config, add an
  `Aspect: …` line to the non-content opener prompts when set.
- `new-project-screen.css`: pill row + footer styles on launch tokens.
- Tests: aspect flows through onStart; disclaimer renders.

## Verify
typecheck 0; design lib + component tests green; shell 21/21.

## Out of scope
P1 one-box start (next session), P1.5 render-and-compare, P2 quick wins.
