import Foundation

/// Client for gizzi-code's permission/approval queue
/// (`cmd/gizzi-code/src/runtime/tools/guard/permission/next.ts`), mounted at
/// `/v1/permission` (`cmd/gizzi-code/src/runtime/server/server.ts:464`,
/// `cmd/gizzi-code/src/runtime/server/routes/permission.ts`) — same shape as
/// `PtyClient`: always talks directly to `AppConfig.gizziCodeBaseURL`
/// through a plain `APIClient`.
///
/// Phase 1 is poll-only (`GET /v1/permission` on an interval from the host
/// view) — the bus events behind `permission.ts`'s SSE `/event` route
/// (`Event.Asked`/`Event.Replied`, `next.ts:101-111`) aren't wired here.
final class PermissionClient: @unchecked Sendable {
    static let shared = PermissionClient()

    private let client: APIClient

    init(baseURL: URL = AppConfig.gizziCodeBaseURL) {
        self.client = APIClient(
            baseURL: baseURL,
            tokenProvider: { try await AuthManager.shared.getToken() }
        )
    }

    /// `GET /v1/permission` — every pending request across all sessions
    /// (`permission.ts:73-93`, backed by `PermissionNext.list()` at
    /// `next.ts:470-473`). Callers filter down to their own session id.
    func listPending() async throws -> [PermissionRequest] {
        try await client.get(path: "v1/permission")
    }

    /// `POST /v1/permission/:requestID/reply` — body `{ reply, message? }`
    /// (`permission.ts:42-71`, `PermissionNext.reply` at `next.ts:208-297`).
    /// The route answers the JSON literal `true` (`c.json(true)`), not a
    /// model — decoded as `Bool` and discarded.
    func reply(requestID: String, reply: PermissionReply, message: String? = nil) async throws {
        let _: Bool = try await client.post(
            path: "v1/permission/\(Self.escape(requestID))/reply",
            body: ReplyRequestBody(reply: reply, message: message)
        )
    }

    /// Same path-escaping idiom as `PtyClient.escape` (parity with the web's
    /// `encodeURIComponent` on path ids).
    private static func escape(_ requestID: String) -> String {
        requestID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? requestID
    }
}

private struct ReplyRequestBody: Encodable {
    let reply: PermissionReply
    let message: String?
}

/// Mirrors `PermissionNext.Request` (`next.ts:71-88`) field-for-field. The
/// server's `tool?: { messageID, callID }` isn't needed for Phase 1 UI and is
/// omitted here — `Decodable` ignores unknown/undeclared JSON keys, so
/// leaving it out doesn't block decoding requests that carry it.
struct PermissionRequest: Decodable, Sendable, Identifiable {
    let id: String
    let sessionID: String
    /// e.g. "edit", "write", "patch", "multiedit", "bash".
    let permission: String
    let patterns: [String]
    let metadata: PermissionMetadata
    let always: [String]
}

/// Mirrors `PermissionNext.Reply` (`next.ts:90-91`).
enum PermissionReply: String, Encodable {
    case once, always, reject
}

/// Narrow decode of `metadata: Record<string, any>` (`next.ts:77`).
///
/// No `AnyCodable`/`AnyDecodable` type exists anywhere in this codebase
/// (checked `Core/` and `Features/`), and Phase 1's UI only ever reads two
/// keys, so this decodes exactly those rather than adding a general-purpose
/// JSON value type:
/// - `diff` — the unified diff string `edit.ts:48-149` attaches via
///   `createTwoFilesPatch` on every edit/write/patch/multiedit call that
///   goes through the permission gate.
/// - `filediff` — `Snapshot.FileDiff`'s `additions`/`deletions` line counts
///   (also set in `edit.ts`, e.g. lines 112-122).
///
/// Both are absent for non-file-edit permissions (e.g. `bash`), which is
/// exactly the fallback-UI case (`ChangesetReviewSheet`). Any other metadata
/// keys are ignored by `Decodable` automatically.
struct PermissionMetadata: Decodable, Sendable {
    let diff: String?
    let filediff: FileDiffCounts?

    struct FileDiffCounts: Decodable, Sendable {
        let additions: Int?
        let deletions: Int?
    }
}
