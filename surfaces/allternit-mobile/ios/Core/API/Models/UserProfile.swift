import Foundation

/// Current user profile returned by `GET /api/v1/me` (me_routes.rs).
struct UserProfile: Decodable, Sendable, Identifiable {
    let id: String
    let clerkId: String?
    let email: String
    let name: String?
    let avatarUrl: String?
    let role: String
    let status: String
    let createdAt: String
    let organizationId: String?
    let organizationRole: String?

    private enum CodingKeys: String, CodingKey {
        case id, email, name, role, status
        case clerkId = "clerk_id"
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
        case organizationId = "organization_id"
        case organizationRole = "organization_role"
    }

    var displayName: String {
        let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? email : trimmed
    }

    var hasOrganization: Bool {
        organizationId?.isEmpty == false
    }
}
