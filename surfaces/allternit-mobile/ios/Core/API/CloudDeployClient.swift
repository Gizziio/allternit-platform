import Foundation

/// Gateway client for Cloud Deploy — `/api/v1/deployments/*`.
///
/// Mirrors the web `views/cloud-deploy/lib/api-client.ts`: list, create,
/// status, and cancel deployments.
final class CloudDeployClient: @unchecked Sendable {
    func listDeployments() async throws -> [Deployment] {
        try await APIClient.shared.get(path: "deployments")
    }

    func createDeployment(_ request: DeploymentCreateRequest) async throws -> Deployment {
        try await APIClient.shared.post(path: "deployments", body: request)
    }

    func fetchDeploymentStatus(id: String) async throws -> Deployment {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return try await APIClient.shared.get(path: "deployments/\(escaped)")
    }

    func cancelDeployment(id: String) async throws {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        try await APIClient.shared.delete(path: "deployments/\(escaped)/cancel")
    }
}
