# Changeset Review — Cross-Surface Map

Source: `docs/SURFACE_AUDIT_FINAL_REPORT.md`, DAG suite section, row "Changeset Review" — classified `GAP`, tier-a priority (the single most concrete, user-facing gap in the whole audit).

## The gap

iOS's Code tab (`surfaces/allternit-mobile/ios/Features/Code/CodeModeView.swift`) lets a user start an agentic coding session backed by a real pty terminal (SwiftTerm), but there is no way to review or approve a pending file change before it's applied. A mobile user can kick off agentic coding work and has to trust it blind, or read raw terminal scrollback.

## What already exists (backend — gizzi-code)

gizzi-code has a complete, working permission/approval queue that already covers this:

- **Data model** — `cmd/gizzi-code/src/runtime/tools/guard/permission/next.ts:69-84`:
  ```ts
  Request = {
    id: string          // permission id
    sessionID: string
    permission: string  // e.g. "edit", "write", "bash"
    patterns: string[]
    metadata: Record<string, any>   // carries `diff` + `filediff` add/delete counts for file edits
    always: string[]
    tool?: { messageID: string, callID: string }
  }
  Reply = "once" | "always" | "reject"
  ```
- **Diff content** — `cmd/gizzi-code/src/runtime/tools/builtins/edit.ts:48-149` generates a real unified diff via `createTwoFilesPatch` and attaches it as `metadata.diff` on every edit/write/patch/multiedit tool call that goes through the permission gate.
- **API surface**, mounted at `/v1/permission` (`cmd/gizzi-code/src/runtime/server/server.ts:464` under the `/v1` router, matching the `v1/pty/...` pattern iOS's `PtyClient` already uses):
  - `GET /v1/permission` — list all pending requests across all sessions (`permission.ts:71-93`)
  - `POST /v1/permission/:requestID/reply` — body `{ reply: "once"|"always"|"reject", message?: string }` (`permission.ts:42-70`)
  - `GET /v1/permission/mode/:sessionID` / `PUT /v1/permission/mode/:sessionID` — read/set a session's permission mode (`manual`, `plan`, `acceptEdits`, `dontAsk`, `auto`, `yolo`, `bypassPermissions`)
- **Push channel** — a bus event exists (`Event.Asked` / `Event.Replied`, `next.ts:100-109`) and an SSE `/event` route is mounted (`server.ts:444`), so a live push is possible later; polling `GET /v1/permission` is a safe, simpler first implementation.

**Conclusion: no backend build-from-scratch needed.** This is real, working, and already exercised by web/desktop. It has just never been called from iOS.

## What's missing (iOS — fully greenfield)

Confirmed via direct code search — no `Diff`, `Changeset`, or `Patch` Swift type exists anywhere in `surfaces/allternit-mobile/ios/`.

- `PtyClient.swift` (`Core/API/PtyClient.swift`) only talks to `/v1/pty/*`; its WebSocket frame protocol (`PtySession`, line 121, frame kinds at line 269-289) has zero permission/diff support.
- `AgentChatClient.swift` / `AgentChatEvent.swift` (chat SSE stream) also has no permission/diff event case.
- The natural host view is `CodeThreadChatView` inside `CodeModeView.swift:576-800` — it already owns the `PtySession`/terminal lifecycle and toolbar (`.toolbar` block at line 607-634), and `TerminalSessionView.swift`'s `statusBanner` (line 53-73) is an existing pattern for rendering a transient state banner over the terminal that a pending-approval banner can mirror.
- Base URL for the new client: `AppConfig.gizziCodeBaseURL` (same as `PtyClient`), via `APIClient`'s pattern in `Core/API/APIClient.swift`.

## Scope decision for Phase 1

iOS-only. Build:
1. `PermissionClient.swift` — REST client for `GET /v1/permission` (poll) and `POST /v1/permission/:requestID/reply`.
2. Swift models mirroring `PermissionNext.Request` / `Reply` above (including a lightweight diff-line parser for `metadata.diff`, unified-diff format).
3. UI: a pending-approval banner in `CodeThreadChatView` (visible in both chat and terminal sub-views) that opens a review sheet showing the diff (added/removed lines, monospace, syntax-neutral) with Approve / Approve-always / Reject actions wired to `PermissionClient`.

Not in scope for Phase 1: SSE push (poll is fine to start), permission-mode switching UI (`/v1/permission/mode/:sessionID`), non-file-edit permission types (bash commands etc. — render generically via `permission`/`patterns` fields, but the diff-rendering path only applies when `metadata.diff` is present).
