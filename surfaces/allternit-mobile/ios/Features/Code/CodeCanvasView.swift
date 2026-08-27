import SwiftUI

/// Phase-1 Code Canvas workspace shell for iOS.
///
/// Mirrors the web's Code Canvas as a workspace grid of code-session tiles.
/// Tapping a tile opens the existing chat thread. This is intentionally not a
/// full infinite canvas — drag/resize, multiple tile types, minimap, HUD, and
/// h5i panels are deferred.
struct CodeCanvasView: View {
    @StateObject private var canvasStore = CodeCanvasStore.shared
    @StateObject private var agentChatClient = AgentChatClient()
    @Environment(\.dismiss) private var dismiss

    @State private var sessions: [AgentSession] = []
    @State private var isLoading = false
    @State private var loadError: String? = nil
    @State private var threadTarget: CodeThreadTarget? = nil

    private let theme = ModeTheme(mode: .code)

    private var codeSessions: [AgentSession] {
        sessions.filter { $0.originSurface == AppMode.code.originSurface }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().background(Color("BorderSubtle"))
                workspaceBar
                Divider().background(Color("BorderSubtle"))
                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .navigationDestination(item: $threadTarget) { target in
                CodeThreadChatView(sessionId: target.sessionId, title: target.title)
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task {
            await loadSessions()
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Canvas")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))
                Text("Workspace view")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }

            Spacer()

            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Workspace bar

    private var workspaceBar: some View {
        HStack(spacing: 10) {
            if let workspace = canvasStore.activeWorkspace {
                HStack(spacing: 6) {
                    Image(systemName: "square.grid.2x2")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(theme.accent)
                    Text(workspace.displayName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)
                }
                .padding(.horizontal, 10)
                .frame(height: 28)
                .background(Color("BgPanel"))
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            }

            Spacer()

            Text("\(codeSessions.count) session\(codeSessions.count == 1 ? "" : "s")")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if isLoading && codeSessions.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError, codeSessions.isEmpty {
            Spacer()
            VStack(spacing: 12) {
                Text("Couldn't load canvas")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    Task { await loadSessions() }
                }
                .font(.subheadline)
                .foregroundColor(theme.accent)
            }
            .padding(.horizontal, 20)
            Spacer()
        } else if codeSessions.isEmpty {
            Spacer()
            emptyState
            Spacer()
        } else {
            tileGrid
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "square.grid.2x2")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text("No code sessions yet")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }

    private var tileGrid: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(codeSessions) { session in
                    sessionTile(session)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
        }
        .refreshable {
            await loadSessions()
        }
    }

    private func sessionTile(_ session: AgentSession) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            threadTarget = CodeThreadTarget(
                sessionId: session.id,
                title: session.name ?? "Untitled Session"
            )
        }) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Image(systemName: session.agentId != nil ? "cpu" : "terminal")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(theme.accent)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color("TextSecondary"))
                }

                Text(session.name ?? "Untitled Session")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                Text(session.agentId != nil ? "Agent session" : "Regular session")
                    .font(.caption2)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(1)
            }
            .padding(14)
            .frame(height: 132)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusLG)
                    .stroke(theme.accentGlow.opacity(0.4), lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Loading

    @MainActor
    private func loadSessions() async {
        if sessions.isEmpty {
            isLoading = true
        }
        loadError = nil
        do {
            sessions = try await agentChatClient.listSessions()
            canvasStore.syncTiles(from: codeSessions)
        } catch is CancellationError {
            // View disappeared mid-flight — keep the current state.
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Thread navigation (mirrors CodeModeView)

private struct CodeThreadTarget: Hashable, Identifiable {
    let sessionId: String?
    let title: String?
    var id: String { sessionId ?? "new-thread" }
}
