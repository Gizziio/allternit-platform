import SwiftUI

/// Projects list (Claude iOS Projects + ChatGPT Projects parity): the
/// sidebar's Projects tab surface, showing the user's cowork projects with
/// per-project chat counts, a search field, and All / Created by you /
/// Shared with you tabs. Rows push the project detail (instructions, files,
/// chats).
///
/// Data: `ProjectStore.shared` over `GET /api/v1/cowork/projects`. A failed
/// request renders the error state; an empty list renders the
/// create-first-project empty state.
struct ProjectsListView: View {
    /// Detail's "+ New chat": selects the project and starts a fresh Chats
    /// conversation stamped with it (the shell owns the session binding).
    let onNewChatInProject: (CoworkProject) -> Void
    /// Tapping a chat row opens it in Chats (same wiring as the history list).
    let onOpenChat: (AgentSession) -> Void
    /// Set when hosted as the Projects tab surface: the header shows a
    /// sidebar (hamburger) button instead of the sheet's close button.
    var onOpenSidebar: (() -> Void)? = nil

    @StateObject private var projectStore = ProjectStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var searchText = ""
    @State private var selectedTab: ProjectTab = .all
    /// projectId → number of agent sessions stamped with it (client-side
    /// count over the fetched session list).
    @State private var chatCounts: [String: Int] = [:]
    /// Pushed detail (nil = list). Item-driven so the `-open-project-detail`
    /// DEBUG arg can deep-link without tap injection.
    @State private var detailProject: CoworkProject? = nil
    @State private var isCreateSheetPresented = false
    @State private var actionError: String? = nil

    /// ChatGPT-style ownership tabs. "Shared with you" has no backend source
    /// yet (projects are per-user rows), so it always shows its empty state.
    private enum ProjectTab: String, CaseIterable {
        case all = "All"
        case created = "Created by you"
        case shared = "Shared with you"
    }

    private var visibleProjects: [CoworkProject] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return projectStore.projects }
        return projectStore.projects.filter {
            $0.title.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header (matches ComposerPlusSheet's sheet chrome; hosted
                // in the Projects tab it leads with the sidebar toggle).
                HStack {
                    if let onOpenSidebar {
                        Button(action: {
                            let generator = UIImpactFeedbackGenerator(style: .medium)
                            generator.impactOccurred()
                            onOpenSidebar()
                        }) {
                            Image(systemName: "line.3.horizontal")
                                .font(.title3)
                                .foregroundColor(Color("TextPrimary"))
                                .frame(width: 44, height: 44)
                        }
                    }
                    Text("Projects")
                        .font(.system(.title3, design: .serif))
                        .fontWeight(.medium)
                        .foregroundColor(Color("TextPrimary"))
                    Spacer()
                    Button(action: {
                        let generator = UIImpactFeedbackGenerator(style: .light)
                        generator.impactOccurred()
                        isCreateSheetPresented = true
                    }) {
                        Image(systemName: "plus")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("TextSecondary"))
                            .frame(width: 32, height: 32)
                            .background(Color("BgPanel"))
                            .clipShape(Circle())
                    }
                    if onOpenSidebar == nil {
                        Button(action: { dismiss() }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(Color("TextSecondary"))
                                .frame(width: 32, height: 32)
                                .background(Color("BgPanel"))
                                .clipShape(Circle())
                        }
                    }
                }
                .padding(.horizontal, onOpenSidebar == nil ? 20 : 12)
                .padding(.vertical, onOpenSidebar == nil ? 14 : 6)

                Divider().background(Color("BorderSubtle"))

                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(item: $detailProject) { project in
                ProjectDetailView(
                    project: project,
                    onNewChat: onNewChatInProject,
                    onOpenChat: onOpenChat
                )
            }
        }
        .sheet(isPresented: $isCreateSheetPresented) {
            NewProjectSheet { title, description in
                createProject(title: title, description: description)
            }
        }
        .task {
            projectStore.fetchProjectsIfNeeded()
            await loadChatCounts()
        }
        #if DEBUG
        .onAppear {
            // `-open-project-detail` (DEBUG only): deep-links into the first
            // project (or a mock when the backend has none) so the detail
            // view can be screenshot-verified without tap injection.
            if CommandLine.arguments.contains("-open-project-detail"), detailProject == nil {
                detailProject = projectStore.projects.first ?? Self.debugMockProject
            }
            // `-open-new-project` (DEBUG only): opens the create sheet
            // directly for screenshot verification.
            if CommandLine.arguments.contains("-open-new-project") {
                isCreateSheetPresented = true
            }
        }
        #endif
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        VStack(spacing: 0) {
            // Ownership tabs (ChatGPT Projects parity).
            Picker("Projects", selection: $selectedTab) {
                ForEach(ProjectTab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)

            if selectedTab == .shared {
                // No sharing backend yet — honest empty state instead of
                // echoing the user's own projects under a wrong label.
                Spacer()
                emptyState(
                    icon: "person.2",
                    message: "No shared chats yet",
                    showsCreateButton: false
                )
                Spacer()
            } else if projectStore.isLoading && projectStore.projects.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if let loadError = projectStore.loadError, projectStore.projects.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Text("Couldn't load projects")
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    Text(loadError)
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        projectStore.fetchProjectsIfNeeded(force: true)
                        Task { await loadChatCounts() }
                    }
                    .font(.subheadline)
                    .foregroundColor(Color("AccentPrimary"))
                }
                .padding(.horizontal, 20)
                Spacer()
            } else if projectStore.projects.isEmpty {
                Spacer()
                emptyState(
                    icon: "folder",
                    message: "Projects keep related chats, files, and instructions together",
                    showsCreateButton: true
                )
                Spacer()
            } else {
                listContent
            }
        }
    }

    private var listContent: some View {
        VStack(spacing: 0) {
            // Search — client-side title filter (no backend search endpoint).
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                TextField("Search projects", text: $searchText)
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
            .padding(.bottom, 12)

            if let actionError {
                Text(actionError)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
            }

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(visibleProjects) { project in
                        projectRow(project)
                    }
                    if visibleProjects.isEmpty {
                        // Search no-results (the no-projects-at-all state
                        // with a create CTA lives in `content`).
                        VStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(Color("TextSecondary"))
                            Text("No projects match your search.")
                                .font(.subheadline)
                                .foregroundColor(Color("TextSecondary"))
                        }
                        .padding(.top, 24)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable {
                projectStore.fetchProjectsIfNeeded(force: true)
                await loadChatCounts()
            }
        }
    }

    private func projectRow(_ project: CoworkProject) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            detailProject = project
        }) {
            HStack(spacing: 12) {
                Image(systemName: "folder")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Color("AccentPrimary"))
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)
                    let count = chatCounts[project.id] ?? 0
                    Text(count == 1 ? "1 chat" : "\(count) chats")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color("TextSecondary"))
            }
            .padding(.horizontal, 14)
            .frame(height: 56)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func emptyState(icon: String, message: String, showsCreateButton: Bool) -> some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text(message)
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            if showsCreateButton {
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                    isCreateSheetPresented = true
                }) {
                    Text("Create project")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color("TextPrimary"))
                        .padding(.horizontal, 14)
                        .frame(height: 36)
                        .background(Color("BgSecondary"))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color("BorderSubtle"), lineWidth: 1))
                }
            }
        }
    }

    // MARK: - Actions

    private func createProject(title: String, description: String?) {
        Task {
            do {
                try await projectStore.createProject(title: title, description: description)
            } catch {
                actionError = "Couldn't create the project: \(error.localizedDescription)"
            }
        }
    }

    /// Counts chats per project from the shared sessions list. The old
    /// backend ignores the `project_id` filter param, so counting is
    /// client-side on the sessions' `metadata.project_id` either way.
    private func loadChatCounts() async {
        do {
            let envelope: AgentSessionListResponse = try await APIClient.shared.get(path: "agent-sessions")
            var counts: [String: Int] = [:]
            for session in envelope.sessions {
                if let projectId = session.projectId {
                    counts[projectId, default: 0] += 1
                }
            }
            chatCounts = counts
        } catch {
            // Counts are decorative — the list still renders without them.
        }
    }

    #if DEBUG
    /// Stand-in project for `-open-project-detail` when the backend has no
    /// projects to deep-link into (endpoints unreachable / empty list).
    private static let debugMockProject = CoworkProject(
        id: "debug-mock-project",
        userId: "dev-ios-tester",
        title: "Demo Project",
        description: "Screenshot fixture — the backend returned no projects.",
        instructions: nil,
        gitRemote: nil,
        defaultBranch: nil,
        createdAt: "2026-07-20 00:00:00",
        updatedAt: "2026-07-20 00:00:00"
    )
    #endif
}
