import Foundation

/// Client for registering this device's APNs token with the gateway.
///
/// The backend route is `POST /api/v1/device-tokens` with `{ token, platform }`.
/// Until the route is deployed the call will 404; the manager stores the token
/// locally and retries on every fresh registration so it automatically wires
/// up once the endpoint exists.
final class PushTokenClient: Sendable {
    static let shared = PushTokenClient()

    private init() {}

    func register(token: String) async throws {
        struct Body: Encodable {
            let token: String
            let platform: String = "ios"
        }
        try await APIClient.shared.post(path: "device-tokens", body: Body(token: token))
    }
}
