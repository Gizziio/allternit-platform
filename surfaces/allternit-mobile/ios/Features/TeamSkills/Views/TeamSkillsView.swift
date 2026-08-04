import SwiftUI

/// Team Skills tab surface — lists installed skills for the active workspace,
/// with install / uninstall actions.
///
/// Mirrors `components/marketplace/TeamSkillsPanel.tsx` on the web. Structural
/// pattern from `AutomationTasksListView`.
struct TeamSkillsView: View {
    @Binding var isSidebarOpen: Bool

    @StateObject private var workspaceStore = WorkspaceStore.shared
    @StateObject private var skillsStore = TeamSkillsStore.shared

    @State private var searchText = ""
    @State private var newName = ""
    @State private var newDescription = ""
    @State private var isCreateSheetPresented = false
    @State private var actionError: String? = nil

    private var visibleSkills: [TeamSkill] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return skillsStore.skills }
        return skillsStore.skills.filter {
            $0.name.localizedCaseInsensitiveContains(query)
            || ($0.description ?? "").localizedCaseInsensitiveContains(query)
        }
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
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $isCreateSheetPresented) {
            createSheet
        }
        .task {
            workspaceStore.fetchWorkspacesIfNeeded()
        }
        .onChange(of: workspaceStore.activeWorkspaceId) { _, workspaceId in
            guard let workspaceId else {
                skillsStore.skills = []
                return
            }
            Task {
                await skillsStore.fetchSkills(workspaceId: workspaceId)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
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

            Text("Team Skills")
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
            .disabled(workspaceStore.activeWorkspaceId == nil)
            .opacity(workspaceStore.activeWorkspaceId == nil ? 0.5 : 1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }

    // MARK: - Workspace bar

    private var workspaceBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "building.2")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))

            if workspaceStore.isLoading && workspaceStore.workspaces.isEmpty {
                Spacer()
                ProgressView()
                    .scaleEffect(0.8)
                Spacer()
            } else if workspaceStore.workspaces.isEmpty {
                Text("No workspaces")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                Spacer()
            } else {
                Picker("Workspace", selection: $workspaceStore.activeWorkspaceId) {
                    Text("Select workspace…").tag(String?.none)
                    ForEach(workspaceStore.workspaces) { workspace in
                        Text(workspace.name).tag(workspace.id as String?)
                    }
                }
                .pickerStyle(.menu)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                Spacer()
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color("BgPrimary"))
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        VStack(spacing: 0) {
            if workspaceStore.activeWorkspaceId == nil {
                Spacer()
                noWorkspaceState
                Spacer()
            } else if skillsStore.isLoading && skillsStore.skills.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if let loadError = skillsStore.loadError, skillsStore.skills.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Text("Couldn't load team skills")
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    Text(loadError)
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        Task {
                            if let workspaceId = workspaceStore.activeWorkspaceId {
                                await skillsStore.fetchSkills(workspaceId: workspaceId)
                            }
                        }
                    }
                    .font(.subheadline)
                    .foregroundColor(Color("AccentPrimary"))
                }
                .padding(.horizontal, 20)
                Spacer()
            } else if skillsStore.skills.isEmpty {
                Spacer()
                emptyState
                Spacer()
            } else {
                listContent
            }
        }
    }

    private var listContent: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                TextField("Search team skills", text: $searchText)
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

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(visibleSkills) { skill in
                        skillRow(skill)
                    }
                    if visibleSkills.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(Color("TextSecondary"))
                            Text("No team skills match.")
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
                if let workspaceId = workspaceStore.activeWorkspaceId {
                    await skillsStore.refresh(workspaceId: workspaceId)
                }
            }
        }
    }

    private func skillRow(_ skill: TeamSkill) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "puzzlepiece.extension")
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color("AccentPrimary"))
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(skill.name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)
                Text(skill.description ?? "No description")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(2)
                HStack(spacing: 8) {
                    Text("v\(skill.version)")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(Color("TextSecondary"))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color("BgSecondary"))
                        .clipShape(Capsule())
                    if let dateText = Self.formatInstalledAt(skill.installedAt) {
                        Text(dateText)
                            .font(.caption2)
                            .foregroundColor(Color("TextSecondary"))
                    }
                }
                .padding(.top, 4)
            }
            Spacer()
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                uninstall(skill)
            }) {
                Image(systemName: "trash")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 72)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "puzzlepiece.extension")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text("No team skills installed yet.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                isCreateSheetPresented = true
            }) {
                Text("Install team skill")
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

    private var noWorkspaceState: some View {
        VStack(spacing: 16) {
            Image(systemName: "building.2")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text("Select a workspace to manage team skills.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }

    // MARK: - Create sheet

    private var createSheet: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    Button("Cancel") {
                        isCreateSheetPresented = false
                    }
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))

                    Spacer()

                    Text("Install Team Skill")
                        .font(.headline)
                        .foregroundColor(Color("TextPrimary"))

                    Spacer()

                    Button("Install") {
                        installSkill()
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("AccentPrimary"))
                    .disabled(newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .opacity(newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color("BgPrimary"))

                Divider().background(Color("BorderSubtle"))

                VStack(spacing: 16) {
                    TextField("Skill name", text: $newName)
                        .font(.subheadline)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color("BgSecondary"))
                        .cornerRadius(10)

                    TextField("Description (optional)", text: $newDescription)
                        .font(.subheadline)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color("BgSecondary"))
                        .cornerRadius(10)

                    if let actionError {
                        Text(actionError)
                            .font(.caption)
                            .foregroundColor(Theme.statusWarning)
                            .multilineTextAlignment(.center)
                    }

                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    // MARK: - Actions

    private func installSkill() {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let workspaceId = workspaceStore.activeWorkspaceId else { return }
        let description = newDescription.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        Task {
            do {
                _ = try await skillsStore.createSkill(
                    workspaceId: workspaceId,
                    name: name,
                    description: description
                )
                newName = ""
                newDescription = ""
                actionError = nil
                isCreateSheetPresented = false
            } catch {
                actionError = "Couldn't install the skill: \(error.localizedDescription)"
            }
        }
    }

    private func uninstall(_ skill: TeamSkill) {
        Task {
            do {
                try await skillsStore.deleteSkill(id: skill.id)
                actionError = nil
            } catch {
                actionError = "Couldn't uninstall the skill: \(error.localizedDescription)"
            }
        }
    }

    // MARK: - Formatting

    private static func formatInstalledAt(_ value: String) -> String? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        formatter.timeZone = TimeZone.current
        guard let date = formatter.date(from: value) else {
            return nil
        }
        return DateFormatter.localizedString(from: date, dateStyle: .medium, timeStyle: .none)
    }
}

private extension String {
    var nilIfEmpty: String? {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self
    }
}
