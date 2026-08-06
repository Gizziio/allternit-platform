import Foundation

enum BenchmarkError: LocalizedError {
    case noModelSelected
    case emptyResponse

    var errorDescription: String? {
        switch self {
        case .noModelSelected: return "Pick a model first."
        case .emptyResponse: return "The model didn't return any text to measure."
        }
    }
}

/// Runs one benchmark request through the SAME `/api/agent-chat` path the
/// regular composer uses, in a dedicated ephemeral session so it never shows
/// up in chat history (mirrors ChatViewModel.startNewSession(ephemeral:
/// true) — see its doc comment). Timing methodology matches
/// MessageRecord.PerfStats exactly, on purpose: same honesty caveat (wall
/// clock over the network, chars/4 token estimate), same numbers a user
/// would already be seeing per-message in chat.
@MainActor
enum BenchmarkRunner {
    private static let prompt = "Write a two-paragraph explanation of how photosynthesis works."

    static func run(modelId: String?, modelLabel: String, chatClient: AgentChatClient = AgentChatClient()) async throws -> BenchmarkResult {
        let session = try await chatClient.createSession(
            name: "Benchmark",
            originSurface: "chat",
            sessionMode: "regular",
            ephemeral: true
        )

        let requestStartedAt = Date()
        var firstDeltaAt: Date? = nil
        var text = ""

        for try await event in chatClient.sendMessageStream(
            sessionId: session.id,
            text: prompt,
            runtimeModelId: modelId
        ) {
            if case .textDelta(let payload) = event {
                if firstDeltaAt == nil { firstDeltaAt = Date() }
                text += payload.text
            }
        }

        guard let firstDeltaAt else { throw BenchmarkError.emptyResponse }
        guard !text.isEmpty else { throw BenchmarkError.emptyResponse }

        return BenchmarkResult(
            id: UUID(),
            modelId: modelId ?? "default",
            modelLabel: modelLabel,
            ranAt: requestStartedAt,
            timeToFirstToken: firstDeltaAt.timeIntervalSince(requestStartedAt),
            generationDuration: Date().timeIntervalSince(firstDeltaAt),
            approxTokenCount: max(1, text.count / 4),
            deviceIdentifier: DeviceSpecs.current().hardwareIdentifier
        )
    }
}
