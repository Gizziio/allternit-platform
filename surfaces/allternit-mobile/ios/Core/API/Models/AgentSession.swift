import Foundation

// -----------------------------------------------------------------------------
// Agent-sessions REST models — base path /api/v1/agent-sessions (LIVE path).
//
// Mirrors the web client's `BackendSession` / `BackendMessage` types in
// surfaces/ai.allternit.com/src/lib/agents/native-agent-api.ts:78-129, verified
// against the Rust producers in cmd/allternit-api/src/agent_session_routes.rs
// (`transform_session`:270-303, `transform_message`:351-383).
//
// The API emits snake_case keys on the wire; Swift properties stay camelCase
// via explicit CodingKeys. Optional fields mirror the web's
// `normalizeSessionPayload` fallbacks (native-agent-api.ts:346-363).
// -----------------------------------------------------------------------------

// MARK: - Session record

/// One agent session (`ses_*` id), as listed/created by the backend.
struct AgentSession: Decodable, Sendable, Identifiable {
    let id: String
    let name: String?
    let description: String?
    let createdAt: String
    let updatedAt: String
    let lastAccessed: String
    let messageCount: Int
    let active: Bool
    let tags: [String]
    /// `metadata.originSurface` — the original frontend surface
    /// ("chat" | "cowork" | "code" | …). The API normalizes the surface for
    /// Gizzi on create but remembers the original in its
    /// `session_origin_surface` table and restores it here on read
    /// (agent_session_routes.rs:274-301). Sessions with no recorded surface
    /// decode as "" (Rust `unwrap_or_default`), never nil.
    let originSurface: String?
    /// `metadata.agent_id` — set when the session was created with a registry
    /// agent (create forwards `agentID`, agent_session_routes.rs:597-602).
    /// The wire has NO `session_mode` field: the web keeps regular/agent in
    /// local-only store metadata (mode-session-store.ts:72-77), so this is the
    /// only wire signal distinguishing agent sessions from regular ones.
    let agentId: String?
    // The rest of `metadata` (project_id, directory, version, permission, …)
    // stays skipped — not rendered anywhere on iOS.

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case lastAccessed = "last_accessed"
        case messageCount = "message_count"
        case active, tags
        case metadata
    }

    /// Keys inside the `metadata` object emitted by `transform_session`
    /// (agent_session_routes.rs:293-301). Note the mixed casing on the wire:
    /// camelCase `originSurface` vs snake_case `agent_id`.
    private enum MetadataKeys: String, CodingKey {
        case originSurface
        case agentId = "agent_id"
    }

    /// Tolerant decode mirroring the web's `normalizeSessionPayload`: only
    /// `id` and `created_at` are required on the wire; everything else falls
    /// back (`updated_at` → `created_at`, `message_count` → 0, …).
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        let updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt) ?? createdAt
        self.updatedAt = updatedAt
        lastAccessed = try container.decodeIfPresent(String.self, forKey: .lastAccessed) ?? updatedAt
        messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount) ?? 0
        active = try container.decodeIfPresent(Bool.self, forKey: .active) ?? true
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        if let metadata = try container.nestedContainerIfPresent(keyedBy: MetadataKeys.self, forKey: .metadata) {
            originSurface = try metadata.decodeIfPresent(String.self, forKey: .originSurface)
            agentId = try metadata.decodeIfPresent(String.self, forKey: .agentId)
        } else {
            originSurface = nil
            agentId = nil
        }
    }
}

/// `GET /api/v1/agent-sessions` envelope (`{ sessions, count }`,
/// agent_session_routes.rs:537-540).
struct AgentSessionListResponse: Decodable, Sendable {
    let sessions: [AgentSession]
    let count: Int
}

// MARK: - Create request

/// Body of `POST /api/v1/agent-sessions`, matching the web's
/// `sessionApi.createSession` payload (native-agent-api.ts:450-474).
///
/// `origin_surface` / `session_mode` are dynamic: the composer passes the
/// current app mode ("chat" | "cowork") and "agent" when the agent pill is
/// on (mode-session-store.ts:849-850,892-893). `session_mode` is sent for
/// parity even though the Rust handler (`CreateSessionBody`,
/// agent_session_routes.rs:138-146) doesn't read it — serde drops it.
///
/// `agent_id` / `agent_name` / `metadata` are read by the backend; nil
/// optionals are omitted from the JSON body (synthesized Encodable skips
/// them), matching the web dropping `undefined`. The web carries the
/// composer's selected agent-mode tile as `metadata.agentModeId`
/// (mode-session-store.ts:897-905,952) — mirrored here.
struct CreateAgentSessionRequest: Encodable, Sendable {
    let name: String
    let originSurface: String
    let sessionMode: String
    let agentId: String?
    let agentName: String?
    let metadata: [String: String]?

    enum CodingKeys: String, CodingKey {
        case name
        case originSurface = "origin_surface"
        case sessionMode = "session_mode"
        case agentId = "agent_id"
        case agentName = "agent_name"
        case metadata
    }
}

// MARK: - Message records

/// One message in a session (`GET /api/v1/agent-sessions/:id/messages` →
/// bare array). Mirrors `BackendMessage` (native-agent-api.ts:91-98) plus the
/// `metadata.parts` the Rust `transform_message` embeds
/// (agent_session_routes.rs:364-382).
///
/// Note: the backend's `content` already includes reasoning-part text
/// (`extract_message_content` matches "text" | "reasoning" | "agent") AND
/// repeats reasoning separately in `thinking` — the web renders both as-is,
/// and so do we.
struct AgentSessionMessage: Decodable, Sendable, Identifiable {
    /// `GizziMessagePart` as serialized inside `metadata.parts`
    /// (agent_session_routes.rs:237-251). `state` (`serde_json::Value`) is
    /// skipped — tool state isn't rendered in the history view.
    struct Part: Decodable, Sendable {
        let type: String
        let text: String?
        let filename: String?
        let url: String?
        let tool: String?
    }

    /// `metadata: { agent, model, parts, error }` — only `parts` is decoded;
    /// `agent`/`model`/`error` are `unknown`-typed in TS and skipped.
    struct Metadata: Decodable, Sendable {
        let parts: [Part]?
    }

    let id: String
    let role: String // "user" | "assistant" (Gizzi role strings)
    let content: String
    let thinking: String?
    let timestamp: String
    let metadata: Metadata?
}
