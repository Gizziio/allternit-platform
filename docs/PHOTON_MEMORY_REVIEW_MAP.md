# Photon + Memory Review Map

> Status: needs review  
> Scope: `surfaces/ai.allternit.com/src/views/bots/BotRuntimeConfigModal.tsx`, `surfaces/ai.allternit.com/src/views/agent-view/steps/IdentityChannelsStep.tsx`, internal Photon messaging, Memory Kernel architecture.

## What was changed in this session

1. `src/views/bots/BotRuntimeConfigModal.tsx`
   - Added `Cloud` icon import and `AgentMessagingConfig` type import.
   - Added state: `messagingEnabled`, `messagingEndpoint`, `messagingCrossSurface`, `messagingSurfaces`.
   - Added a "Photon Cloud Messaging" card in the Identity tab.
   - Added `messagingConfig` to `handleSave` and dependency array.

2. `src/views/agent-view/steps/IdentityChannelsStep.tsx`
   - Replaced the small "Cloud Messaging" checkbox section with a full "Photon Cloud Messaging" card.

## Critical context discovered during the session

- **Photon is a third-party service**: https://photon.codes. It operates **Spectrum**, an open-source SDK + cloud platform that connects agents to iMessage, WhatsApp, Telegram, Slack, SIP voice, etc. It is NOT Allternit's internal bus.
- Allternit already has internal code named `photon` (`src/lib/messaging/photon.service.ts`, `src/lib/bots/bot-photon.ts`, `cmd/allternit-api/src/photon_routes.rs`). This appears to be either a naming collision or an early placeholder that was never wired to the real Photon.codes service.
- The user explicitly corrected the assumption that Photon is internal. They want the real Photon.codes integration and the Memory Kernel overhaul.

## Internal Photon bus (what exists today)

- `cmd/allternit-api/src/photon_routes.rs`: SQLite-backed inbox, secrets, connector resolution, identity channels, cross-surface bridge stub.
- `src/lib/messaging/photon.service.ts`: EventSource/SSE client, send/subscribe helpers.
- `src/lib/bots/bot-photon.ts`: Zustand store managing per-bot Photon clients.
- It sends real JSON envelopes between bots/surfaces, but the bridge endpoint is a stub and transport is SSE + SQLite polling.

## Memory Kernel (what exists today)

- Tables: `memory_documents`, `memory_events`, `memory_entities`, `memory_edges`, `session_memory`, `beta_memory_stores`, `memory_reconstruction_jobs`.
- `memory_routes.rs` proxies queries to an external memory agent sidecar (`state.config.memory_url()`).
- `local_brain_routes.rs` provides keyword search fallback.
- Frontend: `MemoryKernelView.tsx` visualizes events/entities/edges.
- The architecture is sidecar-dependent and feels dated compared to 2026 agent memory systems (Hindsight, Mem0, Graphiti).

## Review goals

1. **Photon/messaging review (Kimi)**: Is the recent UI work correct? Should the internal "Photon" be renamed? What is the real integration path for Photon.codes Spectrum?
2. **Memory Kernel review (Agy)**: What is wrong with the current memory architecture? Propose a concrete no-Docker overhaul that keeps everything in the existing Rust/SQLite backend.

## Deliverable sentinel

When finished, write `docs/PHOTON_MEMORY_REVIEW_NOTES.md` with YAML frontmatter:

```yaml
---
agent: <kimi|agy>
status: done|blocked
files_reviewed: [paths]
findings: [list]
recommendations: [list]
deviations: []
remaining: []
---
```

Then prose notes.
