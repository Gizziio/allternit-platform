# WebVM Connected Mode Spec (v0)

Purpose
- Run capsules inside WebVM with live ToolABI proxying.
- Preserve replay support by recording every tool call and event.

## Modes

1) Replay
- Deterministic playback from EventEnvelope stream + ContextBundle snapshot.
- No external side effects.

2) Connected
- Capsule executes in WebVM.
- ToolABI calls are proxied to apps/api or edge agents.
- Event stream is persisted for later replay.

3) Dev
- Full Linux workspace in browser for authoring and testing capsules.
- Not intended for production runs.

## Connected mode data flow

Browser
- Loads WebVM runtime and mounts capsule rootfs.
- Establishes a WebSocket to `apps/api` for ToolABI proxying.

WebVM guest
- Runs `a2r-runner` inside the VM.
- Emits ToolABI requests to the host proxy bridge.

API
- Validates requests against policy.
- Executes tools in the tools-gateway or forwards to edge agents.
- Emits EventEnvelope and PolicyDecisionArtifact for every step.

## Tool proxy contract

WebVM -> Host (ToolABI request)
```json
{
  "request_id": "req_01HV...",
  "tenant_id": "tenant_default",
  "tool_name": "web.get",
  "arguments": { }
}
```

Host -> WebVM (ToolABI response)
```json
{
  "request_id": "req_01HV...",
  "ok": true,
  "result": { }
}
```

## Capsule packaging requirements

Capsule is an OCI artifact with the following layers:
- Rootfs layer (tar or ext4 image)
- Capsule config (`capsule.json`)
- Policy bundle (`policy.json`)
- Context bundle hash (`context.json`)
- Signature (`capsule.sig`)

The same capsule artifact runs on:
- WebVM
- Cloud runner
- Edge agents

Optional: a WASI target can be added later for native wasm execution, but is not required.

## Replay requirements

Connected runs MUST record:
- ToolABI requests/responses
- PolicyDecisionArtifact
- EventEnvelope stream

Replay uses:
- EventEnvelope stream + context snapshot
- Tool stubs in WebVM (no external proxy)

## Security constraints

- No direct host hardware access from WebVM.
- Hardware access must be via connectors/edge agents.
- Policy check precedes every ToolABI request.

## Implementation notes

- WebVM host bridge uses WebSocket to `apps/api`.
- `apps/api` exposes: `POST /api/tools/execute` and event stream endpoints.
- Connected mode is non-deterministic by default, but supports deterministic replay.
