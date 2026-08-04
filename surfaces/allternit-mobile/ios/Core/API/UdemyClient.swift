import Foundation

/// Client for the Udemy catalog proxy (`cmd/allternit-api/src/udemy_routes.rs`).
/// Route: `POST /api/v1/udemy/search`.
final class UdemyClient: @unchecked Sendable {
    static let shared = UdemyClient()

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// Searches Udemy's public catalog through the Allternit proxy.
    func search(
        query: String,
        page: Int = 1,
        pageSize: Int = 50,
        price: String = "free",
        level: String? = nil
    ) async throws -> UdemySearchResponse {
        var body: [String: AnyEncodable] = [
            "query": AnyEncodable(query),
            "page": AnyEncodable(page),
            "page_size": AnyEncodable(pageSize),
            "price": AnyEncodable(price)
        ]
        if let level {
            body["level"] = AnyEncodable(level)
        }
        return try await client.post(path: "udemy/search", body: body)
    }
}

/// Small wrapper so a heterogeneous dictionary can be JSON-encoded.
private struct AnyEncodable: Encodable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let double = value as? Double {
            try container.encode(double)
        } else {
            try container.encode(String(describing: value))
        }
    }
}
