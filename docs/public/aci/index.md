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

## Server-side approvals

Approvals belong to the Allternit Computer Use **product**, not to any single
engine (design decision D2): the same enforcement covers the ACU loop
(`/api/aci/run`), the direct computer control routes
(`/api/v1/computers/:id/{mouse,keyboard,shell,files/*}`), and the capability
path (`/tools/execute` `computer_*` tools). A compromised or modified client
cannot approve its own actions — enforcement is entirely server-side in
`cmd/allternit-api` (`aci_approvals`, `aci_safety`, `computer_control`).

Every action is classified into a confirmation taxonomy — **reversible**
(read-only or trivially undoable, e.g. cursor moves, file reads, `ls`),
**risky** (state-mutating, e.g. clicks, writes, `rm`, package installs), or
**irreversible** (destructive, e.g. `rm -rf /`, writes to system paths). Risky
and irreversible actions require an approval grant; reversible actions proceed
without one. Set `ALLTERNIT_ACI_SAFETY_MODE=audit` to log-and-allow, or
`=off` to disable (default: enforce).

A **grant** binds a human approval to a SHA-256 hash of the specific action
payload — the goal and options for a run, the command argv for a shell call —
not merely to a run id. Grants are:

- **Hash-bound** — an action whose payload does not hash to the granted value
  is denied with `approval_denied`, even if a valid-looking `approval_id` is
  presented.
- **Single-use** — redemption consumes the grant; replaying it is denied.
- **Expiring** — grants lapse after `ALLTERNIT_ACI_GRANT_TTL_SECS` seconds
  (default 300).
- **Receipted** — every redemption attempt (allowed or denied) is recorded as
  an immutable receipt for audit.

Typical flow for a flagged run:

1. `POST /api/aci/run` with a sensitive goal returns `202 handoff_required`
   with an `approval_id` and `action_hash`.
2. A human decides via `POST /api/aci/handoff/{approval_id}/approve` (or
   `/deny`).
3. The client retries the **same** run body with `"approvalId"` added; the
   gateway recomputes the action hash and redeems the grant. Any change to the
   payload changes the hash and is denied.

The same flow applies to control routes and tools: a `403 confirmation_required`
response carries `approval_id` + `action_hash`; retry with the `approvalId`
query param (REST) or `approval_id` argument (`/tools/execute`) after approval.

The TypeScript SDK's `ApprovalPredicates` (`sdk/computer-use/src/approvals.ts`)
are a **UX pre-filter only** — they decide what the client auto-answers when
the server asks. They do not, and cannot, grant authority: the gateway's
hash-bound grant check is the sole enforcement point.

## Vision coordinates

ACI computer-use tools use absolute pixel coordinates for mouse actions. The SDK's `ComputerUseCapability` advertises the display size in tool metadata:

```json
{
  "metadata": {
    "allternitToolType": "computer",
    "computerToolVersion": "20250124",
    "display_width_px": 1280,
    "display_height_px": 720,
    "requiresVision": true
  }
}
```

The tool contract is **Allternit Computer Use** (design decision D3): `allternitToolType: "computer"` with `computerToolVersion` selecting the action set (`"20250124"` default, `"20251124"` adds the `zoom` action when the capability is created with `enableZoom: true`). During the transition the metadata still carries `anthropicType` (`computer_20250124` / `computer_20251124`) as a legacy-compat adapter for upstream integrations — nothing user-facing should depend on it.

The UI overlays action bounding boxes on the live screenshot. Boxes are scaled from the natural screenshot resolution to the displayed image size so a coordinate such as `{ "x": 640, "y": 360 }` points to the center of a 1280x720 screen regardless of how the image is rendered in the viewport.

Supported computer actions include:

| Action | Needs coordinate | Needs text |
|---|---|---|
| `mouse_move`, `left_click`, `right_click`, `double_click`, `triple_click`, `left_click_drag` | yes | no |
| `scroll` | yes | no (uses `scroll_direction` / `scroll_amount`) |
| `type`, `key`, `hold_key` | no | yes |
| `screenshot`, `cursor_position`, `wait` | no | no |
| `zoom` (20251124 only, requires `enableZoom: true`) | no (uses `region` [x1, y1, x2, y2]) | no |

Always combine `screenshot` calls with the bounding box metadata returned in the stream so the model can reason about where the next action will land.
