import Foundation

/// One provider/engine row from `GET /api/v1/providers` (provider_routes.rs).
struct ProviderInfo: Decodable, Sendable, Identifiable {
    let id: String
    let name: String
    let providerType: String
    let baseUrl: String?
    let apiKeySet: Bool
    let models: [String]
    let status: String

    private enum CodingKeys: String, CodingKey {
        case id, name, models, status
        case providerType = "provider_type"
        case baseUrl = "base_url"
        case apiKeySet = "api_key_set"
    }

    var isLocal: Bool { providerType == "local" }
    var isSubprocess: Bool { providerType == "subprocess" }

    var kindLabel: String {
        if isLocal { return "Local" }
        if isSubprocess { return "CLI" }
        return "Cloud"
    }

    var isReady: Bool {
        status == "active" || status == "ok" || status == "online"
    }
}

/// Auth status row from `GET /api/v1/providers/auth/status`.
struct ProviderAuthStatus: Decodable, Sendable, Identifiable {
    var id: String { providerId }
    let providerId: String
    let status: String
    let authenticated: Bool

    private enum CodingKeys: String, CodingKey {
        case providerId = "provider_id"
        case status
        case authenticated
    }
}

/// Ollama live probe response from `GET /api/v1/provider/ollama/status`.
struct OllamaLiveStatus: Decodable, Sendable {
    let running: Bool
    let models: [String]
}
