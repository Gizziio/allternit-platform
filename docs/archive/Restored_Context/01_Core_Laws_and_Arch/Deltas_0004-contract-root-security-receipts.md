# Delta 0004 — Contract Root Canon + Security Boot Gates + Receipts Contract

Status: PROPOSED

## Goal (Non‑Negotiable)
1) Make `spec/Contracts/` the **only** canonical contract root.
2) Enforce security boot gates (no auth bypass; no python exec).
3) Define receipts as *proofs* via a contract schema and require them at tool + workflow boundaries.

---

## Changes (Exact)

### A) Contract Root Canon
- Create `/spec/Contracts/` and move/copy canonical contracts into it.
- Declare `spec/1_contracts/` **legacy and non‑authoritative**.
- Any runtime/CI reference to `spec/1_contracts/` as canonical is invalid.

### B) Security Boot Gates (CI Fail Conditions)
- Kernel auth bypass for `/v1/brain`, `/v1/config`, `/v1/sessions` is forbidden.
- Python gateway `exec()` path is forbidden.
- CI must fail if either condition is detected.

### C) Receipt Contract
- Add `/spec/Contracts/Receipt.schema.json` with mandatory proof fields.
- ToolGateway and WorkflowEngine must emit receipts validated against this schema.
- Receipt generation is required for completion and resume.

---

## Contract Artifacts
- `/spec/Contracts/README.md`
- `/spec/Contracts/WIH.schema.json`
- `/spec/Contracts/Receipt.schema.json`

## Receipt Schema (Minimum Required Fields)
- `receipt_id`, `created_at`, `run_id`, `workflow_id`, `node_id`, `wih_id`
- `tool_id`, `tool_def_hash`, `policy_decision_hash`, `pretool_event_hash`
- `input_hashes`, `output_hashes`
- `artifact_manifest[]` (path, hash, size, media_type)
- `write_scope_proof` (declared vs actual paths)
- `execution` (exit_code, stderr_hash, stdout_hash, duration_ms)
- `idempotency_key`, `retry_count`, `trace_id`
- `environment_hash` (tool version, runtime signature)

---

## File-Level Impact (Minimum)
- `services/kernel/src/main.rs` (remove auth bypass; enforce boot gate)
- `services/python-gateway/main.py` (remove exec / gate behind ToolGateway)
- `crates/kernel/tools-gateway/src/lib.rs` (PreToolUse gating + receipt emission)
- `crates/orchestration/workflows/src/lib.rs` (receipt emission + validation)
- `/spec/Contracts/*`
- `/spec/AcceptanceTests.md`

---

## Acceptance Tests (Must Fail CI if Violated)
- **AT-SEC-0001:** static + runtime check: no auth bypass list for `/v1/brain`, `/v1/config`, `/v1/sessions`.
- **AT-SEC-0002:** static check: no `exec(` in `services/python-gateway/main.py` request path.
- **AT-RECEIPT-0001:** receipts generated and validated for tool execution.
- **AT-RECEIPT-0002:** workflow node completion produces receipt validated by `Receipt.schema.json`.
- **AT-LAW-0004:** contract root canonicalization enforced (`spec/Contracts` only).

---

## Migration Notes
- `spec/1_contracts/` can remain as legacy reference, but **cannot** be used as authoritative input to runtime/CI.
- Update any references to `spec/1_contracts/` in code, docs, or CI to point to `spec/Contracts/`.
