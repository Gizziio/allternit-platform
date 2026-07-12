# ADR-0042: One Allternit Browser Agent Across Platform, Desktop, Gizzi, and Extension

- **Status:** Accepted
- **Date:** 2026-07-10
- **Owners:** Browser Platform / Computer Use

## Decision

Allternit will operate one Browser Agent service and one computer-use protocol across Platform Web, Allternit Desktop, Gizzi, and the Chrome extension.

The Chrome extension is a secure transport, current-tab capability adapter, and UI host. It is not an independent agent runtime. It must not own a separate planner, run state machine, approval system, workflow format, skill registry, or durable conversation store.

The canonical layers are:

1. `@allternit/computer-use-protocol`: dependency-light schemas and wire contracts.
2. Browser capability orchestrator: owns runs, routing, policy, approvals, receipts, and provider negotiation.
3. `@allternit/browser`: canonical local Playwright/CDP provider and supervisor.
4. Provider adapters: existing-browser extension transport, Browser Use, Stagehand/Browserbase, and future providers.
5. Shared clients/view model: Platform Web, Desktop, Gizzi, and extension side panel.
6. One trajectory-to-skill service and registry shared by all surfaces.

## Cross-surface invariant

A run has one `runId`, `conversationId`, `accountId`, action timeline, approval state, artifact set, receipt chain, and optional skill candidate regardless of which surface starts, watches, approves, interrupts, or completes it.

Surfaces negotiate capabilities; they do not fork behavior. A run may hand off between Platform, Desktop, and extension. The current execution lease has one owner at a time while any authorized surface may observe it.

## Provider invariant

Local Playwright/CDP, an attached extension tab, Browser Use, and Stagehand/Browserbase implement the same provider interface and conformance suite. Unsupported capabilities are declared before execution and never silently emulated with weaker behavior.

## Security boundary

The extension and local device bridge use paired-device identity, short-lived execution leases, origin-bound messages, schema validation, redaction, and explicit capability grants. Private/LAN/localhost resources stay local unless policy explicitly permits otherwise. Redirect targets are revalidated.

## Existing component disposition

| Component | Decision |
|---|---|
| `sdk/computer-use` | Public client; migrate its wire types to the protocol package. |
| `infrastructure/chrome-stream/agent-systems/allternit-browser` | Canonical local browser provider after foundation repairs. |
| `surfaces/allternit-extensions/allternit-extension` | First-class companion transport and shared UI host; remove parallel orchestration. |
| `packages/@allternit/browser-tools` | Migrate useful actions/safety to provider/orchestrator; then reduce or retire. |
| `api/services/browser-runtime` | Duplicate runtime; migrate consumers and retire. |
| `services/runtime/runtime/browser-runtime` | Duplicate runtime; migrate consumers and retire. |
| Platform `browserAgent.store` | Replace with the shared run view model in stages. |
| Extension page-agent packages | Retain only current-tab observation/action primitives needed by the extension adapter. |
| Computer-use plugin skills/cookbooks | Seed material for the verified trajectory-to-skill compiler. |

## Parity gate

Local, cloud, and extension modes must be tested for navigation, focused snapshots, refs, clicking, typing, scrolling, tabs, frames, dialogs, upload/download, extraction, screenshots, approvals, interruption, recovery, recording, replay, receipts, and skill promotion. A release cannot claim parity when a capability is missing or unverified.

## Consequences

- No new browser execution core may be added outside the provider interface.
- Extension features must begin in the shared protocol/view model unless they are Chrome-specific transport primitives.
- Duplicate runtimes are deleted only after consumer and conformance evidence is complete.
- Raw trajectories are evidence, not trusted skills; promotion requires sanitization, verification, tests, provenance, and human approval.

