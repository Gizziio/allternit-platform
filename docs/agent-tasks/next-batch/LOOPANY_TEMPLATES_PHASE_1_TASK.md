# Loopany.ai Templates — Phase 1 Task

**Scope:** Curate loop templates from `https://loopany.ai/templates` into Allternit's loop library.

**Agent:** kimi
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-loopany-templates`

## Deliverables

1. Research loopany.ai templates:
   - Fetch `https://loopany.ai/templates` and identify at least 8 reusable loop templates (e.g., daily standup, content pipeline, research sweep, code review triage).
2. Template data layer:
   - File: `surfaces/ai.allternit.com/src/lib/loops/loopany-templates.ts`
   - Export `LOOPANY_TEMPLATES: LoopTemplate[]` with id, name, description, tags, frequency, steps, and default tools.
   - File: `surfaces/ai.allternit.com/src/lib/loops/loopany-templates.types.ts`
   - Define `LoopTemplate` interface.
3. Surface integration:
   - File: `surfaces/ai.allternit.com/src/views/loops/LoopTemplatesGallery.tsx` (create directory if needed)
   - Gallery UI for browsing and importing loop templates into the user's loop library.
   - Wire into the existing `/automation/loops` page or left rail.

## Constraints

- Do not scrape the entire site; only curate representative public templates.
- Match existing surface styling.
- Final validation: `bun x tsc --noEmit` from `surfaces/ai.allternit.com` and grep for changed files.
- No git commits/pushes.

## Reference

- `https://loopany.ai/templates` (fetch via WebSearch/FetchURL)
- `surfaces/ai.allternit.com/src/views/loops/` or `src/pages/LoopsListPage.tsx`
- `surfaces/ai.allternit.com/src/lib/agents/agent-templates.ts`

## Sentinel

When finished, write `docs/agent-tasks/LOOPANY_TEMPLATES_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/loops/loopany-templates.types.ts
  - surfaces/ai.allternit.com/src/lib/loops/loopany-templates.ts
  - surfaces/ai.allternit.com/src/views/loops/LoopTemplatesGallery.tsx
deviations: []
remaining:
  - Backend persistence for imported templates
  - One-click activate loop flow
```

Then prose notes summarizing template curation and validation results.
