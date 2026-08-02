import Foundation

/// Response of `POST /api/v1/brains` (cmd/allternit-api/src/brain_routes.rs,
/// phase D2): a freshly provisioned hosted brain remote. `clone_url` already
/// includes the `/git` suffix of the smart-HTTP routes.
struct BrainProvision: Decodable, Sendable {
    let brainID: String
    let cloneURL: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case brainID = "brain_id"
        case cloneURL = "clone_url"
        case createdAt = "created_at"
    }
}

/// Response of `POST /api/v1/tokens/git`: an `allternit_git_<32hex>` token,
/// shown exactly once — callers must persist it (BrainStore does). Used as
/// the HTTP Basic password (any username) on the brain smart-HTTP routes.
struct GitToken: Decodable, Sendable {
    let id: String
    let token: String
    let note: String?
}

/// Client for the brain API (`cmd/allternit-api/src/brain_routes.rs`, phase
/// D2): hosted-brain provisioning and git-token minting. Clerk Bearer auth is
/// attached automatically by APIClient.
final class BrainsClient: @unchecked Sendable {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `POST /api/v1/brains` with an empty body → 201 `{ brain_id, clone_url,
    /// created_at }`.
    func provisionBrain() async throws -> BrainProvision {
        try await client.post(path: "brains", body: EmptyBody())
    }

    /// `POST /api/v1/tokens/git` → 201 `{ id, token, note }`.
    func mintGitToken(name: String) async throws -> GitToken {
        try await client.post(path: "tokens/git", body: TokenBody(name: name))
    }

    private struct EmptyBody: Encodable {}
    private struct TokenBody: Encodable {
        let name: String
    }
}
