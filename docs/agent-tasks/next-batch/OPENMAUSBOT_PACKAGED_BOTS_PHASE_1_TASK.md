# OpenMausBot Packaged Bots — Phase 1 Task

**Scope:** Add a "Bots" presentation layer to Agent Hub that lets users discover, configure, and launch packaged bot sessions from the left rail. This is a surface-only integration; it does not replace the existing agent runtime. It reuses the existing session/composer infrastructure.

**Agent:** kimi
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-openmausbot`

## Deliverables

1. New tab in Agent Hub:
   - File: `surfaces/ai.allternit.com/src/views/agent-hub/main/AgentHub.constants.ts`
   - Add `'bots'` to `AgentTab` union and add a `Bots` entry to `TABS` with an appropriate icon.
2. New view component:
   - File: `surfaces/ai.allternit.com/src/views/agent-hub/main/AgentHubBotsTab.tsx`
   - Show a searchable grid of packaged bot cards. Each card: icon, name, description, tags, "Start Session" button.
   - Data source: a static manifest file (see #3).
3. Bot manifest and types:
   - File: `surfaces/ai.allternit.com/src/lib/bots/bots.manifest.ts`
   - Export `PACKAGED_BOTS: PackagedBot[]` with at least 6 curated templates (e.g., Deep Researcher, Code Reviewer, Writing Partner, Data Analyst, Social SDR, UX Auditor).
   - File: `surfaces/ai.allternit.com/src/lib/bots/bots.types.ts`
   - Define `PackagedBot` interface with `id`, `name`, `description`, `icon`, `tags`, `systemPrompt`, `defaultModel?`, `starterMessages?`.
4. Session launch:
   - File: `surfaces/ai.allternit.com/src/lib/bots/useBotSession.ts`
   - Hook that calls the existing session creation API (`src/services/allternit-ai/session-api.ts` or `src/lib/agents/session-metadata.ts`) and navigates to `/shell/sessions/:id`.
5. Wire tab content:
   - File: `surfaces/ai.allternit.com/src/views/agent-hub/main/AgentHubContent.tsx`
   - Add a `case 'bots':` rendering `AgentHubBotsTab`.

## Constraints

- Match existing surface styling: CSS variables (`--bg-elevated`, `--text-primary`, `--accent-primary`, `--border-subtle`, etc.), Tailwind + `cn()`.
- Use existing icons from `@phosphor-icons/react`.
- Do not modify the session runtime; only create sessions with pre-filled metadata.
- Do not run dev servers. Final validation: `bun install` (if needed) then `bun typecheck` from `surfaces/ai.allternit.com`. If typecheck fails due to native deps, use `bun install --ignore-scripts` and run `bun x tsc --noEmit`.
- No git commits/pushes.

## Reference

- `surfaces/ai.allternit.com/src/views/agent-hub/main/AgentHub.constants.ts`
- `surfaces/ai.allternit.com/src/views/agent-hub/main/AgentHubContent.tsx`
- `surfaces/ai.allternit.com/src/views/agent-hub/main/AgentSessionsTab.tsx`
- `surfaces/ai.allternit.com/src/lib/agents/session-metadata.ts`
- `surfaces/ai.allternit.com/src/services/allternit-ai/session-api.ts`

## Sentinel

When finished, write `docs/agent-tasks/OPENMAUSBOT_PACKAGED_BOTS_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/agent-hub/main/AgentHub.constants.ts
  - surfaces/ai.allternit.com/src/views/agent-hub/main/AgentHubContent.tsx
  - surfaces/ai.allternit.com/src/views/agent-hub/main/AgentHubBotsTab.tsx
  - surfaces/ai.allternit.com/src/lib/bots/bots.types.ts
  - surfaces/ai.allternit.com/src/lib/bots/bots.manifest.ts
  - surfaces/ai.allternit.com/src/lib/bots/useBotSession.ts
deviations: []
remaining: []
```

Then prose notes summarizing what was built and validation results.
