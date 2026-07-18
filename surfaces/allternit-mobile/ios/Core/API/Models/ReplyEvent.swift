import Foundation

// -----------------------------------------------------------------------------
// ⚠️ QUARANTINED (2026-07-18) — future replies-runtime contract, UNUSED by the
// live path.
//
// These are the wire models of the replies-runtime scaffold (in-memory
// Express app, port 4200 — not deployed, not mounted in any gateway). They
// remain the *future* adoption target per
// docs/ios_architecture_plan.md §2.0; the LIVE protocol is agent-sessions +
// agent-chat (AgentSession.swift / AgentChatEvent.swift / AgentChatClient.swift).
// Nothing in the live path references these types.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// ReplyEvent — canonical SSE wire format.
//
// Mirrors the `ReplyEvent` discriminated union in
// packages/@allternit/replies-contract/src/index.ts (single source of truth —
// do not hand-model; update this file when the contract package changes).
//
// Events flow server → client only, so `Encodable` is intentionally omitted.
// Fields typed `unknown` / `Record<string, unknown>` in the contract are
// skipped (not decoded) and noted inline — the client ignores them for now.
// -----------------------------------------------------------------------------

/// Wire names of every `ReplyEvent` variant (the `type` discriminator).
enum ReplyEventType: String, Codable, Sendable {
    case replyStarted = "reply.started"
    case replyItemAdded = "reply.item.added"
    case replyTextDelta = "reply.text.delta"
    case replyReasoningDelta = "reply.reasoning.delta"
    case toolCallStarted = "tool_call.started"
    case toolCallProgress = "tool_call.progress"
    case toolCallCompleted = "tool_call.completed"
    case toolCallFailed = "tool_call.failed"
    case artifactCreated = "artifact.created"
    case citationAdded = "citation.added"
    case mcpAppCreated = "mcp_app.created"
    case codeAdded = "code.added"
    case terminalAdded = "terminal.added"
    case planCreated = "plan.created"
    case planUpdated = "plan.updated"
    case fileOpAdded = "file_op.added"
    case replyItemDone = "reply.item.done"
    case replyCompleted = "reply.completed"
    case replyFailed = "reply.failed"
}

// MARK: - Event payloads (one per union member; `ts` is milliseconds since epoch)

struct ReplyStartedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let conversationId: String?
    let ts: Double
}

struct ReplyItemAddedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let kind: ReplyItemKind
    let ts: Double
}

struct ReplyTextDeltaEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let delta: String
    let ts: Double
}

struct ReplyReasoningDeltaEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let delta: String
    let summary: String?
    let ts: Double
}

struct ToolCallStartedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let toolCallId: String
    let toolName: String
    let title: String?
    // `input?: unknown` — skipped (see contract).
    let ts: Double
}

struct ToolCallProgressEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let toolCallId: String
    let statusText: String
    let ts: Double
}

struct ToolCallCompletedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let toolCallId: String
    // `output: unknown`, `preview?: unknown` — skipped (see contract).
    let ts: Double
}

struct ToolCallFailedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let toolCallId: String
    let error: String
    let ts: Double
}

struct ArtifactCreatedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let artifactId: String
    let artifactType: String
    let title: String
    let url: String?
    /// `inlinePreview?: unknown` in the contract. The only known producer
    /// (provider-adapters' `<document>` extraction, ai-sdk.ts) sends the full
    /// content as a string, so decode tolerantly: the string when present,
    /// `nil` for absent/null/non-string values.
    let inlinePreview: String?
    // `metadata?: Record<string, unknown>` — skipped (see contract).
    let ts: Double

    private enum CodingKeys: String, CodingKey {
        case replyId, runId, itemId, artifactId, artifactType, title, url, inlinePreview, ts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        replyId = try container.decode(String.self, forKey: .replyId)
        runId = try container.decode(String.self, forKey: .runId)
        itemId = try container.decode(String.self, forKey: .itemId)
        artifactId = try container.decode(String.self, forKey: .artifactId)
        artifactType = try container.decode(String.self, forKey: .artifactType)
        title = try container.decode(String.self, forKey: .title)
        url = try container.decodeIfPresent(String.self, forKey: .url)
        // `try?` swallows type mismatches (e.g. a structured preview object).
        inlinePreview = try? container.decodeIfPresent(String.self, forKey: .inlinePreview)
        ts = try container.decode(Double.self, forKey: .ts)
    }
}

struct CitationAddedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let citationId: String
    let title: String
    let url: String?
    let snippet: String?
    let ts: Double
}

struct McpAppCreatedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let toolCallId: String
    let toolName: String
    let connectorId: String
    let connectorName: String
    let resourceUri: String
    let title: String
    let description: String?
    let html: String
    let allow: String?
    let prefersBorder: Bool?
    // `csp?`, `permissions?`, `toolInput?: Record<string, unknown>`, `toolResult?: unknown` — skipped (see contract).
    let domain: String?
    let ts: Double
}

struct CodeAddedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let language: String
    let code: String
    let filename: String?
    let ts: Double
}

struct TerminalAddedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let command: String
    let output: String
    let exitCode: Int?
    let status: TerminalStatus
    let ts: Double
}

struct PlanCreatedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let planId: String
    let title: String
    let steps: [PlanStep]
    let ts: Double
}

struct PlanUpdatedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let steps: [PlanStep]
    let ts: Double
}

struct FileOpAddedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let operation: FileOpKind
    let path: String
    let content: String?
    let diff: String?
    let ts: Double
}

struct ReplyItemDoneEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let itemId: String
    let ts: Double
}

struct ReplyCompletedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let ts: Double
}

struct ReplyFailedEvent: Decodable, Sendable {
    let replyId: String
    let runId: String
    let error: String
    let ts: Double
}

// MARK: - ReplyEvent

/// A single SSE event from `GET /v1/replies/:replyId/stream`.
enum ReplyEvent: Decodable, Sendable {
    case replyStarted(ReplyStartedEvent)
    case replyItemAdded(ReplyItemAddedEvent)
    case replyTextDelta(ReplyTextDeltaEvent)
    case replyReasoningDelta(ReplyReasoningDeltaEvent)
    case toolCallStarted(ToolCallStartedEvent)
    case toolCallProgress(ToolCallProgressEvent)
    case toolCallCompleted(ToolCallCompletedEvent)
    case toolCallFailed(ToolCallFailedEvent)
    case artifactCreated(ArtifactCreatedEvent)
    case citationAdded(CitationAddedEvent)
    case mcpAppCreated(McpAppCreatedEvent)
    case codeAdded(CodeAddedEvent)
    case terminalAdded(TerminalAddedEvent)
    case planCreated(PlanCreatedEvent)
    case planUpdated(PlanUpdatedEvent)
    case fileOpAdded(FileOpAddedEvent)
    case replyItemDone(ReplyItemDoneEvent)
    case replyCompleted(ReplyCompletedEvent)
    case replyFailed(ReplyFailedEvent)

    /// Terminal events end the SSE stream (`reply.completed` / `reply.failed`).
    var isTerminal: Bool {
        switch self {
        case .replyCompleted, .replyFailed:
            return true
        default:
            return false
        }
    }

    private enum DiscriminatorKey: String, CodingKey {
        case type
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DiscriminatorKey.self)
        let rawType = try container.decode(String.self, forKey: .type)
        guard let type = ReplyEventType(rawValue: rawType) else {
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown ReplyEvent type '\(rawType)'"
            )
        }

        switch type {
        case .replyStarted:
            self = .replyStarted(try ReplyStartedEvent(from: decoder))
        case .replyItemAdded:
            self = .replyItemAdded(try ReplyItemAddedEvent(from: decoder))
        case .replyTextDelta:
            self = .replyTextDelta(try ReplyTextDeltaEvent(from: decoder))
        case .replyReasoningDelta:
            self = .replyReasoningDelta(try ReplyReasoningDeltaEvent(from: decoder))
        case .toolCallStarted:
            self = .toolCallStarted(try ToolCallStartedEvent(from: decoder))
        case .toolCallProgress:
            self = .toolCallProgress(try ToolCallProgressEvent(from: decoder))
        case .toolCallCompleted:
            self = .toolCallCompleted(try ToolCallCompletedEvent(from: decoder))
        case .toolCallFailed:
            self = .toolCallFailed(try ToolCallFailedEvent(from: decoder))
        case .artifactCreated:
            self = .artifactCreated(try ArtifactCreatedEvent(from: decoder))
        case .citationAdded:
            self = .citationAdded(try CitationAddedEvent(from: decoder))
        case .mcpAppCreated:
            self = .mcpAppCreated(try McpAppCreatedEvent(from: decoder))
        case .codeAdded:
            self = .codeAdded(try CodeAddedEvent(from: decoder))
        case .terminalAdded:
            self = .terminalAdded(try TerminalAddedEvent(from: decoder))
        case .planCreated:
            self = .planCreated(try PlanCreatedEvent(from: decoder))
        case .planUpdated:
            self = .planUpdated(try PlanUpdatedEvent(from: decoder))
        case .fileOpAdded:
            self = .fileOpAdded(try FileOpAddedEvent(from: decoder))
        case .replyItemDone:
            self = .replyItemDone(try ReplyItemDoneEvent(from: decoder))
        case .replyCompleted:
            self = .replyCompleted(try ReplyCompletedEvent(from: decoder))
        case .replyFailed:
            self = .replyFailed(try ReplyFailedEvent(from: decoder))
        }
    }
}
