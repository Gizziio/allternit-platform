import SwiftUI

/// Fetches Cowork tasks and runs the Intelli-Schedule optimizer.
@MainActor
final class IntelliScheduleStore: ObservableObject {
    static let shared = IntelliScheduleStore()

    @Published private(set) var tasks: [CoworkTask] = []
    @Published private(set) var output: IntelliScheduleOutput?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String? = nil

    private let client: CoworkTasksClient
    private let engine = IntelliScheduleEngine()
    private var fetchTask: Task<Void, Never>? = nil

    init(client: CoworkTasksClient = CoworkTasksClient()) {
        self.client = client
    }

    func fetchAndOptimizeIfNeeded(workspaceId: String = "default", force: Bool = false) {
        guard force || tasks.isEmpty, fetchTask == nil else { return }
        isLoading = true
        errorMessage = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.tasks = try await self.client.listTasks(workspaceId: workspaceId)
                self.runOptimization()
            } catch is CancellationError {
                // View went away mid-flight.
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    func refresh(workspaceId: String = "default") async {
        errorMessage = nil
        do {
            tasks = try await client.listTasks(workspaceId: workspaceId)
            runOptimization()
        } catch is CancellationError {
            // View went away mid-flight.
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func runOptimization(constraints: IntelliScheduleConstraints = IntelliScheduleConstraints()) {
        let intelliTasks = tasks.map { task in
            IntelliTask(
                id: task.id,
                title: task.title,
                priority: task.priority,
                estimatedMinutes: task.estimatedMinutes ?? 60,
                deadline: task.deadline.flatMap { ISO8601DateFormatter().date(from: $0) },
                dependencies: task.dependencies ?? []
            )
        }
        output = engine.optimize(tasks: intelliTasks, constraints: constraints)
    }

    func task(withId id: String) -> CoworkTask? {
        tasks.first { $0.id == id }
    }
}
