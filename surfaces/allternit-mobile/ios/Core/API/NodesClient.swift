import Foundation

/// Gateway client for the Nodes endpoints — `/api/v1/nodes/*`.
///
/// Mirrors the web `views/nodes/hooks/useNodes.ts` operations: list, delete,
/// and generate a join token.
final class NodesClient: @unchecked Sendable {
    func fetchNodes() async throws -> NodesResponse {
        try await APIClient.shared.get(path: "nodes")
    }

    func deleteNode(nodeId: String) async throws {
        let escaped = nodeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? nodeId
        try await APIClient.shared.delete(path: "nodes/\(escaped)")
    }

    func generateToken() async throws -> NodeTokenResponse {
        try await APIClient.shared.post(path: "nodes/token", body: [String: String]())
    }
}
