import Foundation

/// Client for allternit-api's bot event ledger routes
/// (`cmd/allternit-api/src/bot_event_routes.rs`, mounted at
/// `/api/v1/bots/:id/events` and `/api/v1/bots/:id/operational-state`).
///
/// Goes through `APIClient.shared`'s relay-aware routing like the other
/// platform clients (WebhookTriggersClient idiom). Shapes mirror the web
/// client (surfaces/ai.allternit.com/src/lib/bots/bot-activity-api.ts).
final class BotEventsClient: @unchecked Sendable {
    static let shared = BotEventsClient()

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /api/v1/bots/:id/events?after_sequence=&limit=&event_types=` →
    /// `{events, nextCursor?, hasMore}`, ascending by per-bot `sequence`.
    /// The server defaults `limit` to 50 and clamps to 200
    /// (bot_event_routes.rs `DEFAULT_PAGE_LIMIT` / `MAX_PAGE_LIMIT`).
    func fetchEvents(
        botId: String,
        afterSequence: Int? = nil,
        limit: Int = 50,
        eventTypes: [String] = []
    ) async throws -> BotEventPage {
        var queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        if let afterSequence {
            queryItems.append(URLQueryItem(name: "after_sequence", value: String(afterSequence)))
        }
        if !eventTypes.isEmpty {
            queryItems.append(URLQueryItem(name: "event_types", value: eventTypes.joined(separator: ",")))
        }
        var components = URLComponents()
        components.queryItems = queryItems
        // `APIClient.authorizedRequest` splits the path on "?" and applies
        // `percentEncodedQuery`, so the query rides along in the path.
        let query = components.percentEncodedQuery ?? ""
        return try await client.get(path: "bots/\(Self.escape(botId))/events?\(query)")
    }

    /// `GET /api/v1/bots/:id/operational-state` → the compute-on-read
    /// `BotOperationalState` projection (bot_event_routes.rs
    /// `fold_operational_state`).
    func fetchOperationalState(botId: String) async throws -> BotOperationalState {
        try await client.get(path: "bots/\(Self.escape(botId))/operational-state")
    }

    /// Same path-safety insurance as AgentEventsClient.escape.
    private static func escape(_ botId: String) -> String {
        botId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? botId
    }
}
