# /spec/Deltas/0003-repo-cartography-ci.md — RCP-001 + CI Gates

Date: 2026-01-27
Status: PROPOSED

## Intent

Add deterministic repo cartography (RCP-001) and wire CI gates that enforce law presence, schema validation, acceptance tests, and CODEBASE regeneration consistency.

## Changes

- Introduce `RCP-001_CODEBASE_GENERATOR.md` as generator contract.
- Add CI job spec `CI_GATES_SPEC.md`.
- Require `CODEBASE.md` regeneration on structural changes.

## Acceptance

- CI fails on missing law files.
- CI validates WIH/tool/proposal/promotion schemas.
- CI runs acceptance suites referenced by deltas.
- RCP-001 produces deterministic output and receipts.

