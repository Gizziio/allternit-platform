import Foundation

/// Client for organization-scoped self-service: profile + personal-org creation.
@MainActor
final class OrganizationClient: @unchecked Sendable {
    static let shared = OrganizationClient()

    /// Fetches the current user's profile, including resolved organization info.
    func fetchProfile() async throws -> UserProfile {
        let envelope: UserProfileEnvelope = try await APIClient.shared.get(path: "me")
        return envelope.user
    }

    /// Creates a personal organization for self-hosted/no-Clerk-key builds.
    /// Returns the organization id. A no-op (created: false) if one exists.
    func createPersonalOrganization() async throws -> String {
        let response: CreateOrganizationResponse = try await APIClient.shared.post(path: "me/organization", body: EmptyBody())
        return response.organizationId
    }
}

private struct UserProfileEnvelope: Decodable {
    let user: UserProfile
}

private struct CreateOrganizationResponse: Decodable {
    let organizationId: String

    private enum CodingKeys: String, CodingKey {
        case organizationId = "organization_id"
    }
}

private struct EmptyBody: Encodable {}
