import Foundation

/// Client for the agent marketplace (`/api/v1/agent-marketplace/*`,
/// agent_routes.rs). Mirrors AgentClient's shape.
final class AgentMarketplaceClient: @unchecked Sendable {
    static let shared = AgentMarketplaceClient()

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /agent-marketplace/listings?q=&category=`.
    func listListings(query: String? = nil, category: String? = nil) async throws -> [MarketplaceListing] {
        var path = "agent-marketplace/listings"
        var components: [String] = []
        if let query, !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let escaped = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
            components.append("q=\(escaped)")
        }
        if let category {
            let escaped = category.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? category
            components.append("category=\(escaped)")
        }
        if !components.isEmpty {
            path += "?" + components.joined(separator: "&")
        }
        let response: MarketplaceListingListResponse = try await client.get(path: path)
        return response.listings
    }

    /// `GET /agent-marketplace/listings/:id` — listing detail + recent ratings.
    func getListing(id: String) async throws -> MarketplaceListingDetail {
        try await client.get(path: "agent-marketplace/listings/\(Self.escape(id))")
    }

    /// `POST /agent-marketplace/listings` — publish a snapshot of one of the
    /// caller's own agents.
    @discardableResult
    func publish(sourceAgentId: String, title: String, description: String, category: String? = nil, tags: [String]? = nil) async throws -> String {
        let response: PublishListingResponse = try await client.post(
            path: "agent-marketplace/listings",
            body: PublishAgentRequest(sourceAgentId: sourceAgentId, title: title, description: description, category: category, tags: tags)
        )
        return response.listing.id
    }

    /// `DELETE /agent-marketplace/listings/:id` — unpublish (publisher only).
    func unpublish(id: String) async throws {
        try await client.delete(path: "agent-marketplace/listings/\(Self.escape(id))")
    }

    /// `POST /agent-marketplace/listings/:id/install` — clones the snapshot
    /// into a new agent the calling user owns; returns its id.
    @discardableResult
    func install(id: String) async throws -> String {
        let response: InstallListingResponse = try await client.post(
            path: "agent-marketplace/listings/\(Self.escape(id))/install",
            body: EmptyBody()
        )
        return response.agent.id
    }

    /// `POST /agent-marketplace/listings/:id/rate` — upserts the caller's
    /// own rating (re-rating replaces the previous one, never duplicates).
    func rate(id: String, rating: Int, review: String? = nil) async throws {
        try await client.post(
            path: "agent-marketplace/listings/\(Self.escape(id))/rate",
            body: RateListingRequest(rating: rating, review: review)
        )
    }

    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }

    private struct EmptyBody: Encodable {}
}
