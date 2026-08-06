import SwiftUI

/// Agent Hub tab surface (mockup A1, docs/agent-hub-options.html): the
/// sidebar's Agents tab, mirroring the web Agent Hub — every registered
/// agent with status / model / primary badge, a Templates section, and
/// swipe-to-delete. Rows push AgentDetailView (mockup A2).
///
/// Data: `AgentHubStore.shared` over `GET /api/v1/agents` (full rows). The
/// composer pill reads the same registry through AgentModeStore's summary
/// cache; after every hub mutation we force-refresh it so the two never
/// disagree.
struct AgentHubView: View {
    @Binding var isSidebarOpen: Bool

    @StateObject private var hubStore = AgentHubStore.shared
    @EnvironmentObject private var agentModeStore: AgentModeStore

    @State private var searchText = ""
    /// Pushed detail (nil = list). Item-driven so the template flow can land
    /// on the new agent's detail without tap injection.
    @State private var detailAgent: AgentRecord? = nil
    @State private var isTemplateSheetPresented = false
    @State private var agentPendingDeletion: AgentRecord? = nil
    @State private var isDeleteConfirmPresented = false
    @State private var actionError: String? = nil
    #if DEBUG
    /// One-shot latch for the `-open-agent-detail` launch arg.
    @State private var didApplyDebugArgs = false
    #endif

    private var visibleAgents: [AgentRecord] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return hubStore.agents }
        return hubStore.agents.filter {
            $0.name.localizedCaseInsensitiveContains(query)
        }
    }

    /// Standalone agents and crew orchestrators (mode "primary" /
    /// "orchestrator" / "council") — the top-level picks.
    private var primaryAgents: [AgentRecord] {
        visibleAgents.filter { $0.mode != "subagent" }
    }

    /// Subagents, shown as their own section with their orchestrator's
    /// name — a flat list hides the crew structure the registry carries.
    private var crewAgents: [AgentRecord] {
        visibleAgents.filter { $0.mode == "subagent" }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header Bar (matches ArtifactsLibraryView's chrome).
                HStack {
                    Button(action: {
                        let generator = UIImpactFeedbackGenerator(style: .medium)
                        generator.impactOccurred()
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.86, blendDuration: 0)) {
                            isSidebarOpen.toggle()
                        }
                    }) {
                        Image(systemName: "line.3.horizontal")
                            .font(.title3)
                            .foregroundColor(Color("TextPrimary"))
                            .frame(width: 44, height: 44)
                    }

                    Text("Agent Hub")
                        .font(.system(.title3, design: .serif))
                        .fontWeight(.medium)
                        .foregroundColor(Color("TextPrimary"))

                    Spacer()

                    NavigationLink(destination: MarketplaceView()) {
                        Image(systemName: "storefront")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("TextSecondary"))
                            .frame(width: 32, height: 32)
                            .background(Color("BgPanel"))
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Discover agents")

                    Button(action: {
                        let generator = UIImpactFeedbackGenerator(style: .light)
                        generator.impactOccurred()
                        isTemplateSheetPresented = true
                    }) {
                        Image(systemName: "plus")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("TextSecondary"))
                            .frame(width: 32, height: 32)
                            .background(Color("BgPanel"))
                            .clipShape(Circle())
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Color("BgPrimary"))

                Divider().background(Color("BorderSubtle"))

                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(item: $detailAgent) { agent in
                AgentDetailView(initialAgent: agent)
            }
        }
        .sheet(isPresented: $isTemplateSheetPresented) {
            AgentTemplateSheet(onConfirm: createFromTemplate)
        }
        .confirmationDialog(
            "Delete \(agentPendingDeletion?.name ?? "this agent")?",
            isPresented: $isDeleteConfirmPresented,
            titleVisibility: .visible
        ) {
            Button("Delete Agent", role: .destructive) {
                if let agent = agentPendingDeletion {
                    deleteAgent(agent)
                }
            }
            Button("Cancel", role: .cancel) { agentPendingDeletion = nil }
        } message: {
            Text("This permanently deletes the agent. This can't be undone.")
        }
        .task {
            hubStore.fetchAgentsIfNeeded()
            hubStore.fetchTemplatesIfNeeded()
        }
        .onChange(of: hubStore.agents) { _, agents in
            #if DEBUG
            // `-open-agent-detail <id>` (DEBUG only): drill straight into an
            // agent's detail for screenshots once the registry resolves
            // (simctl has no tap injection). Accepts a full id or a unique
            // prefix, e.g. the first 8 hex chars.
            guard !didApplyDebugArgs,
                  let raw = UserDefaults.standard.string(forKey: "open-agent-detail"),
                  let agent = agents.first(where: { $0.id == raw || $0.id.hasPrefix(raw) })
            else { return }
            didApplyDebugArgs = true
            detailAgent = agent
            #endif
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if hubStore.isLoading && hubStore.agents.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = hubStore.loadError, hubStore.agents.isEmpty {
            Spacer()
            VStack(spacing: 12) {
                Text("Couldn't load agents")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    hubStore.fetchAgentsIfNeeded(force: true)
                }
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            Spacer()
        } else if hubStore.agents.isEmpty {
            Spacer()
            emptyState
            Spacer()
        } else {
            listContent
        }
    }

    private var listContent: some View {
        VStack(spacing: 0) {
            // Search — client-side name filter (no backend search endpoint).
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                TextField("Search agents", text: $searchText)
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
            .padding(.vertical, 12)

            if let actionError {
                Text(actionError)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
            }

            List {
                Section {
                    ForEach(primaryAgents) { agent in
                        agentRow(agent)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    agentPendingDeletion = agent
                                    isDeleteConfirmPresented = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .hubCardRow()
                    }
                    if visibleAgents.isEmpty {
                        // Search no-results (the no-agents-at-all state with
                        // a create CTA lives in `content`).
                        Text("No agents match your search.")
                            .font(.subheadline)
                            .foregroundColor(Color("TextSecondary"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                    }
                } header: {
                    sectionLabel("Your agents")
                }

                if !crewAgents.isEmpty {
                    Section {
                        ForEach(crewAgents) { agent in
                            agentRow(agent)
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        agentPendingDeletion = agent
                                        isDeleteConfirmPresented = true
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .hubCardRow()
                        }
                    } header: {
                        sectionLabel("Crew")
                    }
                }

                Section {
                    templatesRow
                        .hubCardRow()
                } header: {
                    sectionLabel("Templates")
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .refreshable {
                hubStore.fetchAgentsIfNeeded(force: true)
                hubStore.fetchTemplatesIfNeeded(force: true)
                agentModeStore.fetchAgentsIfNeeded(force: true)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "cpu")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text("Agents run tasks on your behalf — create one from a template to get started")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                isTemplateSheetPresented = true
            }) {
                Text("New from template")
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

    // MARK: - Rows

    private func agentRow(_ agent: AgentRecord) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            detailAgent = agent
        }) {
            HStack(alignment: .top, spacing: 11) {
                AgentAvatarView(agent: agent, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 7) {
                        Text(agent.name)
                            .font(.system(size: 14.5, weight: .semibold))
                            .foregroundColor(Color("TextPrimary"))
                            .lineLimit(1)
                        statusDot(agent)
                        if agent.isPrimary {
                            Text("PRIMARY")
                                .font(.system(size: 9.5, weight: .bold))
                                .tracking(0.6)
                                .foregroundColor(Color("AccentPrimary"))
                                .padding(.horizontal, 7)
                                .padding(.vertical, 2.5)
                                .background(Color("AccentPrimary").opacity(0.14))
                                .clipShape(Capsule())
                        }
                    }
                    if let description = agent.description, !description.isEmpty {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                            .lineLimit(1)
                    }
                    HStack(spacing: 6) {
                        if !agent.model.isEmpty {
                            Text(agent.model)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(Color("TextSecondary"))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2.5)
                                .background(Color("BgSecondary"))
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(Color("BorderSubtle"), lineWidth: 1))
                        }
                        // Crew lineage — the registry's parent link, so a
                        // subagent row says WHOSE crew it belongs to.
                        if let parentName = crewParentName(for: agent) {
                            Text("crew of \(parentName)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(Color("TextSecondary").opacity(0.85))
                                .lineLimit(1)
                        }
                    }
                    .padding(.top, 5)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color("TextSecondary"))
                    .padding(.top, 4)
            }
            .padding(12)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.045), radius: 5, x: 0, y: 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// The orchestrator's name for a subagent row, when the parent is in
    /// the cached list; nil for top-level agents and unknown parents.
    private func crewParentName(for agent: AgentRecord) -> String? {
        guard agent.mode == "subagent", let parentId = agent.parentAgentId else { return nil }
        return hubStore.agent(withId: parentId)?.name
    }

    /// The "New from template…" card (mockup A1 Templates section); the
    /// subtitle lists the catalog once it has loaded.
    private var templatesRow: some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            isTemplateSheetPresented = true
        }) {
            HStack(spacing: 11) {
                Image(systemName: "sparkles")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(Color("AccentPrimary"))
                    .frame(width: 40, height: 40)
                    .background(Color("AccentPrimary").opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("New from template…")
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundColor(Color("TextPrimary"))
                    Text(hubStore.templates.isEmpty
                         ? "Research, review, write, and more"
                         : hubStore.templates.map(\.name).joined(separator: " · "))
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(12)
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

    /// Green dot + caption for an actively running agent, the muted sand
    /// dot alone for idle (idle is the default state — spelling it out on
    /// every row is noise). The backend's status column is free-form
    /// ("idle" by default, agent_routes.rs:476), so anything not
    /// explicitly active reads as idle.
    private func statusDot(_ agent: AgentRecord) -> some View {
        let isActive = ["active", "running", "busy"].contains(agent.status.lowercased())
        return HStack(spacing: 4) {
            Circle()
                .fill(isActive ? Theme.statusSuccess : Color("TextSecondary").opacity(0.6))
                .frame(width: 7, height: 7)
            if isActive {
                Text("Active")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundColor(Theme.statusSuccess)
            }
        }
    }

    private func sectionLabel(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .bold))
            .tracking(1)
            .foregroundColor(Color("TextSecondary"))
            .textCase(nil)
    }

    // MARK: - Actions

    private func deleteAgent(_ agent: AgentRecord) {
        agentPendingDeletion = nil
        Task {
            do {
                try await hubStore.deleteAgent(id: agent.id)
                // Keep the composer pill's registry in step; a deleted agent
                // stops resolving as the pill's selection on its own.
                agentModeStore.fetchAgentsIfNeeded(force: true)
            } catch {
                actionError = "Couldn't delete the agent: \(error.localizedDescription)"
            }
        }
    }

    /// Template sheet confirm → instantiate → land on the new agent's
    /// detail (mockup A1 → A2 flow).
    private func createFromTemplate(_ template: AgentTemplate) {
        Task {
            do {
                let agent = try await hubStore.createFromTemplate(templateId: template.id)
                agentModeStore.fetchAgentsIfNeeded(force: true)
                detailAgent = agent
            } catch {
                actionError = "Couldn't create the agent: \(error.localizedDescription)"
            }
        }
    }
}

/// List-row chrome shared by the hub's card rows: invisible separators and
/// backgrounds so the row's own panel card is the only visible chrome.
private extension View {
    func hubCardRow() -> some View {
        self
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 5, leading: 20, bottom: 5, trailing: 20))
    }
}

/// Agent avatar — the agent's ID card, three looks:
/// 1. `avatar` set to "grid:<seed>" → a shuffled identicon variant (iOS
///    convention from the avatar editor; the web hub renders the raw
///    string until it learns it).
/// 2. `avatar` set to anything else → the glyph itself (custom emoji /
///    character the user typed) on the type-tinted tile.
/// 3. unset → the deterministic identicon from the agent id — every agent
///    has a distinctive mark out of the box, no generic icons.
struct AgentAvatarView: View {
    let agent: AgentRecord
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.325, style: .continuous)
                .fill(tileBackground)
            if let avatar = agent.avatar, !avatar.isEmpty {
                if let seed = Self.gridSeed(avatar) {
                    AgentIdenticonView(seed: seed, size: size * 0.62)
                } else {
                    Text(avatar)
                        .font(.system(size: size * 0.475))
                }
            } else {
                AgentIdenticonView(seed: agent.id, size: size * 0.62)
            }
        }
        .frame(width: size, height: size)
    }

    /// "grid:<seed>" → the seed, nil otherwise.
    static func gridSeed(_ avatar: String) -> String? {
        avatar.hasPrefix("grid:") ? String(avatar.dropFirst(5)) : nil
    }

    private var tileBackground: Color {
        if let avatar = agent.avatar, !avatar.isEmpty, Self.gridSeed(avatar) == nil {
            // Custom glyph keeps the type-tinted tile.
            return Self.tint(for: agent).opacity(0.14)
        }
        // Identicon paper — the warm cream of the logo's tile bed.
        return Color(red: 0.93, green: 0.90, blue: 0.84)
    }

    /// Per-kind tile tint behind custom glyphs (mockup's avatar color
    /// coding); the accent stays the default so unknown kinds read as
    /// platform-native.
    static func tint(for agent: AgentRecord) -> Color {
        let type = agent.type.lowercased()
        if type.contains("research") { return Color(red: 0.36, green: 0.51, blue: 0.74) }
        if type.contains("code") { return Color(red: 0.24, green: 0.48, blue: 0.32) }
        if type.contains("trad") { return Color(red: 0.58, green: 0.42, blue: 0.66) }
        if type.contains("write") { return Color(red: 0.72, green: 0.52, blue: 0.24) }
        return Color("AccentPrimary")
    }
}

/// The "+" sheet: the pattern-template catalog (`GET /api/v1/agent-templates`)
/// with a confirm step before `POST /agents/from-template` runs.
struct AgentTemplateSheet: View {
    /// Runs after the user confirms a template; the hub instantiates and
    /// navigates. The sheet dismisses itself first.
    let onConfirm: (AgentTemplate) -> Void

    @StateObject private var hubStore = AgentHubStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var pendingTemplate: AgentTemplate? = nil
    @State private var isConfirmPresented = false

    var body: some View {
        NavigationStack {
            content
                .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
                .navigationTitle("New from Template")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Close") { dismiss() }
                    }
                }
        }
        .confirmationDialog(
            "Create \(pendingTemplate?.name ?? "agent")?",
            isPresented: $isConfirmPresented,
            titleVisibility: .visible
        ) {
            Button("Create Agent") {
                if let template = pendingTemplate {
                    pendingTemplate = nil
                    dismiss()
                    onConfirm(template)
                }
            }
            Button("Cancel", role: .cancel) { pendingTemplate = nil }
        } message: {
            Text("This creates a new agent from the template with your default model.")
        }
        .task {
            hubStore.fetchTemplatesIfNeeded()
        }
    }

    @ViewBuilder
    private var content: some View {
        if hubStore.isLoadingTemplates && hubStore.templates.isEmpty {
            ProgressView()
        } else if let templatesError = hubStore.templatesError, hubStore.templates.isEmpty {
            VStack(spacing: 12) {
                Text("Couldn't load templates")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(templatesError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    hubStore.fetchTemplatesIfNeeded(force: true)
                }
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
        } else {
            List(hubStore.templates) { template in
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                    pendingTemplate = template
                    isConfirmPresented = true
                }) {
                    HStack(spacing: 12) {
                        Image(systemName: "square.grid.2x2")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color("AccentPrimary"))
                            .frame(width: 36, height: 36)
                            .background(Color("AccentPrimary").opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(template.name)
                                .font(.system(size: 14.5, weight: .semibold))
                                .foregroundColor(Color("TextPrimary"))
                            if let description = template.description, !description.isEmpty {
                                Text(description)
                                    .font(.caption)
                                    .foregroundColor(Color("TextSecondary"))
                                    .lineLimit(2)
                            }
                            Text(template.pattern ?? template.category)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(Color("TextSecondary"))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2.5)
                                .background(Color("BgSecondary"))
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(Color("BorderSubtle"), lineWidth: 1))
                                .padding(.top, 4)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(12)
                    .background(Color("BgPanel"))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusMD)
                            .stroke(Theme.borderWarmDefault, lineWidth: 1)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .hubCardRow()
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
    }
}
