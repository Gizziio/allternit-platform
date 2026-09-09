# Agent Work Attestation — bot-identity-computer Phase 2 follow-up

**Date:** 2026-09-09 02:02
**Session ID:** 5c233b1c
**Branch:** session/5c233b1c
**Agent:** kimi-code
**Commit:** 54731db8a (PR #195 → merge 95c1eafcf)
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

User-directed Phase 2 follow-up to PR #190 (atomic Create Bot, spec
`bot-identity-computer`). Four items, all landed in one PR:

1. **Removed the replaced bot-creation path.** `CreateAgentForm` bot mode
   (`BOT_FLOW_STEPS`, `isBotMode` branching, `VMOperatorStep` inside the agent
   wizard) and the forge "launch queued" animation deleted. `CreateBotForm` is
   the single canonical bot creation UI. `AgentView` now routes bot drafts
   (studio "Create Bot" button, landing bot templates, BotHubCard/AgentGalleryCard
   duplicates) to `CreateBotForm` via a new `draft` prop + `buildInitialFormData`.
   `CreateAgentForm` itself stays — it is the only agent-creation UI.
2. **Size presets.** `BOT_DESKTOP_PRESETS` (small 1 vCPU/2 GB/50 GB, medium
   2/4/100 — the Phase 1 default, large 4/8/200), `describeDesktopResources()`,
   `presetIdForResources()` in vm-operator; preset selector cards on the Create
   Bot Computer step and in the review summary.
3. **Fleet "Provision computers" action** on the Bots hub header (shown only
   when some bot has `vmOperator.enabled`). `provisionFleetComputers()` runs
   sequentially (deliberately — does not hammer the host), skips bots without a
   computer config, and reports ready/skipped/failed counts.
4. **Watch/takeover crash fix + polish.** `BotDesktopStatus.status` type lacked
   `'creating'` while the provisioning path emits it — `statusBadge[statusValue].label`
   in `BotComputerViewport` would throw while a desktop provisions. Type widened;
   added a creating badge, header subtitle branch, and a dedicated provisioning
   panel. Status already polls every 5 s so the page self-updates.

## How it works

- Draft routing: `AgentView`'s `CreateAgentFlow` reads `draftAgent` from the
  store; `draftAgent?.isBot` renders `CreateBotForm isOpen draft={draftAgent}`,
  closing clears the draft. One shared `close` for both paths.
- Presets map 1:1 onto the existing `BotDesktopResources` shape, so persistence
  and provisioning code paths are unchanged — presets only set vCPU/RAM/disk.
- Fleet provision reuses `ensureBotComputer` per bot sequentially; results are
  aggregated into one summary line.
- Deliberate keeps: Big Five personality sliders in agent creation (runtime-read
  at `agent.service.ts:1511` via `config.personality` — effective, not theater);
  `VMOperatorStep` in `EditAgentForm` (editing an existing bot's computer is
  unrelated to creation flow); `calculateProjectedStats` (feeds the kept
  personality data path).

## Verification

- `npx vitest run src/lib/bots/` — 432/432 tests, 43 files, incl. new
  `provisionFleetComputers` suite (mocked fetch: bot-1 binds via GET only,
  bot-2 GET+POST with `persistence: 'persistent'`, bot-3 skipped, 3 fetch calls /
  1 POST total) and `bot desktop presets` suite (medium==defaults, GB math,
  presetIdForResources small/large/default/custom).
- `pnpm run typecheck:fast` — zero errors in touched files; 15 total remaining,
  all pre-existing environment issues (main's stale node_modules show 24,
  including 9 office-sheets IPreset errors that do not reproduce on a fresh
  install).
- Steering checkpoint written; commit/push gate passed.

## Known gaps / remaining work

- **No live Incus desktop was booted.** Watch/takeover changes are verified by
  static analysis (the crash was found by reading the statusBadge lookup), not
  a runtime repro against a provisioning desktop.
- Preset selector and fleet button JSX have no component-level tests (repo
  pattern: logic is unit-tested, components are not).
- Spec items not yet done (future phases, per spec): Orgo integration, pricing/
  billing, ao v3, deeper fleet management. Phase 2's "provision all bots" is now
  available as a manual hub action; automated fleet sweeps remain out of scope.

## Files changed

- `surfaces/ai.allternit.com/src/views/agent-view/components/CreateAgentForm.tsx` — bot mode + forge theater removed
- `surfaces/ai.allternit.com/src/views/agent-view/components/CreateBotForm.tsx` — draft prop, buildInitialFormData, size preset selector
- `surfaces/ai.allternit.com/src/views/AgentView.tsx` — bot drafts route to CreateBotForm
- `surfaces/ai.allternit.com/src/lib/bots/vm-operator.ts` — presets, describe/presetId helpers, provisionFleetComputers, BotDesktopStatus 'creating'
- `surfaces/ai.allternit.com/src/views/agent-hub/main/BotHubHomeTab.tsx` — fleet Provision computers action
- `surfaces/ai.allternit.com/src/views/bots/BotComputerViewport.tsx` — creating badge/subtitle/provisioning panel
- `surfaces/ai.allternit.com/src/lib/bots/vm-operator.test.ts` — fleet provision tests
- `surfaces/ai.allternit.com/src/lib/bots/bot-tool-registry.test.ts` — preset tests
