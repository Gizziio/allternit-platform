# Agent Work Attestation — rendercompare-0911 (P1.5 render-and-compare)

**Date:** 2026-09-11 20:35
**Session ID:** rendercompare-0911 (session E)
**Branch:** session/rendercompare-0911
**Agent:** kimi-code
**Commit:** PR #393 → merge `f827271fc`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

- Mapping doc §3 port #2 ("P1.5") — render-and-compare self-verification for the studio
  design agent. Gap: nothing verified generated UI visually; critique panelists catch
  defects by eye.
- New repo-root CLI `scripts/render-artifact-screenshot.mjs`: renders artifact HTML
  (`--html-file <path>` or stdin) to PNG in real Chrome via playwright-core. Flags:
  `--out` (default alongside input / `./render.png` for stdin), `--width 1280
  --height 800 --wait <ms>`. Pure helpers (`parseArgs`, `resolveOutputPath`,
  `chromeCandidates`) factored out and covered by `node --test` (11/11) — no browser
  launched in tests.
- `composeStudioSystemPrompt` gained a bounded `## Self-verification — render and
  compare (binding, max 2 passes)` block: after producing a candidate artifact and
  BEFORE emitting `<artifact>`, write it to a temp file, run the exact command line
  `node scripts/render-artifact-screenshot.mjs --html-file /tmp/studio-verify.html
  --width 1280 --height 800 --out <project-dir>/.renders/<timestamp>-pass1.png` from
  the platform repo root (`~/Desktop/allternit-workspace/allternit` in the session
  environment — stated as an assumption; the prompt otherwise references paths
  repo-root-relative), read the PNG back, list concrete visual defects against the
  brief (overflow/clipping, contrast, hierarchy, alignment), patch, render again at
  most once (max 2 passes total), and keep the final screenshot as a project file at
  `/.renders/<timestamp>.png`. Honesty rule: if Chrome/playwright-core is unavailable,
  skip verification and say so — never claim a render that did not happen.

## How it works

- playwright-core is deliberately NOT a package dependency. Resolution mirrors the
  proven client-report `~/.kimi-code/skills/client-report/scripts/screenshot.js`
  pattern, documented in the script header: `require.resolve` from the script location
  (repo-root node_modules, where the pnpm workspace already hoists playwright-core),
  then `npm root -g`, then `~/node_modules` and `~/.kimi-code/node_modules` (ad-hoc
  per-session installs). Chrome discovery: `$CHROME_PATH` → well-known macOS/Linux
  installs → playwright `channel:"chrome"` last resort. No browser download.
- Graceful failure is a contract: non-zero exit + stderr message when Chrome or
  playwright-core is unavailable, so the agent (and callers) can treat it as
  "verification unavailable" instead of a crash or a fake success.
- fullPage screenshots mean overflow beyond the viewport is captured, not clipped —
  that's the defect class this check exists to catch.

## Verification

- `pnpm typecheck` (surfaces/ai.allternit.com) — 0 errors.
- `pnpm vitest run src/lib/design src/shell src/views/design` — **79/79 passed, 13
  files** (baseline at branch point 66/66 @ 12 files; main had gained tests from
  concurrent sessions; this change adds 5 new assertions in
  studio-system-prompt.test.ts covering the self-verification instruction, the exact
  script path, the 2-pass cap, the project-file persistence, and the honesty rule).
- `node --test scripts/render-artifact-screenshot.test.mjs` — 11/11 (pure helpers only).
- **Live render check (the session's core claim):** fixture
  `<h1>Render check</h1>` with inline styles → real Chrome PNG, **9825 bytes,
  1280×800**, via BOTH `--html-file` and stdin paths (machine Chrome at
  /Applications/Google Chrome.app/Contents/MacOS/Google Chrome). PNG read back and
  visually confirmed (heading rendered, amber on dark). Fixtures deleted after.
- `node scripts/release-preflight.mjs` — 35 passed, 0 failed.
- Desktop rebuild from merged main: build **b2218**, bundle grep for
  `render-artifact-screenshot.mjs --html-file` hit in
  `release/mac-arm64/Allternit Desktop.app/Contents/Resources/platform/assets/`
  (DesignModeView chunk). DMGs copied to the shared checkout release dir;
  previously-latest **b2206** DMG set retired (the briefing's "b2198" was already
  gone — a concurrent session had landed b2206 and retired b2198 before this
  session's swap); older builds left alone.

## Known gaps / remaining work

- **Critique-panel image wiring deferred** — panelists consuming the persisted
  `/.renders/*.png` screenshot as image input is a follow-up session.
- **Gallery thumbnails unchanged** — `artifact-thumbnail.ts` keeps the existing
  in-app foreignObject capture; real-browser screenshots can replace it once
  agent-saved project-file screenshots exist in practice. Follow-up.
- **No gateway-side rendering** — out of scope by design.
- The repo-root mount path in the prompt block (`~/Desktop/allternit-workspace/allternit`)
  is a stated assumption; if studio sessions run elsewhere, adjust the block.
- No automated test launches a browser (deliberate); the live render path is verified
  manually above and would benefit from an occasional smoke in CI if a Chrome+png
  assertion lane ever exists.

## Files changed

- `scripts/render-artifact-screenshot.mjs` — new render CLI (Chrome + playwright-core, ad-hoc resolution)
- `scripts/render-artifact-screenshot.test.mjs` — new pure-helper node:test suite
- `surfaces/ai.allternit.com/src/lib/design/studio-system-prompt.ts` — bounded Self-verification block in `composeStudioSystemPrompt`
- `surfaces/ai.allternit.com/src/lib/design/studio-system-prompt.test.ts` — 5 new assertions
- `.steering/plans/plan-rendercompare-0911.md`, `.steering/checkpoint.md` — session plan + checkpoints
