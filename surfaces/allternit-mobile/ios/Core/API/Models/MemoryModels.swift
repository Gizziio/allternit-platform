import Foundation

/// A row of `GET /api/v1/memory/documents`
/// (cmd/allternit-api/src/memory_routes.rs — `MemoryDoc`). Field casing is
/// snake_case on the wire, matching the rusqlite column names.
struct MemoryDocument: Decodable, Sendable, Identifiable {
    let id: String
    let agentId: String?
    let title: String
    let sourceType: String
    let sourceUrl: String?
    let chunkCount: Int
    let isIndexed: Bool
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case agentId = "agent_id"
        case title
        case sourceType = "source_type"
        case sourceUrl = "source_url"
        case chunkCount = "chunk_count"
        case isIndexed = "is_indexed"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// `GET /api/v1/memory/stats` — counts across the memory stores. `memories`
/// is a nested `{ "total": N }` object on the wire; every field is optional
/// so older/newer builds with partial shapes still decode.
struct MemoryStats: Decodable, Sendable {
    let connections: Int?
    let insights: Int?
    let memories: MemoryCount?
    let vectors: Int?

    struct MemoryCount: Decodable, Sendable {
        let total: Int?
    }

    /// Flattened totals for the settings header.
    var memoryTotal: Int { memories?.total ?? 0 }
}

/// `GET /api/v1/memory/health` — subsystem reachability. Only `status` is
/// read by the UI ("healthy" / "degraded").
struct MemoryHealth: Decodable, Sendable {
    let status: String?
}
