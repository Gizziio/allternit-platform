# Browse.sh CLI Browser UX Audit — Phase 1 Task

**Scope:** Audit `https://browse.sh` CLI for browser-use UX patterns that can be borrowed for gizzi-code's browser command.

**Agent:** kimi
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-browse-sh-audit`

## Deliverables

1. Research browse.sh:
   - Fetch `https://browse.sh` and any linked docs/GitHub.
   - Identify command structure, output format, navigation shortcuts, and agentic browsing patterns.
2. UX audit report:
   - File: `docs/agent-tasks/BROWSE_SH_AUDIT_PHASE_1_NOTES.md`
   - Include:
     - Feature summary
     - UX patterns worth borrowing for `gizzi browser` or `gizzi browse`
     - Gap analysis vs. existing Allternit browser capsule
     - Concrete recommendations (commands, TUI panels, output rendering)
3. Optional prototype:
   - If appropriate, extend `cmd/gizzi-code/src/cli/commands/` with a `browse.ts` command sketch implementing the top 2-3 recommended UX patterns.

## Constraints

- Do not fork proprietary browse.sh code.
- No git commits/pushes.

## Reference

- `https://browse.sh` (fetch via WebSearch/FetchURL)
- `cmd/gizzi-code/src/cli/commands/`
- `surfaces/ai.allternit.com/src/capsules/browser/`

## Sentinel

When finished, write `docs/agent-tasks/BROWSE_SH_AUDIT_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - docs/agent-tasks/BROWSE_SH_AUDIT_PHASE_1_NOTES.md
deviations: []
remaining:
  - Implementation of chosen UX patterns in gizzi-code
```

Then prose audit report.
