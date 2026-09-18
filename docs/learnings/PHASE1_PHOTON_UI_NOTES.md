---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/agents/agent.types.ts
  - surfaces/ai.allternit.com/src/lib/bots/identity-connector-map.ts
  - surfaces/ai.allternit.com/src/lib/design/connector-icon-map.ts
  - surfaces/ai.allternit.com/src/views/agent-view/steps/IdentityChannelsStep.tsx
  - surfaces/ai.allternit.com/src/views/bots/BotRuntimeConfigModal.tsx
findings:
  - Added 'photon' to AgentPhoneChannel provider union and zod schema so the UI select value is type-safe.
  - Added photon connector mapping (id: photon, provider: photon, label: Photon.codes) to identity-connector-map.ts.
  - Added photon icon entry to connector-icon-map.ts pointing to photon.png; no such icon asset currently exists in public/icons/connectors/, so the UI will fall back to its default connector logo behavior.
  - IdentityChannelsStep.tsx and BotRuntimeConfigModal.tsx both now render Photon Project ID, Project Secret (password), optional Line ID inputs, and a free-tier callout when Photon.codes is selected.
  - Connect button in both surfaces seals PHOTON_PROJECT_ID, PHOTON_PROJECT_SECRET, PHOTON_LINE_ID (when provided), and BOT_PHONE_NUMBER via sealAgentSecret, then records a photon connector binding.
  - BotRuntimeConfigModal persists provider/number/voice/sms state through the existing updateAgent call in handleSave.
deviations:
  - The task spec listed 4 files to modify, but agent.types.ts was also updated so the new 'photon' provider value passes TypeScript without casting or type suppression.
remaining:
  - Add a real Photon.codes icon asset at public/icons/connectors/photon.png if the fallback logo is not acceptable.
  - Pre-existing type errors in packages/@allternit/office-sheets-app/src/renderer/App.tsx (univerjs preset IPreset mismatch) still cause pnpm exec tsc --noEmit to exit non-zero; these are unrelated to Photon UI work and were not fixed.
---

# Phase 1 — Photon.codes UI Integration Notes

## Verification

Ran:

```bash
cd surfaces/ai.allternit.com
pnpm exec tsc --noEmit
```

No TypeScript errors were introduced in the modified files. The only remaining errors are pre-existing and located in `packages/@allternit/office-sheets-app/src/renderer/App.tsx`.
