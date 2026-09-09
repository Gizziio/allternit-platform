# ACI Guide

## Integration modes

ACI exposes three integration modes. All three are covered by the same
server-side approvals enforcement — see
[Approvals and server-side enforcement](#approvals-and-server-side-enforcement).

1. **Intent-driven runs (the planning loop).** POST a natural-language goal to
   `/api/aci/run`; the ACU gateway plans and executes the browser task and
   streams progress over SSE. This is the mode most clients want — see the
   [Quickstart](./quickstart.md).
2. **Direct computer control.** The REST routes
   `/api/v1/computers/:id/{mouse,keyboard,shell,files/*}` drive an attached
   computer with explicit low-level actions for callers that run their own
   planning loop.
3. **Capability path (structured actions via tools).** The `/tools/execute`
   surface exposes the `computer_*` tools so an agent can emit structured
   computer actions through the platform tool contract (see
   [Action space and tool versions](#action-space-and-tool-versions)).

Control endpoints for intent-driven runs:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/aci/run` | Start a browser automation run |
| GET | `/api/aci/stream/{id}` | SSE stream of run events |
| POST | `/api/aci/stop/{id}` | Cancel a run |
| POST | `/api/aci/approve/{id}?deny=true` | Approve or deny a pending action |

## Action space and tool versions

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

The tool contract is **Allternit Computer Use** (design decision D3): `allternitToolType: "computer"` with `computerToolVersion` selecting the action set (`"20250124"` default, `"20251124"` adds the `zoom` action when the capability is created with `enableZoom: true`). During the transition the metadata still carries `anthropicType` (`computer_20250124` / `computer_20251124`) as a legacy-compat adapter for upstream integrations — nothing user-facing should depend on it. See the [Changelog](./changelog.md) for the version history.

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

## Approvals and server-side enforcement

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

## Environments and the VM driver

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

## Recording and replay

ACI runs are stateless across the gateway: the gateway drains the upstream
event stream into an in-process replay buffer (one queue per run), so a client
can attach to `/api/aci/stream/{id}` at any time — mid-run or after completion
— and receive the full event history followed by the live tail (ending at
`done`). See [Replay a recording](./recipes.md#replay-a-recording).

Interactive **teach** mode (demonstrating a workflow once for the agent to
learn and re-run) is not available yet; the recipe page marks it accordingly.

## Monitoring

- Every run emits human-readable `trace` events plus structured `state` updates over SSE — sufficient for live progress UI and log pipelines.
- Every approval grant redemption attempt (allowed or denied) is recorded as an immutable receipt, giving per-action auditability without a separate logging integration.

## Vision coordinates

See [Action space and tool versions](#action-space-and-tool-versions) for the
coordinate contract, display-size metadata, and bounding-box overlay behavior.
