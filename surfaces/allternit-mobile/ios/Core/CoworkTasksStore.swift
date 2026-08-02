import SwiftUI

/// Cowork tasks state: the fetched flat task list backing the Cowork Tasks
/// sheet's Tasks / Agent Tasks segments (filtered client-side on
/// `assigneeType`, CoworkTasksListView).
///
/// Data source: `GET /api/v1/tasks?workspace_id=default` on the cloud API
/// (CoworkTasksClient, same host as RuntimeDevicesClient/ProjectStore). On
/// failure the store keeps whatever it last had and exposes `loadError` so
/// views render an error state instead of spinning forever (ProjectStore's
/// convention).
@MainActor
final class CoworkTasksStore: ObservableObject {
    static let shared = CoworkTasksStore()

    @Published private(set) var tasks: [CoworkTask] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    private let client: CoworkTasksClient
    private var fetchTask: Task<Void, Never>? = nil

    init(client: CoworkTasksClient = CoworkTasksClient()) {
        self.client = client
    }

    func task(withId id: String) -> CoworkTask? {
        tasks.first { $0.id == id }
    }

    // MARK: - Fetch

    /// Fetches the task list once per launch unless forced; concurrent
    /// callers share the in-flight request (CronJobStore's
    /// `fetchJobsIfNeeded` pattern).
    func fetchTasksIfNeeded(force: Bool = false) {
        guard force || tasks.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.tasks = try await self.client.listTasks()
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
            tasks = try await client.listTasks()
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Mutations

    /// Creates a task, then resyncs so server-computed fields (`id`,
    /// `priority`, `createdAt`/`updatedAt`) land.
    @discardableResult
    func create(title: String, description: String?, assigneeType: String?) async throws -> CoworkTask {
        let task = try await client.createTask(title: title, description: description, assigneeType: assigneeType)
        await refresh()
        return task
    }

    /// Changes a task's status, then resyncs from the server (the source of
    /// truth for `status`/`updatedAt`).
    func updateStatus(id: String, status: CoworkTaskStatus) async throws {
        try await client.updateTask(id: id, status: status.rawValue)
        await refresh()
    }

    /// Deletes a task and removes it locally.
    func delete(id: String) async throws {
        try await client.deleteTask(id: id)
        tasks.removeAll { $0.id == id }
    }
}
