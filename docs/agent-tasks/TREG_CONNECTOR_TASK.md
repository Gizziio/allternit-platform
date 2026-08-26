# P1: treg Agent Connector / Tool Router (Phase 1)

## Goal
Research `superdesigndev/treg` and design where it fits into Allternit as an agent tool connector/router.

## Reference
- Upstream: https://github.com/superdesigndev/treg
- Allternit agent/tool surfaces: `surfaces/ai.allternit.com/src/lib/agents/tool-registry.store.ts`, `src/lib/agents/`, and `cmd/allternit-api/src/tool_routes.rs`.

## Tasks
1. Clone or fetch the upstream repo into a temporary directory.
2. Audit its architecture:
   - What problem it solves (OpenRouter for agent tools).
   - Tool registration, discovery, routing, billing/credit model.
   - License and API shape.
3. Gap analysis against Allternit's existing tool registry, connector framework, and agent hub.
4. Decide whether to:
   - Fork and embed,
   - Build a compatible adapter, or
   - Reject and document why.
5. If adoptable, scaffold a new module, e.g. `platform/treg-connector/` or extend `src/lib/agents/`.
6. Implement a minimal proof-of-concept:
   - A TypeScript or Rust client that lists treg tools and routes one tool call.
   - Unit tests or a small script validating the contract.
7. Run typecheck or `cargo check` for the new code.

## Constraints
- Do not import upstream code without a recognized license.
- Keep changes isolated from unrelated Allternit surfaces in this phase.
- No git operations, no commits, no pushes.

## Deliverable Sentinel
Write `docs/agent-tasks/TREG_CONNECTOR_NOTES.md` with YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Include: audit summary, adoption decision, PoC design, validation status, and next-phase work.
