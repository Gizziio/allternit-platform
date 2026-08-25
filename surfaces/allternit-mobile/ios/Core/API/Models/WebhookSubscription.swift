import Foundation

/// One webhook subscription row from `GET /beta/webhooks`.
/// Mirrors `SubscriptionRow` in `cmd/allternit-api/src/webhook_subscription_routes.rs:57-66`.
struct WebhookSubscription: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let url: String
    let events: [String]
    let active: Bool
    let createdAt: String
    let updatedAt: String

    private enum CodingKeys: String, CodingKey {
        case id, url, events, active
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Envelope of `GET /beta/webhooks` (`{ subscriptions, total }`).
struct WebhookSubscriptionListResponse: Decodable, Sendable {
    let subscriptions: [WebhookSubscription]
    let total: Int
}
