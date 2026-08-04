import Foundation

// -----------------------------------------------------------------------------
// Team Skill REST models — base path /api/v1/team-skills.
//
// Mirrors `cmd/allternit-api/src/team_skill_routes.rs` (`TeamSkillRow`).
// The API emits snake_case keys on the wire; Swift properties stay camelCase
// via explicit CodingKeys.
// -----------------------------------------------------------------------------

/// One team skill (`GET /api/v1/team-skills` → `{skills: [...]}`).
/// Timestamps stay Strings — the SQLite-backed routes emit
/// `YYYY-MM-DD HH:MM:SS` (CURRENT_TIMESTAMP), not RFC-3339.
struct TeamSkill: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let workspaceId: String
    let name: String
    let description: String?
    /// Manifest is stored as a JSON string in the DB; keep it opaque here.
    let manifest: String?
    let sourceRepo: String?
    let version: String
    let installedBy: String
    let installedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, manifest, version
        case workspaceId = "workspace_id"
        case sourceRepo = "source_repo"
        case installedBy = "installed_by"
        case installedAt = "installed_at"
    }
}

/// `GET /api/v1/team-skills` envelope (`{ skills: [...] }`).
struct TeamSkillListResponse: Decodable, Sendable {
    let skills: [TeamSkill]
}

/// `POST /api/v1/team-skills` response (`{ skill: { id, name } }`).
struct CreateTeamSkillResponse: Decodable, Sendable {
    struct Created: Decodable, Sendable {
        let id: String
        let name: String
    }
    let skill: Created
}

/// Body of `POST /api/v1/team-skills`.
struct CreateTeamSkillBody: Encodable, Sendable {
    let workspaceId: String
    let name: String
    let description: String?
    let version: String

    enum CodingKeys: String, CodingKey {
        case name, description, version
        case workspaceId = "workspaceId"
    }
}
