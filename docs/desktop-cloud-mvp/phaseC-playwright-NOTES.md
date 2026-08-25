# Phase C — Playwright end-to-end test for Desktop Cloud provisioning

## Goal
Add an automated end-to-end test that proves a user can provision, start, stop,
and deprovision a bot desktop from inside the authenticated Allternit React
shell, and record the run as a `.webm` screen-capture artifact.

## What changed

### Frontend
- `surfaces/ai.allternit.com/src/views/desktop-cloud/DesktopCloudAdminView.tsx`
  - Merged the canonical `/api/v1/agents` list with the agent store's
    validated list so desktop-only bots are not dropped by the strict
    `agentSchema` validation.
  - Added `data-testid="sandboxes-table"` to the sandboxes table so the test
    can scope row lookups to the correct table.
- `surfaces/ai.allternit.com/src/lib/agents/agent.types.ts`
  - Extended `AgentType` enum with `'assistant'`.
  - Extended `trustTier` enum with `'medium'`.
  - These values are returned by the real backend for API-created test bots;
    rejecting them caused the store to silently hide the test bot.

### Backend
- `cmd/allternit-computer-cloud/src/tart.rs`
  - `TartDriver::spawn` now polls the Tart host wrapper until the VM reports
    `running` before returning, matching the synchronous guarantee already
    provided by `IncusDriver`.
- `cmd/allternit-api/src/bot_desktop_routes.rs`
  - `provision_desktop` now stores and returns `"running"` after a successful
    spawn because both drivers block until the guest is ready.
  - `deprovision_desktop` deletes the DB record immediately and runs
    `driver.destroy()` in a background task so the HTTP response is fast and
    the UI removes the row right away.
  - Updated `deprovision_desktop_calls_destroy_and_deletes_record` unit test
    to poll for the background `destroy` call.

### Test
- `surfaces/ai.allternit.com/tests/desktop-cloud.spec.ts`
  - New Playwright test that:
    1. Opens the platform shell.
    2. Clicks "Desktop Cloud" in the rail.
    3. Selects `desktop-cloud-e2e-bot` and `macOS Desktop (macos)`.
    4. Provisions the desktop and waits for the sandbox row to show `running`.
    5. Stops the desktop and waits for `stopped|paused`.
    6. Deprovisions the desktop and waits for the row to disappear.
    7. Asserts no Desktop Cloud console/page errors.
  - Records video (`test.use({ video: 'on' })`) for the phase-C artifact.

## Preconditions for the test
The test expects a bot named `desktop-cloud-e2e-bot` owned by the local dev
user. Create it with:

```bash
curl -s -X POST http://127.0.0.1:8013/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "desktop-cloud-e2e-bot",
    "description": "Test bot for Desktop Cloud end-to-end test",
    "model": "gpt-4o",
    "provider": "openai",
    "type": "assistant",
    "harness": { "mode": "local" },
    "trust_tier": "medium",
    "allowed_surfaces": ["chat"]
  }'
```

## How to run

```bash
cd surfaces/ai.allternit.com
pnpm exec playwright test tests/desktop-cloud.spec.ts --project chromium --reporter=list
```

The screen recording is saved automatically by Playwright under
`test-results/output/*/video.webm`. Copy the successful run's video to the
phase-C artifact path:

```bash
cp test-results/output/*/video.webm \
   ../../docs/desktop-cloud-mvp/phaseC-playwright-demo.webm
```

## Proof
- Screen recording: `docs/desktop-cloud-mvp/phaseC-playwright-demo.webm`
  (shows the full authenticated shell flow: open Desktop Cloud, provision,
  running, stop, deprovision, row disappears).

## Tests pass
- `pnpm exec playwright test tests/desktop-cloud.spec.ts --project chromium`
  (1 passed)
- `pnpm exec vitest run src/lib/desktop-cloud-api.test.ts` (11 passed)
- `cargo test -p allternit-api` (464 passed)
- `cargo test -p allternit-computer-cloud` (24 passed)

## LOC check
- `DesktopCloudAdminView.tsx`: ~580 LOC
- `desktop-cloud-api.ts`: ~160 LOC
- `bot_desktop_admin.rs`: 87 LOC
- `bot_desktop_routes.rs`: 1,451 LOC
- `tart.rs`: ~350 LOC

All feature modules remain under the 1,500 LOC limit.
