import Foundation
import MLXLLM
import MLXLMCommon

/// Fourth local-model data-plane tier: on-device inference, native Swift,
/// via MLX (see docs/Audits_and_Research/BYOC_DESKTOP_CLOUD_IOS_ARCHITECTURE_AUDIT.md).
///
/// Scope, deliberately: this is the CORE inference loop only (load model,
/// stream a chat completion) — real and verified compiling, not a stub.
/// What's NOT built here, on purpose: tool-calling, the doom-loop permission
/// guard, and `sdk.sessions.handoff()` escalation to a paired runtime for
/// real tool execution. Those are the difference between "a local chat
/// screen" and "an on-device session that goes through an intelligent
/// harness" — the whole point Eoj raised — and need their own dedicated
/// design pass before being bolted onto this. Do not wire this loop
/// directly into ChatViewModel/the main session pipeline until that
/// exists; it would bypass the harness exactly the way that was flagged as
/// wrong for the desktop/cloud tiers.
enum OnDeviceEvent: Sendable {
    case textDelta(String)
    case finished
    case failed(String)
}

enum OnDeviceModelState: Equatable, Sendable {
    case notLoaded
    case downloading(progress: Double)
    case loaded
    case failed(String)
}

@MainActor
final class OnDeviceHarness: ObservableObject {
    static let shared = OnDeviceHarness()

    /// Llama 3.2 1B Instruct, 4-bit — the smallest well-tested entry in
    /// MLXLLM's own registry, appropriate for phone storage/compute (~700MB)
    /// rather than Sidecar's much larger desktop-tier default (Qwen 3.5 4B).
    static let modelConfiguration = MLXLLM.LLMRegistry.llama3_2_1B_4bit

    @Published private(set) var state: OnDeviceModelState = .notLoaded

    private var container: ModelContainer?

    /// Downloads (first run only — cached by MLX's Hub layer after that)
    /// and loads the model. Safe to call repeatedly; no-ops once loaded.
    func ensureLoaded() async {
        if container != nil { return }
        state = .downloading(progress: 0)
        do {
            let container = try await MLXLLM.LLMModelFactory.shared.loadContainer(
                configuration: Self.modelConfiguration
            ) { [weak self] progress in
                Task { @MainActor in
                    self?.state = .downloading(progress: progress.fractionCompleted)
                }
            }
            self.container = container
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// Streams a completion for one turn — system prompt + a single user
    /// message, no conversation history threading yet (matches the reduced
    /// scope above: this proves the inference loop works, not a full chat
    /// session model).
    func stream(systemPrompt: String?, userText: String) -> AsyncThrowingStream<OnDeviceEvent, Error> {
        AsyncThrowingStream { continuation in
            guard let container else {
                continuation.yield(.failed("Model not loaded."))
                continuation.finish()
                return
            }

            Task {
                do {
                    try await container.perform { context in
                        // Built inside the closure, not captured from
                        // outside — `[String: Any]` isn't Sendable (Any
                        // could hold anything), so a pre-built array can't
                        // cross into this @Sendable closure. systemPrompt/
                        // userText are plain Strings, which are.
                        var messages: [[String: Any]] = []
                        if let systemPrompt, !systemPrompt.isEmpty {
                            messages.append(["role": "system", "content": systemPrompt])
                        }
                        messages.append(["role": "user", "content": userText])

                        let input = try await context.processor.prepare(input: UserInput(messages: messages))
                        // didGenerate hands back one NEW token per call (this
                        // API shape, unlike mlx-swift-examples' older
                        // accumulated-[Int] style) — decode the growing token
                        // array ourselves and diff against the last decode to
                        // get a text delta, since decoding a lone token in
                        // isolation can split a multi-token character/BPE merge.
                        var allTokens: [Int] = []
                        var previousText = ""

                        _ = try MLXLMCommon.generate(
                            input: input,
                            parameters: GenerateParameters(),
                            context: context
                        ) { token in
                            allTokens.append(token)
                            let decoded = context.tokenizer.decode(tokens: allTokens)
                            if decoded.hasPrefix(previousText) {
                                let delta = String(decoded.dropFirst(previousText.count))
                                if !delta.isEmpty {
                                    continuation.yield(.textDelta(delta))
                                }
                                previousText = decoded
                            }
                            return .more
                        }
                    }
                    continuation.yield(.finished)
                    continuation.finish()
                } catch {
                    continuation.yield(.failed(error.localizedDescription))
                    continuation.finish()
                }
            }
        }
    }
}
