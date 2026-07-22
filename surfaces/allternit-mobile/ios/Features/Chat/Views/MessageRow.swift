import SwiftUI
import MarkdownView

struct MessageRow: View {
    let message: MessageRecord
    let onArtifactTap: (ArtifactRecord) -> Void
    /// Error-card actions: model errors offer "Choose a model", everything
    /// else offers "Retry" (re-streams the last sent text).
    var onChooseModel: () -> Void = {}
    var onRetry: (String) -> Void = { _ in }
    /// Phase 8 action bar: true only on the most recent assistant reply —
    /// its row gets the retry (regenerate) button.
    var isLastAssistant: Bool = false
    /// Phase 8 edit: true only on the most recent user bubble — its
    /// long-press menu gets "Edit" (fill the composer; re-sending truncates
    /// the conversation after it).
    var isLastUser: Bool = false
    var onRegenerate: () -> Void = {}
    var onEdit: () -> Void = {}

    @State private var isThinkingExpanded = false
    /// Settings → Capabilities → Artifacts gates the inline artifact cards;
    /// observed so toggling it applies to already-rendered rows.
    @ObservedObject private var settings = SettingsStore.shared

    var body: some View {
        // Voice-mode summary card (Phase 7b): a centered card row with no
        // avatars/bubble — the conversation itself renders as normal turns.
        if let voiceSummary = message.voiceSummary {
            VoiceSummaryCardView(summary: voiceSummary)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 12)
        } else {
            messageRowBody
        }
    }

    private var messageRowBody: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == "user" {
                Spacer(minLength: 40)
            } else {
                // Agent Avatar Icon
                Text("A://")
                    .font(.system(.caption, design: .monospaced))
                    .bold()
                    .foregroundColor(Color("AccentPrimary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgSecondary"))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color("BorderSubtle"), lineWidth: 1))
            }

            VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 8) {
                // Collapsible "thinking" block (reply.reasoning.delta)
                if !message.reasoning.isEmpty {
                    thinkingBlock
                }

                // Tool-call status line
                if let toolStatus = message.toolStatus {
                    toolStatusLine(toolStatus)
                }

                // Message Bubble — markdown for the assistant, plain text for the user.
                // Skipped when the message is nothing but an error card.
                if !message.content.isEmpty || message.error == nil {
                    bubble
                }

                // Structured failure card (replaces raw backend error text)
                if let error = message.error {
                    ChatErrorCardView(
                        error: error,
                        onChooseModel: onChooseModel,
                        onRetry: { onRetry(message.id) }
                    )
                }

                // Inline Artifact Card attachments (typed artifact.created
                // events) — gated by Settings → Capabilities → Artifacts.
                if settings.artifactsEnabled {
                    ForEach(message.artifacts) { artifact in
                        artifactCard(artifact)
                    }
                }

                // Phase 8 action bar (Claude parity): copy / share / speak /
                // 👍 / 👎 / retry under completed assistant replies. Hidden
                // while streaming and on error cards (the card owns retry).
                if message.role == "assistant", !message.isStreaming, message.error == nil {
                    MessageActionBar(
                        message: message,
                        isLastAssistant: isLastAssistant,
                        onRegenerate: onRegenerate
                    )
                }
            }

            if message.role == "user" {
                // User Avatar Icon
                Image(systemName: "person.circle.fill")
                    .resizable()
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
            } else {
                Spacer(minLength: 40)
            }
        }
        .padding(.horizontal, 12)
    }

    // MARK: - Subviews

    @ViewBuilder
    private var bubble: some View {
        if message.role == "user" {
            Text(message.content)
                .font(.body)
                .foregroundColor(Color.black)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color("AccentPrimary"))
                .cornerRadius(18)
                .contextMenu { bubbleContextMenu }
        } else {
            // MarkdownView 2.6.0 (pinned, see project.yml): full re-parse on
            // each content change — bounded by the view model's ~50ms flush
            // coalescing. v3's incremental StreamingMarkdownReader returns
            // with the Xcode upgrade.
            MarkdownView(message.content)
            .font(.body)
            .foregroundColor(Color("TextPrimary"))
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color("BgPrimary"))
            .cornerRadius(18)
            .contextMenu { bubbleContextMenu }
        }
    }

    @ViewBuilder
    private var bubbleContextMenu: some View {
        // Phase 8: "Edit" on the last user bubble — fills the composer with
        // the message text; re-sending truncates the conversation after it
        // (ChatViewModel.resendEditedMessage).
        if message.role == "user", isLastUser {
            Button(action: onEdit) {
                Label("Edit", systemImage: "pencil")
            }
        }

        Button(action: {
            UIPasteboard.general.string = message.content
        }) {
            Label("Copy Text", systemImage: "doc.on.doc")
        }
    }

    @ViewBuilder
    private var thinkingBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button(action: {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isThinkingExpanded.toggle()
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "brain")
                        .font(.caption)
                    Text(message.isStreaming && message.content.isEmpty ? "Thinking…" : "Thinking")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Image(systemName: isThinkingExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                }
                .foregroundColor(Color("TextSecondary"))
            }
            .buttonStyle(.plain)

            if isThinkingExpanded {
                Text(message.reasoning)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color("BgPrimary"))
                    .cornerRadius(10)
            }
        }
    }

    @ViewBuilder
    private func toolStatusLine(_ status: MessageRecord.ToolStatus) -> some View {
        HStack(spacing: 6) {
            Group {
                switch status.state {
                case .running:
                    ProgressView()
                        .scaleEffect(0.6)
                case .done:
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Color("AccentPrimary"))
                case .failed:
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                }
            }
            .frame(width: 14, height: 14)

            Text(status.text)
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .lineLimit(1)
        }
    }

    @ViewBuilder
    private func artifactCard(_ artifact: ArtifactRecord) -> some View {
        Button(action: { onArtifactTap(artifact) }) {
            HStack(spacing: 12) {
                Image(systemName: artifact.fileType.lowercased() == "svg" ? "paintpalette" : "doc.text.fill")
                    .font(.title3)
                    .foregroundColor(Color("AccentPrimary"))

                VStack(alignment: .leading, spacing: 2) {
                    Text(artifact.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)

                    Text(artifact.isPreviewable ? "Click to open interactive preview" : "Click to view")
                        .font(.caption2)
                        .foregroundColor(Color("TextSecondary"))
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }
            .padding(12)
            .frame(width: 250)
            .background(Color("BgPrimary"))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color("BorderSubtle"), lineWidth: 1)
            )
        }
        .transition(.slide)
    }
}
