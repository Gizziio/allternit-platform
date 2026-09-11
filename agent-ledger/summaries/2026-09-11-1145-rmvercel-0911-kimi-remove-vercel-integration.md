# Agent Work Attestation — remove dead vercel deploy integration

**Date:** 2026-09-11 11:45
**Session ID:** `rmvercel-0911`
**Branch:** `session/rmvercel-0911`
**Agent:** kimi (Kimi Code session `9fe8e2b1`)
**PR:** https://github.com/Gizziio/allternit-platform/pull/344
**Merge commit:** `f0c4598bc`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner: "we don't use vercel in the code base, remove the vercel." The repo
hosts on Cloudflare Pages; all Vercel *hosting* wiring in the repo was dead.
Removed:

- `.mcp.json` — `verceldeploy` MCP server (path pointed into `archive/`,
  already broken at runtime)
- `.gitignore` / `.dockerignore` — `.vercel` ignore lines
- `docs/agent-tasks/next-batch/VERCEL_AGENT_PLUGIN_ADAPTER_PHASE_1_TASK.md`
  — stale task doc for the archived plugin
- `surfaces/ai.allternit.com/src/plugins/catalog/native-plugins.ts` —
  `codex-verceldeploy-plugin` catalog entry
- `scripts/validate-codex-plugins.ts` — Phase 1 vercel check + vercel ids in
  the two expected arrays
- `docs/PLUGIN_AND_SERVICE_INTEGRATION.md` — section 1.1, diagram rows, MCP
  example, deploy example, file-table row, next-steps commands

Deliberately retained (product surface / history, not hosting):
open-connector vercel provider + icons, design-system library `vercel`
preset + style mentions, website plugin `deploymentTarget: 'vercel'`
option, `archive/`, `agent-ledger/`, vendored + THIRD_PARTY files.

## How it works

The Vercel PR checks (`Vercel – a2rchitech/allternit/platform`) come from
the Vercel GitHub App installed on the repo (projects under the gizzi-io-6138s
Vercel account) — not from code. Disconnect steps reported to owner:
github.com → Settings → Applications → Vercel (repo access), or Vercel
dashboard → delete the three projects / disconnect Git.

## Verification

- `.mcp.json` parses (`python3 -m json.tool`)
- `pnpm typecheck` (ai.allternit.com) — 0 errors
- `pnpm test` — 1650 passed / 14 skipped
- `scripts/validate-codex-plugins.ts` runs: 5p/3f (clean main: 5p/4f — the
  removed vercel check was failing; the 3 remaining failures are
  pre-existing: remotioncard/iosappbuild plugins also archived,
  ui-state.json absent)

## Known gaps / remaining work

- Vercel GitHub App disconnect + Vercel project deletion are owner dashboard
  actions (no API access from a PAT).
- `scripts/validate-codex-plugins.ts` remains mostly dead weight (checks
  archived plugins); deletion is a reasonable follow-up but was left to keep
  this session scoped.

## Files changed

- `.mcp.json`, `.gitignore`, `.dockerignore`
- `docs/agent-tasks/next-batch/VERCEL_AGENT_PLUGIN_ADAPTER_PHASE_1_TASK.md` (deleted)
- `surfaces/ai.allternit.com/src/plugins/catalog/native-plugins.ts`
- `scripts/validate-codex-plugins.ts`
- `docs/PLUGIN_AND_SERVICE_INTEGRATION.md`
