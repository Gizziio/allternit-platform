import Foundation

// -----------------------------------------------------------------------------
// ⚠️ QUARANTINED (2026-07-18) — future replies-runtime contract, UNUSED by the
// live path. See the header of ReplyEvent.swift for details; the live protocol
// models are AgentSession.swift / AgentChatEvent.swift.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Reply — the public runtime object of the Replies API.
//
// Mirrors `Reply` / `ReplyStatus` in
// packages/@allternit/replies-contract/src/index.ts, plus the response of
// `POST /v1/replies` (api/services/replies-runtime/src/replies.router.ts).
// -----------------------------------------------------------------------------

enum ReplyStatus: String, Codable, Sendable {
    case streaming
    case complete
    case failed
}

/// Current reduced state of a reply (`GET /v1/replies/:replyId`).
/// Timestamps are milliseconds since epoch.
struct Reply: Decodable, Sendable {
    let id: String
    let runId: String
    let conversationId: String?
    let status: ReplyStatus
    let error: String?
    let startedAt: Double
    let completedAt: Double?
    let items: [ReplyItem]
}

/// Response of `POST /v1/replies` (201 Created).
struct CreateReplyResponse: Decodable, Sendable {
    let id: String
    let runId: String
    let status: ReplyStatus
    let conversationId: String?
}
