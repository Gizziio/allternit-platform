import Foundation

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
    /// desktop-agent-only; mobile chat sends none. `runtimeModelId` stays nil
    /// until the model selector produces real runtime ids (the backend falls
    /// back to its configured default model when absent, v1_routes.rs:182-200).
    private struct AgentChatRequest: Encodable {
        let chatId: String
        let message: String
        let runtimeModelId: String?
    }

    // MARK: - Sessions (REST, /api/v1/agent-sessions)

    /// Creates a session; returns the `ses_*` session record.
    ///
    /// `originSurface` is the current app mode ("chat" | "cowork"),
    /// `sessionMode` is "agent" when the composer's agent pill is on
    /// (otherwise "regular"). `agentModeId` is the selected bottom-deck
    /// tile, carried as `metadata.agentModeId` like the web
    /// (mode-session-store.ts:897-905).
    func createSession(name: String,
                       originSurface: String,
                       sessionMode: String,
                       agentId: String? = nil,
                       agentName: String? = nil,
                       agentModeId: String? = nil) async throws -> AgentSession {
        let body = CreateAgentSessionRequest(
            name: name,
            originSurface: originSurface,
            sessionMode: sessionMode,
            agentId: agentId,
            agentName: agentName,
            metadata: agentModeId.map { ["agentModeId": $0] }
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

    /// Lists all messages of a session (history view + foreground reconcile).
    func listMessages(sessionId: String) async throws -> [AgentSessionMessage] {
        try await client.get(path: "agent-sessions/\(Self.escape(sessionId))/messages")
    }

    /// Aborts an in-flight generation server-side.
    func abort(sessionId: String) async throws {
        try await client.post(path: "agent-sessions/\(Self.escape(sessionId))/abort")
    }

    // MARK: - Chat streaming (POST /api/agent-chat)

    /// Sends `text` to the session and streams the response frames on the
    /// POST body. The stream finishes on a terminal frame
    /// (`finish` / `done` / `[DONE]`), when the connection ends, or when the
    /// consuming task is cancelled; per-frame decode failures are skipped
    /// (the web parser logs and continues on malformed frames).
    func sendMessageStream(sessionId: String, text: String) -> AsyncThrowingStream<AgentChatEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var request = try await client.authorizedRequest(url: chatURL, method: "POST")
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    // Streams are long-lived; the default 60s idle timeout
                    // would kill slow generations between frames.
                    request.timeoutInterval = 600
                    request.httpBody = try JSONEncoder().encode(
                        AgentChatRequest(chatId: sessionId, message: text, runtimeModelId: nil)
                    )

                    let (bytes, response) = try await client.session.bytes(for: request)
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
