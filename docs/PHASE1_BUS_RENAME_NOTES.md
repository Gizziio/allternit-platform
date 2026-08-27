---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/messaging/allternit-bus.types.ts
  - surfaces/ai.allternit.com/src/lib/messaging/allternit-bus.service.ts
  - surfaces/ai.allternit.com/src/lib/messaging/index.ts
  - surfaces/ai.allternit.com/src/lib/bots/bot-allternit-bus.ts
  - surfaces/ai.allternit.com/src/lib/bots/bot-allternit-bus.test.ts
  - surfaces/ai.allternit.com/src/lib/bots/useStartBotSession.ts
  - cmd/allternit-api/src/allternit_bus_routes.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
  - docs/PHASE1_BUS_RENAME_NOTES.md
findings:
  - "cargo check --package allternit-api passes (only pre-existing warnings remain)."
  - "pnpm exec tsc --noEmit has no errors in the renamed files or their direct consumers."
  - "The full repo pnpm exec tsc --noEmit still fails because of pre-existing, unrelated type errors in packages/@allternit/office-sheets-app, office-pdf-app, and office-slides-app (missing assets / @univerjs / harfbuzzjs types)."
  - "No remaining code references to the old identifiers (PhotonClient, createPhotonClient, useBotPhotonStore, photon_routes, photon_router, etc.)."
deviations:
  - "External route paths were intentionally kept unchanged for backward compatibility: /api/v1/photon/* and /webhooks/photon."
  - "Domain schema fields messagingConfig.photonEnabled and messagingConfig.photonEndpoint were left unchanged because they refer to the Photon.codes integration, not the internal bus."
  - "Environment variable names ALLTERNIT_PHOTON_URL and NEXT_PUBLIC_PHOTON_URL were left unchanged as external configuration contracts."
  - "SQLite table agent_photon_inbox and the phone_provider = 'photon' enum value were left unchanged to avoid a migration in Phase 1."
  - "Markdown docs (AUTONOMOUS_BOT_PRIMITIVES.md, BOT_AGENT_CONTRACT.md) still cite the old file paths; they are not compiled and were left out of scope."
remaining:
  - "Resolve pre-existing TypeScript errors in packages/@allternit/office-* before the full pnpm exec tsc --noEmit command will pass."
  - "Optionally update markdown docs to reference the new allternit-bus filenames."
---

# Phase 1 — Rename Internal Photon Bus

Completed the rename of Allternit's internal messaging bus from "Photon" to "AllternitBus".

## What changed

- **TypeScript messaging layer**
  - `photon.types.ts` → `allternit-bus.types.ts`
  - `photon.service.ts` → `allternit-bus.service.ts`
  - Types renamed: `AllternitBusClient`, `AllternitBusClientConfig`, `AllternitBusEnvelope`, `AllternitBusSendOptions`, `AllternitBusMessageKind`, `AllternitBusPriority`, `AllternitBusSubscription`.
  - Factory function renamed: `createAllternitBusClient`.

- **Bot manager**
  - `bot-photon.ts` → `bot-allternit-bus.ts`
  - `bot-photon.test.ts` → `bot-allternit-bus.test.ts`
  - Store/hook/types renamed: `useBotAllternitBusStore`, `useBotAllternitBusStatus`, `BotAllternitBusState`.

- **Rust API**
  - `cmd/allternit-api/src/photon_routes.rs` → `cmd/allternit-api/src/allternit_bus_routes.rs`
  - Router function renamed: `allternit_bus_router()`.
  - Internal message struct renamed: `AllternitBusMessage`.
  - Inbound webhook payload struct renamed: `AllternitBusWebhookPayload`.
  - `lib.rs` and `main.rs` imports updated.

- **Consumers updated**
  - `src/lib/messaging/index.ts`
  - `src/lib/bots/useStartBotSession.ts`

## Verification

```bash
cd /Users/joe/Desktop/allternit-workspace/allternit
cargo check --package allternit-api
# passes

cd surfaces/ai.allternit.com
pnpm exec tsc --noEmit
# fails only on pre-existing, unrelated office-* package errors
```

The renamed files and their consumers are error-free.
