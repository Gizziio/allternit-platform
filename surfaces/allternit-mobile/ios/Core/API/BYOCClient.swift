import Foundation

/// Gateway client for Enterprise BYOC endpoints.
///
/// Mirrors the web's `lib/enterprise-usage.ts` + `lib/design/cloud-credentials.ts`:
/// user profile, usage summary, and cloud-credential CRUD.
final class BYOCClient: @unchecked Sendable {
    func fetchCurrentUserProfile() async throws -> CurrentUserProfile {
        let envelope: ProfileEnvelope = try await APIClient.shared.get(path: "me")
        return envelope.user
    }

    func fetchUsageSummary(organizationId: String, periodStart: String, periodEnd: String) async throws -> EnterpriseUsageSummary {
        var components = URLComponents()
        components.path = "usage/summary"
        components.queryItems = [
            URLQueryItem(name: "organization_id", value: organizationId),
            URLQueryItem(name: "period_start", value: periodStart),
            URLQueryItem(name: "period_end", value: periodEnd),
        ]
        guard let pathWithQuery = components.url?.absoluteString else {
            throw URLError(.badURL)
        }
        return try await APIClient.shared.get(path: pathWithQuery)
    }

    func listCloudCredentials() async throws -> [CloudCredential] {
        let envelope: CloudCredentialsEnvelope = try await APIClient.shared.get(path: "cloud-credentials")
        return envelope.cloudCredentials
    }

    func createCloudCredential(_ request: CloudCredentialCreateRequest) async throws -> CloudCredential {
        try await APIClient.shared.post(path: "cloud-credentials", body: request)
    }

    func revokeCloudCredential(id: String) async throws {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        try await APIClient.shared.delete(path: "cloud-credentials/\(escaped)")
    }

    func testCloudCredential(_ request: CloudCredentialTestRequest) async throws -> CloudCredentialTestResult {
        let url = AppConfig.apiBaseURL.appendingPathComponent("v1/cloud-credentials/test")
        var urlRequest = try await APIClient.shared.authorizedRequest(url: url, method: "POST")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        let (data, response) = try await APIClient.shared.session.data(for: urlRequest)
        try APIClient.shared.validate(response, data: data)
        return try JSONDecoder().decode(CloudCredentialTestResult.self, from: data)
    }
}

private struct ProfileEnvelope: Decodable {
    let user: CurrentUserProfile
}

private struct CloudCredentialsEnvelope: Decodable {
    let cloudCredentials: [CloudCredential]

    enum CodingKeys: String, CodingKey {
        case cloudCredentials = "cloud_credentials"
    }
}
