# Allternit browser computer-use protocol

This package exposes the canonical browser automation boundary for Allternit surfaces:

- platform web / browser-mode chat
- Gizzi browser tooling
- desktop computer-use flows
- Chrome extension active-tab execution
- provider adapters such as `browser-use` and Stagehand

The goal is one protocol and one event/receipt model across all of those surfaces. The extension should not become a parallel browser agent; it is another surface/provider that speaks the same protocol.

## API surface

The browser gateway registers these routes:

| Route | Purpose |
| --- | --- |
| `GET /v1/browser-runs/providers` | List provider capabilities. |
| `POST /v1/browser-runs` | Start a browser run and create/bind a session. |
| `GET /v1/browser-runs/:runId` | Read run/session/lease state. |
| `GET /v1/browser-runs/:runId/events` | Read ordered protocol events. |
| `POST /v1/browser-runs/:runId/observe` | Capture an accessibility/semantic observation. |
| `POST /v1/browser-runs/:runId/actions` | Execute one leased protocol action. |
| `POST /v1/browser-runs/:runId/skill` | Compile the committed trajectory to a reusable workflow + skill manifest. |
| `POST /v1/browser-runs/:runId/complete` | Mark the run complete. |
| `POST /v1/browser-runs/:runId/cancel` | Cancel the run. |

Start request shape:

```json
{
  "accountId": "local",
  "conversationId": "browser",
  "objective": "Open Example Domain and capture the page heading.",
  "provider": "local-playwright",
  "startedBy": "api"
}
```

Action execution shape:

```json
{
  "lease": {
    "leaseId": "lease-id",
    "runId": "run-id",
    "ownerSurfaceInstanceId": "api:local",
    "issuedAt": "2026-07-11T04:00:00.000Z",
    "expiresAt": "2026-07-11T04:05:00.000Z",
    "epoch": 1,
    "nonce": "0123456789abcdef"
  },
  "action": {
    "schemaVersion": "1.0",
    "actionId": "action-navigate",
    "runId": "run-id",
    "sessionId": "session-id",
    "kind": "navigate",
    "reason": "Open the target page.",
    "input": { "url": "https://example.com/" }
  }
}
```

## Repeatable workflow capture

Every successful browser task should be treated as a candidate workflow:

1. Start a run with a clear `objective`.
2. Execute atomic actions through `/actions`.
3. Observe after material page changes.
4. Complete the run once the outcome is verified.
5. Call `/skill` to produce:
   - `workflow`: replayable browser steps with redacted parameter inputs.
   - `manifest`: installable/discoverable skill metadata.

The compiler only includes committed actions. Sensitive free-text inputs are parameterized and recorded in `workflow.safety.redactions`.

## Provider and extension parity

Provider IDs are canonical:

- `local-playwright`
- `extension-tab`
- `browser-use`
- `stagehand`

The Chrome extension uses the same shared package, `@allternit/computer-use-protocol`, for `ExecutionLease`, `ActionIntent`, events, and receipts. Backend messages to the extension should use:

```json
{
  "type": "computer_use.action",
  "payload": {
    "surfaceInstanceId": "extension-surface-id",
    "tabId": 123,
    "lease": {},
    "action": {}
  }
}
```

The extension maps that protocol action to its legacy `BROWSER.*` executor internally, then returns:

```json
{
  "type": "computer_use.events",
  "payload": {
    "events": [],
    "receipt": {}
  }
}
```

This keeps extension, desktop, platform, Gizzi, and remote providers aligned at the protocol boundary even when the local execution mechanism differs.

## Debug extension / native browser-mode harness

Allternit browser mode and the debug Chrome extension use the same native messaging host:

```text
com.allternit.desktop
```

The native host registration lives in:

```text
surfaces/allternit-extensions/native-host
```

Register it with a concrete extension id:

```bash
ALLTERNIT_EXTENSION_ID=<32-character-chrome-extension-id> pnpm --filter @allternit/desktop-native-host register
```

For Allternit browser mode or any computer-use harness that launches Chromium with a custom `--user-data-dir`, also install the host manifest into that profile:

```bash
pnpm --filter @allternit/desktop-native-host register -- --extension-id <id> --profile-dir <browser-user-data-dir>
```

Dry-run/doctor:

```bash
pnpm --filter @allternit/desktop-native-host run doctor -- --extension-id <32-character-chrome-extension-id>
```

The installer creates an executable wrapper and native messaging manifests with exact `allowed_origins`. Do not use `chrome-extension://*/`; Chrome native messaging requires concrete extension origins.

This is the required bridge for parity with systems that expose browser-use/computer-use as a harness capability: the extension is the active-tab provider, the browser gateway is the API/session/event layer, and both emit the same protocol receipts.

Repeatable extension/native-host/browser-mode smoke:

```bash
pnpm --filter @allternit/extension exec wxt build --mode development --browser chrome --mv3
pnpm --filter @allternit/desktop-native-host smoke:browser-mode
```

Expected result: `ok: true`, service worker URL under the deterministic Allternit extension id, content readiness equal to that extension id, and a native `pong` through the TCP `3011` bridge.

## Live smoke checklist

Use a real Chrome binary with a clean CDP port:

```bash
pnpm --filter @allternit/browser build
```

Start the server from `dist` and then run the API flow:

1. `GET /v1/browser-runs/providers`
2. `POST /v1/browser-runs`
3. `POST /v1/browser-runs/:runId/actions` with `kind: "navigate"`
4. `POST /v1/browser-runs/:runId/observe`
5. `GET /v1/browser-runs/:runId/events`
6. `POST /v1/browser-runs/:runId/skill`
7. `POST /v1/browser-runs/:runId/complete`

Expected result for the Example Domain smoke:

- provider list includes `local-playwright`
- navigation emits `action.state_changed` and `receipt.issued`
- observation title is `Example Domain`
- skill output contains one committed `navigate` step
- run state becomes `completed`

## Current Chrome/CDP compatibility notes

Modern Chrome requires `PUT /json/new?...` for new targets. Using `GET` returns a non-JSON warning such as `Using unsafe HTTP verb GET...`.

Chrome target creation returns `id`; the browser gateway normalizes it to `targetId` internally.

Semantic observations must not emit refs with empty selectors. Root nodes should resolve to `html` / `body`; unresolved selectors are omitted from refs.

## Validation commands

```bash
pnpm --filter @allternit/browser build
pnpm --filter @allternit/browser test -- src/browser/__tests__/cdp.test.ts src/browser/__tests__/snapshot.test.ts src/protocol/run-controller.test.ts

pnpm --filter @allternit/extension test
pnpm --filter @allternit/extension build

pnpm --filter @allternit/computer-use-protocol build
pnpm --filter @allternit/computer-use-protocol test
```
