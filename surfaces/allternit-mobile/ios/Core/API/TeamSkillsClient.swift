import Foundation

/// Client for the team-skills API (`cmd/allternit-api/src/team_skill_routes.rs`).
/// Routes live under `/api/v1/team-skills` on `allternit-api`.
final class TeamSkillsClient: @unchecked Sendable {
    static let shared = TeamSkillsClient()

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /api/v1/team-skills` — skills from all accessible workspaces,
    /// newest first.
    func listSkills() async throws -> [TeamSkill] {
        let response: TeamSkillListResponse = try await client.get(path: "team-skills")
        return response.skills
    }

    /// Lists team skills for a workspace, or all accessible skills when no
    /// workspace is provided (`{ skills: [...] }`).
    func listSkills(workspaceId: String? = nil) async throws -> [TeamSkill] {
        let path: String
        if let workspaceId {
            let escaped = workspaceId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? workspaceId
            path = "team-skills?workspaceId=\(escaped)"
        } else {
            path = "team-skills"
        }
        let response: TeamSkillListResponse = try await client.get(path: path)
        return response.skills
    }

    /// Creates a team skill in the given workspace; returns the new skill id
    /// (`201 { skill: { id, name } }`).
    @discardableResult
    func createSkill(workspaceId: String, name: String, description: String? = nil) async throws -> String {
        let response: CreateTeamSkillResponse = try await client.post(
            path: "team-skills",
            body: CreateTeamSkillBody(
                workspaceId: workspaceId,
                name: name,
                description: description,
                version: "0.0.1"
            )
        )
        return response.skill.id
    }

    /// `DELETE /api/v1/team-skills/:id`.
    func deleteSkill(id: String) async throws {
        try await client.delete(path: "team-skills/\(Self.escape(id))")
    }

    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }
}
