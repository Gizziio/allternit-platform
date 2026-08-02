---
schema_version: 1
trust_tier: unverified
provenance_refs:
  - https://example.com/golden-fixture
produced_by: scout.cjs
produced_at: 2026-08-01T00:00:00.000Z
---

# Golden Fixture Mechanism

- Source: hackernews
- URL: https://example.com/golden-fixture
- Relevance score: 0.9
- Discovered: 2026-08-01T00:00:00.000Z

## What it is

A golden fixture brief that pins the artifact contract: a deterministic
widget that does one observable thing, used only by contract-test.sh.

## Mechanism

- The widget reads one input and emits one output
- State is kept in a single append-only log

## Integration surface

- infra/example: add the widget driver
- domains/agent: expose the widget as a tool

## Requirements seed

- WHEN a widget input arrives, THE SYSTEM SHALL append it to the widget log exactly once
- WHEN the widget log is read, THE SYSTEM SHALL return entries in arrival order
