import Foundation

/// One row of `GET /api/v1/connectors` (`connector_routes.rs` `merge()` /
/// `merge_sidecar()`): the 181-entry owned catalog + per-user connection
/// state. Only the fields this client actually renders are decoded — the
/// wire carries more (auth details, setup hints for unmapped OAuth apps,
/// local-CLI availability) that the UI doesn't need yet.
struct Connector: Decodable, Sendable, Identifiable {
    let id: String
    let name: String
    let category: String?
    let description: String?
    let connectable: Bool
    let executable: Bool
    let authType: String?
    let connection: ConnectionState

    struct ConnectionState: Decodable, Sendable {
        /// "connected" | "disconnected" (`connector_routes.rs:381`).
        let status: String
        let account: String?
    }

    enum CodingKeys: String, CodingKey {
        case id, name, category, description, connectable, executable
        case authType = "auth_type"
        case connection
    }

    var isConnected: Bool { connection.status == "connected" }
}

/// `GET /api/v1/connectors` envelope (`connector_routes.rs:568-574`).
struct ConnectorListResponse: Decodable, Sendable {
    let connectors: [Connector]
    let total: Int
}

/// `POST /api/v1/connectors/:id/connect` response. Every code path in
/// `connect_connector` (oauth2 / api_key / local_cli / device_flow, mapped or
/// not) returns a `status` string plus a human `message` — never a fixed
/// shape — so this decodes permissively and the client renders whatever the
/// backend actually said instead of assuming a specific flow succeeded.
struct ConnectResponse: Decodable, Sendable {
    let status: String?
    let message: String?
    let error: String?
    /// Present only for `status == "authorization_required"`
    /// (`connector_routes.rs:1758`) — open in-browser to complete OAuth.
    let authorizeURL: String?

    enum CodingKeys: String, CodingKey {
        case status, message, error
        case authorizeURL = "authorize_url"
    }
}
