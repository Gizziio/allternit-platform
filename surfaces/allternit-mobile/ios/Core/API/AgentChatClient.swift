import Foundation

/// Composer "+" sheet tool options, sent as `metadata.tools` on every
/// agent-chat request (ToolOptionsStore is the persisted source).
struct ToolOptions: Encodable, Sendable {
    let webSearch: Bool
    let research: Bool
    /// "auto" | "on_demand" | "always" (ToolAccess raw values).
    let toolAccess: String
}

/// One composer-staged attachment in the agent-chat body. `url` is the
/// `POST /api/v1/uploads` result; `dataBase64` inlines small payloads
/// without an upload round-trip. The bridge forwards each as a gizzi
/// `{"type":"file","url":...}` part (v1_routes.rs agent_chat_bridge).
struct AttachmentRef: Encodable, Sendable {
    let url: String?
    let dataBase64: String?
    let mediaType: String
    let name: String?
}

/// Client for the LIVE agent platform protocol (replaces the scaffold
/// RepliesStreamClient):
///
/// - `POST /api/v1/agent-sessions`              → create a `ses_*` session
/// - `GET  /api/v1/agent-sessions`              → history list (`{sessions, count}`)
/// - `GET  /api/v1/agent-sessions/:id/messages` → session messages (bare array)
/// - `POST /api/v1/agent-sessions/:id/abort`    → stop an in-flight generation
/// - `POST /api/agent-chat`                     → send a message; the response
///   body itself is the SSE-style stream of `AgentChatEvent` frames
///   (`data: {json}\n\n`, canonical shapes in
///   cmd/allternit-api/src/v1_routes.rs:247-388).
///
/// Reference: the web client's `sessionApi` / `chatApi` in
/// surfaces/ai.allternit.com/src/lib/agents/native-agent-api.ts:423-579,635-830.
/// Auth is just the Clerk Bearer (via APIClient) — no `X-Allternit-*` tenant
/// headers (desktop-shell-only).
final class AgentChatClient: @unchecked Sendable {
    private let client: APIClient
    private let chatURL: URL

    init(client: APIClient = .shared, chatURL: URL = AppConfig.agentChatURL) {
        self.client = client
        self.chatURL = chatURL
    }

    /// Body of `POST /api/agent-chat` (native-agent-api.ts:643-648). The web
    /// also splats an `agentContext` (agentId/systemPrompt/…) into the body —
    /// desktop-agent-only; mobile chat sends just `agentId`: the bridge
    /// resolves the agent's persona, workspace files (SOUL.md/STYLE.md),
    /// and the caller's response-style preferences SERVER-SIDE and wraps
    /// them as `<system-instructions>` (v1_routes.rs agent_chat_bridge).
    /// `systemPrompt` stays accepted for parity with the web (appended
    /// last by the bridge) but mobile sends none. `runtimeModelId` is a
    /// catalog id ("provider/model", RuntimeModel.id); nil lets the bridge
    /// fall back to the agent's own model, then the configured default
    /// (v1_routes.rs:182-200).
    /// `effort` ("low"|"medium"|"high") rides along for reasoning-capable
    /// models; the bridge forwards it to the runtime, which ignores it for
    /// models without reasoning. `attachments` are composer-staged files
    /// (already uploaded via `POST /api/v1/uploads`); `metadata.tools` carries
    /// the "+" sheet's tool options. The bridge turns attachments into gizzi
    /// file parts and stashes the tool options into the gizzi payload
    /// metadata (v1_routes.rs agent_chat_bridge).
    private struct AgentChatRequest: Encodable {
        let chatId: String
        let message: String
        let agentId: String?
        let systemPrompt: String?
        let runtimeModelId: String?
        let effort: String?
        let attachments: [AttachmentRef]?
        let metadata: RequestMetadata?
    }

    /// `metadata` on the agent-chat body — currently only the composer tool
    /// options.
    private struct RequestMetadata: Encodable {
        let tools: ToolOptions
    }

    /// Response of `POST /api/v1/uploads` (upload_routes.rs).
    struct UploadResponse: Decodable {
        let uploadId: String
        let url: String
    }

    private struct UploadRequest: Encodable {
        let name: String
        let mediaType: String
        let dataBase64: String
    }

    // MARK: - Sessions (REST, /api/v1/agent-sessions)

    /// Creates a session; returns the `ses_*` session record.
    ///
    /// `originSurface` is the current app mode ("chat" | "cowork"),
    /// `sessionMode` is "agent" when the composer's agent pill is on
    /// (otherwise "regular"). `agentModeId` is the selected bottom-deck
    /// tile, carried as `metadata.agentModeId` like the web
    /// (mode-session-store.ts:897-905). `projectId` is the selected cowork
    /// project, carried as `metadata.projectId` — the backend stamps it onto
    /// the gizzi session so list responses can group chats by project
    /// (agent_session_routes.rs create_session). `ephemeral` marks an
    /// incognito chat (Phase 6), carried as `metadata.ephemeral`. `persona`
    /// is the onboarding work-profile answer (Phase 10), carried as
    /// `metadata.persona`.
    func createSession(name: String,
                       originSurface: String,
                       sessionMode: String,
                       agentId: String? = nil,
                       agentName: String? = nil,
                       agentModeId: String? = nil,
                       projectId: String? = nil,
                       ephemeral: Bool = false,
                       persona: String? = nil) async throws -> AgentSession {
        var metadata: [String: String] = [:]
        if let agentModeId { metadata["agentModeId"] = agentModeId }
        if let projectId { metadata["projectId"] = projectId }
        if let persona { metadata["persona"] = persona }
        // Incognito chats (Phase 6): carried as `metadata.ephemeral = "true"`
        // (the metadata bag is string-valued); the backend also accepts a
        // top-level bool. Ephemeral sessions are excluded from list responses
        // and purged on abort (agent_session_routes.rs create_session).
        if ephemeral { metadata["ephemeral"] = "true" }
        let body = CreateAgentSessionRequest(
            name: name,
            originSurface: originSurface,
            sessionMode: sessionMode,
            agentId: agentId,
            agentName: agentName,
            metadata: metadata.isEmpty ? nil : metadata
        )
        return try await client.post(path: "agent-sessions", body: body)
    }

    /// Lists all sessions (the production sidebar's history source).
    func listSessions() async throws -> [AgentSession] {
        let response: AgentSessionListResponse = try await client.get(path: "agent-sessions")
        return response.sessions
    }

    // MARK: - Agent registry (REST, /api/v1/agents)

    /// Lists registered agents — the data source for the composer's agent
    /// selector (web: agent.service.ts:67-92 → GET /api/v1/agents).
    func listAgents() async throws -> [AgentSummary] {
        let response: AgentListResponse = try await client.get(path: "agents")
        return response.agents
    }

    /// Lists the flattened runtime-model catalog (`GET /api/v1/models`, a
    /// bare array) — the composer model pill's data source.
    func listModels() async throws -> [RuntimeModel] {
        try await client.get(path: "models")
    }

    /// Lists all messages of a session (history view + foreground reconcile).
    func listMessages(sessionId: String) async throws -> [AgentSessionMessage] {
        try await client.get(path: "agent-sessions/\(Self.escape(sessionId))/messages")
    }

    /// Aborts an in-flight generation server-side.
    func abort(sessionId: String) async throws {
        try await client.post(path: "agent-sessions/\(Self.escape(sessionId))/abort")
    }

    /// Conversation revert (Phase 8 edit-resend), live on the backend
    /// (agent_session_routes.rs — probed 2026-07: 200 on a valid session).
    func revert(sessionId: String) async throws {
        try await client.post(path: "agent-sessions/\(Self.escape(sessionId))/revert")
    }

    // MARK: - Uploads (POST /api/v1/uploads)

    /// Uploads one staged attachment; returns the fetchable `{uploadId, url}`
    /// ref the agent-chat body then references.
    func upload(name: String, mediaType: String, dataBase64: String) async throws -> UploadResponse {
        try await client.post(
            path: "uploads",
            body: UploadRequest(name: name, mediaType: mediaType, dataBase64: dataBase64)
        )
    }

    // MARK: - Chat streaming (POST /api/agent-chat)

    /// Sends `text` to the session and streams the response frames on the
    /// POST body. The stream finishes on a terminal frame
    /// (`finish` / `done` / `[DONE]`), when the connection ends, or when the
    /// consuming task is cancelled; per-frame decode failures are skipped
    /// (the web parser logs and continues on malformed frames).
    func sendMessageStream(sessionId: String, text: String, agentId: String? = nil, systemPrompt: String? = nil, runtimeModelId: String? = nil, effort: String? = nil, attachments: [AttachmentRef]? = nil, tools: ToolOptions? = nil) -> AsyncThrowingStream<AgentChatEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var request = try await client.authorizedRequest(url: chatURL, method: "POST")
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    // Streams are long-lived; the default 60s idle timeout
                    // would kill slow generations between frames.
                    request.timeoutInterval = 600
                    request.httpBody = try JSONEncoder().encode(
                        AgentChatRequest(
                            chatId: sessionId,
                            message: text,
                            agentId: agentId,
                            systemPrompt: systemPrompt,
                            runtimeModelId: runtimeModelId,
                            effort: effort,
                            attachments: attachments,
                            metadata: tools.map { RequestMetadata(tools: $0) }
                        )
                    )

                    let (bytes, response) = try await client.sendStream(request)
                    try client.validate(response)

                    let decoder = JSONDecoder()
                    for try await line in bytes.lines {
                        try Task.checkCancellation()

                        // SSE frames are `data: {json}`; blank lines, comments
                        // (axum keep-alive `:…` lines) and event lines are skipped.
                        guard line.hasPrefix("data: ") else { continue }
                        let payload = String(line.dropFirst(6))
                        guard !payload.isEmpty else { continue }

                        // OpenAI-style sentinel, tolerated like the web parser.
                        if payload == "[DONE]" {
                            continuation.finish()
                            return
                        }

                        guard let data = payload.data(using: .utf8),
                              let event = try? decoder.decode(AgentChatEvent.self, from: data) else {
                            print("agent-chat: skipping undecodable frame: \(payload)")
                            continue
                        }

                        // Unknown/tolerated frames decode to `.ignored`.
                        if case .ignored = event { continue }

                        continuation.yield(event)

                        if event.isTerminal {
                            continuation.finish()
                            return
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }

            // Cancelling the consumer cancels the Task, which cancels the
            // underlying URLSession stream. Server-side abort is the caller's
            // job (ChatViewModel.stopStreaming → abort(sessionId:)).
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// Web uses `encodeURIComponent` on session ids (ses_* ids are already
    /// path-safe; this is parity insurance).
    private static func escape(_ sessionId: String) -> String {
        sessionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? sessionId
    }
}
