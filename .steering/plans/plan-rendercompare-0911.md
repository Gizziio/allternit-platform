# Plan — rendercompare-0911 (mapping doc §3 port #2, "P1.5" render-and-compare)

Session E. Branch `session/rendercompare-0911`, worktree `allternit-session-rendercompare-0911`,
from origin/main @ dce56e070.

## Goal
Give the studio design agent bounded self-verification: render a candidate artifact in real
Chrome, read the screenshot back, list visual defects against the brief, patch, max 2 passes,
persist the final screenshot as a project file `/.renders/<timestamp>.png`.

## Todos

- [x] Worktree + pnpm install (playwright-core resolvable from root node_modules; Chrome at
      /Applications/Google Chrome.app; preflight baseline 35/0)
- [ ] `scripts/render-artifact-screenshot.mjs` (repo root): `--html-file` | stdin, `--out`,
      `--width 1280 --height 800 --wait <ms>`; Chrome discovery + playwright-core ad-hoc
      resolution mirroring client-report screenshot.js; graceful non-zero exit + stderr.
      Pure helpers (parseArgs, output-path defaulting) factored for node:test coverage.
- [ ] `scripts/render-artifact-screenshot.test.mjs` — pure-helper tests only, no browser.
- [ ] Studio steering: bounded "Self-verification — render and compare" block in
      `composeStudioSystemPrompt` (surfaces/ai.allternit.com/src/lib/design/studio-system-prompt.ts)
      with the exact command line + repo-root mount note.
- [ ] Extend studio-system-prompt.test.ts (self-verification instruction, exact script path,
      2-pass cap).
- [ ] Verify: `pnpm typecheck` 0 errors; `pnpm vitest run src/lib/design src/shell src/views/design`
      all green; `node --test scripts/render-artifact-screenshot.test.mjs`.
- [ ] Live render check: fixture HTML `<h1>Render check</h1>` + inline styles → real non-empty PNG;
      show size; delete fixture.
- [ ] `node scripts/release-preflight.mjs` passes.
- [ ] Commit, push, PR (--merge), merge SHA.
- [ ] Ledger branch session/ledger-rendercompare-0911: summary + LEDGER.md bullet, PR, merge.
- [ ] Desktop rebuild from merged main (copy sidecar bin/, `npm run dist` background), bundle grep
      for `render-artifact-screenshot.mjs --html-file`, DMG swap (retire b2198 set only), cleanup
      (worktree + branches local/remote).

## Deferrals (honest, for ledger)

- Critique-panel image wiring (panelists consuming the persisted screenshot) — follow-up.
- Gallery thumbnails keep in-app foreignObject capture (artifact-thumbnail.ts); real-browser
  screenshots can replace it once agent-saved project-file screenshots exist — follow-up.
- No gateway-side rendering.
