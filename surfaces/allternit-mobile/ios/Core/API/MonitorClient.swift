import Foundation

/// Gateway client for the Monitor endpoints — `/api/v1/monitor/*`.
///
/// These routes match web `MonitorView.tsx` but are not implemented in the
/// backend yet; the UI is wired so it works once they land.
final class MonitorClient: @unchecked Sendable {
    func listAgents() async throws -> [MonitorAgent] {
        let envelope: MonitorAgentsResponse = try await APIClient.shared.get(path: "monitor/agents")
        return envelope.agents
    }

    func listLogs() async throws -> [MonitorLogEntry] {
        let envelope: MonitorLogsResponse = try await APIClient.shared.get(path: "monitor/logs")
        return envelope.logs
    }

    func systemMetrics() async throws -> [MonitorSystemMetric] {
        let envelope: MonitorSystemResponse = try await APIClient.shared.get(path: "monitor/system")
        return envelope.metrics
    }
}
