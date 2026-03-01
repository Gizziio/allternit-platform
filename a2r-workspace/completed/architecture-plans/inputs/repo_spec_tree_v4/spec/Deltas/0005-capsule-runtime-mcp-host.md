# /spec/Deltas/0005-capsule-runtime-mcp-host.md — Capsules via MCP Apps + Thin Shell Overlay

Date: 2026-01-27
Status: PROPOSED

## Intent

Add the MVP primitives observed in MiniMax/Kimi/Claude: (1) a global thin-chat overlay as the control plane, and (2) an interactive capsule runtime compatible with MCP Apps (UI-returning tools). Capsules are first-class miniapps (tables, dashboards, forms, inspectors) and include a browser capsule for agent work.

This delta formalizes contracts, sandboxing, permissioning, and receipts so capsule interactivity does not violate A2R law invariants.

## Non-negotiables (Law alignment)

- Every capsule action that can trigger tool calls MUST carry WIH context (graph_id/task_id/run_id) and respect tool registry + write-scope.
- Capsule UI is sandboxed. It cannot directly access filesystem/network/credentials; it must request through the host bridge.
- All capsule-emitted artifacts MUST be written under `/.a2r/` and appear in run receipts.
- Human approval gates are first-class (capsules are ideal for approvals).

## Capsule runtime model

### Roles

- **Host**: A2R Shell (desktop/web). Renders capsule UIs and brokers messages.
- **Provider**: MCP server/tool service that returns UI descriptors (MCP Apps).
- **Capsule UI**: sandboxed UI surface (HTML/JS) rendered by the host.
- **Bridge**: bidirectional message channel Host↔Capsule, with Host-mediated tool invocation.

### Transport

- MCP Apps UI resources are represented as `app://` or `ui://` descriptors (host-resolved). The host fetches the UI resource and renders it inside an isolated container.

## Thin shell overlay (Desktop MVP)

### Behavior

- Global hotkey opens a minimal chat bar (Spotlight-like).
- Overlay supports:
  - send message to current workspace
  - quick-switch workspace
  - start agent/run
  - open last capsule/browser
  - open DAG inspector

### Constraints

- Overlay must not bypass law gates; it is only an entry point.

## Browser capsule

- Browser capsule is a hardened WebView/iframe that can be driven by agents through the host bridge.
- Browser actions produce receipts: URL, DOM snapshot hash, screenshot hash, tool calls, and diffs.
- Network egress and downloads are policy-controlled (router/gateway).

## Contracts added

- `spec/Contracts/CapsuleManifest.schema.json`
- `spec/Contracts/MCPAppDescriptor.schema.json`
- `spec/Contracts/CapsuleBridgeEvent.schema.json`

## Acceptance tests to add

- **AT-CAP-0001** Capsule UI sandbox cannot directly access FS/network; only via host bridge.
- **AT-CAP-0002** Every capsule→tool action must include WIH identifiers and pass tool registry.
- **AT-CAP-0003** Capsule artifacts are written only under `/.a2r/` and appear in receipts.
- **AT-CAP-0004** Approval-required actions cannot execute without explicit user approval state.
- **AT-CAP-0005** Browser capsule emits replayable receipts (URL + DOM/screenshot hashes).

## Implementation notes

- Implement MCP Apps host as a module in the shell that can render multiple capsules concurrently.
- Use the existing workflow DAG engine as the execution substrate; capsules are views/controllers over node state.
- Store capsule instances and state under `/.a2r/capsules/instances/<id>/...`.
