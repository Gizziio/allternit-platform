import Foundation

// -----------------------------------------------------------------------------
// ⚠️ QUARANTINED (2026-07-18) — future replies-runtime contract, UNUSED by the
// live path. See the header of ReplyEvent.swift for details; the live protocol
// models are AgentSession.swift / AgentChatEvent.swift.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// ReplyItem — output union of a Reply.
//
// Mirrors `ReplyItem` and its supporting types in
// packages/@allternit/replies-contract/src/index.ts. Items flow server →
// client only, so `Encodable` is intentionally omitted. Fields typed
// `unknown` / `Record<string, unknown>` in the contract are skipped (not
// decoded) and noted inline.
// -----------------------------------------------------------------------------

enum ReplyItemKind: String, Codable, Sendable {
    case text
    case reasoning
    case toolCall = "tool_call"
    case artifact
    case citation
    case mcpApp = "mcp_app"
    case code
    case terminal
    case plan
    case fileOp = "file_op"
}

enum ToolCallState: String, Codable, Sendable {
    case queued
    case running
    case done
    case error
}

enum TerminalStatus: String, Codable, Sendable {
    case running
    case completed
    case error
}

enum PlanStepStatus: String, Codable, Sendable {
    case pending
    case inProgress = "in-progress"
    case complete
    case error
}

enum FileOpKind: String, Codable, Sendable {
    case create
    case modify
    case delete
}

struct CitationRef: Decodable, Sendable {
    let id: String
    let title: String
    let url: String?
    let snippet: String?
}

struct PlanStep: Decodable, Sendable {
    let id: String
    let description: String
    let status: PlanStepStatus
}

// MARK: - Item payloads (one per union member)

struct TextReplyItem: Decodable, Sendable {
    let id: String
    let text: String
    let isOpen: Bool
}

struct ReasoningReplyItem: Decodable, Sendable {
    let id: String
    let text: String
    let summary: String?
    let isOpen: Bool
}

struct ToolCallReplyItem: Decodable, Sendable {
    let id: String
    let toolCallId: String
    let toolName: String
    let title: String?
    let state: ToolCallState
    // `input?: unknown` — skipped (see contract).
    let progressLines: [String]
    // `output?: unknown`, `outputPreview?: unknown` — skipped (see contract).
    let error: String?
    let isOpen: Bool
    let startedAt: Double?
    let endedAt: Double?
}

struct ArtifactReplyItem: Decodable, Sendable {
    let id: String
    let artifactId: String
    let artifactType: String
    let title: String
    let url: String?
    /// `preview?: unknown` in the contract; the reducer passes the event's
    /// `inlinePreview` through verbatim, so apply the same tolerant string
    /// decode as `ArtifactCreatedEvent.inlinePreview`.
    let preview: String?
    // `metadata?: Record<string, unknown>` — skipped (see contract).
    let isOpen: Bool

    private enum CodingKeys: String, CodingKey {
        case id, artifactId, artifactType, title, url, preview, isOpen
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        artifactId = try container.decode(String.self, forKey: .artifactId)
        artifactType = try container.decode(String.self, forKey: .artifactType)
        title = try container.decode(String.self, forKey: .title)
        url = try container.decodeIfPresent(String.self, forKey: .url)
        preview = try? container.decodeIfPresent(String.self, forKey: .preview)
        isOpen = try container.decode(Bool.self, forKey: .isOpen)
    }
}

struct CitationReplyItem: Decodable, Sendable {
    let id: String
    let items: [CitationRef]
    let isOpen: Bool
}

struct McpAppReplyItem: Decodable, Sendable {
    let id: String
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
    let isOpen: Bool
}

struct CodeReplyItem: Decodable, Sendable {
    let id: String
    let language: String
    let code: String
    let filename: String?
    let isOpen: Bool
}

struct TerminalReplyItem: Decodable, Sendable {
    let id: String
    let command: String
    let output: String
    let exitCode: Int?
    let status: TerminalStatus
    let isOpen: Bool
}

struct PlanReplyItem: Decodable, Sendable {
    let id: String
    let planId: String
    let title: String
    let steps: [PlanStep]
    let isOpen: Bool
}

struct FileOpReplyItem: Decodable, Sendable {
    let id: String
    let operation: FileOpKind
    let path: String
    let content: String?
    let diff: String?
    let isOpen: Bool
}

// MARK: - ReplyItem

/// One output block of a reply, discriminated by `kind`.
enum ReplyItem: Decodable, Sendable {
    case text(TextReplyItem)
    case reasoning(ReasoningReplyItem)
    case toolCall(ToolCallReplyItem)
    case artifact(ArtifactReplyItem)
    case citation(CitationReplyItem)
    case mcpApp(McpAppReplyItem)
    case code(CodeReplyItem)
    case terminal(TerminalReplyItem)
    case plan(PlanReplyItem)
    case fileOp(FileOpReplyItem)

    private enum DiscriminatorKey: String, CodingKey {
        case kind
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DiscriminatorKey.self)
        let rawKind = try container.decode(String.self, forKey: .kind)
        guard let kind = ReplyItemKind(rawValue: rawKind) else {
            throw DecodingError.dataCorruptedError(
                forKey: .kind,
                in: container,
                debugDescription: "Unknown ReplyItem kind '\(rawKind)'"
            )
        }

        switch kind {
        case .text:
            self = .text(try TextReplyItem(from: decoder))
        case .reasoning:
            self = .reasoning(try ReasoningReplyItem(from: decoder))
        case .toolCall:
            self = .toolCall(try ToolCallReplyItem(from: decoder))
        case .artifact:
            self = .artifact(try ArtifactReplyItem(from: decoder))
        case .citation:
            self = .citation(try CitationReplyItem(from: decoder))
        case .mcpApp:
            self = .mcpApp(try McpAppReplyItem(from: decoder))
        case .code:
            self = .code(try CodeReplyItem(from: decoder))
        case .terminal:
            self = .terminal(try TerminalReplyItem(from: decoder))
        case .plan:
            self = .plan(try PlanReplyItem(from: decoder))
        case .fileOp:
            self = .fileOp(try FileOpReplyItem(from: decoder))
        }
    }
}
