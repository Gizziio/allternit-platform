# 0005. Automated Governance & CI Infrastructure

Date: 2026-02-04

## Status
Accepted

## Context
Maintaining architectural integrity in a complex, cross-language codebase is difficult without automation. We need "guardrails" that prevent layer-jumping, track decisions, and verify internalized logic.

## Decision
Establish a suite of automated governance tools in the `bin/` directory:
1.  **bin/adr**: Tool for creating and managing standardized Architecture Decision Records.
2.  **bin/ci-gate**: Centralized verification script that enforces vendor quarantine and runs integration tests.
3.  **bin/generate-codebase-md**: Auto-generator for `CODEBASE.md` to keep LLM context fresh.

## Consequences
- **Continuity**: New developers (and AI agents) can quickly understand the history of decisions.
- **Strictness**: `ci-gate` prevents regression into vendor-dependent code paths.
- **Context**: `CODEBASE.md` ensures that agents always have an accurate map of the repo.

