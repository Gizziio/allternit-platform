import Foundation

// -----------------------------------------------------------------------------
// ⚠️ QUARANTINED (2026-07-18) — conversations REST models, UNUSED by the live
// path. Kept for future use (message edit/retry via `POST /:id/fork`): the
// routes are mounted on allternit-api but unused by web chat today
// (docs/ios_architecture_plan.md §2.0). The LIVE history path is
// agent-sessions — see AgentSession.swift / AgentChatClient.swift.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Conversations REST models — base path /api/v1/conversations.
//
// Mirrors the web client in surfaces/ai.allternit.com/src/api/conversations.ts
// exactly. Note: the API emits snake_case keys on the wire (created_at,
// message_count, …); Swift properties stay camelCase via explicit CodingKeys.
// Request bodies keep the same key casing the web client sends (parentMessageId
// / fromMessageId are camelCase, conversation_id is snake_case).
// -----------------------------------------------------------------------------

// MARK: - Records

struct ConversationRecord: Decodable, Sendable, Identifiable {
    let id: String
    let object: String // always "conversation"
    let createdAt: String
    let updatedAt: String
    let title: String?
    let parentConversationId: String?
    let messageCount: Int
    let branchCount: Int

    enum CodingKeys: String, CodingKey {
        case id, object, title
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case parentConversationId = "parent_conversation_id"
        case messageCount = "message_count"
        case branchCount = "branch_count"
    }
}

struct ConversationMessageRecord: Decodable, Sendable, Identifiable {
    enum Role: String, Decodable, Sendable {
        case user
        case assistant
        case system
    }

    let id: String
    let object: String // always "conversation.message"
    let createdAt: String
    let conversationId: String
    let role: Role
    let content: String
    let parentMessageId: String?
    // `metadata: Record<string, unknown> | null` — skipped (see TS client).

    enum CodingKeys: String, CodingKey {
        case id, object, role, content
        case createdAt = "created_at"
        case conversationId = "conversation_id"
        case parentMessageId = "parent_message_id"
    }
}

/// `POST /:id/fork` response.
struct ForkResponse: Decodable, Sendable {
    let id: String
    let object: String // always "conversation"
    let createdAt: String
    let updatedAt: String
    let title: String?
    let parentConversationId: String?
    let forkedFromMessageId: String?
    let messageCount: Int

    enum CodingKeys: String, CodingKey {
        case id, object, title
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case parentConversationId = "parent_conversation_id"
        case forkedFromMessageId = "forked_from_message_id"
        case messageCount = "message_count"
    }
}

// MARK: - List envelopes (`{ object: "list", data: [...] }`, NOT bare arrays)

struct ConversationListResponse: Decodable, Sendable {
    let object: String // always "list"
    let data: [ConversationRecord]
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case object, data
        case hasMore = "has_more"
    }
}

struct ConversationMessageListResponse: Decodable, Sendable {
    let object: String // always "list"
    let conversationId: String
    let data: [ConversationMessageRecord]
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case object, data
        case conversationId = "conversation_id"
        case hasMore = "has_more"
    }
}

// MARK: - Request bodies (match the web client's JSON.stringify payloads)

/// `POST ""` — TS `CreateConversationOptions` (`metadata` skipped).
struct CreateConversationOptions: Encodable, Sendable {
    let conversationId: String?
    let title: String?

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case title
    }
}

/// `POST /:id/messages` — TS `AddMessageOptions` (`metadata` skipped).
struct AddMessageOptions: Encodable, Sendable {
    let role: String // "user" | "assistant" | "system"
    let content: String
    let parentMessageId: String?
}

/// `POST /:id/fork` — TS `ForkOptions`.
struct ForkOptions: Encodable, Sendable {
    let fromMessageId: String?
    let title: String?
}
