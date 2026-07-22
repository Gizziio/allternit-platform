import Foundation

/// Client for the real Allternit-owned connector standard
/// (`cmd/allternit-api/src/connector_routes.rs`): a 181-entry catalog +
/// per-user connection state, curated github/notion/slack with real mapped
/// OAuth endpoints, everything else honestly reporting what's missing rather
/// than pretending to connect.
final class ConnectorsClient: @unchecked Sendable {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /api/v1/connectors` — the full catalog + this user's connection
    /// status for each row.
    func listConnectors() async throws -> [Connector] {
        let response: ConnectorListResponse = try await client.get(path: "connectors")
        return response.connectors
    }

    /// Body of `POST /api/v1/connectors/:id/connect`
    /// (`connector_routes.rs:614-617`). `via` is left nil — the backend
    /// already defaults it to the connector's own `auth_type`
    /// (`connector_routes.rs:639-644`), so the client never needs to guess
    /// which auth flow a given connector uses.
    private struct ConnectRequestBody: Encodable {
        let apiKey: String?
        enum CodingKeys: String, CodingKey { case apiKey = "api_key" }
    }

    /// Starts (or completes, for api-key connectors) a connection. The
    /// response `status`/`message`/`authorize_url` vary by auth type and
    /// mapping state — the caller renders whatever came back rather than
    /// assuming success (see `ConnectResponse`'s doc comment).
    func connect(id: String, apiKey: String? = nil) async throws -> ConnectResponse {
        try await client.post(path: "connectors/\(Self.escape(id))/connect", body: ConnectRequestBody(apiKey: apiKey))
    }

    /// `DELETE /api/v1/connectors/:id/disconnect`.
    func disconnect(id: String) async throws {
        try await client.delete(path: "connectors/\(Self.escape(id))/disconnect")
    }

    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }
}
