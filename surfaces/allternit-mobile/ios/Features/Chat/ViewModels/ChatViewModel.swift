import Foundation
import SwiftUI

/// View-side chat message. Assistant messages accumulate streamed text,
/// reasoning ("thinking"), a tool-call status line, and typed artifact
/// attachments — all driven by `AgentChatEvent` frames from the agent-chat
/// stream.
struct MessageRecord: Identifiable, Equatable, Sendable {
    /// Latest known state of the most recent tool call (rendered as a status line).
    struct ToolStatus: Equatable, Sendable {
        enum State: Equatable, Sendable {
            case running
            case done
            case failed
        }

        var toolName: String
        var text: String
        var state: State
    }

    let id: String
    let role: String // "user" | "assistant" | "system"
    var content: String
    var reasoning: String = ""
    var isStreaming: Bool = false
    var toolStatus: ToolStatus? = nil
    var artifacts: [ArtifactRecord] = []
}

/// Parameters for the NEXT session create, pushed from the view whenever
/// the app mode or composer agent state changes. Mode/toggle are
/// composer-level (pre-session only), so the context only ever affects
/// sessions created after the change — it never mutates a live session.
struct SessionContext: Equatable, Sendable {
    /// "chat" | "cowork" — the app mode's `origin_surface`.
    var originSurface: String = "chat"
    /// "regular" | "agent" — "agent" when the agent pill is on.
    var sessionMode: String = "regular"
    /// Selected registry agent (nil = backend default agent).
    var agentId: String? = nil
    var agentName: String? = nil
    /// Selected bottom-deck tile, sent as `metadata.agentModeId`.
    var agentModeId: String? = nil
}

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [MessageRecord] = []
    @Published var isStreaming: Bool = false
    @Published var currentSessionId: String? = nil
    /// True only during the first message's session-create POST; the
    /// composer disables send on it so a slow create can't double-send.
    @Published var isCreatingSession: Bool = false
    /// Dismissible banner text for load/send failures (shown at the top of
    /// the feed); nil hides the banner.
    @Published var transientError: String? = nil
    /// Failed-send draft handed back to the composer (the message never
    /// reached the backend); ChatView restores it into `inputText`.
    @Published var draftToRestore: String? = nil

    private let chatClient: AgentChatClient

    /// Current composer mode/agent context for the next session create —
    /// set by ChatView from the mode/agent stores (see SessionContext).
    var sessionContext = SessionContext()

    /// The in-flight assistant message, when a stream is active (kept across
    /// backgrounding so the foreground reconcile can settle its state).
    private var streamingMessageId: String? = nil
    private var streamTask: Task<Void, Never>? = nil

    // MARK: - Streaming throttle (Enchanted pattern)
    //
    // Per-token deltas are appended to these buffers; a ~50ms coalescing task
    // flushes them into `messages` so SwiftUI re-renders at most ~20x/sec
    // instead of once per token. Low-frequency events (tool status, artifacts)
    // are applied to the message immediately.
    private var pendingText: String = ""
    private var pendingReasoning: String = ""
    private var flushTask: Task<Void, Never>? = nil
    private static let flushIntervalNs: UInt64 = 50_000_000

    init(apiClient: APIClient = .shared) {
        self.chatClient = AgentChatClient(client: apiClient)
    }

    // MARK: - Sessions

    func startNewSession() {
        stopStreaming()
        transientError = nil
        messages = []
        currentSessionId = nil
    }

    func loadSession(_ sessionId: String) {
        stopStreaming()
        transientError = nil
        currentSessionId = sessionId
        messages = []

        Task { [weak self] in
            guard let self else { return }
            do {
                // GET /api/v1/agent-sessions/:id/messages → bare array
                let records = try await chatClient.listMessages(sessionId: sessionId)
                // Ignore stale responses if the user switched sessions mid-flight.
                guard self.currentSessionId == sessionId else { return }
                self.messages = records.map(Self.mapRecord)
            } catch {
                self.transientError = "Couldn't load the conversation: \(error.localizedDescription)"
            }
        }
    }

    /// Maps a wire message to the view model. The backend's `content` may
    /// already include reasoning text (it also ships separately in
    /// `thinking`) — mirrored as-is, like the web's `mapBackendMessage`.
    private static func mapRecord(_ record: AgentSessionMessage) -> MessageRecord {
        MessageRecord(
            id: record.id,
            role: record.role,
            content: record.content,
            reasoning: record.thinking ?? ""
        )
    }

    /// Creates the backing agent session on first send
    /// (POST /api/v1/agent-sessions → `ses_*` record), stamped with the
    /// current mode (`origin_surface`) and agent state (`session_mode`,
    /// selected agent / tile).
    private func ensureSessionId() async throws -> String {
        if let id = currentSessionId {
            return id
        }

        let session = try await chatClient.createSession(
            name: sessionContext.originSurface == "cowork" ? "New Cowork" : "New Chat",
            originSurface: sessionContext.originSurface,
            sessionMode: sessionContext.sessionMode,
            agentId: sessionContext.agentId,
            agentName: sessionContext.agentName,
            agentModeId: sessionContext.agentModeId
        )
        currentSessionId = session.id
        return session.id
    }

    // MARK: - Sending & streaming

    func sendMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isStreaming, !isCreatingSession else { return }

        transientError = nil
        draftToRestore = nil

        let userMessageId = UUID().uuidString
        messages.append(MessageRecord(id: userMessageId, role: "user", content: trimmed))

        let assistantId = UUID().uuidString
        messages.append(MessageRecord(id: assistantId, role: "assistant", content: "", isStreaming: true))

        isStreaming = true
        streamingMessageId = assistantId

        streamTask = Task { [weak self] in
            guard let self else { return }
            var streamFailed = false
            // True only while the first message's session-create POST is in
            // flight — the composer disables send on it (double-send guard).
            self.isCreatingSession = self.currentSessionId == nil
            do {
                let sessionId = try await self.ensureSessionId()
                self.isCreatingSession = false
                // POST /api/agent-chat — the response body IS the frame stream.
                for try await event in self.chatClient.sendMessageStream(sessionId: sessionId, text: trimmed) {
                    try Task.checkCancellation()
                    if self.apply(event, to: assistantId) {
                        streamFailed = true
                    }
                }
                // Terminal frame arrived (finish / done / [DONE]) and the
                // stream finished.
                self.finishStreaming(messageId: assistantId)
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(streamFailed ? .error : .success)
            } catch is CancellationError {
                // Local cancel (stop button / backgrounding). Whoever cancelled
                // owns the state cleanup — just don't lose buffered deltas.
                self.isCreatingSession = false
                self.flushPendingDeltas()
            } catch let error as URLError where error.code == .cancelled {
                // URLSession surfaces task cancellation as URLError.cancelled.
                self.isCreatingSession = false
                self.flushPendingDeltas()
            } catch {
                self.isCreatingSession = false
                if self.streamingMessageIsPristine(assistantId) {
                    // Nothing ever streamed back (session-create / first-byte
                    // failure): roll back the optimistic pair, hand the draft
                    // back to the composer, and surface one banner.
                    self.messages.removeAll { $0.id == assistantId || $0.id == userMessageId }
                    self.draftToRestore = trimmed
                    self.transientError = "Couldn't send the message: \(error.localizedDescription)"
                    self.finishStreaming(messageId: assistantId)
                    let generator = UINotificationFeedbackGenerator()
                    generator.notificationOccurred(.error)
                } else {
                    self.failStreaming(messageId: assistantId, error: error)
                }
            }
        }
    }

    /// Applies one `AgentChatEvent` to the streaming assistant message.
    /// Returns true when the stream failed (error frames / finish "error") —
    /// used for the completion haptic.
    private func apply(_ event: AgentChatEvent, to messageId: String) -> Bool {
        switch event {
        case .textDelta(let payload):
            pendingText += payload.text
            scheduleFlush()

        case .thinkingDelta(let text):
            pendingReasoning += text
            scheduleFlush()

        case .toolCall(let payload):
            updateMessage(messageId) { message in
                message.toolStatus = MessageRecord.ToolStatus(
                    toolName: payload.toolName,
                    text: payload.toolName,
                    state: .running
                )
            }

        case .toolResult:
            updateMessage(messageId) { message in
                message.toolStatus?.state = .done
            }

        case .toolError(let payload):
            updateMessage(messageId) { message in
                message.toolStatus?.state = .failed
                message.toolStatus?.text = payload.error
            }

        case .artifact(let artifact):
            // Typed artifact frame — no markdown-fence regex. The card
            // appears as soon as the frame arrives.
            updateMessage(messageId) { message in
                message.artifacts.append(ArtifactRecord(agentChat: artifact))
            }

        case .finish(let payload):
            guard payload.status == "error" else { break }
            flushPendingDeltas()
            let reason = payload.error ?? "The generation failed."
            updateMessage(messageId) { message in
                message.content += message.content.isEmpty
                    ? "⚠️ \(reason)"
                    : "\n\n⚠️ \(reason)"
            }
            return true

        case .streamError(let reason):
            flushPendingDeltas()
            updateMessage(messageId) { message in
                message.content += message.content.isEmpty
                    ? "⚠️ \(reason)"
                    : "\n\n⚠️ \(reason)"
            }
            return true

        case .messageStart, .done, .ignored:
            // messageStart carries only model labels (not rendered); done is
            // the bare terminal signal; ignored frames never reach here (the
            // client filters them) but the case is kept for exhaustiveness.
            break
        }
        return false
    }

    /// Stop button: cancels the local consumer and aborts the server-side
    /// generation (POST /api/v1/agent-sessions/:id/abort).
    func stopStreaming() {
        let sessionId = currentSessionId

        streamTask?.cancel()
        streamTask = nil
        flushPendingDeltas()

        if let messageId = streamingMessageId {
            updateMessage(messageId) { $0.isStreaming = false }
        }
        isStreaming = false
        streamingMessageId = nil

        if let sessionId {
            Task { [chatClient] in
                try? await chatClient.abort(sessionId: sessionId)
            }
        }
    }

    // MARK: - scenePhase lifecycle

    /// Called from ChatView's `scenePhase` handler. The SSE connection cannot
    /// survive backgrounding: on `.background` cancel local consumption (the
    /// generation keeps running server-side); on `.active` reload the
    /// session's messages — the canonical server state IS the reconcile path
    /// (the live protocol has no reply-state endpoint to diff against).
    func handleScenePhase(_ phase: ScenePhase) {
        switch phase {
        case .background:
            streamTask?.cancel()
            streamTask = nil
            flushPendingDeltas()
        case .active:
            Task { [weak self] in
                await self?.reconcileSession()
            }
        default:
            break
        }
    }

    /// Re-renders the current session from `GET .../messages` after a
    /// foreground return. Skipped while a stream is still live in-process
    /// (e.g. an `.inactive` → `.active` bounce that never severed the
    /// connection).
    private func reconcileSession() async {
        guard streamTask == nil else { return }

        // A stream cancelled by backgrounding is no longer streaming locally.
        if let messageId = streamingMessageId {
            updateMessage(messageId) { $0.isStreaming = false }
            streamingMessageId = nil
            isStreaming = false
        }

        guard let sessionId = currentSessionId else { return }

        do {
            let records = try await chatClient.listMessages(sessionId: sessionId)
            // Bail if the user switched sessions or started a new stream
            // while the reload was in flight.
            guard self.currentSessionId == sessionId, self.streamTask == nil else { return }
            self.messages = records.map(Self.mapRecord)
            self.transientError = nil
        } catch {
            self.transientError = "Couldn't refresh the conversation: \(error.localizedDescription)"
        }
    }

    // MARK: - Flush & finalize

    /// Schedules the ~50ms coalescing flush; no-op while one is pending.
    private func scheduleFlush() {
        guard flushTask == nil else { return }
        flushTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.flushIntervalNs)
            guard let self, !Task.isCancelled else { return }
            self.flushPendingDeltas()
        }
    }

    /// Applies buffered text/reasoning deltas to the streaming message.
    private func flushPendingDeltas() {
        flushTask?.cancel()
        flushTask = nil

        let text = pendingText
        let reasoning = pendingReasoning
        pendingText = ""
        pendingReasoning = ""

        guard !text.isEmpty || !reasoning.isEmpty,
              let messageId = streamingMessageId else { return }
        updateMessage(messageId) { message in
            message.content += text
            message.reasoning += reasoning
        }
    }

    /// Normal end of a stream: flush, clear streaming flags and bookkeeping.
    private func finishStreaming(messageId: String) {
        flushPendingDeltas()
        updateMessage(messageId) { $0.isStreaming = false }
        isStreaming = false
        streamingMessageId = nil
        streamTask = nil
    }

    /// Transport/creation failure: surface the error inline, then finalize.
    /// Intentional cancels (CancellationError / URLError.cancelled) stay silent.
    private func failStreaming(messageId: String, error: Error) {
        if error is CancellationError { return }
        if let urlError = error as? URLError, urlError.code == .cancelled { return }
        flushPendingDeltas()
        updateMessage(messageId) { message in
            let reason = error.localizedDescription
            message.content += message.content.isEmpty
                ? "⚠️ Connection interrupted: \(reason)"
                : "\n\n⚠️ Connection interrupted: \(reason)"
        }
        finishStreaming(messageId: messageId)
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }

    /// True while the streaming assistant message has received nothing —
    /// no deltas buffered or applied, no tool activity, no artifacts. Used
    /// to tell "send never landed" (roll back + restore draft) apart from a
    /// mid-stream interruption (keep the partial reply, inline error).
    private func streamingMessageIsPristine(_ messageId: String) -> Bool {
        guard pendingText.isEmpty, pendingReasoning.isEmpty,
              let message = messages.first(where: { $0.id == messageId }) else { return false }
        return message.content.isEmpty && message.toolStatus == nil && message.artifacts.isEmpty
    }

    private func updateMessage(_ id: String, _ mutate: (inout MessageRecord) -> Void) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        mutate(&messages[index])
    }
}
