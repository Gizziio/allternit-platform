# ARCHIVED 2026-07-22 — services/computer-use-operator

Superseded by the ACU engine at `domains/computer-use/core` (gateway :8760),
per `research/COMPUTER-USE-FULL-INTEGRATION-MASTER-PLAN.md` (Jul 15).

Runtime verification on 2026-07-22 proved this service was **already broken
with its primary consumer**: every `/v1/execute` response failed gizzi-code's
`ComputerUseResponse` zod schema (adapter name in the `mode` field). ACU's
responses pass the same schema.

All consumers were repointed to ACU (:8760) before archiving:
- `cmd/gizzi-code/.../browser.ts` (URL, auto-start, adapter-preference mapping)
- `cmd/gizzi-code/packages/sdk/src/capabilities/computer.ts`
- `sdk/allternit-sdk/src/ai-runtime/capabilities/computer{,-use}.ts`
- `domains/kernel/core/src/operator/orchestrator.ts` (vision screenshot → ACU execute/screenshot)
- `services/gateway/unified`, `services/gateway/http/runtime`, gizzi extension health
- `surfaces/ai.allternit.com/.../useAllternitOperatorStatus.ts`

## Salvage candidates (not ported — restore from here if needed)
- `src/browser_use/`, `allternit_vision/`, `brain_adapter.py` — VLM `propose`
  logic; ACU has no equivalent endpoint.
- `vision/` (`@allternit/ui-tars`) — zero dependents at archive time.

## Known defects at archive time (do not revive without fixing)
- Hardcoded default API key `allternit-operator-key` (src/main.py:73)
- `/v1/execute` had no auth
- Response envelope incompatible with gizzi-code zod schema
