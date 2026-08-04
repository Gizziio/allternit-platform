import Foundation

// -----------------------------------------------------------------------------
// Swarm ADE models — ported from surfaces/ai.allternit.com/src/views/swarm/types.ts
// and the session-to-agent mapping in SwarmMonitor.store.ts.
//
// iOS lite port: agents are derived from agent-sessions (chat/code) plus their
// latest messages. The backend has no dedicated "swarm agent" entity, so the
// same heuristic role/status detection the web uses is applied here.
// -----------------------------------------------------------------------------

/// A role inferred from session name / tags / description.
enum SwarmAgentRole: String, CaseIterable, Sendable, Identifiable {
    case orchestrator
    case worker
    case specialist
    case reviewer

    var id: String { rawValue }

    var label: String {
        switch self {
        case .orchestrator: return "Orchestrator"
        case .worker: return "Worker"
        case .specialist: return "Specialist"
        case .reviewer: return "Reviewer"
        }
    }

    /// Color matches the web's roleColors (types.ts / SwarmMonitor.store.ts).
    var colorHex: String {
        switch self {
        case .orchestrator: return "#c17817"
        case .worker: return "#3b82f6"
        case .specialist: return "#a78bfa"
        case .reviewer: return "#22c55e"
        }
    }

    /// SF Symbol used in place of Phosphor icons.
    var icon: String {
        switch self {
        case .orchestrator: return "brain.head.profile"
        case .worker: return "cpu"
        case .specialist: return "microchip"
        case .reviewer: return "checkmark.clipboard"
        }
    }
}

/// A status inferred from recent session activity.
enum SwarmAgentStatus: String, CaseIterable, Sendable, Identifiable {
    case idle
    case working
    case error
    case stopped

    var id: String { rawValue }

    var label: String {
        switch self {
        case .idle: return "Idle"
        case .working: return "Working"
        case .error: return "Error"
        case .stopped: return "Stopped"
        }
    }

    var colorHex: String {
        switch self {
        case .idle: return "#6b7280"
        case .working: return "#22c55e"
        case .error: return "#ef4444"
        case .stopped: return "#f59e0b"
        }
    }
}

/// One task derived from a recent assistant message.
struct SwarmTask: Identifiable, Sendable {
    let id: String
    let name: String
    let status: SwarmTaskStatus
    let progress: Int
    let tokensUsed: Int
    let cost: Double
    let startTime: Date
    let duration: String
}

enum SwarmTaskStatus: String, Sendable {
    case active
    case completed
    case failed
}

/// One agent in the swarm view.
struct SwarmAgent: Identifiable, Sendable {
    let id: String
    let name: String
    let role: SwarmAgentRole
    let status: SwarmAgentStatus
    let model: String
    let tasksActive: Int
    let tokensUsed: Int
    let costAccumulated: Double
    let avgLatency: Int
    let lastActivity: Date
    let uptime: String
    let currentTasks: [SwarmTask]
    let capabilities: [String]
    let originSurface: String

    /// Derived display color.
    var colorHex: String { role.colorHex }
}

/// Aggregated swarm metrics.
struct SwarmMetrics: Sendable {
    let activeAgents: Int
    let activeThreads: Int
    let completedThreads: Int
    let failedThreads: Int
    let queuedThreads: Int
    let totalCost: Double
    let totalTokens: Int
    let throughput: Double
    let avgLatency: Int
    let tokensPerMinute: Double
    let costPerHour: Double
}

/// One console event derived from recent assistant messages.
struct SwarmActivityEvent: Identifiable, Sendable {
    let id: String
    let timestamp: String
    let agentId: String
    let agentRole: SwarmAgentRole
    let agentName: String
    let type: SwarmEventType
    let message: String
    let tokens: Int
    let cost: Double
}

enum SwarmEventType: String, Sendable {
    case taskStart = "task_start"
    case taskComplete = "task_complete"
    case message
}

/// The six view modes offered by the web SwarmADE.
enum SwarmViewMode: String, CaseIterable, Sendable, Identifiable {
    case grid
    case topology
    case kanban
    case console
    case detail
    case history

    var id: String { rawValue }

    var label: String {
        switch self {
        case .grid: return "Grid"
        case .topology: return "Topology"
        case .kanban: return "Kanban"
        case .console: return "Console"
        case .detail: return "Detail"
        case .history: return "History"
        }
    }

    var icon: String {
        switch self {
        case .grid: return "square.grid.2x2"
        case .topology: return "network"
        case .kanban: return "columns"
        case .console: return "terminal"
        case .detail: return "list.bullet.rectangle"
        case .history: return "chart.line.uptrend.xyaxis"
        }
    }
}
