---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/agents/agent.types.ts
  - cmd/allternit-api/src/allternit_bus_routes.rs
  - cmd/allternit-api/src/main.rs
  - services/open-connector/catalog/apps/photon.json
  - cmd/allternit-api/assets/connector_id_aliases.json
  - cmd/allternit-api/assets/open-design/connectors.json
  - cmd/allternit-api/assets/connectors.meta.json
  - docs/PHASE1_PHOTON_BACKEND_NOTES.md
findings:
  - agent.types.ts already had 'photon' in the AgentPhoneChannel provider union and schema; added photonProjectId and photonLineId optional fields as requested.
  - photonEnabled was already present in AgentMessagingConfig and its zod schema; no change needed there.
  - The agent_photon_inbox and agent_identity_channels tables from migration V47__agent_secrets_photon_identity.sql already provide the necessary storage, so no new migration was required.
  - The task referenced cmd/allternit-api/src/photon_routes.rs, but that file was renamed to allternit_bus_routes.rs in a prior task; the Photon webhook route was added to the renamed file instead.
deviations:
  - Implemented POST /webhooks/photon in cmd/allternit-api/src/allternit_bus_routes.rs (function allternit_bus_webhook_router) rather than photon_routes.rs because photon_routes.rs no longer exists.
  - Mounted the new public webhook router in cmd/allternit-api/src/main.rs alongside the existing Slack webhook router so the endpoint is reachable without Clerk authentication.
  - The open-connector catalog photon.json uses auth type api_key with a structured fields array (projectId, projectSecret, optional lineId) as specified, even though the existing api_key providers in the catalog use a single-key shape.
remaining:
  - pnpm exec tsc --noEmit in surfaces/ai.allternit.com reports pre-existing TypeScript errors in packages/@allternit/office-sheets-app/src/renderer/App.tsx (univerjs dependency version mismatch); these are unrelated to the Photon changes and were not fixed per the "minimal changes" constraint.
  - The rust-native connector api_key flow (connect_api_key in connector_routes.rs) expects a single api_key string, while the Photon catalog entry describes structured credentials. A follow-up Phase 1.x/Phase 2 task should align the connection handshake with the structured Photon fields or route Photon through the open-connector sidecar.
---

# Phase 1 — Photon.codes Backend Integration Notes

## Summary
Added Photon.codes as a backend phone/messaging provider and connector without touching UI code.

## Verification
- `cargo check --package allternit-api` passes with no errors (pre-existing warnings only).
- `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` shows no errors in the touched file (`agent.types.ts`) or any Photon-related code; remaining errors are pre-existing in `office-sheets-app`.

## Route details
- `POST /webhooks/photon` parses `{ from, to, body, channel, message_id }`, resolves the recipient agent by matching `phone_provider = 'photon'` and `phone_number = to` in `agent_identity_channels`, inserts into `agent_photon_inbox` with `INSERT OR IGNORE` (using `message_id` as the row id for idempotent retries), and returns `202 Accepted`.
