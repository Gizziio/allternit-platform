import SwiftUI

// MARK: - Code tab root

/// Root of the Code tab: agentic coding sessions, chat-driven, tagged
/// `origin_surface='code'` on create (the web's CodeSessionStore,
/// surfaces/ai.allternit.com/src/views/code/CodeSessionStore.ts:30-34).
///
/// Layout: a header ("Code" title in the code accent + environment selector +
/// New Thread button) above the code-session list, mirroring the simple
/// subset of the web rail's code recents (ShellRail.tsx:1036-1234) — list +
/// new thread; the web's Status/Project/Environment/Date filters and
/// Group/Sort popover are intentionally skipped for v1.
///
/// Tapping a session (or New Thread) pushes a `ChatContentView` — the same
/// chat UI Home uses — inside the tab's own NavigationStack. Because the app
/// mode is `.code` here, the first send stamps the new session with
/// `origin_surface='code'` (plus `session_mode='agent'` when the agent pill
/// is on for the code surface, via AgentModeStore's per-mode state).
struct CodeModeView: View {
    @Binding var isSidebarOpen: Bool
    @Binding var selectedSessionId: String?

    @EnvironmentObject private var modeStore: AppModeStore
    @StateObject private var environmentStore = EnvironmentStore.shared

    @State private var sessions: [AgentSession] = []
    @State private var isLoading = false
    @State private var loadError: String? = nil
    @State private var threadTarget: CodeThreadTarget? = nil
    @State private var isPairingPresented = false
    /// Phase 8 status filter (Claude "Filter by status" sheet parity).
    @State private var statusFilter: CodeStatusFilter = .all
    @State private var isFilterSheetPresented = false

    private let theme = ModeTheme(mode: .code)

    /// Only sessions tagged code — the API restores the original surface at
    /// `metadata.originSurface` on read (agent_session_routes.rs:274-301).
    /// Sessions whose surface was never recorded decode as "" and fall out.
    private var codeSessions: [AgentSession] {
        sessions.filter { $0.originSurface == AppMode.code.originSurface }
    }

    /// The status filter on top of the code-surface filter.
    private var filteredSessions: [AgentSession] {
        guard statusFilter != .all else { return codeSessions }
        return codeSessions.filter { Self.derivedStatus(of: $0) == statusFilter }
    }

    private var groups: [HistoryGroup] {
        Self.group(filteredSessions)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().background(Color("BorderSubtle"))

                if environmentStore.environment == .cloud, environmentStore.pairedRuntimeId == nil {
                    cloudUnpairedNotice
                    Divider().background(Color("BorderSubtle"))
                }

                ScrollView {
                    content
                }
                .refreshable {
                    await loadSessions()
                }
            }
            .background(Color("BgPrimary"))
            .navigationDestination(item: $threadTarget) { target in
                CodeThreadChatView(sessionId: target.sessionId, title: target.title)
            }
            .sheet(isPresented: $isPairingPresented) {
                RuntimePairingView()
            }
            .sheet(isPresented: $isFilterSheetPresented) {
                CodeStatusFilterSheet(
                    selected: $statusFilter,
                    counts: Dictionary(grouping: codeSessions, by: { Self.derivedStatus(of: $0) }).mapValues(\.count),
                    accent: theme.accent
                )
                .presentationDetents([.medium])
            }
            .task {
                await loadSessions()
                #if DEBUG
                // `-open-code-filter` (DEBUG only): open the status filter
                // sheet on appear for screenshot verification — MainWorkspaceView
                // handles the matching tab switch to Code (no tap injection
                // in simctl).
                if CommandLine.arguments.contains("-open-code-filter") {
                    isFilterSheetPresented = true
                }
                // `-open-code-thread` (DEBUG only): push a fresh code thread
                // so the terminal session UX can be screenshot-verified.
                if CommandLine.arguments.contains("-open-code-thread") {
                    threadTarget = CodeThreadTarget(sessionId: nil, title: nil)
                }
                #endif
            }
            .onChange(of: threadTarget) { _, target in
                // Back from a thread: pick up sessions created/renamed there.
                if target == nil {
                    Task { await loadSessions() }
                }
            }
            .onChange(of: environmentStore.environment) { _, _ in
                // Local ↔ cloud swaps the backend the list comes from.
                Task { await loadSessions() }
            }
            .onChange(of: selectedSessionId) { _, id in
                // If a code session was selected from the sidebar, navigate to it!
                if let id = id, modeStore.mode == .code {
                    let name = sessions.first(where: { $0.id == id })?.name ?? "Code Session"
                    threadTarget = CodeThreadTarget(sessionId: id, title: name)
                    // Reset selectedSessionId immediately so subsequent triggers work
                    DispatchQueue.main.async {
                        selectedSessionId = nil
                    }
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
                isSidebarOpen.toggle()
            }) {
                Image(systemName: "line.3.horizontal")
                    .font(.title3)
                    .foregroundColor(Color("TextPrimary"))
                    .frame(width: 44, height: 44)
            }

            Text("Code")
                .font(.system(.title3, design: .serif))
                .fontWeight(.semibold)
                .foregroundColor(theme.accent)

            environmentMenu

            Spacer()

            // Status filter (Phase 8, Claude parity) — tinted while a
            // non-All filter is active.
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                isFilterSheetPresented = true
            }) {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .font(.title3)
                    .foregroundColor(statusFilter == .all ? Color("TextPrimary") : theme.accent)
                    .frame(width: 44, height: 44)
            }

            Button(action: startNewThread) {
                Image(systemName: "square.and.pencil")
                    .font(.title3)
                    .foregroundColor(Color("TextPrimary"))
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.leading, 8)
        .padding(.trailing, 8)
        .padding(.vertical, 10)
        .background(Color("BgPrimary"))
    }

    /// Runtime target switcher (the web header's EnvironmentSelector): a
    /// capsule showing the active environment — colored status dot (cosmetic
    /// for now), icon, label, caret — backed by EnvironmentStore.
    private var environmentMenu: some View {
        Menu {
            ForEach(AppEnvironment.allCases, id: \.self) { environment in
                Button(action: { environmentStore.environment = environment }) {
                    HStack {
                        if environmentStore.environment == environment {
                            Image(systemName: "checkmark")
                        }
                        Label(environment.label, systemImage: environment.icon)
                    }
                }
            }

            Divider()

            Button(action: { isPairingPresented = true }) {
                Label("Pair Runtime…", systemImage: "link")
            }
            if environmentStore.pairedRuntimeId != nil {
                Button(role: .destructive, action: { environmentStore.unpair() }) {
                    Label("Unpair Runtime", systemImage: "xmark.circle")
                }
            }
        } label: {
            HStack(spacing: 6) {
                Circle()
                    .fill(environmentStore.environment.color)
                    .frame(width: 6, height: 6)
                Image(systemName: environmentStore.environment.icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(environmentStore.environment.color)
                Text(environmentStore.environment.label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color("TextSecondary"))
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
    }

    /// Cloud needs a paired runtime to relay through; without one every
    /// runtime call fails with the interceptor's 503 `runtime_unavailable`
    /// (fetch-interceptor.ts:470-478), so say so up front.
    private var cloudUnpairedNotice: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.subheadline)
                .foregroundColor(Theme.statusWarning)

            Text("Allternit Cloud relays through a paired runtime — pair one to use it.")
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .lineLimit(2)

            Spacer(minLength: 8)

            Button(action: { isPairingPresented = true }) {
                Text("Pair…")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(theme.accent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color("BgSecondary"))
    }

    // MARK: - Session list

    /// Loading / error / empty / grouped states mirror HistorySidebarView.
    @ViewBuilder
    private var content: some View {
        if isLoading && groups.isEmpty {
            HStack {
                Spacer()
                ProgressView()
                    .padding(.top, 40)
                Spacer()
            }
        } else if let loadError, groups.isEmpty {
            VStack(spacing: 12) {
                Text("Couldn't load code sessions")
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
            .padding(.top, 40)
            .frame(maxWidth: .infinity)
        } else if groups.isEmpty {
            VStack(spacing: 16) {
                Image(systemName: theme.icon)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(theme.accent)
                    .frame(width: 56, height: 56)
                    .background(theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusLG)
                            .stroke(theme.accentGlow, lineWidth: 1)
                    )

                Text("No code sessions yet")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))

                Text("Start a new thread and it will show up here.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)

                Button(action: startNewThread) {
                    Text("New Thread")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.black)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(theme.accent)
                        .cornerRadius(10)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 60)
            .frame(maxWidth: .infinity)
        } else {
            VStack(alignment: .leading, spacing: 28) {
                ForEach(groups) { group in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(group.title)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(Color("TextSecondary"))
                            .padding(.horizontal, 20)

                        ForEach(group.sessions) { session in
                            sessionRow(session)
                        }
                    }
                }
            }
            .padding(.vertical, 16)
        }
    }

    /// Recents row (ShellRail.tsx:1204-1228): leading icon (the web recents
    /// use Cpu; terminal stands in for regular threads), title, and a
    /// status · date subtitle.
    ///
    /// Status caveat: the wire has no `session_mode` field — the web keeps
    /// regular/agent in local-only store metadata (mode-session-store.ts:72-77).
    /// `metadata.agent_id` IS on the wire (set when created with a registry
    /// agent, agent_session_routes.rs:597-602) and is the only wire signal.
    private func sessionRow(_ session: AgentSession) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            threadTarget = CodeThreadTarget(sessionId: session.id, title: session.name ?? "Untitled Session")
        }) {
            HStack(spacing: 12) {
                Image(systemName: session.agentId != nil ? "cpu" : "terminal")
                    .font(.subheadline)
                    .foregroundColor(theme.accent)
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 2) {
                    Text(session.name ?? "Untitled Session")
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)

                    Text(Self.subtitle(for: session))
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundColor(Color("TextSecondary"))
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 20)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Actions & loading

    private func startNewThread() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
        threadTarget = CodeThreadTarget(sessionId: nil, title: nil)
    }

    @MainActor
    private func loadSessions() async {
        if sessions.isEmpty {
            isLoading = true
        }
        loadError = nil

        do {
            // GET /api/v1/agent-sessions → { sessions, count } — same source
            // as the Home history sidebar.
            sessions = try await AgentChatClient().listSessions()
        } catch is CancellationError {
            // View disappeared mid-flight — keep the current state.
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Date grouping & formatting
    //
    // The same bucketing idiom as HistorySidebarView (Today / Yesterday /
    // Previous 7 Days / Older). That file owns its private copy and is
    // off-limits to this task, so the ~40 lines are mirrored here rather than
    // extracted into a shared helper.

    private static func subtitle(for session: AgentSession) -> String {
        let status = session.agentId != nil ? "Agent" : "Regular"
        let date = timestamp(of: session)
        guard date > .distantPast else { return status }
        // Built per call: a shared formatter static would be non-Sendable
        // state under Swift 6.
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return "\(status) · \(formatter.localizedString(for: date, relativeTo: Date()))"
    }

    // MARK: - Status filter (Phase 8)

    /// Claude's code-session statuses (its "Filter by status" sheet). The
    /// wire has NO status field — AgentSession exposes only `active`,
    /// `messageCount`, and `agentId` — so `derivedStatus` maps those
    /// heuristically until the backend ships a real one.
    enum CodeStatusFilter: String, CaseIterable, Identifiable {
        case all, needsInput, readyForReview, working, completed, archived

        var id: String { rawValue }

        var label: String {
            switch self {
            case .all: return "All"
            case .needsInput: return "Needs input"
            case .readyForReview: return "Ready for review"
            case .working: return "Working"
            case .completed: return "Completed"
            case .archived: return "Archived"
            }
        }
    }

    /// Heuristic wire → status mapping (see the caveat on CodeStatusFilter):
    /// `active == false` is the archive bit (session archive PATCH); an
    /// empty session is waiting for its first prompt ("Needs input"); an
    /// agent-backed session is treated as in flight ("Working"); anything
    /// else with messages has output to read ("Ready for review").
    /// `completed` intentionally has no mapping — no wire signal exists for
    /// it yet, so the row shows a 0 count until the backend grows one.
    private static func derivedStatus(of session: AgentSession) -> CodeStatusFilter {
        if !session.active { return .archived }
        if session.messageCount == 0 { return .needsInput }
        if session.agentId != nil { return .working }
        return .readyForReview
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

// MARK: - Thread navigation

/// Navigation item for the Code tab's thread push. `sessionId == nil` is a
/// fresh draft thread — the backend session is created on the first send
/// (ChatViewModel.ensureSessionId), stamped `origin_surface='code'`.
private struct CodeThreadTarget: Hashable, Identifiable {
    let sessionId: String?
    let title: String?

    var id: String { sessionId ?? "new-thread" }
}

/// A code thread: the shared ChatContentView inside the Code tab's
/// navigation chrome, dressed as a terminal session (dark chrome, terminal
/// palette feed — ChatContentView renders terminal rows under `.code`).
/// The composer keeps its agent pill + bottom deck (the code surface's tile
/// set, AgentModeTile.visibleTiles(for: .code)); the Chat/Cowork toggle is
/// Home-only and hidden here.
private struct CodeThreadChatView: View {
    let sessionId: String?
    let title: String?

    @StateObject private var viewModel = ChatViewModel()

    var body: some View {
        ChatContentView(sessionId: sessionId, viewModel: viewModel)
            .background(Color("BgPrimary"))
            .navigationTitle(title ?? "New Thread")
            .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Runtime pairing sheet

/// Pairing sheet behind the environment menu's "Pair Runtime…" entry.
///
/// Two paths:
/// 1. Handoff token → POST /dispatch/handoff/claim (the phone half of the
///    desktop QR handoff, src/lib/dispatch/handoff.ts). DEPENDENT ON AN
///    UNIMPLEMENTED HOSTED ENDPOINT (handoff.ts:1-7,23-27) — marked inline;
///    failures are shown, not swallowed.
/// 2. Manual "Runtime device ID" entry — the working fallback (the id the
///    web's Settings → Runtime devices lists from GET /api/v1/runtime-devices,
///    SettingsView.tsx:193-254).
private struct RuntimePairingView: View {
    @StateObject private var environmentStore = EnvironmentStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var handoffToken = ""
    @State private var manualRuntimeId = ""
    @State private var isClaiming = false
    @State private var pairingError: String? = nil
    @State private var infoMessage: String? = nil

    private let theme = ModeTheme(mode: .code)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let pairedRuntimeId = environmentStore.pairedRuntimeId {
                        pairedCard(pairedRuntimeId)
                    }
                    handoffCard
                    manualCard
                }
                .padding(20)
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .navigationTitle("Pair Runtime")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func pairedCard(_ runtimeId: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(Theme.statusSuccess)

            VStack(alignment: .leading, spacing: 2) {
                Text("Paired runtime")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextPrimary"))
                Text(runtimeId)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Spacer()

            Button("Unpair") {
                environmentStore.unpair()
            }
            .font(.subheadline)
            .foregroundColor(.red)
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private var handoffCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Handoff token")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(Color("TextPrimary"))

            Text("Paste the token from the desktop's pairing handoff. Dependent on the hosted /dispatch/handoff/claim endpoint, which isn't implemented yet — expect claiming to fail and use manual entry below.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .fixedSize(horizontal: false, vertical: true)

            TextField("Handoff token", text: $handoffToken)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(Color("BgSecondary"))
                .cornerRadius(10)

            if let pairingError {
                Text(pairingError)
                    .font(.caption)
                    .foregroundColor(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let infoMessage {
                Text(infoMessage)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button(action: claim) {
                HStack(spacing: 8) {
                    if isClaiming {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                    Text(isClaiming ? "Claiming…" : "Claim Token")
                }
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(theme.accent)
                .cornerRadius(10)
            }
            .disabled(handoffToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isClaiming)
            .opacity(handoffToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isClaiming ? 0.5 : 1)
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private var manualCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Runtime device ID")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(Color("TextPrimary"))

            Text("The id listed under Settings → Runtime devices on the web or desktop. Cloud requests then relay through this runtime.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .fixedSize(horizontal: false, vertical: true)

            TextField("Runtime device ID", text: $manualRuntimeId)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(Color("BgSecondary"))
                .cornerRadius(10)

            Button(action: saveManual) {
                Text("Save Runtime ID")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(theme.accent)
                    .cornerRadius(10)
            }
            .disabled(manualRuntimeId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(manualRuntimeId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    /// POST /dispatch/handoff/claim via EnvironmentStore. Success carrying a
    /// runtime id pairs and dismisses; any failure is shown inline.
    private func claim() {
        let token = handoffToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty, !isClaiming else { return }

        isClaiming = true
        pairingError = nil
        infoMessage = nil

        Task {
            do {
                if let runtimeId = try await environmentStore.claimHandoffToken(token) {
                    environmentStore.pair(withRuntimeId: runtimeId)
                    dismiss()
                } else {
                    // 2xx but an unrecognized body — the endpoint's success
                    // shape is undefined while it's unimplemented.
                    infoMessage = "The token was accepted, but the response carried no runtime id. Enter the runtime device ID manually below."
                }
            } catch {
                pairingError = error.localizedDescription
            }
            isClaiming = false
        }
    }

    private func saveManual() {
        let runtimeId = manualRuntimeId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !runtimeId.isEmpty else { return }
        environmentStore.pair(withRuntimeId: runtimeId)
        dismiss()
    }
}


// MARK: - Status filter sheet (Phase 8)

/// Claude's "Filter by status" bottom sheet: one row per status with the
/// session count on the right and a checkmark on the selection; tapping a
/// row selects and dismisses.
private struct CodeStatusFilterSheet: View {
    @Binding var selected: CodeModeView.CodeStatusFilter
    /// Per-status session counts across the (unfiltered) code session list.
    let counts: [CodeModeView.CodeStatusFilter: Int]
    let accent: Color

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Filter by status")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(Color("TextSecondary"))
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 8)

            ForEach(CodeModeView.CodeStatusFilter.allCases) { filter in
                Button(action: {
                    let generator = UISelectionFeedbackGenerator()
                    generator.selectionChanged()
                    selected = filter
                    dismiss()
                }) {
                    HStack(spacing: 12) {
                        Text(filter.label)
                            .font(.subheadline)
                            .foregroundColor(Color("TextPrimary"))

                        Spacer()

                        Text("\(filter == .all ? counts.values.reduce(0, +) : (counts[filter] ?? 0))")
                            .font(.subheadline)
                            .foregroundColor(Color("TextSecondary"))

                        Image(systemName: "checkmark")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(accent)
                            .opacity(selected == filter ? 1 : 0)
                            .frame(width: 20)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            Spacer()
        }
        .background(Color("BgPrimary"))
    }
}
