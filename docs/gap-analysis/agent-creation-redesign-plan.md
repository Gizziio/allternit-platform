# Agent Creation Wizard — Redesign Plan

## Philosophy

**Delete the theater. Wire the real infrastructure.**

The existing wizard is 3,165 lines of RPG stats, personality sliders, avatar builders, and forge animations that produce functionally identical GPT-4o wrappers. The codebase already has a real plugin runtime, tool registry, MCP client, and 35+ specialist templates. The wizard ignores all of it.

## New Flow: 4 Steps, All Real

```
Step 1: Template     → Pick from 35+ specialist templates OR start blank
Step 2: Identity     → Name, description, type (what exists today, keep it)
Step 3: Configure    → Model, temperature, system prompt (what exists today, keep it)
Step 4: Capabilities → REAL tool selection from tool registry + plugins + MCPs
Step 5: Knowledge    → Attach memory documents / RAG sources
Step 6: Review       → Summary card → SAVE (no fake animation)
```

## What Gets Deleted

| Fake Element | Action |
|-------------|--------|
| 6-second "Forge" animation | Delete. Call API immediately. |
| RPG stats (Level, XP, Class, RIG/THR/SAF/FIT) | Delete entirely |
| Big Five personality sliders | Delete. If kept, must auto-generate system prompt text. |
| Avatar builder (body shapes, eyes, antenna) | Replace with simple initial + color picker |
| Workspace layer toggles (cognitive, governance, etc.) | Delete or make functional |
| Redundant 4-step `AgentCreationWizard` | Delete, consolidate to one wizard |

## What Gets Built

### 1. Template Selection Step (NEW)
- Grid of specialist templates from `SPECIALIST_TEMPLATES`
- Each card shows: role, description, recommended tools
- Selecting a template pre-fills: systemPrompt, tools, capabilities, temperature, model
- "Start from scratch" option

### 2. Real Tool Selection (REPLACES fake "Capabilities Marketplace")
- Fetch from `useToolRegistryStore.fetchKernelTools()`
- Show actual tools by category: File System, Web, Database, AI, Security, etc.
- Toggle enable/disable per tool
- Show tool description + parameters
- Plugin skills as separate section
- MCP servers as separate section

### 3. Knowledge Attachment (NEW)
- Fetch from `useAgentMemoryStore.fetchDocuments()`
- Toggle which memory documents this agent can access
- Show document count + indexing status

### 4. Clean Review Step
- Show summary: name, model, enabled tools count, knowledge docs count
- "Create Agent" button → immediate API call
- No animation theater

## Files to Modify

| File | Action |
|------|--------|
| `src/views/agent-view/components/CreateAgentForm.tsx` | Major rewrite — replace 7-step with 4-step real flow |
| `src/views/agent-view/components/AgentCreationWizard.tsx` | Delete — redundant |
| `src/lib/agents/agent.types.ts` | Add `knowledgeDocIds` and `enabledTools` to Agent model |
| `src/lib/agents/agent.store.ts` | Wire tool registry fetch into agent creation |
| `prisma/schema.prisma` | Add `enabledTools` JSON and `knowledgeDocIds` JSON to Agent |

## Implementation Order

1. **Prisma migration** — add new fields
2. **Type updates** — Agent model, CreateAgentInput
3. **Template selection component** — grid of SPECIALIST_TEMPLATES
4. **Real tool selector component** — wire to tool registry store
5. **Knowledge attachment component** — wire to memory store
6. **Rewrite CreateAgentForm** — assemble steps, delete fake steps
7. **Delete redundant wizard** — remove AgentCreationWizard
8. **Test** — create agents with real tool selections
