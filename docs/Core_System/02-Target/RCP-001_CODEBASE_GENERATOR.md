# RCP-001 — Repo Cartography: CODEBASE.md Generator

Date: 2026-01-27
Status: DRAFT

## Goal

Produce a deterministic, reproducible **CODEBASE.md** and optional machine-readable indices that enable retrieval without grepping across the filesystem.

## Inputs

- Repo root path
- Include/exclude globs
- Max file size threshold
- Language detectors
- Optional: dependency graph extractor(s)

## Outputs

- `CODEBASE.md` (human anchor)
- `CODEBASE.index.json` (machine index)
- `CODEBASE.graph.json` (optional: dependency/service graph)
- `/.allternit/receipts/rcp-001-<run_id>.json` (hashes + stats)

## Determinism requirements

- Stable ordering: paths sorted lexicographically.
- Stable hashing: SHA-256 of file bytes; include newline normalization flag (default: none).
- Stable summaries: generated from structural signals only (path, headings, exported symbols) — no stochastic text.
- Receipts include generator version + config.

## Minimum CODEBASE.md structure

1. Repo identity + version receipt
2. Top-level topology (apps/packages/services/crates)
3. Critical invariants (law layer)
4. Kernel/service map
5. UI map
6. Tooling/agents map
7. Contracts/specs map
8. Index of key entrypoints
9. Change points

## Index JSON schema (informal)

- files: [{path, sha256, bytes, lang, role_tags, headings[], exports[] }]
- graphs: {services:[], deps:[]}

## Acceptance

- Regeneration on same repo state produces identical outputs (byte-identical).
- Diff output shows added/removed/changed files with hashes.

