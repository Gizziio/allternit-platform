import Foundation

/// Gateway + runtime client for Runtime Operations.
///
/// Budget / replay / prewarm live on the gateway (`/api/v1/runtime/*`).
/// Execution mode lives on the gizzi-code runtime (`/runtime/execution-mode`).
final class RuntimeOperationsClient: @unchecked Sendable {
    // MARK: - Budget

    func fetchBudget() async throws -> RuntimeBudgetStatus {
        try await APIClient.shared.get(path: "runtime/budget")
    }

    func setBudgetQuota(creditsPerHour: Double) async throws -> RuntimeBudgetQuotaUpdate {
        struct Body: Encodable {
            let creditsPerHour: Double
            enum CodingKeys: String, CodingKey {
                case creditsPerHour = "credits_per_hour"
            }
        }
        return try await APIClient.shared.post(
            path: "runtime/budget/quota",
            body: Body(creditsPerHour: creditsPerHour)
        )
    }

    // MARK: - Replay

    func fetchReplayManifests() async throws -> [ReplayManifest] {
        try await APIClient.shared.get(path: "runtime/replay/sessions")
    }

    func executeReplay(runId: String) async throws -> ReplayExecutionResult {
        let escaped = runId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? runId
        return try await APIClient.shared.post(
            path: "runtime/replay/sessions/\(escaped)/execute",
            body: [String: String]()
        )
    }

    // MARK: - Prewarm

    func fetchPrewarmStatus() async throws -> PrewarmStatus {
        try await APIClient.shared.get(path: "runtime/prewarm/status")
    }

    // MARK: - Execution mode

    /// GET {gizzi}/runtime/execution-mode — direct to runtime host.
    func fetchExecutionMode() async throws -> RuntimeExecutionModeStatus {
        let url = AppConfig.gizziCodeBaseURL.appendingPathComponent("runtime/execution-mode")
        let request = try await APIClient.shared.authorizedRequest(url: url)
        let (data, response) = try await APIClient.shared.session.data(for: request)
        try APIClient.shared.validate(response, data: data)
        return try JSONDecoder().decode(RuntimeExecutionModeStatus.self, from: data)
    }

    /// POST {gizzi}/runtime/execution-mode.
    func setExecutionMode(_ mode: RuntimeExecutionMode) async throws -> RuntimeExecutionModeStatus {
        let url = AppConfig.gizziCodeBaseURL.appendingPathComponent("runtime/execution-mode")
        var request = try await APIClient.shared.authorizedRequest(url: url, method: "POST")
        struct Body: Encodable {
            let mode: RuntimeExecutionMode
        }
        request.httpBody = try JSONEncoder().encode(Body(mode: mode))
        let (data, response) = try await APIClient.shared.session.data(for: request)
        try APIClient.shared.validate(response, data: data)
        return try JSONDecoder().decode(RuntimeExecutionModeStatus.self, from: data)
    }
}
