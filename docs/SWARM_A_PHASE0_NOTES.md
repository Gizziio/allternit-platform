---
status: done
files_changed: []
deviations: []
remaining: []
---

# Swarm A Phase 0 notes

The harness now exposes one provider-neutral contract for reasoning effort and thinking budgets, prompt-cache boundaries, native JSON Schema responses, tool selection, parallel calls, and strict tool schemas. Pure request adapters map that contract to OpenAI, Anthropic, and Kimi wire shapes, and the Native Tool Belt preserves strict/cache metadata when injecting active tools.

The OpenAI-compatible gateway now validates normalized reasoning and structured-output fields, forwards JSON Schema formats and reasoning variants to Gizzi, validates `Idempotency-Key` before authentication or spend, and returns stable machine-readable `allternit.*` error codes. Model-list responses now include each catalog model's `context_window` and `max_output_tokens` limits.

Targeted local verification passed: 7 tests across the provider-request and Tool Belt suites. `git diff --check` also passes. No external-service tests, builds, typechecks, or dev servers were run.

Phase 1 work was intentionally not started. The remaining Phase 1 scope should be taken from the master parity handoff rather than inferred here.
