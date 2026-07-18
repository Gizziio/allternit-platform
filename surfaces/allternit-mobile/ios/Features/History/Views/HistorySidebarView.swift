import SwiftUI

/// A dated bucket of sessions (Today / Yesterday / Previous 7 Days / Older).
struct HistoryGroup: Identifiable {
    let id: String
    let title: String
    let sessions: [AgentSession]
}

struct HistorySidebarView: View {
    @Binding var selectedSessionId: String?
    @Binding var isSidebarOpen: Bool

    @State private var historyGroups: [HistoryGroup] = []
    @State private var isLoading = false
    @State private var loadError: String? = nil
    @State private var searchText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("A://")
                    .foregroundColor(Color("AccentPrimary"))
                    .font(.system(.title3, design: .monospaced))
                    .bold()
                Text("LLTERNIT")
                    .foregroundColor(Color("TextPrimary"))
                    .font(.system(.title3, design: .serif))
                    .tracking(2.0)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 60)
            .padding(.bottom, 24)

            // Chat search — client-side title filter (the backend has no
            // session search endpoint).
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))

                TextField("Search chats", text: $searchText)
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.subheadline)
                            .foregroundColor(Color("TextSecondary"))
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(Color("BgSecondary"))
            .cornerRadius(10)
            .padding(.horizontal, 20)
            .padding(.bottom, 16)

            // History Group List
            ScrollView {
                historyContent
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable {
                await loadSessions()
            }

            Spacer()

            Divider().background(Color("BorderSubtle"))

            // Footer (Profile & Settings)
            HStack(spacing: 14) {
                // Profile Avatar Placeholder
                Image(systemName: "person.crop.circle.fill")
                    .resizable()
                    .frame(width: 36, height: 36)
                    .foregroundColor(Color("TextSecondary"))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Joseph Eoj")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color("TextPrimary"))
                    Text("Developer Account")
                        .font(.caption2)
                        .foregroundColor(Color("TextSecondary"))
                }

                Spacer()

                Button(action: {
                    Task { try? await AuthManager.shared.signOut() }
                }) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .foregroundColor(Color("TextSecondary"))
                        .font(.title3)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
            .background(Color("BgPrimary"))
        }
        .frame(width: 280)
        .background(Color("BgPrimary"))
        .edgesIgnoringSafeArea(.vertical)
        .task {
            await loadSessions()
        }
        .onChange(of: isSidebarOpen) { _, isOpen in
            // Refresh each time the drawer is revealed so new chats show up.
            if isOpen {
                Task { await loadSessions() }
            }
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var historyContent: some View {
        if isLoading && historyGroups.isEmpty {
            HStack {
                Spacer()
                ProgressView()
                    .padding(.top, 40)
                Spacer()
            }
        } else if let loadError, historyGroups.isEmpty {
            VStack(spacing: 12) {
                Text("Couldn't load conversations")
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
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            .padding(.top, 40)
            .frame(maxWidth: .infinity)
        } else if historyGroups.isEmpty {
            Text("No conversations yet.\nStart a new chat to see it here.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
                .padding(.top, 40)
                .frame(maxWidth: .infinity)
        } else if visibleGroups.isEmpty {
            // History is loaded but the search filters everything out —
            // distinct from the "no chats yet" empty state.
            VStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.title3)
                    .foregroundColor(Color("TextSecondary"))
                Text("No chats match your search.")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 20)
            .padding(.top, 40)
            .frame(maxWidth: .infinity)
        } else {
            VStack(alignment: .leading, spacing: 28) {
                ForEach(visibleGroups) { group in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(group.title)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(Color("TextSecondary"))
                            .padding(.horizontal, 20)

                        ForEach(group.sessions) { session in
                            Button(action: {
                                let generator = UIImpactFeedbackGenerator(style: .light)
                                generator.impactOccurred()
                                selectedSessionId = session.id
                                isSidebarOpen = false
                            }) {
                                HStack(spacing: 12) {
                                    Image(systemName: "bubble.left")
                                        .font(.subheadline)
                                        .foregroundColor(selectedSessionId == session.id ? Color("AccentPrimary") : Color("TextSecondary"))

                                    Text(session.name ?? "Untitled")
                                        .font(.subheadline)
                                        .foregroundColor(selectedSessionId == session.id ? Color("TextPrimary") : Color("TextPrimary").opacity(0.8))
                                        .lineLimit(1)

                                    Spacer()
                                }
                                .padding(.vertical, 8)
                                .padding(.horizontal, 20)
                                .background(selectedSessionId == session.id ? Color("BgSecondary") : Color.clear)
                                .cornerRadius(8)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Search

    /// History filtered by the search query — case-insensitive contains on
    /// the display title over the already-loaded list. The date grouping is
    /// preserved; buckets the filter empties drop out.
    private var visibleGroups: [HistoryGroup] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return historyGroups }
        return historyGroups.compactMap { group in
            let matches = group.sessions.filter {
                ($0.name ?? "Untitled").localizedCaseInsensitiveContains(query)
            }
            return matches.isEmpty ? nil : HistoryGroup(id: group.id, title: group.title, sessions: matches)
        }
    }

    // MARK: - Loading & grouping

    @MainActor
    private func loadSessions() async {
        if historyGroups.isEmpty {
            isLoading = true
        }
        loadError = nil

        do {
            // GET /api/v1/agent-sessions → { sessions: [...], count } — the
            // production sidebar's history source.
            let envelope: AgentSessionListResponse = try await APIClient.shared.get(path: "agent-sessions")
            historyGroups = Self.group(envelope.sessions)
        } catch is CancellationError {
            // View disappeared mid-flight — keep the current state.
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }

    /// Buckets records by `updated_at` (falling back to `created_at`), newest
    /// first, into Today / Yesterday / Previous 7 Days / Older. Empty groups
    /// are dropped.
    private static func group(_ records: [AgentSession]) -> [HistoryGroup] {
        let sorted = records.sorted { timestamp(of: $0) > timestamp(of: $1) }
        let calendar = Calendar.current
        let weekAgo = Date().addingTimeInterval(-7 * 24 * 60 * 60)

        var today: [AgentSession] = []
        var yesterday: [AgentSession] = []
        var previousWeek: [AgentSession] = []
        var older: [AgentSession] = []

        for record in sorted {
            let date = timestamp(of: record)
            if calendar.isDateInToday(date) {
                today.append(record)
            } else if calendar.isDateInYesterday(date) {
                yesterday.append(record)
            } else if date > weekAgo {
                previousWeek.append(record)
            } else {
                older.append(record)
            }
        }

        return [
            HistoryGroup(id: "today", title: "Today", sessions: today),
            HistoryGroup(id: "yesterday", title: "Yesterday", sessions: yesterday),
            HistoryGroup(id: "previousWeek", title: "Previous 7 Days", sessions: previousWeek),
            HistoryGroup(id: "older", title: "Older", sessions: older)
        ].filter { !$0.sessions.isEmpty }
    }

    private static func timestamp(of record: AgentSession) -> Date {
        parseTimestamp(record.updatedAt) ?? parseTimestamp(record.createdAt) ?? .distantPast
    }

    /// Backend timestamps are RFC-3339 (chrono `to_rfc3339`), with or without
    /// fractional seconds.
    private static func parseTimestamp(_ value: String) -> Date? {
        if let date = try? Date(value, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) {
            return date
        }
        return try? Date(value, strategy: Date.ISO8601FormatStyle())
    }
}
