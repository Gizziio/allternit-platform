import SwiftUI

/// Cowork workspace launchpad.
///
/// Entry point for the full Cowork workspace on iOS: start a new session or
/// resume a recent one. Selected sessions push to `CoworkSessionWorkspaceView`.
struct CoworkWorkspaceView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = CoworkSessionStore.shared

    @State private var selectedSessionId: String? = nil
    @State private var isCreating = false
    @State private var createError: String? = nil

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().background(Color("BorderSubtle"))
                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(item: $selectedSessionId) { sessionId in
                CoworkSessionWorkspaceView(sessionId: sessionId)
            }
        }
        .task {
            store.fetchSessionsIfNeeded()
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("Cowork")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Spacer()

            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        ScrollView {
            VStack(spacing: 20) {
                newSessionSection

                if let createError {
                    Text(createError)
                        .font(.subheadline)
                        .foregroundColor(.red)
                        .padding(.horizontal, 20)
                }

                recentSessionsSection
            }
            .padding(.vertical, 20)
        }
    }

    private var newSessionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Start collaborating")
                .font(.headline)
                .foregroundColor(Color("TextPrimary"))

            Button(action: { startNewSession() }) {
                HStack(spacing: 12) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundColor(Color("AccentPrimary"))

                    VStack(alignment: .leading, spacing: 2) {
                        Text("New Cowork Session")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(Color("TextPrimary"))
                        Text("Plan, build, and review with an agent.")
                            .font(.subheadline)
                            .foregroundColor(Color("TextSecondary"))
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color("TextSecondary"))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(Color("BgPanel"))
                .cornerRadius(16)
            }
            .disabled(isCreating)
            .opacity(isCreating ? 0.6 : 1)
        }
        .padding(.horizontal, 20)
    }

    @ViewBuilder
    private var recentSessionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Sessions")
                    .font(.headline)
                    .foregroundColor(Color("TextPrimary"))

                Spacer()

                if store.isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }

            if let errorMessage = store.errorMessage, store.sessions.isEmpty {
                Text(errorMessage)
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .padding(.vertical, 20)
                    .frame(maxWidth: .infinity, alignment: .center)
            } else if store.sessions.isEmpty && !store.isLoading {
                Text("No sessions yet. Start your first Cowork session above.")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                    .padding(.vertical, 20)
                    .frame(maxWidth: .infinity, alignment: .center)
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(store.sessions) { session in
                        HStack(spacing: 12) {
                            Button(action: { selectedSessionId = session.id }) {
                                HStack(spacing: 12) {
                                    Image(systemName: "bubble.left.and.bubble.right")
                                        .font(.system(size: 18))
                                        .foregroundColor(Color("AccentPrimary"))

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(session.displayTitle)
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundColor(Color("TextPrimary"))
                                            .lineLimit(1)

                                        Text(session.createdAt)
                                            .font(.caption)
                                            .foregroundColor(Color("TextSecondary"))
                                    }

                                    Spacer()

                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(Color("TextSecondary"))
                                }
                            }
                            .buttonStyle(.plain)

                            Button(action: {
                                Task {
                                    try? await store.deleteSession(id: session.id)
                                }
                            }) {
                                Image(systemName: "trash")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(.red.opacity(0.8))
                                    .frame(width: 32, height: 32)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color("BgPanel"))
                        .cornerRadius(12)
                    }
                }
            }
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Actions

    private func startNewSession() {
        isCreating = true
        createError = nil
        Task {
            do {
                let id = try await store.createSession(name: "New Cowork Session")
                isCreating = false
                selectedSessionId = id
            } catch {
                isCreating = false
                createError = error.localizedDescription
            }
        }
    }
}
