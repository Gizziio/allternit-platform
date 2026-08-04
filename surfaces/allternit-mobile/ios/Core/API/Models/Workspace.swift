import Foundation

// ------------------------------------------------------------------------------
// Workspace REST models — base path /api/v1/workspaces.
//
// Mirrors `cmd/allternit-api/src/workspace_routes.rs` (`WorkspaceRow`).
// The API emits snake_case keys; Swift properties stay camelCase via explicit
// CodingKeys.
// ------------------------------------------------------------------------------

/// One workspace (`GET /api/v1/workspaces` → `{workspaces: [...]}`).
struct Workspace: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let name: String
    let slug: String
    let ownerId: String
    let description: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, slug, description
        case ownerId = "owner_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// `GET /api/v1/workspaces` envelope (`{ workspaces: [...] }`).
struct WorkspaceListResponse: Decodable, Sendable {
    let workspaces: [Workspace]
}
