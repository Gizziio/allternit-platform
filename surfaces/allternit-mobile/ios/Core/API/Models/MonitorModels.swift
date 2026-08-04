import Foundation

// -----------------------------------------------------------------------------
// Monitor models — mirrors the web shapes in
// surfaces/ai.allternit.com/src/views/MonitorView.tsx.
// -----------------------------------------------------------------------------

enum MonitorAgentStatus: String, Codable, Sendable {
    case active
    case idle
    case error
    case paused

    var label: String {
        switch self {
        case .active: return "Active"
        case .idle: return "Idle"
        case .error: return "Error"
        case .paused: return "Paused"
        }
    }
}

struct MonitorAgent: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    let status: MonitorAgentStatus
    let type: String
    let model: String
    let taskCount: Int
    let tokensUsed: Int
    let latencyMs: Int
    let uptime: String
    let lastActivity: String
    let memMb: Int

    enum CodingKeys: String, CodingKey {
        case id, name, status, type, model
        case taskCount = "task_count"
        case tokensUsed = "tokens_used"
        case latencyMs = "latency_ms"
        case uptime
        case lastActivity = "last_activity"
        case memMb = "mem_mb"
    }
}

enum MonitorTrend: String, Codable, Sendable {
    case up
    case down
    case stable
}

struct MonitorSystemMetric: Identifiable, Codable, Sendable {
    let label: String
    let value: String
    let unit: String
    let trend: MonitorTrend
    let trendValue: String
    let color: String

    enum CodingKeys: String, CodingKey {
        case label, value, unit, trend
        case trendValue = "trend_value"
        case color
    }

    var id: String { label }
}

enum MonitorLogLevel: String, Codable, Sendable {
    case info
    case warn
    case error
    case debug
}

struct MonitorLogEntry: Identifiable, Codable, Sendable {
    let id: String
    let time: String
    let level: MonitorLogLevel
    let agent: String
    let message: String
}

// MARK: - Envelopes

struct MonitorAgentsResponse: Decodable, Sendable {
    let agents: [MonitorAgent]
}

struct MonitorLogsResponse: Decodable, Sendable {
    let logs: [MonitorLogEntry]
}

struct MonitorSystemResponse: Decodable, Sendable {
    let metrics: [MonitorSystemMetric]
}
