# Changeset Review — Phase 1 Task (iOS only)

Read `docs/CHANGESET_REVIEW_MAP.md` first — it has the full grounded analysis (exact file paths/line numbers on both sides) backing every decision below. Do not re-derive it; apply it.

## Scope

Build iOS support for reviewing and approving/rejecting a pending file-edit permission request from a gizzi-code coding session, surfaced inside the existing Code tab. This is a pure consumer of an already-working backend API — no backend changes in this phase.

Files to add (all under `surfaces/allternit-mobile/ios/`):

1. **`Core/API/PermissionClient.swift`** — new REST client, same shape as `Core/API/PtyClient.swift` (read it first for the exact idiom: `static let shared`, `init(baseURL: URL = AppConfig.gizziCodeBaseURL)`, wraps an `APIClient` with `tokenProvider: { try await AuthManager.shared.getToken() }`).
   - `func listPending() async throws -> [PermissionRequest]` → `client.get(path: "v1/permission")`
   - `func reply(requestID: String, reply: PermissionReply, message: String? = nil) async throws` → `client.post(path: "v1/permission/\(Self.escape(requestID))/reply", body: ...)` (see `PtyClient.escape` for the existing path-escaping helper — reuse the same pattern, do not duplicate logic elsewhere).
   - Model types, matching `cmd/gizzi-code/src/runtime/tools/guard/permission/next.ts:69-91` exactly (field names/types):
     ```swift
     struct PermissionRequest: Decodable, Sendable, Identifiable {
         let id: String
         let sessionID: String
         let permission: String       // e.g. "edit", "write", "bash"
         let patterns: [String]
         let metadata: [String: AnyCodable]   // see note below on AnyCodable
         let always: [String]
         // `tool` field exists server-side but is not needed for Phase 1 UI — omit or decode-and-ignore, do not block decoding if present
     }
     enum PermissionReply: String, Encodable {
         case once, always, reject
     }
     ```
   - `metadata` is a `Record<string, any>` server-side. Check whether this codebase already has an `AnyCodable`-style type for decoding arbitrary JSON (search for `AnyCodable`, `AnyDecodable`, or similar in `Core/`). If one exists, use it. If not, add a minimal one scoped to this file (do not build a general-purpose JSON library) — you only need to read `metadata["diff"]` as a `String?` and `metadata["filediff"]` as add/delete `Int?` counts; decode narrowly for exactly those two keys rather than a fully generic `AnyCodable` if that's simpler and matches repo conventions better.

2. **A diff-rendering view**, e.g. `Features/Code/ChangesetReviewSheet.swift`:
   - Input: a `PermissionRequest` whose `metadata["diff"]` is present (unified diff format, from `createTwoFilesPatch` — standard `+`/`-`/` ` prefixed lines with `@@` hunk headers).
   - Render as a monospaced, line-by-line view: added lines (prefix `+`) in a green-tinted background, removed lines (prefix `-`) in a red-tinted background, context lines plain. Look at how `TerminalSessionView.swift` renders monospaced terminal content (it uses SwiftTerm directly, so it won't have a directly reusable text-diff component — instead check `Features/` broadly for any existing code/monospace text view idiom, e.g. syntax highlighting in chat code blocks, and match font/sizing conventions from there, e.g. `Font.system(.body, design: .monospaced)`).
   - If `metadata["diff"]` is absent (e.g. a `bash` permission, not a file edit), render a simpler fallback: show `permission` + `patterns` as plain text, no diff view.
   - Three actions, matching `PermissionReply`: **Approve** (`.once`), **Always Allow** (`.always`), **Reject** (`.reject`) — call `PermissionClient.shared.reply(...)`, dismiss the sheet on success, show an inline error (do not silently swallow failures) on failure.

3. **Wire into `Features/Code/CodeModeView.swift`**, inside `CodeThreadChatView` (lines ~576-800):
   - Add `@State private var pendingPermissions: [PermissionRequest] = []` and a lightweight poll (e.g. a `Task` loop with `Task.sleep` every 3-5s while the view is visible, cancelled in `.onDisappear` — mirror the existing `.task { await session.start() }` / `.onDisappear { session.stop() }` pattern already on this view for the terminal session lifecycle, do not invent a different lifecycle idiom) calling `PermissionClient.shared.listPending()`, filtered to `sessionID == sessionId` (the view's own session id — check how `sessionId` is already scoped in this file).
   - When `pendingPermissions` is non-empty, show a banner above the chat/terminal content (visible in both `showTerminal` states) — a single line like "1 change awaiting review" with a chevron/button that presents `ChangesetReviewSheet` for the oldest pending request as a `.sheet(...)`. Match existing banner/toolbar visual conventions in this file (colors via named assets like `Color("BgPrimary")`, not hardcoded hex).
   - After a reply succeeds, remove that request from `pendingPermissions` immediately (optimistic) in addition to the next poll naturally clearing it.

## Explicitly out of scope for this phase

- No backend/gizzi-code changes — the API already works.
- No SSE/push wiring (`/event` route) — polling only.
- No permission-mode switching UI (`/v1/permission/mode/:sessionID`).
- No Android/web/desktop changes.
- Do NOT start any other item from `docs/SURFACE_AUDIT_PROGRESS.md` — this phase is Changeset Review only.

## Constraints

- Match existing repo idiom exactly: SwiftUI (no UIKit view controllers unless an existing pattern already does that for a similar case), the `APIClient`/`PtyClient` REST-client shape, named color assets not hardcoded colors, doc-comments in the same style as `PtyClient.swift` (explain *why*, cite exact backend file:line where relevant — future readers should be able to jump straight to the server-side code).
- No git operations (no commits, no branches) — just write the files.
- No Xcode build/run required from you — a build-and-review pass happens afterward, separately. Just make sure the Swift is syntactically complete and self-consistent (no dangling references to types/functions that don't exist).
- Do not touch `PtyClient.swift`, `TerminalSessionView.swift`, or any backend file — this phase is additive only, plus the one edit to `CodeModeView.swift` described above.

## Deliverable

When finished, write `docs/CHANGESET_REVIEW_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done  # or blocked
files_changed: [list of exact paths]
deviations: [what you changed from this spec and why, or "none"]
remaining: [anything left undone, or "none"]
---
```

Followed by prose notes: what `AnyCodable`/metadata-decoding approach you landed on and why, what the banner/sheet actually looks like (describe it — no screenshot available), and any assumption you had to make that wasn't fully specified above.

That file existing = done.
