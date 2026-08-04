import SwiftUI

// -----------------------------------------------------------------------------
// Swarm ADE store — observable state for the iOS SwarmADE view.
//
// Mirrors useSwarmMonitorStore from
// surfaces/ai.allternit.com/src/views/swarm/SwarmMonitor.store.ts:
//   - keeps agents, selected agent, view mode, filters, loading/error state
//   - fetches sessions and maps them to swarm agents via SwarmClient
//   - lazy-loads messages for the selected/detail agent
// -----------------------------------------------------------------------------

@MainActor
final class SwarmStore: ObservableObject {
    static let shared = SwarmStore()

    @Published private(set) var agents: [SwarmAgent] = []
    @Published private(set) var sessions: [AgentSession] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    @Published var viewMode: SwarmViewMode = .grid
    @Published var selectedAgentId: String? = nil

    // Filters
    @Published var searchQuery = ""
    @Published var roleFilter: SwarmAgentRole? = nil
    @Published var statusFilter: SwarmAgentStatus? = nil

    private let client: SwarmClient
    private var fetchTask: Task<Void, Never>? = nil
    private var detailTask: Task<Void, Never>? = nil

    init(client: SwarmClient = SwarmClient()) {
        self.client = client
    }

    var filteredAgents: [SwarmAgent] {
        agents.filter { agent in
            if let roleFilter, agent.role != roleFilter { return false }
            if let statusFilter, agent.status != statusFilter { return false }
            let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if query.isEmpty { return true }
            return agent.name.localizedCaseInsensitiveContains(query)
                || agent.role.rawValue.localizedCaseInsensitiveContains(query)
                || agent.model.localizedCaseInsensitiveContains(query)
                || agent.capabilities.contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }

    var selectedAgent: SwarmAgent? {
        guard let selectedAgentId else { return nil }
        return agents.first { $0.id == selectedAgentId }
    }

    var metrics: SwarmMetrics {
        calculateMetrics(agents: agents)
    }

    var events: [SwarmActivityEvent] {
        generateActivityEvents(agents: agents)
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
                let fresh = try await self.client.listAgents()
                self.agents = fresh
                // Keep session list in sync so detail refreshes can find them.
                self.sessions = try await AgentChatClient().listSessions()
            } catch is CancellationError {
                // ignore
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    func refresh() {
        fetchIfNeeded(force: true)
    }

    // MARK: - Selection / detail

    func selectAgent(id: String?) {
        selectedAgentId = id
        if let id {
            viewMode = .detail
            loadDetail(for: id)
        }
    }

    func backToGrid() {
        selectedAgentId = nil
        viewMode = .grid
    }

    private func loadDetail(for sessionId: String) {
        detailTask?.cancel()
        detailTask = Task { [weak self] in
            guard let self else { return }
            do {
                if let refreshed = try await self.client.agentWithMessages(
                    sessionId: sessionId,
                    sessions: self.sessions
                ) {
                    if let index = self.agents.firstIndex(where: { $0.id == refreshed.id }) {
                        self.agents[index] = refreshed
                    }
                }
            } catch is CancellationError {
                // ignore
            } catch {
                // Don't overwrite the list with a detail error.
            }
        }
    }

    // MARK: - Agent actions

    func restartAgent(id: String) async {
        // Best-effort: mark session metadata refreshed. The backend updateSession
        // isn't exposed on AgentChatClient, so we just refresh from messages.
        do {
            _ = try await client.agentWithMessages(sessionId: id, sessions: sessions)
            refresh()
        } catch {
            loadError = error.localizedDescription
        }
    }

    func stopAgent(id: String) async {
        do {
            try await AgentChatClient().abort(sessionId: id)
            refresh()
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func calculateMetrics(agents: [SwarmAgent]) -> SwarmMetrics {
        let activeAgents = agents.filter { $0.status == .working }.count
        let activeThreads = agents.reduce(0) { $0 + $1.currentTasks.filter { $0.status == .active }.count }
        let completedThreads = agents.reduce(0) { $0 + $1.currentTasks.filter { $0.status == .completed }.count }
        let failedThreads = agents.reduce(0) { $0 + $1.currentTasks.filter { $0.status == .failed }.count }
        let totalCost = agents.reduce(0.0) { $0 + $1.costAccumulated }
        let totalTokens = agents.reduce(0) { $0 + $1.tokensUsed }

        return SwarmMetrics(
            activeAgents: activeAgents,
            activeThreads: activeThreads,
            completedThreads: completedThreads,
            failedThreads: failedThreads,
            queuedThreads: 0,
            totalCost: totalCost,
            totalTokens: totalTokens,
            throughput: 4.2 + Double.random(in: 0..<0.5),
            avgLatency: 180 + Int.random(in: 0..<100),
            tokensPerMinute: Double(totalTokens) / 60.0,
            costPerHour: totalCost * 60.0
        )
    }

    private func generateActivityEvents(agents: [SwarmAgent]) -> [SwarmActivityEvent] {
        var events: [SwarmActivityEvent] = []
        for agent in agents {
            for (index, task) in agent.currentTasks.enumerated() {
                events.append(SwarmActivityEvent(
                    id: "evt-\(agent.id)-\(task.id)",
                    timestamp: Self.timeFormatter.string(from: task.startTime),
                    agentId: agent.id,
                    agentRole: agent.role,
                    agentName: agent.name,
                    type: index == agent.currentTasks.count - 1 ? .taskComplete : .message,
                    message: task.name,
                    tokens: task.tokensUsed,
                    cost: task.cost
                ))
            }
        }
        return events.sorted { $0.timestamp > $1.timestamp }.prefix(50).map { $0 }
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter
    }()
}
