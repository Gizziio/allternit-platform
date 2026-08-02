import Foundation

/// Client for the Rails Mail / ledger endpoints that back Agent Activity
/// (`cmd/allternit-api/src/rails/mod.rs`, routes registered at
/// rails/mod.rs:179-188).
///
/// The rails router is mounted directly under `/api`
/// (cmd/allternit-api/src/main.rs:334-335, `.nest("/api/rails",
/// rails_router())`) — NOT under `/api/v1` — so, exactly like
/// `ACIAgentClient` for `/api/aci/*`, requests go through
/// `APIClient.authorizedRequest(url:)` against `AppConfig.railsBaseURL`
/// rather than `APIClient.get/post(path:)`.
final class AgentActivityClient: @unchecked Sendable {
    private let client: APIClient
    private let baseURL: URL

    init(client: APIClient = .shared, baseURL: URL = AppConfig.railsBaseURL) {
        self.client = client
        self.baseURL = baseURL
    }

    // MARK: - Threads

    /// `GET /api/rails/mail/threads` (`list_mail_threads`,
    /// rails/mod.rs:843-864) → `{ threads: [{ thread_id, messages: <count>,
    /// last_ts }] }`.
    func listThreads() async throws -> [AgentActivityThreadSummary] {
        let request = try await client.authorizedRequest(url: baseURL.appendingPathComponent("mail/threads"))
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(AgentActivityThreadListResponse.self, from: data).threads
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// `GET /api/rails/mail/thread/:thread_id` (`read_mail_thread`,
    /// rails/mod.rs:877-908) → `{ messages: [{ message_id, thread_id,
    /// from_agent, body, event_type, timestamp }] }`.
    func getThreadMessages(threadId: String) async throws -> [AgentActivityMessage] {
        let request = try await client.authorizedRequest(
            url: baseURL.appendingPathComponent("mail/thread/\(Self.escape(threadId))")
        )
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(AgentActivityMessageListResponse.self, from: data).messages
        } catch {
            throw APIError.decoding(error)
        }
    }

    // MARK: - Actions

    private struct SendBody: Encodable {
        let thread: String
        let body: String
    }

    /// `POST /api/rails/mail/send` (`mail_send`, rails/mod.rs:620-667) — the
    /// legacy `{ thread, body }` shape is sufficient for a human reply (the
    /// richer `from_agent`/`to_agents`/`subject`/`importance` fields are the
    /// agent-to-agent typed-envelope path, not needed here) →
    /// `{ sent, thread_id }`, discarded — callers refresh the thread's
    /// messages separately.
    func send(threadId: String, body: String) async throws {
        var request = try await client.authorizedRequest(
            url: baseURL.appendingPathComponent("mail/send"), method: "POST"
        )
        request.httpBody = try JSONEncoder().encode(SendBody(thread: threadId, body: body))
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
    }

    private struct DecideBody: Encodable {
        let thread: String
        let approve: Bool
    }

    /// `POST /api/rails/mail/decide` (`mail_decide`, rails/mod.rs:989-1024) —
    /// `approve` is strictly boolean server-side (`MailDecideRequest`
    /// resolves it to `"accepted"`/`"rejected"`; there's no N-way decision)
    /// → `{ decided, thread_id }`, discarded.
    func decide(threadId: String, approve: Bool) async throws {
        var request = try await client.authorizedRequest(
            url: baseURL.appendingPathComponent("mail/decide"), method: "POST"
        )
        request.httpBody = try JSONEncoder().encode(DecideBody(thread: threadId, approve: approve))
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
    }

    private struct ShareBody: Encodable {
        let thread: String
        let assetRef: String
        let note: String?

        private enum CodingKeys: String, CodingKey {
            case thread
            case assetRef = "asset_ref"
            case note
        }
    }

    /// `POST /api/rails/mail/share` (`mail_share`, rails/mod.rs:916-963) →
    /// `{ shared, share_id, thread_id }`, discarded.
    func share(threadId: String, assetRef: String, note: String? = nil) async throws {
        var request = try await client.authorizedRequest(
            url: baseURL.appendingPathComponent("mail/share"), method: "POST"
        )
        request.httpBody = try JSONEncoder().encode(ShareBody(thread: threadId, assetRef: assetRef, note: note))
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
    }

    // MARK: - Ledger

    private struct LedgerTailBody: Encodable {
        let count: Int
    }

    /// `POST /api/rails/ledger/tail` (`tail_ledger`, rails/mod.rs:426-459) —
    /// body `{ count }` → bare `UiLedgerEvent[]`, no envelope. This is the
    /// real (and only) mechanism for reservation/guard/review visibility:
    /// `AgentActivityStore` fetches a batch and filters client-side by
    /// `LedgerEvent.relatedThreadId`.
    func tailLedger(count: Int) async throws -> [LedgerEvent] {
        var request = try await client.authorizedRequest(
            url: baseURL.appendingPathComponent("ledger/tail"), method: "POST"
        )
        request.httpBody = try JSONEncoder().encode(LedgerTailBody(count: count))
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode([LedgerEvent].self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// Web uses plain thread ids in the path; percent-encode anyway as
    /// parity insurance (same as ACIAgentClient.escape).
    private static func escape(_ threadId: String) -> String {
        threadId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? threadId
    }
}
