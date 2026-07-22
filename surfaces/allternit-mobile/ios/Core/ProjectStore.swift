import SwiftUI

/// Cowork projects state: the fetched project list plus the selected project
/// shared by the cowork top deck and the Projects feature.
///
/// This store is the SINGLE source of truth for `selectedProjectId`
/// (persisted in UserDefaults like AgentModeStore's other composer state);
/// `AgentModeStore.selectedProjectId` forwards here so older call sites keep
/// working.
///
/// Data source: `GET /api/v1/cowork/projects` (cowork_routes.rs). On
/// failure the store keeps an empty list and exposes `loadError` so views
/// render an error state instead of spinning forever.
@MainActor
final class ProjectStore: ObservableObject {
    static let shared = ProjectStore()

    @Published private(set) var projects: [CoworkProject] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    /// The cowork top-deck / project-detail selection. Nil = "No project".
    @Published var selectedProjectId: String? {
        didSet { defaults.set(selectedProjectId, forKey: Keys.selectedProjectId) }
    }

    private let defaults: UserDefaults
    private let projectsClient: ProjectsClient
    private var fetchTask: Task<Void, Never>? = nil

    private enum Keys {
        static let selectedProjectId = "allternit-selected-project-id"
    }

    init(defaults: UserDefaults = .standard, projectsClient: ProjectsClient = ProjectsClient()) {
        self.defaults = defaults
        self.projectsClient = projectsClient
        self.selectedProjectId = defaults.string(forKey: Keys.selectedProjectId)
    }

    /// The selected project record, when it still exists (a delete on
    /// another surface can leave a dangling id — callers fall back to the
    /// "Select project" none-label).
    var selectedProject: CoworkProject? {
        guard let selectedProjectId else { return nil }
        return projects.first { $0.id == selectedProjectId }
    }

    func project(withId id: String) -> CoworkProject? {
        projects.first { $0.id == id }
    }

    // MARK: - Fetch

    /// Fetches the project list once per launch unless forced; concurrent
    /// callers share the in-flight request (same pattern as
    /// AgentModeStore.fetchAgentsIfNeeded).
    func fetchProjectsIfNeeded(force: Bool = false) {
        guard force || projects.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.projects = try await self.projectsClient.listProjects()
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    // MARK: - Mutations

    /// Creates a project and prepends it locally (the list route orders by
    /// `updated_at DESC`, which a fresh row tops).
    @discardableResult
    func createProject(title: String, description: String? = nil) async throws -> CoworkProject {
        let id = try await projectsClient.createProject(title: title, description: description)
        let now = ISO8601DateFormatter().string(from: Date())
        let project = CoworkProject(
            id: id,
            userId: "",
            title: title,
            description: description,
            instructions: nil,
            gitRemote: nil,
            defaultBranch: nil,
            createdAt: now,
            updatedAt: now
        )
        projects.insert(project, at: 0)
        return project
    }

    /// Renames a project (PUT title) and updates the local copy.
    func renameProject(id: String, title: String) async throws {
        try await projectsClient.updateProject(id: id, title: title)
        if let index = projects.firstIndex(where: { $0.id == id }) {
            let old = projects[index]
            projects[index] = CoworkProject(
                id: old.id,
                userId: old.userId,
                title: title,
                description: old.description,
                instructions: old.instructions,
                gitRemote: old.gitRemote,
                defaultBranch: old.defaultBranch,
                createdAt: old.createdAt,
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )
        }
    }

    /// Saves a project's custom instructions (PUT instructions) and updates
    /// the local copy.
    func saveInstructions(id: String, instructions: String) async throws {
        try await projectsClient.updateProject(id: id, instructions: instructions)
        if let index = projects.firstIndex(where: { $0.id == id }) {
            let old = projects[index]
            projects[index] = CoworkProject(
                id: old.id,
                userId: old.userId,
                title: old.title,
                description: old.description,
                instructions: instructions,
                gitRemote: old.gitRemote,
                defaultBranch: old.defaultBranch,
                createdAt: old.createdAt,
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )
        }
    }

    /// Deletes a project, removes it locally, and clears the selection if it
    /// pointed at the deleted row.
    func deleteProject(id: String) async throws {
        try await projectsClient.deleteProject(id: id)
        projects.removeAll { $0.id == id }
        if selectedProjectId == id {
            selectedProjectId = nil
        }
    }
}
