# Agent Activity — iOS Phase 1 Task

Read `docs/AGENT_ACTIVITY_IOS_MAP.md` first — full grounded backend contract and iOS conventions. Also skim `docs/agent-activity-design/mockup-v3.html` for the visual/interaction intent (status colors, typed review cards, reservation/guard treatment) — translate the *design intent* into native SwiftUI idiom, don't port the HTML/CSS.

## Confirmed base-URL pattern (verified, not guessed)

`Features/ACI/Services/ACIAgentClient.swift` is the exact precedent: ACI's routes are also mounted directly under `/api` (not `/api/v1`), and it solves this exactly by adding `AppConfig.aciBaseURL` (derived by stripping `v1` from `apiBaseURL` and appending the real mount name) then using `APIClient.authorizedRequest(url:)` against that absolute URL. Copy this pattern precisely:

1. In `Core/AppConfig.swift`, add `static let railsBaseURL: URL` immediately after `aciBaseURL`, identical derivation, appending `"rails"` instead of `"aci"`.
2. New client wraps `APIClient.shared` + `AppConfig.railsBaseURL`, exactly like `ACIAgentClient`'s `init(client: APIClient = .shared, baseURL: URL = AppConfig.aciBaseURL)`.

## Files to add

1. **`Core/API/Models/AgentActivityThread.swift`** — `AgentActivityThreadSummary { threadId: String, messageCount: Int, lastActivityAt: String }` (from `GET /api/rails/mail/threads`'s `{ thread_id, messages, last_ts }` — map field names via `CodingKeys`), `AgentActivityMessage { messageId, threadId, fromAgent, body: String?, eventType, timestamp }` (from `GET /api/rails/mail/thread/:id`'s `messages[]` — decode `body` leniently: try `String`, else nil, don't crash on non-string JSON), `LedgerEvent { eventId: String, eventType: String, ts: String, payload: [String: AnyDecodableValue] }` or similar minimal shape sufficient to read `event_type` and look for a `thread_id`/`mail_thread_id` key in `payload` (check for an existing loosely-typed JSON value decoder in this codebase — `CronJob`'s handling of a `Record<string, unknown>`-shaped field, or `PermissionMetadata`, may already have a pattern to reuse rather than inventing a new one).
2. **`Core/API/AgentActivityClient.swift`** — methods: `listThreads() async throws -> [AgentActivityThreadSummary]` (`GET rails/mail/threads`), `getThreadMessages(threadId:) async throws -> [AgentActivityMessage]` (`GET rails/mail/thread/{id}`), `send(threadId:body:) async throws` (`POST rails/mail/send`, body `{thread, body}`), `decide(threadId:approve:) async throws` (`POST rails/mail/decide`, body `{thread, approve}`), `share(threadId:assetRef:note:) async throws` (`POST rails/mail/share`), `tailLedger(count:) async throws -> [LedgerEvent]` (`POST rails/ledger/tail`, body `{count}`). Doc-comment each method citing the exact `cmd/allternit-api/src/rails/mod.rs` line, matching this codebase's established citation style (see any recent client, e.g. `CronClient.swift`).
3. **`Core/AgentActivityStore.swift`** — `@MainActor final class AgentActivityStore: ObservableObject`, `static let shared`, `@Published private(set) var threads: [AgentActivityThreadSummary]`, `refresh()`, and per-thread derived state (review/guard/reservation flags) computed from a batch `tailLedger` call — mirror the heuristic in `docs/AGENT_ACTIVITY_WEB_PHASE_1_NOTES.md`'s "What reservation/guard data actually looked like" section exactly (substring match on `event_type`, read-only, no fabricated structured reservation data).
4. **`Features/AgentActivity/Views/AgentActivityListView.swift`** — list of threads (topic = `threadId` displayed as-is per the map doc's finding — this is real, current backend behavior, not a bug to work around here), review/guard/reservation tags, unread heuristic (define "unread" as: has any message this store hasn't already fetched-and-displayed once — since there's no server-side ack-per-device concept confirmed for iOS, keep this simple and local, don't invent a fake ack call unless you find iOS already has one). Tap **pushes** `AgentActivityDetailView` via `NavigationStack`/`.navigationDestination(item:)` (native push, not `.sheet` — this satisfies the "not a modal" constraint from the web phase's product feedback automatically, since push navigation is SwiftUI's non-modal idiom).
5. **`Features/AgentActivity/Views/AgentActivityDetailView.swift`** — full message history (no height cap), a typed review card when the ledger-derived heuristic shows a pending review for this thread (Approve/Reject calling `decide(threadId:approve:)`), guard/reservation context cards (read-only), a reply text field + send button (`send(threadId:body:)`).
6. **Entry point** — read `Features/Chat/Views/ComposerPlusSheet.swift` (already has `coworkTasksRow`/`permissionsRow`/`projectRow` — this session's own established pattern for "utility feature reachable from the composer sheet") and decide whether Agent Activity fits that same list (a `menuRow` + `.sheet` launching a list, same as `CoworkTasksListView`'s own entry) or deserves a different placement (e.g. a badge/icon somewhere more persistently visible, if this codebase has an existing persistent-badge convention — check before inventing one). Justify your choice in the notes; either is acceptable if grounded in a real existing pattern.

## Explicitly out of scope

- Archive (see map doc — web's own phase found this maps to confusing, workaround-of-a-workaround server semantics; don't replicate that on iOS yet).
- gizzi-code CLI phase — separate, later.
- No backend changes.
- Do NOT start any item from `docs/SURFACE_AUDIT_PROGRESS.md` — unrelated, separate tracked work.

## Constraints

- Match repo idiom exactly: the `ACIAgentClient`/`APIClient.authorizedRequest(url:)` pattern for the base-URL derivation (this is the one part of this task that's easy to get subtly wrong — verify against the real file, don't work from memory of this doc's summary), `CronJobStore`/`CoworkTasksStore`'s store shape, `AutomationTasksListView`/`ProjectsListView`'s list/push-navigation shape.
- No git operations.
- No Xcode build/run required — this sandboxed environment can't build (`Mesh.xcframework` missing, confirmed pre-existing across every iOS phase this session). `swiftc -parse` on every new/changed file is required and must be clean.
- If the ledger-tail-derived guard/reservation heuristic doesn't turn up anything meaningfully different from what the web phase already documented, say so plainly rather than inventing richer behavior than the real data supports.

## Deliverable

`docs/AGENT_ACTIVITY_IOS_PHASE_1_NOTES.md`, YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`), then prose: confirm the base-URL derivation matches `ACIAgentClient`'s pattern exactly, describe the entry-point placement decision and why, and any assumption made where this spec was ambiguous. That file existing = done.
