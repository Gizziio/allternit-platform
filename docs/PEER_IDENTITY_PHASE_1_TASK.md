# Peer Identity Phase 1 — Task

Implement automatic peer identity discovery for the new Code Mode peer collaboration
surface. This is ADR-0044 rollout-gate run 2 and must exercise an interactive Codex
executor with verified steering.

## Required behavior

1. In `cmd/gizzi-code/src/runtime/server/routes/peers.ts`, add `GET /context`.
2. The response must be honest and shaped as:
   `{ team: string | null, agent: string, source: "runtime" | "fallback" }`.
3. Use the existing Gizzi identity helpers. Runtime identity is available only when
   `getTeamName()` returns a non-empty team. When it does, return that team and
   `getAgentName() ?? TEAM_LEAD_NAME`, with `source: "runtime"`.
4. When no runtime team exists, return `team: null`, `agent: TEAM_LEAD_NAME`, and
   `source: "fallback"`. Do not invent or scan for a team.
5. In `surfaces/ai.allternit.com/src/views/code/peer-collaboration.service.ts`, add a
   typed `getPeerContext()` client for `/v1/peers/context`.
6. In `PeerCollaborationCenter.tsx`, request context once on mount. If the response
   source is `runtime`, replace the current team and self values. If it is fallback,
   preserve the user's saved team value and only use the returned agent when no saved
   self value exists.
7. Show a small identity-source label (`Runtime identity` or `Saved identity`) near
   the team/self fields. Keep the fields editable for recovery.
8. Context lookup failure must not break peer list or inbox refresh; retain saved
   values and surface no new blocking error.

## Exact scope

- `cmd/gizzi-code/src/runtime/server/routes/peers.ts`
- `surfaces/ai.allternit.com/src/views/code/peer-collaboration.service.ts`
- `surfaces/ai.allternit.com/src/views/code/PeerCollaborationCenter.tsx`
- `docs/PEER_IDENTITY_PHASE_1_NOTES.md` (completion sentinel)

Do not modify anything else. Do not start another phase.

## Constraints

- No builds, typechecks, tests, development servers, git operations, commits, or pushes.
- Match existing code style and API conventions.
- Do not change ADR-0044 or introduce orchestrator HTTP/MCP routes.
- Do not overwrite or revert concurrent edits.

## Completion contract

When finished, write `docs/PEER_IDENTITY_PHASE_1_NOTES.md` beginning with YAML
frontmatter containing exactly these keys:

```yaml
---
status: done
files_changed:
  - path
deviations: []
remaining: []
---
```

Use `status: blocked` and explain the blocker when the task cannot be completed. The
notes file existing is the only completion signal.
