import SwiftUI

/// Cloud Deploy state: deployment list and creation.
///
/// Data source: `/api/v1/deployments/*` on the gateway (CloudDeployClient).
@MainActor
final class CloudDeployStore: ObservableObject {
    static let shared = CloudDeployStore()

    @Published private(set) var deployments: [Deployment] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil
    @Published private(set) var isCreating = false
    @Published private(set) var createError: String? = nil
    @Published private(set) var lastCreated: Deployment? = nil
    @Published private(set) var isCancellingId: String? = nil

    /// Views report/update create-flow errors through this setter; the
    /// property stays `private(set)` so all mutation goes through the store.
    func setCreateError(_ message: String?) {
        createError = message
    }

    private let client: CloudDeployClient
    private var fetchTask: Task<Void, Never>? = nil
    private var pollTask: Task<Void, Never>? = nil

    init(client: CloudDeployClient = CloudDeployClient()) {
        self.client = client
    }

    // MARK: - Fetch

    func fetchIfNeeded(force: Bool = false) {
        guard force || deployments.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                self.deployments = try await self.client.listDeployments()
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    func refresh() async {
        loadError = nil
        do {
            self.deployments = try await client.listDeployments()
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Actions

    func createDeployment(_ request: DeploymentCreateRequest) async throws {
        isCreating = true
        createError = nil
        defer { isCreating = false }
        let deployment = try await client.createDeployment(request)
        lastCreated = deployment
        await refresh()
        startPolling(id: deployment.id)
    }

    func cancelDeployment(_ id: String) async throws {
        isCancellingId = id
        defer { isCancellingId = nil }
        try await client.cancelDeployment(id: id)
        await refresh()
    }

    func clearLastCreated() {
        lastCreated = nil
        createError = nil
        pollTask?.cancel()
        pollTask = nil
    }

    // MARK: - Polling

    func startPolling(id: String) {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            guard let self else { return }
            for _ in 0..<60 {
                guard !Task.isCancelled else { return }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                guard !Task.isCancelled else { return }
                do {
                    let updated = try await self.client.fetchDeploymentStatus(id: id)
                    if let index = self.deployments.firstIndex(where: { $0.id == id }) {
                        self.deployments[index] = updated
                    }
                    if updated.status == "complete" || updated.status == "error" || updated.status == "cancelled" {
                        return
                    }
                } catch {
                    // Keep polling on transient errors.
                }
            }
        }
    }
}
