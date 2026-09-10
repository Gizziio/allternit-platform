# Steering Checkpoint — agent-sessions /sync caller (P5 native-sessions)

## Goal
Point the web `/api/v1/agent-sessions/sync` caller at the real data-plane
contract (`transform_bus_event` on allternit-api / gizzi agent-compat) instead
of the invented `{ type: "session.created", payload: { session } }` envelope.
Do not reshape events in cloud-api; the relay stays verbatim.

## Just did
- Created worktree `allternit-session-43d9456` on `session/43d9456` from
  `origin/main` (`b7bd3d518`).
- Parser `agent-session-sync.ts` pinned to `transform_bus_event` wire types.
- `mode-session-store` + `createSyncSource(lastEventId)` consume that contract.
- `CloudApiEventSource` forwards `Last-Event-ID`; 8013 `sync_sessions` honors
  `?since=` like gizzi agent-compat.

## Next
1. Vitest the new parser + event-source tests; typecheck the surface.
2. `cargo check -p allternit-api` for the `?since=` query.

## Open questions
- `todo.updated` is consumed by session-composer but is not in
  `transform_bus_event`. Leave it; do not invent a service event.
