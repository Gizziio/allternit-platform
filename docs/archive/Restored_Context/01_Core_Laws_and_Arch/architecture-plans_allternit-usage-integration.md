# Allternit Usage Telemetry Blueprint

Allternit Usage is the in-house telemetry experience inspired by the OpenUsage plugin-driven design: every provider stays pluggable, metrics surface in a single live panel, and usage/cost signals stay visible across views. Implementing it inside Allternit means absorbing those plugin patterns, normalization logic, and refresh choreography, then exposing the shared schema to the mail monitor, conversation overlay, and plugin dashboard without carrying the upstream branding.

## Goals
1. Normalize telemetry across vendors (Claude, OpenAI, Cursor, etc.) into a single `TelemetrySnapshot` schema (`tokenUsage`, `cost`, `toolCalls`, `modelUsage`, `timeline`, `status`).
2. Treat each vendor as a pluggable provider, mirroring OpenUsage’s “Every provider is a plugin” promise, so we can onboard new sources without UI changes.
3. Surface the normalized telemetry through the existing Live Monitor, conversation panel, and plugin registry without vendor-specific UI logic.

## Proposed Architecture
1. **Telemetry plugins** (`src/lib/telemetry/providers/*`): each provider exports `probeUsage(sessionId)` that pulls vendor-specific API data (OpenAI Usage, Claude receipts, etc.) and returns a shared `TelemetrySnapshot`. Provide helpers for caching, rate limiting, and refresh scheduling (e.g., every 30s to match the OpenUsage rhythm).
2. **Telemetry orchestrator** (`src/lib/telemetry/allternit-usage.ts`): loads provider plugins via a registry, merges results, and exposes a canonical API (REST endpoints in `allternit-operator` and the front-end telemetry store) that the UI can consume. Support toggling providers on/off in a way that mirrors the original plugin list while remaining fully Allternit-branded.
3. **Operator integration**: add new `/v1/telemetry/sessions` and `/v1/telemetry/providers` endpoints to `services/allternit-operator/src/main.py`, secured by the existing API key, so the UI can fetch the latest snapshots and provider health status.
4. **UI wiring**: build a new `telemetry` store that hits the operator endpoints and feeds data into `MonitorView`, the upcoming conversation monitor companion, and the plugin dashboard, ensuring everything renders `TelemetrySnapshot` fields regardless of vendor origin.

## Next Steps
1. Implement the shared `TelemetrySnapshot` schema (tokens/costs/toolCalls/timeline/status) in `src/lib/telemetry/schema.ts` and hook it into `SessionAnalytics` so the mail monitor already consumes it.
2. Create the provider registry + OpenUsage orchestrator (with an adapter for Claude receipts and one for OpenAI usage as proof-of-concept) inside the operator service; expose refresh scheduling and health-check endpoints.
3. Update the UI components (`MonitorView`, conversation monitor, plugin registry) to rely on `telemetry` store data instead of hardcoded Claude flows, and document how to add new provider plugins.
