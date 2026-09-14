import Foundation

/// Client for allternit-api's bot desktop routes
/// (`cmd/allternit-api/src/bot_desktop_routes.rs`, mounted under
/// `/api/v1/bots/:bot_id/desktop`). Shapes mirror the web client
/// (surfaces/ai.allternit.com/src/lib/bots/vm-operator.ts:
/// `getBotDesktopStatus`, `provisionBotDesktop`, `observeBotDesktop`,
/// `takeOverBotDesktop`, `handBackBotDesktop`).
///
/// Goes through `APIClient.shared`'s relay-aware routing like the other
/// platform clients (WebhookTriggersClient idiom). All routes are
/// Clerk-authed and ownership-checked server-side; a 403/503 surfaces as
/// `APIError.httpError` carrying the server's `{error}` body text (e.g. the
/// 503 "No VM driver is configured on this host").
final class BotDesktopClient: @unchecked Sendable {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /api/v1/bots/:bot_id/desktop?sandbox_id=…` →
    /// `DesktopStatusResponse`. `sandbox_id` is a REQUIRED query param
    /// server-side (`DesktopQuery`, bot_desktop_routes.rs:39-43); when no
    /// sandbox id is known yet (never provisioned from this device) the
    /// query is sent empty and the server answers `status: "off"`.
    func status(botId: String, sandboxId: String?) async throws -> BotDesktopStatus {
        try await client.get(
            path: "bots/\(Self.escape(botId))/desktop\(Self.sandboxQuery(sandboxId))"
        )
    }

    /// `POST /api/v1/bots/:bot_id/desktop/provision` →
    /// `ProvisionDesktopResponse`. Idempotent — an already-active sandbox is
    /// returned as-is (bot_desktop_routes.rs:149-160). 503 when the host has
    /// no desktop-capable VM driver.
    func provision(botId: String) async throws -> BotDesktopProvisionResponse {
        try await client.post(
            path: "bots/\(Self.escape(botId))/desktop/provision",
            body: EmptyBody()
        )
    }

    /// `POST …/desktop/observe?sandbox_id=…` — human watches without
    /// pausing the bot → `{control_state: "human_observing"}`.
    func observe(botId: String, sandboxId: String) async throws -> BotDesktopControlResponse {
        try await client.post(
            path: "bots/\(Self.escape(botId))/desktop/observe\(Self.sandboxQuery(sandboxId))",
            body: EmptyBody()
        )
    }

    /// `POST …/desktop/take-over?sandbox_id=…` — human drives; the bot's
    /// autonomous computer use pauses → `{control_state: "human_controls"}`.
    func takeOver(botId: String, sandboxId: String) async throws -> BotDesktopControlResponse {
        try await client.post(
            path: "bots/\(Self.escape(botId))/desktop/take-over\(Self.sandboxQuery(sandboxId))",
            body: EmptyBody()
        )
    }

    /// `POST …/desktop/hand-back?sandbox_id=…` — control returns to the bot
    /// → `{control_state: "bot_controls"}`.
    func handBack(botId: String, sandboxId: String) async throws -> BotDesktopControlResponse {
        try await client.post(
            path: "bots/\(Self.escape(botId))/desktop/hand-back\(Self.sandboxQuery(sandboxId))",
            body: EmptyBody()
        )
    }

    /// The control routes carry no JSON body; `APIClient.post(path:body:)`
    /// requires one, so an empty object is sent (BrainsClient idiom).
    private struct EmptyBody: Encodable {}

    /// `?sandbox_id=…` suffix — the value is percent-encoded here because
    /// `APIClient.authorizedRequest(path:)` treats a `?query` suffix as
    /// already-encoded (see its doc comment).
    private static func sandboxQuery(_ sandboxId: String?) -> String {
        let value = sandboxId?.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return "?sandbox_id=\(value)"
    }

    /// Web uses `encodeURIComponent` on path ids (parity with
    /// WebhookTriggersClient/CronClient/PtyClient).
    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }
}
