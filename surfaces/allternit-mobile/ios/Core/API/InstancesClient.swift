import Foundation

/// One self-registered `gizzi serve --tunnel` instance, as listed by the
/// cloud API's `GET /api/v1/gizzi-instances` (newest first):
/// `{ "instances": [{ "id", "name", "url", "status", "updated_at" }] }`.
///
/// `status` and `updatedAt` stay raw Strings on purpose: unknown future
/// statuses shouldn't break decoding of the whole list, and the timestamp
/// (RFC-3339 or SQLite datetime depending on the backend) is display-only
/// here — no Date parsing.
struct GizziInstance: Decodable, Sendable, Identifiable {
    let id: String
    let name: String
    let url: String
    /// "online" | "stale" (kept as String for forward compatibility).
    let status: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, url, status
        case updatedAt = "updated_at"
    }

    var isOnline: Bool { status == "online" }

    /// The instance's tunnel base URL (e.g. `https://xyz.trycloudflare.com`);
    /// nil if the server sent a malformed URL.
    var instanceURL: URL? { URL(string: url) }
}

/// Fetches the signed-in user's registered gizzi instances from the cloud
/// API. Like EnvironmentStore's handoff claim, requests go DIRECT to
/// `AppConfig.cloudAPIBaseURL` — never through the EnvironmentStore relay
/// route, which only proxies runtime-gateway calls.
final class InstancesClient: @unchecked Sendable {
    /// `GET {cloud}/api/v1/gizzi-instances` with the Clerk Bearer
    /// (EnvironmentStore.claimHandoffToken is the template for cloud calls).
    func fetchInstances() async throws -> [GizziInstance] {
        let url = AppConfig.cloudAPIBaseURL.appendingPathComponent("api/v1/gizzi-instances")
        let client = APIClient.shared
        let request = try await client.authorizedRequest(url: url)

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(InstancesResponse.self, from: data).instances
        } catch {
            throw APIError.decoding(error)
        }
    }
}

private struct InstancesResponse: Decodable {
    let instances: [GizziInstance]
}
