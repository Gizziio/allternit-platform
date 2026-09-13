---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/agents-console-api.ts
  - surfaces/ai.allternit.com/src/lib/agents-console-api.test.ts
  - surfaces/ai.allternit.com/src/views/agent-cloud/AgentsConsoleView.tsx
  - surfaces/ai.allternit.com/src/shell/ViewRegistry.tsx
  - surfaces/ai.allternit.com/src/lib/i18n/locales/en.json
deviations:
  - Implemented in grok session (named-slug execute). Replaced the Agent Cloud view slot rather than adding a second nav id.
remaining:
  - Slice 2 composer modes, Slice 3 recents, Slice 4 docs site
  - Browser e2e against a live Hub (no browser MCP in this session)
brain_updates:
  - Hub view agent-cloud is Agents Console wired to Cloud Agents /api/v1/sessions.
---

Slice 1 Agents Console. vitest agents-console-api.test.ts 4/4.
