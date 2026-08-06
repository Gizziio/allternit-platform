import SwiftUI

/// Minimal on-device chat screen — deliberately standalone, NOT wired into
/// ChatViewModel/the main session pipeline (see OnDeviceHarness's doc
/// comment for why: no tool-calling loop or handoff escalation exists yet,
/// so plugging this into the real chat surface would bypass the harness).
/// This proves the inference loop itself is real and working; integrating
/// it as a first-class chat surface is a separate, larger follow-up.
struct OnDeviceChatView: View {
    @StateObject private var harness = OnDeviceHarness.shared
    @State private var messages: [(role: String, text: String)] = []
    @State private var inputText = ""
    @State private var isGenerating = false
    @State private var errorText: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            switch harness.state {
            case .notLoaded:
                loadPrompt
            case .downloading(let progress):
                downloadProgress(progress)
            case .failed(let message):
                failedState(message)
            case .loaded:
                chatBody
            }
        }
        .navigationTitle("On-Device (Experimental)")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color("BgPrimary"))
    }

    // MARK: - Pre-loaded states

    private var loadPrompt: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "brain.head.profile")
                .font(.system(size: 40))
                .foregroundColor(Color("TextSecondary"))
            Text("Llama 3.2 1B (4-bit)")
                .font(.headline)
                .foregroundColor(Color("TextPrimary"))
            Text("Runs entirely on this device, offline, once downloaded (~700MB, first time only). No shell/file tools yet — chat only.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Download & Load") {
                Task { await harness.ensureLoaded() }
            }
            .buttonStyle(.borderedProminent)
            Spacer()
        }
    }

    private func downloadProgress(_ progress: Double) -> some View {
        VStack(spacing: 16) {
            Spacer()
            ProgressView(value: progress)
                .frame(width: 200)
            Text("\(Int(progress * 100))%")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
            Spacer()
        }
    }

    private func failedState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Spacer()
            Text("Couldn't load the model")
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
            Text(message)
                .font(.caption)
                .foregroundColor(Theme.statusWarning)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Button("Retry") {
                Task { await harness.ensureLoaded() }
            }
            Spacer()
        }
    }

    // MARK: - Chat

    private var chatBody: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(Array(messages.enumerated()), id: \.offset) { index, message in
                            messageBubble(message)
                                .id(index)
                        }
                    }
                    .padding(12)
                }
                .onChange(of: messages.count) { _, _ in
                    withAnimation {
                        proxy.scrollTo(messages.count - 1, anchor: .bottom)
                    }
                }
            }

            if let errorText {
                Text(errorText)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
                    .padding(.horizontal, 12)
            }

            HStack(spacing: 8) {
                TextField("Message", text: $inputText, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .disabled(isGenerating)
                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(isGenerating || inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(12)
        }
    }

    private func messageBubble(_ message: (role: String, text: String)) -> some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 40) }
            Text(message.text)
                .font(.subheadline)
                .foregroundColor(message.role == "user" ? .black : Color("TextPrimary"))
                .padding(10)
                .background(message.role == "user" ? Color("AccentPrimary") : Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            if message.role != "user" { Spacer(minLength: 40) }
        }
    }

    private func send() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        inputText = ""
        errorText = nil
        messages.append((role: "user", text: text))
        messages.append((role: "assistant", text: ""))
        let assistantIndex = messages.count - 1
        isGenerating = true

        Task {
            do {
                for try await event in harness.stream(systemPrompt: nil, userText: text) {
                    switch event {
                    case .textDelta(let delta):
                        messages[assistantIndex].text += delta
                    case .finished:
                        break
                    case .failed(let message):
                        errorText = message
                    }
                }
            } catch {
                errorText = error.localizedDescription
            }
            isGenerating = false
        }
    }
}
