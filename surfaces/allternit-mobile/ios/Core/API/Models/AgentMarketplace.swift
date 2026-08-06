import Foundation

// -----------------------------------------------------------------------------
// Agent marketplace — publish/browse/search/install/rate shared agents
// (PalsHub-equivalent, agent_routes.rs's "agent marketplace" section,
// V35__agent_marketplace.sql). Field names mirror the Rust serde names.
// -----------------------------------------------------------------------------

struct MarketplaceListing: Decodable, Sendable, Identifiable, Equatable {
    let id: String
    let title: String
    let description: String
    let category: String?
    let tags: [String]
    let publisherUserId: String
    let publisherName: String?
    let ratingAvg: Double
    let ratingCount: Int
    let installCount: Int
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, category, tags
        case publisherUserId = "publisher_user_id"
        case publisherName = "publisher_name"
        case ratingAvg = "rating_avg"
        case ratingCount = "rating_count"
        case installCount = "install_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        description = try container.decode(String.self, forKey: .description)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        tags = ((try? container.decodeIfPresent([String].self, forKey: .tags)) ?? nil) ?? []
        publisherUserId = try container.decode(String.self, forKey: .publisherUserId)
        publisherName = try container.decodeIfPresent(String.self, forKey: .publisherName)
        ratingAvg = try container.decodeIfPresent(Double.self, forKey: .ratingAvg) ?? 0
        ratingCount = try container.decodeIfPresent(Int.self, forKey: .ratingCount) ?? 0
        installCount = try container.decodeIfPresent(Int.self, forKey: .installCount) ?? 0
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
    }
}

struct MarketplaceRating: Decodable, Sendable, Identifiable, Equatable {
    let userId: String
    let reviewerName: String?
    let rating: Int
    let review: String?
    let createdAt: String

    var id: String { userId }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case reviewerName = "reviewer_name"
        case rating, review
        case createdAt = "created_at"
    }
}

struct MarketplaceListingDetail: Decodable, Sendable {
    let listing: MarketplaceListing
    let ratings: [MarketplaceRating]
}

struct MarketplaceListingListResponse: Decodable, Sendable {
    let listings: [MarketplaceListing]
}

struct PublishAgentRequest: Encodable, Sendable {
    let sourceAgentId: String
    let title: String
    let description: String
    let category: String?
    let tags: [String]?

    enum CodingKeys: String, CodingKey {
        case sourceAgentId = "source_agent_id"
        case title, description, category, tags
    }
}

struct PublishListingResponse: Decodable, Sendable {
    struct ListingRef: Decodable, Sendable { let id: String }
    let listing: ListingRef
}

struct InstallListingResponse: Decodable, Sendable {
    struct AgentRef: Decodable, Sendable { let id: String }
    let agent: AgentRef
}

struct RateListingRequest: Encodable, Sendable {
    let rating: Int
    let review: String?
}
