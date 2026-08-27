import Foundation

/// Client for allternit-api's webhook trigger routes
/// (`cmd/allternit-api/src/webhook_trigger_routes.rs`, mounted at
/// `/api/v1/webhook-triggers`; the public receiver lives outside the API
/// router at `/webhooks/inbound/:id`).
///
/// Goes through `APIClient.shared`'s relay-aware routing like the other
/// platform clients (PreferencesClient idiom) — NOT a direct connection
/// like CronClient, which targets gizzi-code's own server. Shapes mirror
/// the web client (surfaces/ai.allternit.com/src/lib/webhook-api.ts).
final class WebhookTriggersClient: @unchecked Sendable {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /api/v1/webhook-triggers` → `{ triggers, total }` (org-scoped,
    /// newest first).
    func listTriggers() async throws -> [WebhookTrigger] {
        let response: WebhookTriggerListResponse = try await client.get(path: "webhook-triggers")
        return response.triggers
    }

    /// `POST /api/v1/webhook-triggers` `{ name, target_bot_id }` → 201
    /// `{ trigger }`. The secret is generated server-side and never
    /// returned.
    func createTrigger(name: String, targetBotId: String) async throws -> WebhookTrigger {
        let response: WebhookTriggerResponse = try await client.post(
            path: "webhook-triggers",
            body: CreateWebhookTriggerBody(name: name, targetBotId: targetBotId)
        )
        return response.trigger
    }

    /// `GET /api/v1/webhook-triggers/:id` → `{ trigger }`.
    func getTrigger(id: String) async throws -> WebhookTrigger {
        let response: WebhookTriggerResponse = try await client.get(
            path: "webhook-triggers/\(Self.escape(id))"
        )
        return response.trigger
    }

    /// `PATCH /api/v1/webhook-triggers/:id` → `{ trigger }`. `body` must
    /// carry at least one set field — the server 400s an empty update
    /// ("no fields to update").
    ///
    /// `APIClient` ships only a void `patch`, and the updated row is the
    /// response payload here, so this builds the request on the client's
    /// public plumbing (same verb/validate/decode semantics as the
    /// convenience methods, one round trip).
    func updateTrigger(id: String, body: UpdateWebhookTriggerBody) async throws -> WebhookTrigger {
        var request = try await client.authorizedRequest(
            path: "webhook-triggers/\(Self.escape(id))", method: "PATCH"
        )
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await client.send(request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(WebhookTriggerResponse.self, from: data).trigger
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// `DELETE /api/v1/webhook-triggers/:id` → 204.
    func deleteTrigger(id: String) async throws {
        try await client.delete(path: "webhook-triggers/\(Self.escape(id))")
    }

    /// `GET /api/v1/webhook-triggers/:id/deliveries` → `{ deliveries,
    /// total }` (last 100, newest first).
    func listDeliveries(triggerId: String) async throws -> [WebhookTriggerDelivery] {
        let response: WebhookTriggerDeliveryListResponse = try await client.get(
            path: "webhook-triggers/\(Self.escape(triggerId))/deliveries"
        )
        return response.deliveries
    }

    /// Public inbound URL shown in the UI (`getWebhookInboundUrl` parity,
    /// webhook-api.ts:44-48): `<apiOrigin>/webhooks/inbound/:id`, where the
    /// origin is `AppConfig.apiBaseURL` with its `/api/v1` suffix stripped
    /// (the receiver router is mounted outside `/api/v1`,
    /// webhook_trigger_routes.rs:48-50). Display/copy only — the signing
    /// secret is never available client-side.
    static func inboundURL(forTriggerId id: String) -> URL {
        var origin = AppConfig.apiBaseURL
        if origin.lastPathComponent == "v1" {
            origin = origin.deletingLastPathComponent()
        }
        if origin.lastPathComponent == "api" {
            origin = origin.deletingLastPathComponent()
        }
        return origin.appendingPathComponent("webhooks/inbound/\(escape(id))")
    }

    /// Web uses `encodeURIComponent` on path ids (parity with
    /// CronClient/PtyClient).
    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }
}
