import SwiftUI

/// Team skills state: the fetched skill list backing both the Code Skills sheet
/// and the Team Skills sidebar tab.
///
/// Data source: `GET /api/v1/team-skills` on the gateway (TeamSkillsClient).
/// On failure the store keeps whatever it last had and exposes `loadError` so
/// views render an error state instead of spinning forever.
@MainActor
final class TeamSkillsStore: ObservableObject {
    static let shared = TeamSkillsStore()

    @Published private(set) var skills: [TeamSkill] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    private let client: TeamSkillsClient
    private var fetchTask: Task<Void, Never>? = nil

    init(client: TeamSkillsClient = .shared) {
        self.client = client
    }

    // MARK: - Fetch

    /// Fetches the skill list once per launch unless forced; concurrent
    /// callers share the in-flight request.
    func fetchSkillsIfNeeded(force: Bool = false) {
        guard force || skills.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.skills = try await self.client.listSkills()
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    /// Loads skills for the given workspace. Callers drive this from the view
    /// layer when `WorkspaceStore.activeWorkspaceId` changes.
    func fetchSkills(workspaceId: String) async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            skills = try await client.listSkills(workspaceId: workspaceId)
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    /// Unconditional refresh (pull-to-refresh) for the Code Skills sheet.
    func refresh() async {
        loadError = nil
        do {
            skills = try await client.listSkills()
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    /// Refreshes the current workspace's skills (pull-to-refresh).
    func refresh(workspaceId: String) async {
        await fetchSkills(workspaceId: workspaceId)
    }

    // MARK: - Mutations

    /// Creates a skill and prepends it locally, then refreshes so
    /// server-computed fields (`installedAt`, etc.) land.
    @discardableResult
    func createSkill(workspaceId: String, name: String, description: String? = nil) async throws -> TeamSkill {
        let id = try await client.createSkill(workspaceId: workspaceId, name: name, description: description)
        let skill = TeamSkill(
            id: id,
            workspaceId: workspaceId,
            name: name,
            description: description,
            manifest: nil,
            sourceRepo: nil,
            version: "0.0.1",
            installedBy: "",
            installedAt: Self.currentTimestamp()
        )
        skills.insert(skill, at: 0)
        await fetchSkills(workspaceId: workspaceId)
        return skill
    }

    /// Deletes a skill and removes it locally.
    func deleteSkill(id: String) async throws {
        try await client.deleteSkill(id: id)
        skills.removeAll { $0.id == id }
    }

    private static func currentTimestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
