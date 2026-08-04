import Foundation

// ------------------------------------------------------------------------------
// Udemy public course model — mirrors `UdemyPublicCourse` in
// surfaces/ai.allternit.com/src/views/catalog/main/CatalogView.types.ts.
//
// The backend (`cmd/allternit-api/src/udemy_routes.rs`) proxies Udemy's public
// api-2.0/courses/ response; this model reads the snake_case keys directly.
// ------------------------------------------------------------------------------

struct UdemyCourse: Decodable, Sendable, Identifiable, Hashable {
    let id: Int
    let title: String
    let headline: String
    let url: String
    let image240x135: String
    let rating: Double
    let numReviews: Int
    let numSubscribers: Int
    let price: String
    let isPaid: Bool
    let level: String
    let lang: String
    let numLectures: Int
    let publishedTitle: String
    let category: String?
    let topics: [String]?

    enum CodingKeys: String, CodingKey {
        case id, title, headline, url, rating, price, level, lang, category, topics
        case image240x135 = "image_240x135"
        case numReviews = "num_reviews"
        case numSubscribers = "num_subscribers"
        case numLectures = "num_lectures"
        case publishedTitle = "published_title"
        case isPaid = "is_paid"
    }
}

/// `POST /api/v1/udemy/search` response shape (`{ count, next, previous, results }`).
struct UdemySearchResponse: Decodable, Sendable {
    let count: Int
    let next: String?
    let previous: String?
    let results: [UdemyCourse]
}
