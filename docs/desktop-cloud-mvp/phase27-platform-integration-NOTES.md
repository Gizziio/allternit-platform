# Phase 27 — Desktop Cloud platform integration

## Goal
Integrate the Desktop Cloud admin surface into the authenticated Allternit React shell so operators can provision, start, stop, and deprovision bot desktops from the platform UI.

## What changed

### Backend
- `cmd/allternit-api/src/bot_desktop_admin.rs` (new, 87 LOC)
  - Added `GET /api/v1/desktop-sandboxes` to list every desktop sandbox owned by the authenticated user's bots (joins `bot_desktop_sandboxes` with `agents`).
  - Added `DesktopSandboxSummary` response struct.
  - Wired into `main.rs` alongside the other desktop routers; inherits platform auth middleware.
- `cmd/allternit-api/src/bot_desktop_routes.rs`
  - Per-feature LOC constraint required moving the global sandbox list into `bot_desktop_admin.rs`; this file is now 1,451 LOC.

### Frontend API client
- `surfaces/ai.allternit.com/src/lib/desktop-cloud-api.ts` (new, ~160 LOC)
  - Typed wrappers for:
    - `GET /api/v1/agents`
    - `GET /api/v1/desktop-templates`
    - `GET /api/v1/desktop-capacity`
    - `GET /api/v1/desktop-usage/summary`
    - `GET /api/v1/desktop-usage`
    - `GET /api/v1/desktop-sandboxes`
    - `POST /api/v1/bots/:bot_id/desktop/provision`
    - `POST /api/v1/bots/:bot_id/desktop/start`
    - `POST /api/v1/bots/:bot_id/desktop/stop`
    - `POST /api/v1/bots/:bot_id/desktop/deprovision`
  - Uses the canonical `api` singleton from `@/integration/api-client` so auth and gateway URL handling stay consistent.

### Frontend tests
- `surfaces/ai.allternit.com/src/lib/desktop-cloud-api.test.ts` (new)
  - 11 Vitest cases covering all endpoints, query-string filters, and error paths.
  - Mocks `@/integration/api-client`.

### React admin view
- `surfaces/ai.allternit.com/src/views/desktop-cloud/DesktopCloudAdminView.tsx` (new, ~580 LOC)
  - Header with refresh action.
  - Stat cards: templates, sandboxes, usage minutes, cost.
  - Provision form: pick a bot + template, call `provisionDesktop`.
  - Sandboxes table: global list with Start/Stop/Deprovision actions.
  - Templates table: OS, image, CPU, memory, disk, network.
  - Capacity panel: per-host snapshots and scale-up signal.
  - Usage panel: summary + per-row usage records.
  - Built with existing platform primitives: `Button`, `GlassSurface`, `StatusBadge`, and the agent store.

### Shell wiring
- `surfaces/ai.allternit.com/src/nav/nav.types.ts`: added `"desktop-cloud"` to `ViewType`.
- `surfaces/ai.allternit.com/src/nav/nav.policy.ts`: added spawn policy.
- `surfaces/ai.allternit.com/src/shell/ViewRegistry.tsx`: added lazy import and registry entry.
- `surfaces/ai.allternit.com/src/shell/ShellRail.tsx`: added "Desktop Cloud" rail item in the HOME TABS section.

### Demo harness
- `surfaces/ai.allternit.com/desktop-cloud-demo.html` and `src/views/desktop-cloud/demo.tsx`
  - Standalone entry point used to render the admin view against the real local API for the screen recording.

## Verification

```bash
# API endpoint smoke test
curl -s http://127.0.0.1:8013/api/v1/desktop-sandboxes
# → {"sandboxes":[]}

# Unit tests
cd surfaces/ai.allternit.com
pnpm exec vitest run src/lib/desktop-cloud-api.test.ts
# → 11 passed

# Type check for new modules
pnpm typecheck
# No errors in desktop-cloud-api.ts or DesktopCloudAdminView.tsx
# (remaining errors are pre-existing office-package/mode-session-store issues)
```

## Screen recording
- `docs/desktop-cloud-mvp/phase27-platform-integration-demo.webm` (746 KB, 12 s)
- Shows the Desktop Cloud admin view rendering live data from the local API: 3 templates, 0 sandboxes, 2h 1m usage, $6.05 cost, and a healthy Microvm capacity snapshot.

## Known environment blockers for full-shell e2e
The platform shell (`src/shell/ShellApp.tsx`) currently crashes on startup in this local environment with a React "Maximum update depth exceeded" loop originating from `useStackProviders` / `StackedAgentService.subscribe`. The loop appears unrelated to the desktop-cloud changes; it reproduces before the new view is ever opened. Additionally, the local Node version (v26.5.0) cannot compile `better-sqlite3@11.10.0`, so `pnpm install` had to run with `--ignore-scripts`, and the gizzi-code runtime needed by `/api/agent-chat` could not be started due to a missing `createAllternitClient` export in the SDK. Because of these blockers, the screen recording was captured from the standalone demo entry point, which exercises the exact same `DesktopCloudAdminView` and API client against the real backend.

## Next steps for production hardening
1. Resolve the shell startup loop so the full platform UI loads and the rail item can be clicked end-to-end.
2. Upgrade or override `better-sqlite3` to a Node-26-compatible version so a normal install succeeds.
3. Build and start the gizzi-code runtime so agent-chat bootstrapping works in dev.
4. Add a Playwright e2e test that opens the platform shell, clicks "Desktop Cloud", provisions a desktop, and verifies the sandbox appears in the table.
