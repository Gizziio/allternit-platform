import Foundation

@MainActor
final class MarketplaceStore: ObservableObject {
    static let shared = MarketplaceStore()

    @Published private(set) var listings: [MarketplaceListing] = []
    @Published private(set) var isLoading = false
    @Published var error: String? = nil

    private let client: AgentMarketplaceClient

    init(client: AgentMarketplaceClient = .shared) {
        self.client = client
    }

    func search(query: String? = nil, category: String? = nil) {
        isLoading = true
        error = nil
        Task {
            do {
                listings = try await client.listListings(query: query, category: category)
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }

    func publish(sourceAgentId: String, title: String, description: String, category: String?, tags: [String]) async throws {
        let cleanedTags = tags.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        try await client.publish(
            sourceAgentId: sourceAgentId, title: title, description: description,
            category: category, tags: cleanedTags.isEmpty ? nil : cleanedTags
        )
        search()
    }

    /// Installs a listing, then refreshes the agent hub so the new agent
    /// shows up immediately without a manual pull-to-refresh.
    @discardableResult
    func install(listingId: String) async throws -> String {
        let agentId = try await client.install(id: listingId)
        AgentHubStore.shared.fetchAgentsIfNeeded(force: true)
        search()
        return agentId
    }

    func rate(listingId: String, rating: Int, review: String?) async throws {
        try await client.rate(id: listingId, rating: rating, review: review)
    }
}
