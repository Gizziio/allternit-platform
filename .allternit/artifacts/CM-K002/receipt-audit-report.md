# CM-K002 Receipt Audit Report

Date: 2026-02-27
Task: CM-K002
Scope: Validate `spec/Contracts/Receipt.schema.json` coverage for Code Mode execution evidence.

## Summary

`Receipt.schema.json` now includes an optional `code_mode` envelope that captures Code Mode-specific proof fields while preserving compatibility for existing non-Code receipts.

## Coverage Mapping

- AT-UI-0003 (UI actions emit receipts):
  - Covered by existing base receipt identity and execution fields.
  - Relevant fields: `receipt_id`, `run_id`, `wih_id`, `tool_id`, `execution`, `trace_id`.

- AT-CODE-ENV-0001 (Runner reports git status):
  - Covered by `code_mode.workspace`.
  - Relevant fields: `workspace.branch`, `workspace.dirty`, `workspace.ahead`, `workspace.behind`.

- AT-CODE-CS-0007 (Apply receipt includes patch/file/hash/command evidence):
  - Covered by `code_mode.patch_hash`, `code_mode.touched_files`, `code_mode.before_hashes`, `code_mode.after_hashes`, `code_mode.command_outputs`.

- AT-CODE-CS-0005 (approval token required):
  - Covered by `code_mode.approval_token`.

- AT-CODE-STATE-0001 / AT-CODE-STATE-0002 (state transitions/evidence):
  - Covered by `code_mode.session_id`, `code_mode.event_id`, `code_mode.mode`, `code_mode.state`.

## Schema Design Notes

- `code_mode` is optional to avoid breaking existing receipt producers.
- `code_mode` itself is strict (`additionalProperties: false`) to keep evidence deterministic.
- Existing receipt required fields remain unchanged.

## Validation Result

- `python3 scripts/validate_law.py` passes after schema update and tool/acceptance validator fixes.
