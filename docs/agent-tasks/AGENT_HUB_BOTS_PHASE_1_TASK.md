# Agent Hub & Packaged Bots Integration — Phase 1 Task

**Agent:** qwen  
**Worktree:** /Users/joe/Desktop/allternit-workspace/allternit  
**Goal:** Research agent-hub and packaged-bot projects and implement a first-class Agent Hub presentation layer for packaged bots as left-rail sessions.

## Projects to research

1. **treg** (superdesigndev/treg) — OpenRouter for agent tools. Determine where to implement in Allternit, if worth adding, and long-term trend.
2. **msitarzewski/agency-agents** — large template of specialized AI agents. Identify which agents fit Allternit Agent Hub and how to surface them.
3. **FoundationAgents/OpenManus** — identify Manus features usable in Allternit surfaces.
4. **PrimeIntellect-ai/prime-agent** — harness with two-system architecture. Determine what to add to the Allternit harness.
5. **milind-soni/OpenMausBot** — newer OpenManus-style bot with better UI/UX. Plan to fork/integrate as Agent Hub packaged bots in left-rail sessions.
6. **x.ai/bot (Allternit Bot)** — reverse-engineer the packaged-bot UX and fill gaps from OpenMausBot research.
7. **CopilotKit/OpenTag** — IMPORTANT: research whether this is actually composer tagging or a Slack/Teams triage app. If composer tagging is not provided, design and implement an Allternit-native tag system for agents/scripts/tools in the composer with a nice visual UI.

## Deliverables

1. Write `docs/agent-tasks/AGENT_HUB_BOTS_MAP.md` with:
   - One-paragraph summary of each project
   - License and reuse risk
   - Adopt / extract / fork / reference / reject decision
   - How each fits Allternit Agent Hub or composer tagging

2. Implement in this phase (production quality, full implementation, no stubs):
   - Add a new "Agent Hub" packaged-bot session type. Each bot appears as a tab/item in the left rail and opens a fully packaged bot session view (chat + tools + context).
   - Create at least two concrete packaged bot templates (e.g., "SEO Expert", "Media Buyer") modeled after agency-agents/treg, with system prompts, available tools, and a session store.
   - Implement OpenTag-style composer tagging if OpenTag itself is not the right fit: allow users to type `@` or `#` in the composer to tag agents, tools, or scripts; render tags as visual chips.
   - Add the bot templates and tag UI to the existing Agent Hub view (`src/views/AgentHub.tsx`) and ensure they are reachable from the left rail.

3. When finished, write `docs/agent-tasks/AGENT_HUB_BOTS_PHASE_1_NOTES.md` with YAML frontmatter:
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
