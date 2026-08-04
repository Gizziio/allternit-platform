import SwiftUI

/// Monitor state: agents, logs, and system metrics.
///
/// Data source: `GET /api/v1/monitor/*` on the gateway (MonitorClient).
/// On failure the store keeps whatever it last had and exposes `loadError` so
/// views render an error state instead of spinning forever.
@MainActor
final class MonitorStore: ObservableObject {
    static let shared = MonitorStore()

    @Published private(set) var agents: [MonitorAgent] = []
    @Published private(set) var logs: [MonitorLogEntry] = []
    @Published private(set) var systemMetrics: [MonitorSystemMetric] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    private let client: MonitorClient
    private var fetchTask: Task<Void, Never>? = nil

    init(client: MonitorClient = MonitorClient()) {
        self.client = client
    }

    // MARK: - Fetch

    func fetchIfNeeded(force: Bool = false) {
        guard force || agents.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                async let agents = self.client.listAgents()
                async let logs = self.client.listLogs()
                async let metrics = self.client.systemMetrics()
                self.agents = try await agents
                self.logs = try await logs
                self.systemMetrics = try await metrics
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
            async let agents = self.client.listAgents()
            async let logs = self.client.listLogs()
            async let metrics = self.client.systemMetrics()
            self.agents = try await agents
            self.logs = try await logs
            self.systemMetrics = try await metrics
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }
}
