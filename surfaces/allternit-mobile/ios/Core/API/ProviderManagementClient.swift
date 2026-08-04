import Foundation

/// Client for the provider/engine management endpoints used by Model Management.
@MainActor
final class ProviderManagementClient: @unchecked Sendable {
    static let shared = ProviderManagementClient()

    func listProviders() async throws -> [ProviderInfo] {
        let response: ProviderListResponse = try await APIClient.shared.get(path: "providers")
        return response.providers
    }

    func listAuthStatus() async throws -> [ProviderAuthStatus] {
        let response: AuthStatusListResponse = try await APIClient.shared.get(path: "providers/auth/status")
        return response.providers
    }

    func ollamaLiveStatus() async throws -> OllamaLiveStatus {
        try await APIClient.shared.get(path: "provider/ollama/status")
    }
}

private struct ProviderListResponse: Decodable {
    let providers: [ProviderInfo]
}

private struct AuthStatusListResponse: Decodable {
    let providers: [ProviderAuthStatus]
}
