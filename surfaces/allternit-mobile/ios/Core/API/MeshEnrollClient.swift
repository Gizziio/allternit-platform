import Foundation

/// Response of the cloud API's `POST /api/v1/mesh/enroll`:
/// `{ "controlUrl", "authKey", "expiresAt", "meshUser" }` — a fresh
/// Headscale pre-auth key for the signed-in user plus the control-plane
/// URL to join with.
///
/// `expiresAt` (RFC-3339) stays a raw String on purpose — display/diagnostic
/// only here, same tolerance as `GizziInstance.updatedAt`. Nothing is
/// cached: each enroll mints a fresh 24h single-use key, so the client
/// simply re-enrolls on every start (platform-side refresh cadence is a
/// follow-up).
struct MeshEnrollment: Decodable, Sendable {
    let controlUrl: String
    let authKey: String
    let expiresAt: String
    let meshUser: String
}

/// Mints mesh credentials from the cloud API. Like InstancesClient, requests
/// go DIRECT to `AppConfig.cloudAPIBaseURL` with the Clerk Bearer
/// (EnvironmentStore.claimHandoffToken is the template) — never through the
/// EnvironmentStore relay route, which only proxies runtime-gateway calls.
///
/// Non-2xx surfaces as `APIError.httpError(statusCode:message:)`, where
/// `message` carries the server's `{ "error": "<code>" }` body string when
/// present (e.g. `mesh_not_configured` on 503).
final class MeshEnrollClient: @unchecked Sendable {
    /// `POST {cloud}/api/v1/mesh/enroll` with the Clerk Bearer.
    func enroll() async throws -> MeshEnrollment {
        let url = AppConfig.cloudAPIBaseURL.appendingPathComponent("api/v1/mesh/enroll")
        let client = APIClient.shared
        let request = try await client.authorizedRequest(url: url, method: "POST")

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(MeshEnrollment.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}
