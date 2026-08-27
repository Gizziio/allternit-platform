# Phase 1 — Photon.codes Backend Integration

## Goal
Add Photon.codes as a real phone/messaging provider and connector in the Allternit backend. Do not touch UI in this task.

## Files to modify

1. `surfaces/ai.allternit.com/src/lib/agents/agent.types.ts`
   - Add `'photon'` to `AgentPhoneChannel["provider"]` union.
   - Add `photonProjectId?: string`, `photonLineId?: string` to `AgentPhoneChannel`.
   - Add `photonEnabled?: boolean` to `AgentMessagingConfig` (already exists but verify).
   - Update zod schemas `agentPhoneChannelSchema` and `agentMessagingConfigSchema` accordingly.

2. `cmd/allternit-api/src/photon_routes.rs`
   - Add a new route `POST /webhooks/photon` that receives inbound Photon.codes messages.
   - Parse payload `{ from: string, to: string, body: string, channel: string, message_id: string }`.
   - Route to the recipient bot's Photon inbox (`agent_photon_inbox`).
   - Return 202 Accepted.

3. `services/open-connector/catalog/apps/photon.json`
   - Create a new provider definition for Photon.codes.
   - Auth type: `api_key`.
   - Fields: `projectId` (text), `projectSecret` (password), optional `lineId` (text).
   - Actions: `photon.send_message` (to, body), `photon.get_line` (no input).

4. `cmd/allternit-api/assets/connector_id_aliases.json`
   - Add `"photon": "photon"`.

5. `cmd/allternit-api/assets/open-design/connectors.json`
   - Add a Photon connector entry if not already present.

6. `cmd/allternit-api/assets/connectors.meta.json`
   - Add a `photon` meta entry with `auth_type: "api_key"`, `connectable: true`, `tier: 1`.

7. `cmd/allternit-api/migrations/V<next>__photon_identity.sql`
   - Add optional migration if new columns are needed (should not be needed if using JSON identity channel).

## Constraints
- Do not modify unrelated files.
- Do not run dev servers or builds.
- Do run `cargo check --package allternit-api` when done and fix any errors.
- Do run `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` for the touched TS file.

## Deliverable
When done, write `docs/PHASE1_PHOTON_BACKEND_NOTES.md` with YAML frontmatter:
```yaml
---
status: done
files_changed: []
findings: []
deviations: []
remaining: []
---
```
