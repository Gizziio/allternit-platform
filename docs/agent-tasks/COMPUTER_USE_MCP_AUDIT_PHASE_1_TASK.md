# Computer-Use-MCP Audit — Phase 1

**Goal:** Deep research `https://github.com/minghinmatthewlam/computer-use-mcp`, compare it to Allternit's existing computer-use/provider surfaces, and produce an integration plan.

## Scope
1. Fetch and read the upstream README, schema, and example server/client code.
2. Identify the MCP tool catalog, input schemas, and output formats.
3. Compare against Allternit:
   - `cmd/allternit-desktop-provider/` (macOS AX JSON-RPC provider)
   - `platform/mobile-harness/`
   - `surfaces/ai.allternit.com/src/lib/computer-use/`
   - `surfaces/ai.allternit.com/src/capsules/browser/` (browser agent actions)
4. Produce a gap analysis: what Allternit can adopt, fork, or ignore.
5. Write a concrete integration plan (Phase 2 spec) for adding an MCP-compatible computer-use tool surface to Allternit.

## Deliverable
- `docs/agent-tasks/COMPUTER_USE_MCP_AUDIT_PHASE_1_NOTES.md` with YAML frontmatter:
  - `status: done`
  - `files_changed: []`
  - `deviations: []`
  - `remaining: [implementation items]`

## Constraints
- No code changes in this phase.
- No git commits.
- No external code imports.
