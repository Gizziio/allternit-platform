import Foundation

/// Gateway client for team skills — `GET /api/v1/team-skills` on
/// allternit-api (cmd/allternit-api/src/team_skill_routes.rs). Like the
/// projects client, requests go through `APIClient.shared` against
/// `AppConfig.apiBaseURL` with the Clerk Bearer.
final class TeamSkillsClient: @unchecked Sendable {
    /// `GET /api/v1/team-skills` — skills from all accessible workspaces,
    /// newest first.
    func listSkills() async throws -> [TeamSkill] {
        let request = try await APIClient.shared.authorizedRequest(path: "team-skills")
        let (data, response) = try await APIClient.shared.session.data(for: request)
        try APIClient.shared.validate(response, data: data)
        do {
            return try JSONDecoder().decode(TeamSkillListResponse.self, from: data).skills
        } catch {
            throw APIError.decoding(error)
        }
    }
}
