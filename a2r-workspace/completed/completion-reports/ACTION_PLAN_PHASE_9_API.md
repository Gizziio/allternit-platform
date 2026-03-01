# Action Plan: Phase 9 Kernel API Alignment

## Goal
Align the Kernel API with `docs/OPERATOR_PACK/api/openapi.yaml` to support the full Operator Control Surface.

## Tasks

### 1. Implement Missing Endpoints
*   **`POST /v1/evidence/add`**: Allow adding raw evidence (URL/File) without starting a capsule.
*   **`POST /v1/capsules/{id}/patch`**: Allow manual patching of a capsule spec.
*   **`GET /v1/tools`**: Expose the list of registered tool definitions.
*   **`POST /v1/actions/execute`**: Direct execution of a tool/action (policy gated).
*   **`GET /v1/health`**: Simple health check.

### 2. Verify SSE Stream
*   Ensure `GET /v1/journal/stream` returns a proper `text/event-stream` response, not just a JSON array.

### 3. Update Types
*   Add request structs for `EvidenceAddRequest`, `CapsulePatchRequest`, `ActionExecuteRequest`.

## Implementation Steps
1.  **Update `types.rs`**: Add new structs.
2.  **Update `main.rs`**:
    *   Add `add_evidence` handler.
    *   Add `patch_capsule` handler.
    *   Add `list_tools` handler.
    *   Add `execute_action` handler.
    *   Add `health_check` handler.
    *   Register routes in `create_router`.

## Affected Files
*   `services/kernel/src/types.rs`
*   `services/kernel/src/main.rs`

## Verification
*   `curl` tests for each new endpoint.
