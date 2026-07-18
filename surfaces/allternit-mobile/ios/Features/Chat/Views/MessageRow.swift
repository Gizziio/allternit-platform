import SwiftUI
import MarkdownView

struct MessageRow: View {
    let message: MessageRecord
    let onArtifactTap: (ArtifactRecord) -> Void

    /// One streaming source per message, kept alive for the message's lifetime.
    /// The view model's ~50ms flushes land here via `onChange(of: message)`;
    /// the reader parses incrementally off the main thread.
    @State private var markdownSource: StreamingMarkdownSource
    @State private var isThinkingExpanded = false

    init(message: MessageRecord, onArtifactTap: @escaping (ArtifactRecord) -> Void) {
        self.message = message
        self.onArtifactTap = onArtifactTap
        _markdownSource = State(initialValue: StreamingMarkdownSource(message.content))
    }

    var body: some View {
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

                // Message Bubble — markdown for the assistant, plain text for the user
                bubble

                // Inline Artifact Card attachments (typed artifact.created events)
                ForEach(message.artifacts) { artifact in
                    artifactCard(artifact)
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
        .onAppear {
            // History and user messages never stream: seed and finish so the
            // reader performs a single full parse.
            markdownSource.text = message.content
            if !message.isStreaming {
                markdownSource.finishStreaming()
            }
        }
        .onChange(of: message) { _, updated in
            if updated.content != markdownSource.text {
                markdownSource.text = updated.content
            }
            if !updated.isStreaming {
                markdownSource.finishStreaming()
            }
        }
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
            StreamingMarkdownReader(markdownSource) { parseResult in
                MarkdownView(parseResult)
            }
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
        Button(action: {
            UIPasteboard.general.string = message.content
        }) {
            Label("Copy Text", systemImage: "doc.on.doc")
        }

        Button(action: {
            // Trigger branching callback from this index
        }) {
            Label("Fork Thread Here", systemImage: "arrow.triangle.branch")
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

                    Text("Click to open interactive preview")
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
