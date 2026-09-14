import Foundation

/// Fabric Transport client (consumer-packaged Cowork P4.1) — approvals inbox
/// (grant/deny with decided-by) and run status, reusing the shared
/// APIClient (runtime device token / Clerk Bearer, environment-aware).
/// Terminology lock: Fabric Transport; legacy Cowork task clients untouched.
final class FabricTransportClient: @unchecked Sendable {
    private let client: APIClient
    private let baseURL: URL

    init(client: APIClient = .shared, baseURL: URL = AppConfig.apiBaseURL) {
        self.client = client
        self.baseURL = baseURL
    }

    struct Approval: Codable, Identifiable {
        let id: String
        let runId: String
        let capability: String
        let target: String
        let status: String
        let executor: String?
        let decidedBy: String?
        let createdAt: String?

        enum CodingKeys: String, CodingKey {
            case id
            case runId = "run_id"
            case capability, target, status, executor
            case decidedBy = "decided_by"
            case createdAt = "created_at"
        }
    }

    struct ApprovalsEnvelope: Codable {
        let approvals: [Approval]
    }

    struct RunEvent: Codable, Identifiable {
        let id: String
        let eventType: String
        let createdAt: String?
        let initiator: String?
        let delegator: String?
        let executor: String?

        enum CodingKeys: String, CodingKey {
            case id
            case eventType = "event_type"
            case createdAt = "created_at"
            case initiator, delegator, executor
        }
    }

    struct Run: Codable, Identifiable {
        let id: String
        let state: String
        let initiator: String?
        let createdAt: String?

        enum CodingKeys: String, CodingKey {
            case id, state, initiator
            case createdAt = "created_at"
        }
    }

    private func url(_ path: String) -> URL {
        baseURL.appendingPathComponent("fabric/transport").appendingPathComponent(path)
    }

    /// `GET /api/v1/fabric/transport/approvals?workspace=…` (pending + recent).
    func listApprovals(workspace: String = "default") async throws -> [Approval] {
        var components = URLComponents(url: url("approvals"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "workspace", value: workspace)]
        guard let endpoint = components?.url else { throw APIError.invalidResponse }
        let request = try await client.authorizedRequest(url: endpoint)
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        return try JSONDecoder().decode(ApprovalsEnvelope.self, from: data).approvals
    }

    /// `POST …/approvals/:id/grant|deny` — decided-by is recorded server-side.
    @discardableResult
    func decide(approvalId: String, grant: Bool) async throws -> Approval {
        let action = grant ? "grant" : "deny"
        let request = try await client.authorizedRequest(
            url: url("approvals").appendingPathComponent(approvalId).appendingPathComponent(action),
            method: "POST"
        )
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        return try JSONDecoder().decode(Approval.self, from: data)
    }

    /// `GET /api/v1/runs` — recent canonical runs (run status surface).
    /// `apiBaseURL` already ends in `/api/v1`; do not strip `v1`.
    func listRuns() async throws -> [Run] {
        let endpoint = baseURL.appendingPathComponent("runs")
        let request = try await client.authorizedRequest(url: endpoint)
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        return try JSONDecoder().decode([Run].self, from: data)
    }

    /// `GET /api/v1/runs/:id/events` — the attributed event timeline.
    func listRunEvents(runId: String) async throws -> [RunEvent] {
        let endpoint = baseURL
            .appendingPathComponent("runs")
            .appendingPathComponent(runId)
            .appendingPathComponent("events")
        let request = try await client.authorizedRequest(url: endpoint)
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        return try JSONDecoder().decode([RunEvent].self, from: data)
    }
}
