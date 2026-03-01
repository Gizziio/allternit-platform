# A2R Usage Integration Notice

## Purpose
Clarify how A2R Usage telemetry, plugin orchestration, and the conversation/monitoring UI fit into the broader A2R platform. This notice belongs in the shared `docs/a2rchitech-notice` area so the team can reference architecture, gateway contracts, and work-in-progress dependencies.

## Architecture Summary
1. **Plugin execution host**
   - `4-services/a2r-operator/src/plugin_engine.py` now drives the A2R Usage probe engine via Python + QuickJS. Each plugin runs inside QuickJS and feeds back normalized `TelemetrySnapshot` records (streams, provider metadata, timeline entries) through the operator’s API.
   - The operator exposes these telemetry snapshots over its HTTP/WS surface so `5-ui/a2r-platform` and the agent system rails can request active provider lists, statuses, and per-timeline datapoints.

2. **Gateway path**
   - Operator ➜ Rails agent system (provider list & telemetry snapshots) ➜ UI components and monitoring overlay.
   - `useTelemetrySnapshot` (UI hook) merges operator data with rail thread/session metadata so monitors display a shared timeline and session-linked provider statuses.
   - UI surfaces: `MailMonitorPanel` (existing tab) and the forthcoming conversation monitor overlay/shortcut (global shortcut command, read-only timeline) both consume the normalized snapshot data for consistent telemetry.

3. **A2R Usage UI host**
   - The original telemetry UI is now translated into an Electron-friendly layer at `5-ui/a2r-platform/src/a2r-usage` with `electron-preload.ts` hooking into the shell.
   - `6-apps/shell-electron/preload/index.ts` exposes the refresh handles (auto-update timer, plugin refresh, settings) required by the telemetry UI so the dashboard behaves identically despite the runtime change.

## Architectural Gateways & Contracts
- **TelemetrySnapshot contract** (see `4-services/a2r-operator/src/telemetry.py`): includes `providerId`, `providerName`, `state`, `timeline[]`, `sessionThreadId`, `lastUpdated`, etc. Operators must normalize QuickJS probe output into this shape.
- **Provider registry API**: returns `[{ id, name, state: 'active'|'inactive', lastHeartbeat, timeline: TelemetrySnapshot[] }]`. UI components mark active/inactive providers via this endpoint and display timeline chips.
- **Conversation monitor gating**: shares `threadId` from rail sessions so monitors can stream telemetry alongside chat transcripts. The overlay should be read-only and triggered via command palette shortcut; avoid adding another input bar that conflicts with chat inputs.

## Dependencies & Environment Guidance
- **QuickJS**: install inside a dedicated Python venv to comply with PEP 668. Example:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  pip install quickjs
  ```
  If network access is restricted, download `quickjs-<version>-*.whl` separately, copy it into `~/Downloads`, and run `pip install --no-index --find-links=~/Downloads quickjs`.
- **A2R Usage UI assets**: maintain under `5-ui/a2r-platform/src/a2r-usage`, with `electron-preload.ts` hooking into `6-apps/shell-electron/preload/index.ts`. This folder is purely for the telemetry UI code and should not mix with backend/operator docs.

## Action Items Reminder
1. Finish the QuickJS-based plugin host and telemetry normalization in `4-services/a2r-operator`.
2. Enhance `useTelemetrySnapshot`, mail monitor view, and the conversation monitor overlay/shortcut command to consume provider lists and timeline data.
3. Maintain the Electron preload/IPC layer so A2R Usage runs inside the Electron shell (maintain refresh/settings hooks under `6-apps/shell-electron/preload`).

Document any additional requirements or constraints here so everyone understands the next milestones for this new integration.