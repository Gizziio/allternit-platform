# Attestation — session/gizzi-tui-parity (P1): animated Allternit startup screen

**Date:** 2026-09-26 04:42 · **Agent:** kimi-code · **Session branch:** `session/gizzi-tui-parity` (multi-phase program) · **DAG:** dag_625298 / wih_8397

## What was done

P1 of the gizzi-code TUI parity program. Rewrote the TUI startup screen (`cmd/gizzi-code/src/cli/ui/ink-app/components/WelcomeBox.tsx`) as an animated, Allternit-branded welcome, referencing the owner's Codex CLI startup recording (`~/Desktop/codexclicopyintogizzicode.mov` — animated shimmering ASCII logo).

- **GIZZI block wordmark** (5-row letterforms) beside the Architectural Sentinel, coral shimmer sweep every 3s.
- **Sentinel animation**: beacon pulses (CORAL↔CORAL_BRIGHT sine), eyes blink every ~3.8s.
- **Tips line**: `/help for commands · /model to switch brains · shift+tab for permission modes`.
- New data module `welcomeArt.ts` (sentinel rows with animatable slots, letterforms, palette). Animation on the shared `useAnimationFrame` clock with viewport ref (pauses offscreen); static frame under `prefersReducedMotion`. Note: `Spinner/utils.parseRGB` only parses `rgb()` strings, so brand RGBs are literals in the component.

**PR:** #744, merge commit `2b16cfa2c8247bf0ca6eca6f03439599b05c0e0a`.

## Verification evidence

- Live pty capture of the real TUI (`bun src/cli/main.ts` under `script(1)`, scratch `GIZZI_CONFIG_DIR`, rails peer off): wordmark renders beside the mascot, blink frames (`●`↔`─`) fire on the clock across redraws, box layout + Directory/Session/Model/Version fields intact. Capture reviewed, then scratch dir and capture deleted; no stray processes.
- `test/components/WelcomeBox.test.ts` (new): 4/4 pass.
- `bun run typecheck`: clean. `node scripts/release-preflight.mjs`: 52/0.

## Honest deferrals

- Shimmer sweep color motion verified by code path + clock redraws in the pty capture (per-char SGR colors not visually diffed frame-by-frame).
- The Codex video's *auth menu* (numbered sign-in options) was inspiration for polish only; gizzi's login flow (`/login`) was not redesigned in this phase.
- Desktop binary rebuild still deferred to program end (see P0 attestation).
