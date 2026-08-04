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
    @State private var isSkillsPresented = false
    @State private var isCanvasPresented = false
    /// Phase 8 status filter (Claude "Filter by status" sheet parity).
    @State private var statusFilter: CodeStatusFilter = .all
    @State private var isFilterSheetPresented = false
    #if DEBUG
    /// One-shot latch for the `-open-code-*` launch args — `.task` can
    /// re-run when the nav stack pops back to the list, and without this
    /// the debug push fires again and swallows the Back navigation.
    @State private var didApplyDebugArgs = false
    #endif

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
            .sheet(isPresented: $isSkillsPresented) {
                CodeSkillsView()
            }
            .sheet(isPresented: $isCanvasPresented) {
                CodeCanvasView()
            }
            .task {
                // Warm the gizzi-instance registry so a thread's first flip
                // to the terminal can attach to a registered instance.
                Task { await InstanceStore.shared.refresh() }
                await loadSessions()
                #if DEBUG
                // `-open-code-filter` / `-open-code-thread` (DEBUG only):
                // land on the filter sheet or a fresh thread for screenshot
                // verification. One-shot — `.task` re-runs when the nav
                // stack pops back here, and re-applying the push would
                // swallow the Back navigation.
                if !didApplyDebugArgs {
                    if CommandLine.arguments.contains("-open-code-filter") {
                        isFilterSheetPresented = true
                    }
                    if CommandLine.arguments.contains("-open-code-thread") {
                        threadTarget = CodeThreadTarget(sessionId: nil, title: nil)
                    }
                    // `-open-code-thread-id <id>` (DEBUG only): open an
                    // existing session in the code thread (e.g. to verify
                    // the thought stream renders from loaded history).
                    if let threadId = UserDefaults.standard.string(forKey: "open-code-thread-id") {
                        threadTarget = CodeThreadTarget(sessionId: threadId, title: "Thread")
                    }
                    // `-mesh-proxy-selfcheck` (DEBUG only): verify the mesh
                    // proxy URL helpers (100.64.0.0/10 classification,
                    // target parsing) — results go to the console.
                    if CommandLine.arguments.contains("-mesh-proxy-selfcheck") {
                        MeshClient.runProxySelfCheck()
                    }
                    didApplyDebugArgs = true
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

            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                isSkillsPresented = true
            }) {
                Image(systemName: "puzzlepiece.extension")
                    .font(.title3)
                    .foregroundColor(Color("TextPrimary"))
                    .frame(width: 44, height: 44)
            }

            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                isCanvasPresented = true
            }) {
                Image(systemName: "square.grid.2x2")
                    .font(.title3)
                    .foregroundColor(Color("TextPrimary"))
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
///
/// The toolbar flips the thread to a real interactive terminal
/// (TerminalSessionView) attached to a pty on the gizzi-code server. The
/// pty session is created lazily on the first flip — resolving the host
/// from InstanceStore (the pinned instance when one is selected, else the
/// first ONLINE registered instance, with mesh instances preferred while
/// the mesh node is up) with fallback to the static
/// `AppConfig.gizziCodeBaseURL` — and kept in @State afterwards so flipping
/// preserves the shell. Mesh-URL instances (100.64.0.0/10) attach through
/// MeshClient's loopback proxy, since URLSession can't route the tailnet.
/// With more than one registered instance, a second
/// toolbar menu switches instances by tearing the session down and
/// rebuilding it against the new host. When no host resolves at all
/// (release build with no registered instance), the flip lands on a
/// no-instance empty state with a Retry that re-fetches the registry.
private struct CodeThreadChatView: View {
    let sessionId: String?
    let title: String?

    @StateObject private var viewModel = ChatViewModel()
    @StateObject private var instanceStore = InstanceStore.shared
    @State private var terminalSession: PtySession? = nil
    @State private var showTerminal = false
    @State private var resolvingTerminalHost = false

    /// Pending gizzi-code approval requests for this thread's own session
    /// (`GET /v1/permission`, filtered to `sessionID == sessionId`), kept
    /// fresh by `pollPendingPermissions()` below. Sorted oldest-first by id
    /// (`Identifier.ascending("permission")`, `next.ts:73`) so the banner
    /// always opens the longest-waiting request.
    @State private var pendingPermissions: [PermissionRequest] = []
    /// Non-nil while `ChangesetReviewSheet` is presented for this request.
    @State private var reviewingPermission: PermissionRequest? = nil

    var body: some View {
        VStack(spacing: 0) {
            pendingPermissionBanner
            Group {
                if showTerminal {
                    if let terminalSession {
                        // `.id` gives each rebuilt session (instance switch) a
                        // fresh view identity, so its `.task` fires and attaches
                        // the new pty instead of reusing the torn-down view.
                        TerminalSessionView(session: terminalSession)
                            .id(ObjectIdentifier(terminalSession))
                    } else if resolvingTerminalHost {
                        ProgressView("Connecting…")
                    } else {
                        noInstanceView
                    }
                } else {
                    ChatContentView(sessionId: sessionId, viewModel: viewModel)
                }
            }
        }
        .background(Color("BgPrimary"))
        .navigationTitle(title ?? "New Thread")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    if !showTerminal, terminalSession == nil {
                        // Resolution can take a while (a mesh node start
                        // blocks up to ~60s Go-side), so it runs in a task
                        // under the "Connecting…" spinner.
                        resolvingTerminalHost = true
                        Task {
                            var session = await Self.makeTerminalSession(from: instanceStore)
                            if session == nil {
                                // No host resolved (release with no registered
                                // instance) — the warm-up fetch may still be in
                                // flight, so wait for it before settling on the
                                // no-instance state.
                                await instanceStore.refreshIfNeeded()
                                session = await Self.makeTerminalSession(from: instanceStore)
                            }
                            terminalSession = session
                            resolvingTerminalHost = false
                        }
                    }
                    showTerminal.toggle()
                } label: {
                    Image(systemName: showTerminal ? "bubble.left.and.bubble.right" : "terminal")
                }
                .accessibilityLabel(showTerminal ? "Show chat" : "Show terminal")
            }
            // Only multi-instance users get the picker; with zero or one
            // registered instance the toolbar is exactly the terminal toggle.
            if instanceStore.instances.count > 1 {
                ToolbarItem(placement: .topBarTrailing) {
                    instanceMenu
                }
            }
        }
        .task {
            // Warm the instance registry so the first flip can already
            // resolve a registered instance. On failure the store keeps the
            // empty list and the flip falls back to the static dev default
            // (DEBUG) or the no-instance state (release).
            await instanceStore.refreshIfNeeded()
        }
        .task {
            // Mirrors the terminal's own `.task { await session.start() }` —
            // SwiftUI cancels a view's `.task` automatically when it leaves
            // the hierarchy, so this loop just needs to check
            // `Task.isCancelled` between polls; no separate teardown call is
            // needed the way `terminalSession?.stop()` tears down the pty.
            await pollPendingPermissions()
        }
        .sheet(item: $reviewingPermission) { request in
            ChangesetReviewSheet(request: request) { resolved in
                pendingPermissions.removeAll { $0.id == resolved.id }
            }
        }
        .onDisappear {
            // Detach only — the pty keeps running server-side.
            terminalSession?.stop()
        }
    }

    /// Single-line banner shown above the chat/terminal content whenever a
    /// gizzi-code coding session has a pending file-edit (or other) approval
    /// waiting — visible regardless of `showTerminal`, since it lives above
    /// the flipped `Group` rather than inside either branch. Tapping it opens
    /// `ChangesetReviewSheet` for the oldest pending request.
    @ViewBuilder
    private var pendingPermissionBanner: some View {
        if let oldest = pendingPermissions.first {
            Button {
                reviewingPermission = oldest
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.shield")
                        .foregroundColor(Theme.statusWarning)
                    Text(pendingPermissions.count == 1
                         ? "1 change awaiting review"
                         : "\(pendingPermissions.count) changes awaiting review")
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundColor(Color("TextSecondary"))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color("BgPanel"))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    /// Polls `GET /v1/permission` every 4s while the view is on screen,
    /// filtered down to this thread's own session id (`sessionID ==
    /// sessionId`, `PermissionNext.Request.sessionID` at `next.ts:74`).
    /// Sessionless (not-yet-created) threads have no id to filter on, so a
    /// nil `sessionId` skips polling entirely. Failed polls are silently
    /// skipped and retried on the next tick — a transient network error
    /// shouldn't blank out an already-known pending list.
    private func pollPendingPermissions() async {
        guard let sessionId else { return }
        while !Task.isCancelled {
            if let all = try? await PermissionClient.shared.listPending() {
                pendingPermissions = all
                    .filter { $0.sessionID == sessionId }
                    .sorted { $0.id < $1.id }
            }
            try? await Task.sleep(for: .seconds(4))
        }
    }

    /// Builds the terminal's pty session on first flip: attached to the
    /// preferred registered instance (name plumbed through for display), or
    /// to `AppConfig.gizziCodeBaseURL` when no instance resolved — the
    /// `PtySession()` default client targets exactly that static URL.
    /// Returns nil when neither source yields a usable host (release build,
    /// no registered instance) — the caller shows the no-instance state
    /// instead of attempting a connection.
    ///
    /// Mesh instances (100.64.0.0/10 URLs) can't be reached by URLSession
    /// directly — the tailnet is in-process userspace — so they attach
    /// through MeshClient's loopback proxy. When the mesh can't be brought
    /// up, resolution falls back to the preferred non-mesh instance, then
    /// to the static URL.
    @MainActor
    private static func makeTerminalSession(from store: InstanceStore) async -> PtySession? {
        if let instance = store.preferredInstance, let url = instance.instanceURL {
            if !url.isMeshAddress {
                return PtySession(client: PtyClient(baseURL: url), attachedInstanceName: instance.name)
            }
            if let proxyURL = await resolveMeshProxyBaseURL(for: url) {
                return PtySession(client: PtyClient(baseURL: proxyURL), attachedInstanceName: instance.name)
            }
            // Mesh instance preferred but unreachable — try the non-mesh
            // fallback before giving up on the registry.
            if let fallback = store.nonMeshFallbackInstance,
               fallback.id != instance.id,
               let fallbackURL = fallback.instanceURL {
                return PtySession(client: PtyClient(baseURL: fallbackURL), attachedInstanceName: fallback.name)
            }
            return nil
        }
        guard AppConfig.hasUsableGizziCodeURL else { return nil }
        return PtySession()
    }

    /// Resolves the loopback base URL (`http://127.0.0.1:<port>`) for a mesh
    /// instance: with the node already up, straight to the proxy; otherwise
    /// starts it via platform enrollment (a DEBUG auth key takes precedence
    /// inside MeshClient) and waits for the join (enroll plus the Go-side
    /// start, which blocks up to ~60s — the caller's "Connecting…" spinner
    /// covers this). nil when the mesh can't be used: a failed enroll or
    /// start leaves state `.failed`.
    @MainActor
    private static func resolveMeshProxyBaseURL(for url: URL) async -> URL? {
        let mesh = MeshClient.shared
        if !mesh.state.isUp {
            await mesh.startWithPlatformAuth()
            // start() is fire-and-forget; poll the published state until
            // the join settles.
            while mesh.state == .starting {
                try? await Task.sleep(for: .milliseconds(250))
                if Task.isCancelled { return nil }
            }
            guard mesh.state.isUp else { return nil }
        }
        return try? await mesh.localProxyBaseURL(forMeshURL: url)
    }

    /// Shown in place of the terminal when no host resolved (release build
    /// with no registered instance and an empty static fallback). Retry
    /// re-fetches the registry and rebuilds the session if an instance
    /// appeared. Copy mirrors the session list's error state.
    private var noInstanceView: some View {
        VStack(spacing: 12) {
            Image(systemName: "terminal")
                .font(.title2)
                .foregroundColor(Color("TextSecondary"))
            Text("No instance available")
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
            Text("Start `gizzi serve --tunnel` on your computer, then retry.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
            Button("Retry") {
                Task {
                    await instanceStore.refresh()
                    terminalSession = await Self.makeTerminalSession(from: instanceStore)
                }
            }
            .font(.subheadline)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Instance switcher for the registered `gizzi serve --tunnel` hosts:
    /// Automatic resolution plus one row per instance with an online/stale
    /// dot and a checkmark on the pinned one. Rendered only when more than
    /// one instance is registered.
    private var instanceMenu: some View {
        Menu {
            Button(action: { selectInstance(nil) }) {
                HStack {
                    if instanceStore.selectedInstanceID == nil {
                        Image(systemName: "checkmark")
                    }
                    Label("Automatic", systemImage: "sparkles")
                }
            }

            Divider()

            ForEach(instanceStore.instances) { instance in
                Button(action: { selectInstance(instance.id) }) {
                    HStack {
                        if instanceStore.selectedInstanceID == instance.id {
                            Image(systemName: "checkmark")
                        }
                        Circle()
                            .fill(instance.isOnline ? Theme.statusSuccess : Color("TextSecondary"))
                            .frame(width: 6, height: 6)
                        Text(instance.isMeshInstance ? "\(instance.name) · mesh" : instance.name)
                    }
                }
            }
        } label: {
            Image(systemName: "server.rack")
        }
        .task {
            // Presenting the thread re-checks reachability so the menu's
            // online/stale dots are fresh — a full refresh, unlike the
            // once-per-run warm-up below.
            await instanceStore.refresh()
        }
    }

    /// Pins the terminal to an instance (nil = automatic) and rebuilds the
    /// pty session against the new host: the old session is detached and
    /// dropped, then either rebuilt (terminal on screen — the fresh view's
    /// `.task` attaches it) or left nil so the next flip rebuilds it lazily
    /// via `makeTerminalSession`, which reads the selection at build time.
    private func selectInstance(_ id: String?) {
        instanceStore.select(id)
        terminalSession?.stop()
        terminalSession = nil
        if showTerminal {
            resolvingTerminalHost = true
            Task {
                terminalSession = await Self.makeTerminalSession(from: instanceStore)
                resolvingTerminalHost = false
            }
        }
    }
}

// MARK: - Runtime pairing sheet

/// Pairing sheet behind the environment menu's "Pair Runtime…" entry. The
/// user never types a runtime id:
///
/// 1. "Choose a runtime" (default) — GET /api/v1/runtime-devices lists the
///    account's paired devices (name, type, online status, last seen);
///    tapping a row pairs it via EnvironmentStore and dismisses.
/// 2. "Have a pairing code?" — the XXXX-XXXX code a NEW device prints
///    (`gizzi pair`, a VPS first boot): GET /api/v1/runtime-pairings/code/:code
///    shows the device, POST .../approve connects it (the web/desktop
///    DevicePairingPanel flow), then the sheet auto-pairs the device once it
///    checks in to the runtime list.
///
/// Manual runtime-id entry remains as a collapsed "Advanced" fallback.
private struct RuntimePairingView: View {
    @StateObject private var environmentStore = EnvironmentStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var runtimes: [RuntimeDevice] = []
    @State private var isLoadingRuntimes = false
    @State private var runtimesError: String? = nil

    @State private var pairingCode = ""
    @State private var pairingInfo: RuntimePairingInfo? = nil
    @State private var isLookingUp = false
    @State private var isApproving = false
    @State private var isDenying = false
    @State private var codeError: String? = nil
    @State private var approvedName: String? = nil

    @State private var manualRuntimeId = ""

    private let theme = ModeTheme(mode: .code)
    private let client = RuntimeDevicesClient()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let pairedRuntimeId = environmentStore.pairedRuntimeId {
                        pairedCard(pairedRuntimeId)
                    }
                    chooseCard
                    codeCard
                    advancedCard
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
            .task {
                await loadRuntimes()
            }
            .refreshable {
                await loadRuntimes()
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

    // MARK: - Choose a runtime

    /// The default path: the account's paired devices from
    /// GET /api/v1/runtime-devices. Tap pairs + dismisses; loading, error
    /// (with retry), and empty states mirror the session list's.
    private var chooseCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Choose a runtime")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(Color("TextPrimary"))

            Text("Cloud requests relay through the runtime you pick. Pair a new device with a code below.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .fixedSize(horizontal: false, vertical: true)

            if isLoadingRuntimes && runtimes.isEmpty {
                HStack {
                    Spacer()
                    ProgressView()
                        .padding(.vertical, 12)
                    Spacer()
                }
            } else if let runtimesError, runtimes.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text(runtimesError)
                        .font(.caption)
                        .foregroundColor(.red)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Retry") {
                        Task { await loadRuntimes() }
                    }
                    .font(.subheadline)
                    .foregroundColor(theme.accent)
                }
            } else if runtimes.isEmpty {
                Text("No runtimes yet — pair one with a code below.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 0) {
                    ForEach(runtimes) { runtime in
                        runtimeRow(runtime)
                    }
                }
            }
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    /// One runtime row: status dot, type icon, name + type · last-seen
    /// subtitle, checkmark on the currently paired one.
    private func runtimeRow(_ runtime: RuntimeDevice) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            environmentStore.pair(withRuntimeId: runtime.id)
            dismiss()
        }) {
            HStack(spacing: 12) {
                Image(systemName: runtime.runtimeType == "vps" || runtime.runtimeType == "hosted" ? "server.rack" : "desktopcomputer")
                    .font(.subheadline)
                    .foregroundColor(theme.accent)
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 2) {
                    Text(runtime.name)
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)

                    Text("\(runtime.typeLabel) · \(Self.lastSeenLabel(for: runtime))")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .lineLimit(1)
                }

                Spacer()

                Circle()
                    .fill(runtime.isOnline ? Theme.statusSuccess : Color("TextSecondary"))
                    .frame(width: 8, height: 8)

                Image(systemName: "checkmark")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(theme.accent)
                    .opacity(environmentStore.pairedRuntimeId == runtime.id ? 1 : 0)
                    .frame(width: 20)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Pairing code

    /// The new-device path: the XXXX-XXXX code a runtime prints when it asks
    /// to pair (`gizzi pair`, a VPS first boot). Continue looks the code up
    /// and swaps in the device details with Approve / Back.
    private var codeCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Have a pairing code?")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(Color("TextPrimary"))

            Text("Enter the code a runtime prints when it asks to connect — e.g. `gizzi pair` output or a VPS first boot.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .fixedSize(horizontal: false, vertical: true)

            if let approvedName {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Theme.statusSuccess)
                    Text("\(approvedName) is connected to your Allternit account — pick it from the list above once it checks in.")
                        .font(.caption)
                        .foregroundColor(Color("TextPrimary"))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            if let pairingInfo {
                pairingDetail(pairingInfo)
            } else {
                HStack(spacing: 10) {
                    TextField("ABCD-2345", text: $pairingCode)
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundColor(Color("TextPrimary"))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .background(Color("BgSecondary"))
                        .cornerRadius(10)
                        .onChange(of: pairingCode) { _, newValue in
                            let normalized = Self.normalizeCode(newValue)
                            if normalized != newValue {
                                pairingCode = normalized
                            }
                            codeError = nil
                        }

                    Button(action: lookup) {
                        HStack(spacing: 8) {
                            if isLookingUp {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                            Text(isLookingUp ? "Checking…" : "Continue")
                        }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.black)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(theme.accent)
                        .cornerRadius(10)
                    }
                    .disabled(pairingCode.count != 9 || isLookingUp)
                    .opacity(pairingCode.count != 9 || isLookingUp ? 0.5 : 1)
                }
            }

            if let codeError {
                Text(codeError)
                    .font(.caption)
                    .foregroundColor(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    /// The looked-up pairing request (DevicePairingPanel.tsx:343-433): device
    /// name, type · code subtitle, optional host/system rows, Approve + Back.
    private func pairingDetail(_ pairing: RuntimePairingInfo) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: pairing.runtimeType == "vps" || pairing.runtimeType == "hosted" ? "server.rack" : "desktopcomputer")
                    .font(.title3)
                    .foregroundColor(theme.accent)
                    .frame(width: 40, height: 40)
                    .background(Color("BgSecondary"))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Connect \(pairing.name)?")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color("TextPrimary"))
                    Text("\(RuntimeDevice.typeLabel(for: pairing.runtimeType)) · Code \(pairing.userCode)")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
            }

            if let hostname = pairing.hostname, !hostname.isEmpty {
                detailRow("Host", hostname)
            }
            if let platform = pairing.platform, !platform.isEmpty {
                detailRow("System", platform)
            }

            HStack(spacing: 10) {
                Button(action: approve) {
                    HStack(spacing: 8) {
                        if isApproving {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        Text(isApproving ? "Connecting…" : "Approve")
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.black)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(theme.accent)
                    .cornerRadius(10)
                }
                .disabled(isApproving || isDenying)
                .opacity(isApproving ? 0.5 : 1)

                Button(action: deny) {
                    Text(isDenying ? "Denying…" : "Deny")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .foregroundColor(.red)
                .disabled(isApproving || isDenying)
                .opacity(isDenying ? 0.5 : 1)

                Button("Back") {
                    pairingInfo = nil
                    codeError = nil
                }
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .disabled(isApproving || isDenying)
            }
        }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(Color("TextPrimary"))
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }

    // MARK: - Advanced (manual id)

    /// Manual runtime-id entry, collapsed by default — the fallback for when
    /// neither the list nor a pairing code applies.
    private var advancedCard: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 10) {
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
            .padding(.top, 10)
        } label: {
            Text("Advanced: enter a runtime ID")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(Color("TextSecondary"))
        }
        .tint(Color("TextSecondary"))
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    // MARK: - Actions & loading

    @MainActor
    private func loadRuntimes() async {
        if runtimes.isEmpty {
            isLoadingRuntimes = true
        }
        runtimesError = nil

        do {
            runtimes = try await client.fetchRuntimes()
        } catch is CancellationError {
            // View disappeared mid-flight — keep the current state.
        } catch {
            runtimesError = error.localizedDescription
        }
        isLoadingRuntimes = false
    }

    /// GET /api/v1/runtime-pairings/code/:code. Success swaps the code field
    /// for the device details; any failure is shown inline.
    private func lookup() {
        let code = pairingCode
        guard code.count == 9, !isLookingUp else { return }

        isLookingUp = true
        codeError = nil

        Task {
            do {
                pairingInfo = try await client.lookupPairing(code: code)
            } catch {
                pairingInfo = nil
                codeError = error.localizedDescription
            }
            isLookingUp = false
        }
    }

    /// POST /api/v1/runtime-pairings/code/:code/deny (DevicePairingPanel.tsx
    /// denyPairing, runtime_pairing.rs deny_pairing) — marks the request
    /// denied and returns to the code-entry state; nothing to auto-pair.
    private func deny() {
        guard let pairing = pairingInfo, !isDenying, !isApproving else { return }

        isDenying = true
        codeError = nil

        Task {
            do {
                try await client.denyPairing(code: pairing.userCode)
                pairingInfo = nil
                pairingCode = ""
            } catch {
                codeError = error.localizedDescription
            }
            isDenying = false
        }
    }

    /// POST /api/v1/runtime-pairings/code/:code/approve, then auto-pair the
    /// device once it checks in to the runtime list; when it hasn't yet, the
    /// success message points at the (refreshed) list instead.
    private func approve() {
        guard let pairing = pairingInfo, !isApproving else { return }

        isApproving = true
        codeError = nil

        Task {
            do {
                let name = try await client.approvePairing(code: pairing.userCode) ?? pairing.name
                pairingInfo = nil
                pairingCode = ""
                await loadRuntimes()
                if await autoPairApprovedRuntime(named: name) {
                    isApproving = false
                    return
                }
                approvedName = name
            } catch {
                codeError = error.localizedDescription
            }
            isApproving = false
        }
    }

    /// The approve response carries no device id (the device registers itself
    /// when it next polls the pairing status), so poll the runtime list
    /// briefly for a device with the approved name and pair it directly.
    /// Returns true when paired (the sheet dismisses); false leaves the
    /// success message + refreshed list for the user to tap.
    @MainActor
    private func autoPairApprovedRuntime(named name: String) async -> Bool {
        for attempt in 0..<4 {
            if attempt > 0 {
                try? await Task.sleep(for: .seconds(1.5))
                await loadRuntimes()
            }
            if Task.isCancelled { return false }
            if let device = runtimes.first(where: { $0.name == name }) {
                environmentStore.pair(withRuntimeId: device.id)
                dismiss()
                return true
            }
        }
        return false
    }

    private func saveManual() {
        let runtimeId = manualRuntimeId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !runtimeId.isEmpty else { return }
        environmentStore.pair(withRuntimeId: runtimeId)
        dismiss()
    }

    // MARK: - Formatting

    /// Same normalization as the web panel (DevicePairingPanel.tsx:64-67):
    /// uppercase A-Z2-9, 8 chars, dashed XXXX-XXXX.
    private static func normalizeCode(_ value: String) -> String {
        let allowed = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789")
        let compact = String(value.uppercased().filter { allowed.contains($0) }.prefix(8))
        return compact.count > 4 ? "\(compact.prefix(4))-\(compact.suffix(compact.count - 4))" : compact
    }

    private static func lastSeenLabel(for runtime: RuntimeDevice) -> String {
        guard let raw = runtime.lastSeenAt, let date = parseTimestamp(raw) else {
            return "Last seen never"
        }
        // Built per call: a shared formatter static would be non-Sendable
        // state under Swift 6.
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return "Last seen \(formatter.localizedString(for: date, relativeTo: Date()))"
    }

    /// Backend timestamps are RFC-3339 (chrono `to_rfc3339`), with or without
    /// fractional seconds. Mirrored from CodeModeView's private copy.
    private static func parseTimestamp(_ value: String) -> Date? {
        if let date = try? Date(value, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) {
            return date
        }
        return try? Date(value, strategy: Date.ISO8601FormatStyle())
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
