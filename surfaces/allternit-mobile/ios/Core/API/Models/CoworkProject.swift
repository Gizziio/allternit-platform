import Foundation

// -----------------------------------------------------------------------------
// Cowork projects REST models — base path /api/v1/cowork/projects.
//
// Mirrors the Rust producers in cmd/allternit-api/src/cowork_routes.rs
// (`ProjectRow`, `ProjectFileRow`). The API emits snake_case keys on the wire;
// Swift properties stay camelCase via explicit CodingKeys.
// -----------------------------------------------------------------------------

// MARK: - Project record

/// One cowork project (`GET /api/v1/cowork/projects` → `{projects: [...]}`).
/// Timestamps stay Strings — the SQLite-backed routes emit
/// `YYYY-MM-DD HH:MM:SS` (CURRENT_TIMESTAMP), not RFC-3339.
struct CoworkProject: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let userId: String
    let title: String
    let description: String?
    /// Custom instructions injected into the project's chats (Claude iOS
    /// project-instructions parity). Editable via PUT …/projects/:id.
    let instructions: String?
    let gitRemote: String?
    let defaultBranch: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, instructions
        case userId = "user_id"
        case gitRemote = "git_remote"
        case defaultBranch = "default_branch"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// `GET /api/v1/cowork/projects` envelope (`{ projects: [...] }`).
struct CoworkProjectListResponse: Decodable, Sendable {
    let projects: [CoworkProject]
}

/// `POST /api/v1/cowork/projects` response (`{ project: { id } }`).
struct CreateCoworkProjectResponse: Decodable, Sendable {
    struct Created: Decodable, Sendable {
        let id: String
    }
    let project: Created
}

/// Body of `POST /api/v1/cowork/projects` (cowork_routes.rs
/// `CreateProjectBody`).
struct CreateCoworkProjectBody: Encodable, Sendable {
    let title: String
    let description: String?
    let instructions: String?
}

/// Body of `PUT /api/v1/cowork/projects/:id` (cowork_routes.rs
/// `UpdateProjectBody` — every field is a COALESCE'd optional, so nil
/// leaves the stored value untouched).
struct UpdateCoworkProjectBody: Encodable, Sendable {
    let title: String?
    let description: String?
    let instructions: String?
}

// MARK: - Project file records

/// One file attached to a project (`GET …/projects/:id/files` →
/// `{files: [...]}`, cowork_routes.rs `ProjectFileRow`). Metadata only — the
/// blob lives behind `uploadId` (/api/v1/uploads) or an external `url`.
struct CoworkProjectFile: Decodable, Sendable, Identifiable {
    let id: String
    let projectId: String
    let name: String
    let url: String?
    let uploadId: String?
    let mediaType: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, url
        case projectId = "project_id"
        case uploadId = "upload_id"
        case mediaType = "media_type"
        case createdAt = "created_at"
    }
}

/// `GET /api/v1/cowork/projects/:id/files` envelope (`{ files: [...] }`).
struct CoworkProjectFileListResponse: Decodable, Sendable {
    let files: [CoworkProjectFile]
}

/// `POST …/projects/:id/files` response (`{ file: { id } }`).
struct CreateCoworkProjectFileResponse: Decodable, Sendable {
    struct Created: Decodable, Sendable {
        let id: String
    }
    let file: Created
}

/// Body of `POST /api/v1/cowork/projects/:id/files` (cowork_routes.rs
/// `CreateProjectFileBody`) — `{name, url or uploadId, mediaType}`.
struct CreateCoworkProjectFileBody: Encodable, Sendable {
    let name: String
    let url: String?
    let uploadId: String?
    let mediaType: String?

    enum CodingKeys: String, CodingKey {
        case name, url
        case uploadId = "upload_id"
        case mediaType = "media_type"
    }
}
