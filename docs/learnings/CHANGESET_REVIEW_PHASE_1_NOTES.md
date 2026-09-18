---
status: done
files_changed:
  - surfaces/allternit-mobile/ios/Core/API/PermissionClient.swift
  - surfaces/allternit-mobile/ios/Features/Code/ChangesetReviewSheet.swift
  - surfaces/allternit-mobile/ios/Features/Code/CodeModeView.swift
deviations:
  - "metadata decoding: used a narrow typed struct (`PermissionMetadata { diff: String?, filediff: FileDiffCounts? }`) instead of the spec's literal `[String: AnyCodable]` snippet. No `AnyCodable`/`AnyDecodable` type exists anywhere in the repo (checked `Core/` and `Features/`), and the spec itself allows decoding narrowly 'if that's simpler and matches repo conventions better' — a plain struct with two optional fields is simpler than adding a general-purpose JSON value type for a Phase 1 UI that only ever reads two keys."
  - "filediff field names: the spec's prose said 'add/delete Int? counts,' but the actual server type (`Snapshot.FileDiff`, used in `edit.ts:112-122`) names them `additions`/`deletions`. Matched the real wire field names instead of the spec's paraphrase."
  - "reply(...) return type: `POST /v1/permission/:requestID/reply` answers the JSON literal `true` (`c.json(true)` in permission.ts:70), not an empty body — `PermissionClient.reply` decodes it as `Bool` and discards it, since `APIClient` has no post-with-body-and-no-response helper."
  - "poll cancellation: implemented as a second `.task { await pollPendingPermissions() }` modifier on `CodeThreadChatView` whose internal `while !Task.isCancelled` loop relies on SwiftUI's built-in `.task` cancellation-on-disappear, rather than a hand-stored `Task` property cancelled from `.onDisappear`. This is the same underlying mechanism the spec pointed at (mirroring the terminal's `.task`/`.onDisappear` pair) — SwiftUI cancels `.task` automatically, so no explicit onDisappear call was needed for this particular Task the way `terminalSession?.stop()` is needed to tear down the pty's own internally-managed receive loop."
remaining: none
---

## Metadata decoding

`metadata` is `Record<string, any>` server-side but Phase 1's UI only ever
reads `diff` (a `String?`) and `filediff.additions` / `filediff.deletions`
(`Int?`). Rather than adding a generic `AnyCodable` type (none existed in the
repo — confirmed by grepping `Core/` and `Features/`), `PermissionMetadata`
is a small `Decodable` struct with exactly those two optional fields (plus a
nested `FileDiffCounts` struct for `filediff`). `Decodable` ignores
undeclared JSON keys automatically, so any other metadata (e.g. `filepath`,
`diagnostics`) decodes fine without being modeled — it's just not read.

## Banner + sheet

`CodeThreadChatView` now polls `GET /v1/permission` every 4 seconds via a
`.task` loop (started alongside the existing instance-registry warm-up
`.task`, cancelled the same way — implicitly, when the view leaves the
hierarchy), filters the result to this thread's own `sessionID`, and stores
it in `@State private var pendingPermissions: [PermissionRequest]`, sorted
oldest-first by id.

Whenever that list is non-empty, a single-line banner renders above the
chat/terminal `Group` (so it's visible in both `showTerminal` states,
matching the shell view's own background/toolbar conventions — `Color`
named assets, `Theme.statusWarning` for the icon): a shield icon, "N
change(s) awaiting review" text, and a trailing chevron. Tapping it presents
`ChangesetReviewSheet` as a `.sheet(item:)` for the oldest pending request.

`ChangesetReviewSheet` shows:
- A header: the permission name (capitalized, e.g. "Edit"), the first
  pattern (the relative file path, monospaced caption, truncated in the
  middle for long paths), and a `+N`/`-N` addition/deletion count line when
  `filediff` is present and non-zero (green for additions via
  `Theme.statusSuccess`, red for deletions — matching the plain `.red` used
  elsewhere in this same file for destructive/error text, since no
  dedicated "error" color asset exists in the catalog).
- The diff itself (when `metadata.diff` is present): each line of the
  unified diff rendered as its own row, monospaced caption font, full-width,
  with a translucent green background for `+`-prefixed lines, translucent
  red for `-`-prefixed lines, and no background for context lines and
  `---`/`+++`/`@@` headers. The whole block sits in a `BgPanel` rounded
  rectangle with a subtle warm border, mirroring the panel/card idiom used
  throughout `CodeModeView.swift` (e.g. `pairedCard`).
- A fallback (when `metadata.diff` is absent, e.g. a `bash` permission):
  "No diff preview for this permission." plus each `patterns` entry listed
  monospaced.
- A bottom action bar (`.safeAreaInset(edge: .bottom)`, three bordered
  buttons: Reject (red), Always Allow (primary text color), Approve (green,
  semibold) — calling `PermissionClient.shared.reply(requestID:reply:)` with
  `.reject` / `.always` / `.once` respectively. On success the sheet calls
  `onResolved(request)` (which the host view uses to optimistically drop the
  request from `pendingPermissions` immediately) and dismisses itself. On
  failure the error's `localizedDescription` is shown inline above the
  action bar instead of being swallowed, and the sheet stays open so the
  user can retry or cancel.

## Assumptions

- **"Oldest pending request"** isn't explicitly defined by the ordering the
  server returns (`Object.values(s.pending)`, which is JS object insertion
  order, not guaranteed request-time order for all key shapes). Since
  permission ids are generated via `Identifier.ascending("permission")`
  (`next.ts:182`), sorting the filtered list by `id` ascending is a more
  robust proxy for "oldest" than trusting array order, so that's what the
  poll does before taking `.first`.
- **Sessionless threads** (`sessionId == nil`, a not-yet-created "New
  Thread") have no session id to filter permissions against, so polling is
  skipped entirely for them (`guard let sessionId else { return }`) rather
  than fetching and discarding every poll.
- **Polling failures are silent** (`try? await PermissionClient.shared.listPending()`,
  falling through to retry on the next 4s tick) rather than surfaced as an
  error banner — a transient network blip on a background poll isn't worth
  interrupting the thread view, and the existing pending list (if any) is
  left untouched rather than cleared, so a real pending approval doesn't
  flicker away on one failed poll.
- **Poll interval** is a fixed 4 seconds (within the spec's suggested 3-5s
  range) with no backoff — Phase 1 is explicitly poll-only, so this matches
  the simplest reading of "a lightweight poll... every 3-5s."
- Not verified with an actual Xcode build/run in this session per the task's
  constraints ("No Xcode build/run required from you"); a background
  `xcodebuild` type-check was kicked off separately as a sanity pass. It
  never reached Swift compilation — it failed earlier, at the link stage,
  on `error: There is no XCFramework found at
  '.../Frameworks/Mesh.xcframework'`, a pre-existing local-environment gap
  (the binary framework isn't checked into the repo and this environment
  never fetched/built it) that predates and is unrelated to this change.
  All three new/changed files were manually cross-checked instead: every
  type referenced (`APIClient`, `AuthManager`, `AppConfig.gizziCodeBaseURL`,
  `Theme.*`, named color assets, `PermissionRequest`/`PermissionReply`/
  `PermissionMetadata` themselves) exists and matches the shape used here.
