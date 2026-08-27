import Foundation

/// Client for the webhook subscription routes mounted at `/beta/webhooks`
/// (`cmd/allternit-api/src/webhook_subscription_routes.rs:31-40`).
///
/// Reads through `APIClient.shared` so it picks up the same auth and relay
/// routing as the rest of the mobile app.
final class WebhookClient: @unchecked Sendable {
    static let shared = WebhookClient()

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /beta/webhooks` — lists the organization's subscriptions.
    func listSubscriptions() async throws -> [WebhookSubscription] {
        let response: WebhookSubscriptionListResponse = try await client.get(path: "beta/webhooks")
        return response.subscriptions
    }
}
