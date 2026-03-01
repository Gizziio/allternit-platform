# CI Gates — AcceptanceTests + Schema Validation

Date: 2026-01-27
Status: DRAFT

## Required jobs

### 1) Law presence gate
- Fail if missing: `SOT.md`, `CODEBASE.md`, `spec/AcceptanceTests.md`, `spec/Contracts/WIH.schema.json`

### 2) Schema validation gate
- Validate all WIH files (`.a2r/wih/*.json` or work-item locations) against WIH schema
- Validate tool registry against ToolRegistry schema
- Validate proposals/promotion rules against their schemas (if present)

### 3) Acceptance test gate
- Run acceptance checks referenced by changed WIHs or deltas.
- Minimum suite: AT-BOOT, AT-WIH, AT-IO, AT-TOOLS, AT-TASK, AT-MEM, AT-NET.

### 4) CODEBASE regeneration consistency
- Run RCP-001 and ensure `CODEBASE.md` is either unchanged or updated in the same PR with receipt.

## Deterministic artifacts

- Store CI receipts under `/.a2r/receipts/ci/<run_id>.json` in build artifacts.
- Include file hash manifest for changed paths.

## Fail conditions (examples)

- Any file write outside `/.a2r/` during agent runs.
- Any WIH missing required fields or referencing unknown acceptance tests.
- Any tool call in logs that references unregistered tool IDs.

