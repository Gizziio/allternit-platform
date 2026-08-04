import SwiftUI

/// Workspace state: the fetched workspace list plus the active selection.
///
/// Data source: `GET /api/v1/workspaces` (workspace_routes.rs). On failure the
/// store keeps an empty list and exposes `loadError` so views render an error
/// state instead of spinning forever (ProjectStore's convention).
@MainActor
final class WorkspaceStore: ObservableObject {
    static let shared = WorkspaceStore()

    @Published private(set) var workspaces: [Workspace] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    /// The workspace currently targeted by workspace-scoped surfaces (Team
    /// Skills, Organization Access, etc.). Persisted like ProjectStore's
    /// selected project id.
    @Published var activeWorkspaceId: String? {
        didSet { defaults.set(activeWorkspaceId, forKey: Keys.activeWorkspaceId) }
    }

    private let defaults: UserDefaults
    private let client: WorkspaceClient
    private var fetchTask: Task<Void, Never>? = nil

    private enum Keys {
        static let activeWorkspaceId = "allternit-active-workspace-id"
    }

    init(defaults: UserDefaults = .standard, client: WorkspaceClient = .shared) {
        self.defaults = defaults
        self.client = client
        self.activeWorkspaceId = defaults.string(forKey: Keys.activeWorkspaceId)
    }

    var activeWorkspace: Workspace? {
        guard let activeWorkspaceId else { return nil }
        return workspaces.first { $0.id == activeWorkspaceId }
    }

    // MARK: - Fetch

    /// Fetches the workspace list once per launch unless forced; concurrent
    /// callers share the in-flight request (ProjectStore pattern).
    func fetchWorkspacesIfNeeded(force: Bool = false) {
        guard force || workspaces.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.workspaces = try await self.client.listWorkspaces()
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    /// Unconditional refresh (pull-to-refresh, post-mutation resync).
    func refresh() async {
        loadError = nil
        do {
            workspaces = try await client.listWorkspaces()
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }
}
