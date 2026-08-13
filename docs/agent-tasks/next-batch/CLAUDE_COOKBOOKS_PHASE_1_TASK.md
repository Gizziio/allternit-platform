# Claude Cookbooks Integration — Phase 1 Task

**Scope:** Port the "Dynamic Workflows" cookbook pattern from Anthropic's `claude-cookbooks/claude_agent_sdk/08_Dynamic_workflows.ipynb` into Allternit's docs surface as a runnable, editable guide. The user explicitly requested cookbooks be added to Allternit docs.

**Agent:** kimi
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-claude-cookbooks`

## Deliverables

1. New cookbook section:
   - Directory: `cmd/gizzi-code/docs/cookbooks/` (create if missing)
   - File: `cmd/gizzi-code/docs/cookbooks/README.md` — index of available cookbooks.
   - File: `cmd/gizzi-code/docs/cookbooks/dynamic-workflows.md` — full markdown adaptation of the Dynamic Workflows notebook.
2. Adaptation requirements:
   - Convert notebook cells into markdown sections.
   - Use Allternit's agent SDK conventions where applicable (reference `cmd/gizzi-code/docs/integration/` for existing integration docs).
   - Include runnable TypeScript/JavaScript examples that match gizzi-code runtime patterns.
   - Preserve all original concepts: conditional branching, loops, parallel tool calls, state management.
3. CLI discoverability:
   - File: `cmd/gizzi-code/src/cli/commands/docs.ts` (create or extend)
   - Add `gizzi docs cookbooks` command that lists cookbooks and `gizzi docs cookbook <name>` that prints the markdown to the terminal.
   - If a docs command already exists, extend it; otherwise create a minimal command following the CLI idiom in `src/cli/commands/`.
4. Surface link (optional but recommended):
   - Add a link in `cmd/gizzi-code/docs/integration/README.md` pointing to the new cookbooks directory.

## Constraints

- Keep the cookbook faithful to the original Dynamic Workflows content; do not invent new patterns.
- Use existing gizzi-code command conventions (command file + registration in CLI router).
- Do not run dev servers. Final validation: `bun run typecheck` from `cmd/gizzi-code` if the project supports it; otherwise run `bun x tsc --noEmit` on changed files.
- No git commits/pushes.

## Reference

- Original notebook: `https://github.com/anthropics/claude-cookbooks/blob/main/claude_agent_sdk/08_Dynamic_workflows.ipynb` (fetch and read with WebSearch/FetchURL if needed).
- `cmd/gizzi-code/docs/integration/README.md`
- `cmd/gizzi-code/src/cli/commands/`

## Sentinel

When finished, write `docs/agent-tasks/CLAUDE_COOKBOOKS_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - cmd/gizzi-code/docs/cookbooks/README.md
  - cmd/gizzi-code/docs/cookbooks/dynamic-workflows.md
  - cmd/gizzi-code/src/cli/commands/docs.ts
  - cmd/gizzi-code/docs/integration/README.md
deviations: []
remaining: []
```

Then prose notes summarizing the adaptation and validation results.
