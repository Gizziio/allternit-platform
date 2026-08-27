---
status: done
files_changed:
  - cmd/allternit-api/migrations/V83__enterprise_phase1.sql
  - cmd/allternit-api/src/data_residency_routes.rs
  - cmd/allternit-api/src/device_attestation_routes.rs
  - cmd/allternit-api/src/enterprise_auth.rs
  - cmd/allternit-api/src/compliance_routes.rs
  - cmd/allternit-api/src/admin_workspace_routes.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
blockers: []
---

# Enterprise and Security — Phase 1 Notes

## Summary

Phase 1 of the Enterprise and Security parity track is complete. The agent was briefly blocked by a transient `auth.kimi.com` runtime error; `cargo check -p allternit-api` was verified manually and passes.

## Implemented Features

### Data Residency
- New `cmd/allternit-api/src/data_residency_routes.rs`
- Endpoints for policy GET/SET and region listing.

### Workforce Identity Federation (WIF)
- Extended `cmd/allternit-api/src/enterprise_auth.rs` with WIF provider CRUD and token-exchange scaffold.

### Device Attestation
- New `cmd/allternit-api/src/device_attestation_routes.rs`
- Register, list, get, revoke, and verify device attestation records.

### Compliance / Retention / Zero Data Retention
- Extended `cmd/allternit-api/src/compliance_routes.rs` with retention-policy endpoints, request-completion tracking, and export download.

### Workspace IP Allowlisting
- Extended `cmd/allternit-api/src/admin_workspace_routes.rs` with workspace-scoped IP allowlist CRUD.

### Schema
- Migration `cmd/allternit-api/migrations/V83__enterprise_phase1.sql` creates tables for data residency, WIF providers, device attestation, retention/ZDR, and workspace IP allowlisting.

### Wiring
- Added module declarations in `lib.rs`.
- Merged new routers in `main.rs`.

## Verification

- `cargo check -p allternit-api` passes with only pre-existing warnings.
- No competitor names remain in code or user-facing strings.

## Phase 2 Remaining Work

- Add integration tests for enterprise routes.
- Implement real WIF token exchange flow.
- Wire retention/ZDR policies into the LLM proxy path.
- Add admin UI views for residency, attestation, and allowlist management.
