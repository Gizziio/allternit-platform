import Foundation

/// Gateway client for SSH connections — `/api/v1/ssh-connections/*`.
///
/// Mirrors the web `api/infrastructure/ssh.ts`: list, create, delete, test,
/// connect, and disconnect VPS/SSH connections.
final class SSHConnectionsClient: @unchecked Sendable {
    func listConnections() async throws -> [SSHConnection] {
        try await APIClient.shared.get(path: "ssh-connections")
    }

    func createConnection(_ request: SSHConnectionCreateRequest) async throws -> SSHConnection {
        try await APIClient.shared.post(path: "ssh-connections", body: request)
    }

    func deleteConnection(id: String) async throws {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        try await APIClient.shared.delete(path: "ssh-connections/\(escaped)")
    }

    func testConnection(_ request: SSHConnectionCreateRequest) async throws -> SSHConnectionTestResponse {
        try await APIClient.shared.post(path: "ssh-connections/test", body: request)
    }

    func connect(id: String) async throws -> SSHConnection {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return try await APIClient.shared.post(path: "ssh-connections/\(escaped)/connect", body: [String: String]())
    }

    func disconnect(id: String) async throws -> SSHConnection {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return try await APIClient.shared.post(path: "ssh-connections/\(escaped)/disconnect", body: [String: String]())
    }
}
