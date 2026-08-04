import SwiftUI

/// Team skills state: the fetched skill list backing the Code Skills sheet.
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

    init(client: TeamSkillsClient = TeamSkillsClient()) {
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

    /// Unconditional refresh (pull-to-refresh).
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
}
