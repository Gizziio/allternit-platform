# Agent Work Attestation — pipeline fixes (Pages deploy gate + pnpm packaging)

**Date:** 2026-09-11 11:15
**Session ID:** `pipelinefix-0911`
**Branch:** `session/pipelinefix-0911`
**Agent:** kimi (Kimi Code session `9fe8e2b1`)
**PR:** https://github.com/Gizziio/allternit-platform/pull/333
**Merge commit:** `5dc01ac96`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Fixed the two flags raised after session/designwordmark-0911:

**Flag 1 — Cloudflare Pages deploy red on main.** Root cause (from CI logs,
run 34614092853): not CF-side. The `verify-ai` job in
deploy-cloudflare-pages.yml failed on `pnpm typecheck` with 6 pre-existing
fabric-session errors, gating the ai.allternit.com deploy; the same job's
`pnpm test` step had 2 more pre-existing failures. Fixes:
- `FabricSessionPanel.tsx` — removed a dead `driveKind === 'bot'` comparison
  (unreachable: the bot case renders FabricBotModeCanvas above it); TS2367.
- `BotsChatPage.tsx` — `Bot` is `AgentBot`; `botProfile` lives directly on
  the agent: `bot?.agent.name` → `bot?.name` (×2), `getBotDisplayName(bot.agent)`
  → `getBotDisplayName(bot)`, `bot?.agent.botProfile` → `bot?.botProfile`,
  `bot?.tagline` → `bot?.botProfile?.tagline` (5 × TS2339).
- `BotsRosterSection.test.tsx` — parallel session dmp1-0911 (PR #332) landed
  an equivalent test fix first; took theirs in the merge conflict.

**Flag 2 — electron-builder required cloned npm-style node_modules.**
Root cause: app-builder-lib `detectPackageManager` reads the app
package.json `packageManager` field first, then app-dir lockfiles; the
desktop package has neither → env detection → npm collector → `npm ls` fails
against pnpm's symlinked virtual store on npm 11 ("No JSON content found in
output"). It only worked in CI because runners use node 20 / npm 10.
Fix: `"packageManager": "pnpm@10.28.0"` in
`surfaces/allternit-desktop/package.json` → native `PnpmNodeModulesCollector`.
CI already installs with pnpm; no workflow change.

## How it works

The `packageManager` field is detected before lockfiles, so even the stray
untracked `package-lock.json` in the shared checkout can no longer divert
electron-builder to the npm collector. The pnpm collector runs
`pnpm list --prod --json` and resolves packages from the content-addressed
store, so packaging now works on any npm version and in fresh pnpm
worktrees — no node_modules cloning.

## Verification

- `pnpm typecheck` (ai.allternit.com) — 0 errors.
- `pnpm test` — 209 files / 1641 tests passed (was 2 failed; failures
  confirmed pre-existing via stash).
- `build:electron:dmg` with the plain pnpm-installed node_modules:
  electron-builder logged `detected workspace root ... pm=pnpm`; asar
  contains real node_modules (1983 entries). DMG
  `Allternit-Desktop-1.1.1-b2052-arm64.dmg` built unsigned.
- Post-merge deploy-cloudflare-pages run on `5dc01ac96` observed
  (verify-ai green; full pipeline result recorded in LEDGER follow-up if
  still running at attestation time).

## Known gaps / remaining work

- Vercel checks on PRs are failing fleet-wide with "Deployment rate limited
  — retry in 24 hours" (external to this repo); non-blocking.
- `.steering/checkpoint.md` conflicts on nearly every concurrent merge —
  two merge-round trips this session alone. Worth a follow-up (e.g.
  per-session checkpoint files) but out of scope here.
- Desktop DMG rebuild from merged main + preview swap handled as the
  post-attestation step of this session.

## Files changed

- `surfaces/ai.allternit.com/src/components/dispatch/FabricSessionPanel.tsx` — dead comparison removed
- `surfaces/ai.allternit.com/src/fabric-session/pages/BotsChatPage.tsx` — AgentBot accessors fixed
- `surfaces/allternit-desktop/package.json` — packageManager field (pnpm collector)
