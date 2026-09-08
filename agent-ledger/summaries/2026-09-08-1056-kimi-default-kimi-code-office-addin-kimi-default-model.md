# Agent Work Attestation — Office add-in default chat model → Kimi

- **Date:** 2026-09-08 10:56
- **Session ID:** kimi-default
- **Branch:** `session/kimi-default`
- **Agent:** kimi-code
- **PR:** #148 → merge `e1eb3d56b86d7a30d3927025e9a14218f8ac215f`

## What was done

Owner directive: "you are using the wrong model, use kimi cli". Changed the
Office add-in's last-resort `DEFAULT_OFFICE_MODEL` from `claude-3-5-sonnet`
(which 400s model_not_found on this deployment) to `kimi-for-coding` — the
model id of the gizzi `kimi-cli` provider (Kimi CLI subprocess) in
`~/.config/gizzi-code/config.json`.

Follow-up to PR #145 (model resolution): since the gateway currently rejects
`ak-…` keys on `GET /v1/models`, catalog resolution falls back to this
hard-coded default in practice, so the default must be a model the local
stack actually serves.

## How it works (file:line, at merge commit)

- `…/allternit-office-addin/src/lib/agent-defaults.ts` —
  `DEFAULT_OFFICE_MODEL = 'kimi-for-coding'` with doc comment (desktop gizzi
  kimi-cli provider; operator overrides server-side or in the panel; catalog
  auto-resolution still wins when the gateway exposes an ak--readable model
  list). New `LEGACY_OFFICE_MODEL = 'claude-3-5-sonnet'`.
- `…/allternit-office-addin/src/agent/useOfficeAgent.ts` —
  `resolveRuntimeConfig` unset-sentinel checks both constants, so stored
  configs from before model resolution keep resolving from the catalog
  instead of flipping to honored-explicit `claude-3-5-sonnet` (would have
  been a #145 regression).
- `…/allternit-office-addin/README.md` — configuration section rewritten for
  the layered resolution + new default.
- Tests: `useOfficeAgent.test.ts` legacy case uses `LEGACY_OFFICE_MODEL`;
  new case: stored value equal to the current default is treated as unset
  and resolved from the catalog.

## Verification

- `npm run typecheck` ✅, `npm test` ✅ 158/158 (1 new), `npm run build` ✅
- Live re-check attempted: minted a fresh `ak-…` key and probed
  `POST /v1/chat/completions` with model `kimi-for-coding` → gateway 502
  "Gizzi runtime unreachable" — the local gizzi on 4096 is down (desktop app
  not running; same flaky-runtime condition as prior sessions). The 200
  end-to-end result is the earlier shell verification cited in the owner
  directive. Probe key `kimi-default-verify` revoked (200) after the attempt.

## Honest deferrals

- No fresh live 200 for `kimi-for-coding` from this session (gizzi down);
  relied on the prior shell verification.
- Gateway-side gap from PR #145 (ak- keys rejected on `/v1/models`) is still
  open; tracked there.

## Files changed (PR #148)

- `…/allternit-office-addin/src/lib/agent-defaults.ts`
- `…/allternit-office-addin/src/agent/useOfficeAgent.ts`
- `…/allternit-office-addin/src/agent/useOfficeAgent.test.ts`
- `…/allternit-office-addin/README.md`
- `.steering/checkpoint.md` (steering checkpoint)
