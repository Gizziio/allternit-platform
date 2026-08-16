# Phase 1 — Photon.codes UI Integration

## Goal
Update the bot identity UI to treat Photon.codes as a first-class phone/messaging provider with free-tier limits clearly shown.

## Files to modify

1. `surfaces/ai.allternit.com/src/views/agent-view/steps/IdentityChannelsStep.tsx`
   - Add `photon` to the phone provider Select.
   - When `photon` is selected, show:
     - Project ID input
     - Project Secret input (password)
     - Optional Line ID input
     - Free-tier limit callout:
       - Shared iMessage line on free tier
       - Rate limits apply
       - Dedicated lines require upgrade
   - Connect button seals `PHOTON_PROJECT_ID`, `PHOTON_PROJECT_SECRET`, `PHOTON_LINE_ID` via `sealAgentSecret`.

2. `surfaces/ai.allternit.com/src/views/bots/BotRuntimeConfigModal.tsx`
   - Add the same Photon provider UI to the Phone card.
   - Ensure state is saved via `updateAgent`.

3. `surfaces/ai.allternit.com/src/lib/bots/identity-connector-map.ts`
   - Add `photon` connector mapping to phone identity channel.

4. `surfaces/ai.allternit.com/src/lib/design/connector-icon-map.ts` (if exists)
   - Add Photon icon mapping.

## Constraints
- Match existing Allternit UI patterns (rounded cards, `var(--bg-card)`, `var(--border-subtle)`, etc.).
- Do not run dev servers.
- Do run `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` and fix errors.

## Deliverable
When done, write `docs/PHASE1_PHOTON_UI_NOTES.md` with YAML frontmatter:
```yaml
---
status: done
files_changed: []
findings: []
deviations: []
remaining: []
---
```
