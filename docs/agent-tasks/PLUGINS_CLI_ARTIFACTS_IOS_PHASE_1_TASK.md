# Plugins, CLI, Artifacts, iOS, Docs, Loops Integration — Phase 1 Task

**Agent:** qwen  
**Worktree:** /Users/joe/Desktop/allternit-workspace/allternit  
**Goal:** Research and plan integrations for multimodal plugins, AI CLI tools, artifacts, iOS, docs, and loop templates; implement the highest-value surface integrations.

## Projects to research

1. **Vercel agent plugins** — research Vercel's agent plugin model and plan how Allternit plugins can adopt the pattern.
2. **QwenLM/Qwen-MM-Plugins** — plan native multimodal plugin integration into Gizzi code.
3. **loopany.ai/templates** — research loop templates and plan how to surface them in Allternit automation.
4. **0xprincess/SPAWN.md** — research and plan integration.
5. **vercel-labs/ai-cli** — research and plan integration as an Allternit surface or tool.
6. **alphaXiv/openresearch-cli** — deep research tool; plan integration into Allternit for deep research.
7. **jordan-gibbs/hyperresearch** — deep research tool; plan integration.
8. **cathrynlavery/diagram-design** — add to artifacts generation designs for Gizzi code.
9. **happier-dev/happier** — audit against Allternit iOS and plan fork/integration for app surface.
10. **anthropics/claude-cookbooks** — specifically `claude_agent_sdk/08_Dynamic_workflows.ipynb`; integrate cookbooks into Allternit docs surface.

## Deliverables

1. Write `docs/agent-tasks/PLUGINS_CLI_ARTIFACTS_IOS_MAP.md` with:
   - One-paragraph summary of each project/link
   - License and reuse risk
   - Adopt / extract / fork / reference / reject decision
   - Surface integration target (e.g., Gizzi code, Docs, iOS, Automation)

2. Implement in this phase (production quality, full implementation, no stubs):
   - Add a "Cookbooks" section to the existing Docs surface (`src/views/docs/DocsView.tsx` or a new CookbooksPanel) that loads and displays Claude cookbooks, with the Dynamic Workflows notebook as a featured entry. Each cookbook card opens in the ACI browser pane.
   - Add a "Diagram Design" artifact template/generation path in Gizzi code (`src/views/code/` or artifact generation pipeline) so agents can generate diagram-design style outputs.
   - Create a "Research Tools" panel or hub that registers openresearch-cli and hyperresearch as available deep-research tools with metadata and launch actions.
   - Add a "Loop Templates" browser in the Automation/Loops surface that loads loopany.ai template patterns and lets users instantiate them.
   - If feasible within this phase, add a basic multimodal plugin registration scaffold for Qwen-MM-Plugins under Gizzi code plugins; otherwise document the exact integration plan.

3. When finished, write `docs/agent-tasks/PLUGINS_CLI_ARTIFACTS_IOS_PHASE_1_NOTES.md` with YAML frontmatter:
   ```yaml
   status: done
   files_changed: []
   deviations: []
   remaining: []
   ```

## Constraints

- Do NOT run git commits, pushes, or upstream code imports.
- Match repo idiom: React + TypeScript, Tailwind CSS, Phosphor or Lucide icons, Zustand stores.
- Do NOT start phase 2.
- Append milestones to `.allternit/shared-context.md` if it exists.
