import SwiftUI

/// Runtime Operations hub state: budget, replay, prewarm, execution mode.
///
/// Data sources: `/api/v1/runtime/*` on the gateway + gizzi-code runtime
/// `/runtime/execution-mode` (RuntimeOperationsClient).
@MainActor
final class RuntimeOperationsStore: ObservableObject {
    static let shared = RuntimeOperationsStore()

    @Published private(set) var budget: RuntimeBudgetStatus? = nil
    @Published private(set) var budgetMetrics: [RuntimeBudgetMetric] = []
    @Published private(set) var budgetAlerts: [RuntimeBudgetAlert] = []
    @Published private(set) var replayManifests: [ReplayManifest] = []
    @Published private(set) var prewarmStatus: PrewarmStatus? = nil
    @Published private(set) var poolStats: PoolStats = .empty
    @Published private(set) var executionMode: RuntimeExecutionModeStatus? = nil
    @Published private(set) var configuredCreditsPerHour: Double = 0
    @Published private(set) var maxPressurePercent: Double = 0
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil
    @Published private(set) var isSavingQuota = false

    private let client: RuntimeOperationsClient
    private var fetchTask: Task<Void, Never>? = nil

    init(client: RuntimeOperationsClient = RuntimeOperationsClient()) {
        self.client = client
    }

    // MARK: - Fetch

    func fetchIfNeeded(force: Bool = false) {
        guard force || budget == nil, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                async let budget = self.client.fetchBudget()
                async let replays = self.client.fetchReplayManifests()
                async let prewarm = self.client.fetchPrewarmStatus()
                async let mode = self.client.fetchExecutionMode()

                let budgetValue = try await budget
                self.budget = budgetValue
                self.budgetMetrics = Self.buildMetrics(budgetValue)
                self.budgetAlerts = Self.buildAlerts(budgetValue)
                self.configuredCreditsPerHour = budgetValue.creditsRemaining
                self.maxPressurePercent = Self.maxPressure(budgetValue)

                self.replayManifests = try await replays

                let prewarmValue = try await prewarm
                self.prewarmStatus = prewarmValue
                self.poolStats = Self.buildStats(prewarmValue)

                self.executionMode = try await mode
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
            async let budget = self.client.fetchBudget()
            async let replays = self.client.fetchReplayManifests()
            async let prewarm = self.client.fetchPrewarmStatus()
            async let mode = self.client.fetchExecutionMode()

            let budgetValue = try await budget
            self.budget = budgetValue
            self.budgetMetrics = Self.buildMetrics(budgetValue)
            self.budgetAlerts = Self.buildAlerts(budgetValue)
            self.configuredCreditsPerHour = budgetValue.creditsRemaining
            self.maxPressurePercent = Self.maxPressure(budgetValue)

            self.replayManifests = try await replays

            let prewarmValue = try await prewarm
            self.prewarmStatus = prewarmValue
            self.poolStats = Self.buildStats(prewarmValue)

            self.executionMode = try await mode
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Actions

    func setBudgetQuota(creditsPerHour: Double) async throws {
        isSavingQuota = true
        defer { isSavingQuota = false }
        let update = try await client.setBudgetQuota(creditsPerHour: creditsPerHour)
        configuredCreditsPerHour = update.creditsPerHour
        await refresh()
    }

    // MARK: - Helpers

    private static func buildMetrics(_ budget: RuntimeBudgetStatus) -> [RuntimeBudgetMetric] {
        [
            .init(key: .cpu, label: "CPU", percent: clampPercent(budget.cpuPercent), tone: tone(for: budget.cpuPercent), detail: "\(clampPercent(budget.cpuPercent).formatted(.number.precision(.fractionLength(1))))% utilized"),
            .init(key: .memory, label: "Memory", percent: clampPercent(budget.memoryPercent), tone: tone(for: budget.memoryPercent), detail: "\(clampPercent(budget.memoryPercent).formatted(.number.precision(.fractionLength(1))))% utilized"),
            .init(key: .network, label: "Network", percent: clampPercent(budget.networkPercent), tone: tone(for: budget.networkPercent), detail: "\(clampPercent(budget.networkPercent).formatted(.number.precision(.fractionLength(1))))% utilized"),
            .init(key: .workers, label: "Workers", percent: clampPercent(budget.workerPercent), tone: tone(for: budget.workerPercent), detail: "\(clampPercent(budget.workerPercent).formatted(.number.precision(.fractionLength(1))))% utilized")
        ]
    }

    private static func buildAlerts(_ budget: RuntimeBudgetStatus) -> [RuntimeBudgetAlert] {
        let maxPressure = max(budget.cpuPercent, budget.memoryPercent, budget.networkPercent, budget.workerPercent)
        if budget.status == "exhausted" || maxPressure >= 100 {
            return [.init(level: .critical, title: "Runtime budget exhausted", message: "The runtime has crossed its enforced pressure ceiling.")]
        } else if budget.status == "warning" || maxPressure >= 75 {
            return [.init(level: .warning, title: "Runtime budget under pressure", message: "Pressure is elevated; consider reducing load.")]
        } else {
            return [.init(level: .info, title: "Runtime budget healthy", message: "Operating inside the current budget envelope.")]
        }
    }

    private static func buildStats(_ status: PrewarmStatus) -> PoolStats {
        PoolStats(
            totalPools: status.pools.count,
            totalInstances: status.availableInstances + status.inUseInstances,
            totalAvailable: status.availableInstances,
            totalInUse: status.inUseInstances,
            totalWarmupsPerformed: 0,
            totalReuses: 0,
            avgWarmupTimeMs: 0
        )
    }

    private static func clampPercent(_ value: Double) -> Double {
        guard value.isFinite else { return 0 }
        return min(100, max(0, value))
    }

    private static func tone(for percent: Double) -> RuntimeBudgetMetric.Tone {
        if percent >= 90 { return .critical }
        if percent >= 75 { return .warning }
        return .healthy
    }

    private static func maxPressure(_ budget: RuntimeBudgetStatus) -> Double {
        max(budget.cpuPercent, budget.memoryPercent, budget.networkPercent, budget.workerPercent)
    }
}

private extension PoolStats {
    static let empty = PoolStats(
        totalPools: 0,
        totalInstances: 0,
        totalAvailable: 0,
        totalInUse: 0,
        totalWarmupsPerformed: 0,
        totalReuses: 0,
        avgWarmupTimeMs: 0
    )
}
