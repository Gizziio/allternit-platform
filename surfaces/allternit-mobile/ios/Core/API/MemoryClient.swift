import Foundation

/// Client for the memory API (`cmd/allternit-api/src/memory_routes.rs`):
/// stats, health, and the document list.
final class MemoryClient: @unchecked Sendable {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /api/v1/memory/stats` → `{ connections, insights, memories: { total }, vectors }`.
    func stats() async throws -> MemoryStats {
        try await client.get(path: "memory/stats")
    }

    /// `GET /api/v1/memory/health` → `{ status, memory: {...} }`.
    func health() async throws -> MemoryHealth {
        try await client.get(path: "memory/health")
    }

    /// `GET /api/v1/memory/documents` → `[MemoryDoc]` (a bare array, newest
    /// `updated_at` first).
    func listDocuments() async throws -> [MemoryDocument] {
        try await client.get(path: "memory/documents")
    }

    /// `POST /api/v1/memory/query` — semantic search. The settings UI
    /// searches the already-fetched document list client-side instead; this
    /// is kept for callers that want the server-side semantic query.
    func query(_ text: String) async throws -> [MemoryDocument] {
        try await client.post(path: "memory/query", body: QueryBody(query: text))
    }

    private struct QueryBody: Encodable {
        let query: String
    }
}
