# Steering Checkpoint — native-sessions catalog caller (P5)

## Goal
Point `/api/v1/native-sessions` list/pickup/show at the same control-plane
relay agent-sessions uses. The catalog contract lives on the node (8013 →
gizzi `/v1/native-session/*`); cloud-api is a verbatim relay. Do not hit the
SPA origin.

## Just did
- Created worktree `allternit-session-43d9456-ns` on `session/43d9456-ns`
  from `origin/main` (`3e12d7188`).
- Root cause: `native-sessions-api.ts` always uses `getGatewayOrigin()`
  (empty on web → relative `/api/v1/native-sessions` → SPA HTML). Agent-
  sessions already targets `getCloudApiBaseUrl()` when the flag is on.
  Pickup also forwards `surface: "bot"`, which gizzi's enum rejects.

## Next
- PR + merge. Ledger attestation after merge.

## Open questions
- None. `todo.updated` on /sync stays deferred.
