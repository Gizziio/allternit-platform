# CM-K003 UI Gateway Contracts Report

Date: 2026-02-27
Task: CM-K003

## Delivered

- Contract files in place:
  - `spec/Contracts/UIRegistry.schema.json`
  - `spec/Contracts/UIAction.schema.json`
  - `spec/Contracts/UINav.schema.json`
  - `spec/Contracts/UIWorkspaceLayout.schema.json`

- Validator now enforces:
  - `ui/ui_registry.json` validates against `UIRegistry.schema.json`.
  - Every registry action can be materialized into a valid `UIAction` envelope.
  - `ui/ui_nav.json` validates against `UINav.schema.json`.
  - `ui/workspace_layout.json` validates against `UIWorkspaceLayout.schema.json`.

- Data updates applied:
  - `ui/ui_nav.json` now includes `nav_id`.
  - `ui/workspace_layout.json` now includes `layout_id`.

## Validation

- `python3 scripts/validate_law.py` passes with UI contract checks enabled.

