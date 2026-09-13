# Plan — session/pipelinefix-0911

Fix the two flags raised after session/designwordmark-0911, plus rebuild the
desktop app from fixed main.

## Flag 1 — Cloudflare Pages deploy failing on main

Root cause (from CI logs, run 34614092853): NOT a CF-side problem. The
`verify-ai` job in deploy-cloudflare-pages.yml fails on `pnpm typecheck` with
6 pre-existing errors in fabric-session code, gating the ai.allternit.com
deploy. platform.allternit.com deploys fine.

Fixes:
- `src/components/dispatch/FabricSessionPanel.tsx:677` — remove dead
  `driveKind === 'bot'` ternary (unreachable: the bot case renders
  FabricBotModeCanvas above and returns different JSX).
- `src/fabric-session/pages/BotsChatPage.tsx` — `Bot` is `AgentBot`
  (`botProfile` lives directly on the agent; no `bot.agent`, no
  `bot.tagline`): `bot?.agent.name` → `bot?.name` (×2), line 158
  `getBotDisplayName(bot.agent)` → `getBotDisplayName(bot)`, line 164
  `bot?.agent.botProfile` → `bot?.botProfile`, line 303 `bot?.tagline` →
  `bot?.botProfile?.tagline`.

## Flag 2 — electron-builder node_modules collector fragility

Root cause: app-builder-lib's `detectPackageManager` checks the app
package.json `packageManager` field first, then lockfiles in the app dir.
`surfaces/allternit-desktop/package.json` has no `packageManager` field and
no lockfile of its own (pnpm workspace: lockfile at repo root) → falls back
to environment detection → npm collector → `npm ls --json` against pnpm's
symlinked virtual store fails on npm 11 ("No JSON content found in output").
It only ever worked because CI runners use node 20 / npm 10. Local dev
(node 25 / npm 11) and future CI bumps break it.

Fix: add `"packageManager": "pnpm@10.28.0"` to
`surfaces/allternit-desktop/package.json` → electron-builder uses the native
`PnpmNodeModulesCollector` (`pnpm list --prod --json`), which understands the
pnpm layout on any npm version. CI already installs with pnpm, so no
workflow change needed.

## Verify

- `pnpm typecheck` + `pnpm test` in surfaces/ai.allternit.com (both gate the
  deploy workflow).
- Full `npm run build:electron:dmg` in the worktree with the pnpm-installed
  node_modules (no npm clone) — proves the collector fix and produces the
  rebuild evidence.

## Todos

- [x] Investigate both root causes
- [x] Fix fabric-session type errors
- [x] Add packageManager field
- [ ] pnpm install + typecheck + unit tests green
- [ ] Desktop dmg build succeeds with pnpm node_modules
- [ ] Commit, push, PR, merge; attest; rebuild from merged main; swap
      preview binary; cleanup
