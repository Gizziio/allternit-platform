import Foundation

/// Client for the workspace API (`cmd/allternit-api/src/workspace_routes.rs`).
/// Routes live under `/api/v1/workspaces` on `allternit-api`.
final class WorkspaceClient: @unchecked Sendable {
    static let shared = WorkspaceClient()

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// Lists workspaces the signed-in user owns or is a member of
    /// (`{ workspaces: [...] }`).
    func listWorkspaces() async throws -> [Workspace] {
        let response: WorkspaceListResponse = try await client.get(path: "workspaces")
        return response.workspaces
    }
}
