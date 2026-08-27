# Diagram-Design Artifacts — Phase 1 Task

**Scope:** Integrate the `cathrynlavery/diagram-design` pattern into Allternit's artifact system as a new editorial SVG diagram kind. The user wants diagram generation added to Gizzi Code artifacts.

**Agent:** kimi
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-diagram-design`

## Deliverables

1. Research the upstream repo:
   - Source: `https://github.com/cathrynlavery/diagram-design`
   - Read the README and examples to understand the diagram design language/patterns.
2. Diagram schema and types:
   - File: `surfaces/ai.allternit.com/src/lib/artifacts/diagram/diagram.types.ts`
   - Define `DiagramArtifact` type with `nodes`, `edges`, `layout`, `theme`.
3. Diagram renderer:
   - File: `surfaces/ai.allternit.com/src/components/artifact/DiagramRenderer.tsx`
   - Render nodes and edges as SVG using Allternit design tokens. Support pan/zoom or fit-to-view at minimum.
   - Support at least one layout engine: manual (x/y) or simple DAG layering.
4. Integrate with ArtifactRenderer:
   - File: `surfaces/ai.allternit.com/src/components/artifact/ArtifactRenderer.tsx`
   - Add a new `case` for `application/allternit.artifact.diagram` and `media/diagram` that renders `DiagramRenderer`.
5. Example generator:
   - File: `surfaces/ai.allternit.com/src/lib/artifacts/diagram/diagram.examples.ts`
   - Export at least 2 example diagrams (e.g., system architecture, decision flow).

## Constraints

- Use only SVG/CSS for rendering; no external diagram libraries unless already in the project's dependencies.
- Match existing artifact renderer styling and sandboxing approach.
- Do not run dev servers. Final validation: `bun install` (if needed) then `bun typecheck` from `surfaces/ai.allternit.com`.
- No git commits/pushes.

## Reference

- `surfaces/ai.allternit.com/src/components/artifact/ArtifactRenderer.tsx`
- `surfaces/ai.allternit.com/src/lib/artifacts/schema.ts`
- `https://github.com/cathrynlavery/diagram-design` (fetch via WebSearch/FetchURL)

## Sentinel

When finished, write `docs/agent-tasks/DIAGRAM_DESIGN_ARTIFACTS_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/artifacts/diagram/diagram.types.ts
  - surfaces/ai.allternit.com/src/components/artifact/DiagramRenderer.tsx
  - surfaces/ai.allternit.com/src/components/artifact/ArtifactRenderer.tsx
  - surfaces/ai.allternit.com/src/lib/artifacts/diagram/diagram.examples.ts
deviations: []
remaining: []
```

Then prose notes summarizing the diagram-design integration and validation results.
