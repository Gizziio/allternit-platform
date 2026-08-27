# Prime-Agent Dual-Loop Harness Audit — Phase 1 Task

**Scope:** Audit `PrimeIntellect-ai/prime-agent` for its dual-loop (RL + sequential) harness design. Determine what Allternit can adopt for its own agent runtime.

**Agent:** qwen
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-prime-agent-audit`

## Deliverables

1. Research prime-agent:
   - Source: `https://github.com/PrimeIntellect-ai/prime-agent`
   - Read README, architecture, and core loop implementations.
2. Audit report:
   - File: `docs/agent-tasks/PRIME_AGENT_AUDIT_PHASE_1_NOTES.md`
   - Include:
     - Dual-loop architecture summary (RL loop + sequential loop)
     - How it compares to Allternit's current sequential DAK Runner
     - Adopt/extract/fork/reject recommendations
     - Concrete integration plan if adoptable

## Constraints

- Do not fork the entire repo.
- No git commits/pushes.
- No dev servers required.

## Reference

- `https://github.com/PrimeIntellect-ai/prime-agent` (fetch via WebSearch/FetchURL)
- `domains/agent/AGENTS.md`
- `surfaces/ai.allternit.com/src/lib/agents/`

## Sentinel

When finished, write `docs/agent-tasks/PRIME_AGENT_AUDIT_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - docs/agent-tasks/PRIME_AGENT_AUDIT_PHASE_1_NOTES.md
deviations: []
remaining:
  - Implementation of chosen dual-loop components
```

Then prose audit report.
