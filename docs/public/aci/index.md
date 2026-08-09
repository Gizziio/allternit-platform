# Allternit Computer Interface (ACI)

The **Allternit Computer Interface (ACI)** is the platform layer that lets an agent observe and control a computer — typically a browser or desktop environment — through a live screenshot stream, mouse/keyboard actions, and human-in-the-loop approvals. ACI routes requests through the Allternit Computer Use (ACU) gateway and surfaces the run state to web, desktop, and iOS clients.

## ACI vs. managed cloud sandboxes

| | ACI / self-hosted | Managed cloud sandbox |
|---|---|---|
| **Hosting** | Runs on the user's machine, a private VPS, or a self-managed WebVM | Runs in a vendor-managed cloud account |
| **Data residency** | Code, screenshots, and credentials stay on the host | Leaves the host by default |
| **Network access** | Same network as the host; can reach internal services | Typically limited to public endpoints unless configured |
| **Approval model** | Pauses for human approval before destructive actions | Depends on the provider |
| **Cost model** | Compute is yours; no per-action sandbox meter | Per-request or per-hour cloud pricing |

ACI is designed for users who want agentic browser automation on infrastructure they control, with the same Clerk identity and session model as the rest of Allternit.

## Self-hosted WebVM and cloud sandbox positioning

Allternit's execution stack supports multiple isolation backends:

- **Local process runner** — used by the SDK default `bash` and `code_execution` tools for fast local tasks.
- **WebVM / VM driver** — used by `cmd/allternit-api` sandbox routes (`/sandbox/execute`). The driver spawns a VM per request with configurable CPU, memory, network, and toolchain layers.
- **ACU gateway** — the computer-use service behind `/api/aci/*` that runs the planning loop and emits screenshot/ action events.

The sandbox API is VM-based rather than Docker-based:

```json
{
  "code": "print('hello from sandbox')",
  "language": "python",
  "timeout_secs": 300,
  "network_enabled": false,
  "resources": {
    "cpu_cores": 1,
    "memory_mb": 512
  },
  "toolchains": ["python-3.12"]
}
```

Capabilities returned by `GET /sandbox/capabilities` include driver type, supported languages, available toolchains, snapshot support, and streaming support.

## Browser automation

ACI browser runs start with a natural-language goal:

```bash
curl -X POST http://127.0.0.1:8013/api/aci/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Find the latest release notes on github.com/allternit/allternit",
    "model": "claude-sonnet-4-6",
    "allowedSites": ["github.com"],
    "openLinksInBrowser": true,
    "autoVerify": false
  }'
```

Response:

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "adapterId": "browser"
}
```

The run streams events over SSE at `/api/aci/stream/{sessionId}`. Event types include:

| Type | Meaning |
|------|---------|
| `trace` | Human-readable progress message from the ACU gateway |
| `state` | Structured state update from the planning loop |
| `done` | Run completed or was cancelled |

Control endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/aci/run` | Start a browser automation run |
| GET | `/api/aci/stream/{id}` | SSE stream of run events |
| POST | `/api/aci/stop/{id}` | Cancel a run |
| POST | `/api/aci/approve/{id}?deny=true` | Approve or deny a pending action |

## Vision coordinates

ACI computer-use tools use absolute pixel coordinates for mouse actions. The SDK's `ComputerUseCapability` advertises the display size in tool metadata:

```json
{
  "metadata": {
    "anthropicType": "computer_20250124",
    "display_width_px": 1280,
    "display_height_px": 720,
    "requiresVision": true
  }
}
```

The UI overlays action bounding boxes on the live screenshot. Boxes are scaled from the natural screenshot resolution to the displayed image size so a coordinate such as `{ "x": 640, "y": 360 }` points to the center of a 1280x720 screen regardless of how the image is rendered in the viewport.

Supported computer actions include:

| Action | Needs coordinate | Needs text |
|---|---|---|
| `mouse_move`, `left_click`, `right_click`, `double_click`, `triple_click`, `left_click_drag` | yes | no |
| `scroll` | yes | no (uses `scroll_direction` / `scroll_amount`) |
| `type`, `key`, `hold_key` | no | yes |
| `screenshot`, `cursor_position`, `wait` | no | no |

Always combine `screenshot` calls with the bounding box metadata returned in the stream so the model can reason about where the next action will land.
