# OpenManus Patterns Audit — Phase 1 Task

**Scope:** Audit `FoundationAgents/OpenManus` for planning/tool-use patterns that can be adopted in Allternit surfaces. Produce an actionable audit report with a gap analysis and integration recommendations.

**Agent:** kimi
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-openmanus-audit`

## Deliverables

1. Research OpenManus:
   - Source: `https://github.com/FoundationAgents/OpenManus`
   - Read README, architecture docs, and at least 3 core source files (planner, tool manager, agent loop).
2. Audit report:
   - File: `docs/agent-tasks/OPENMANUS_AUDIT_PHASE_1_NOTES.md` (this is also the sentinel)
   - Include:
     - Summary of OpenManus architecture
     - Strengths relevant to Allternit
     - Gaps vs. Allternit's existing DAK Runner / agent runtime
     - Concrete adopt/extract/fork/reject decisions
     - Recommended integration points (e.g., planning module, tool registry, loop UI)
3. Optional prototype:
   - If a clear, low-risk integration point is identified, implement a small proof-of-concept in `surfaces/ai.allternit.com/src/lib/agents/openmanus/` (e.g., a planning state machine or tool-call serializer).

## Constraints

- Do not fork the entire OpenManus repo.
- No git commits/pushes.
- No dev servers required.

## Reference

- `https://github.com/FoundationAgents/OpenManus` (fetch via WebSearch/FetchURL)
- `surfaces/ai.allternit.com/src/lib/agents/`
- `domains/agent/AGENTS.md`

## Sentinel

When finished, write `docs/agent-tasks/OPENMANUS_AUDIT_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - docs/agent-tasks/OPENMANUS_AUDIT_PHASE_1_NOTES.md
deviations: []
remaining:
  - Implementation of chosen integration points
```

Then prose audit report.
