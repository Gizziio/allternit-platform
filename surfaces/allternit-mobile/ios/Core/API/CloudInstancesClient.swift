import Foundation

/// Cloud-API client for the BYO-VPS deployment wizard.
///
/// Mirrors the web `views/settings/CloudInstancesPanel.tsx` calls to
/// `/api/v1/cloud/wizard/deployments*` on `AppConfig.cloudAPIBaseURL`.
final class CloudInstancesClient: @unchecked Sendable {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = AppConfig.cloudAPIBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func listSessions() async throws -> [CloudWizardSession] {
        let url = baseURL.appendingPathComponent("api/v1/cloud/wizard/deployments")
        return try await fetch(url: url)
    }

    func startSession(_ request: CloudWizardStartRequest) async throws -> CloudWizardSession {
        let url = baseURL.appendingPathComponent("api/v1/cloud/wizard/deployments")
        return try await post(url: url, body: request)
    }

    func fetchSession(id: String) async throws -> CloudWizardSession {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = baseURL.appendingPathComponent("api/v1/cloud/wizard/deployments/\(escaped)")
        return try await fetch(url: url)
    }

    func advanceSession(id: String) async throws -> CloudWizardSession {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = baseURL.appendingPathComponent("api/v1/cloud/wizard/deployments/\(escaped)/advance")
        return try await post(url: url, body: [String: String]())
    }

    func bootstrapSession(id: String) async throws -> CloudBootstrapResult {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = baseURL.appendingPathComponent("api/v1/cloud/wizard/deployments/\(escaped)/bootstrap")
        return try await post(url: url, body: [String: String]())
    }

    func cancelSession(id: String) async throws {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = baseURL.appendingPathComponent("api/v1/cloud/wizard/deployments/\(escaped)/cancel")
        _ = try await post(url: url, body: [String: String]())
    }

    func deleteSession(id: String) async throws {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = baseURL.appendingPathComponent("api/v1/cloud/wizard/deployments/\(escaped)")
        let request = try await APIClient.shared.authorizedRequest(url: url, method: "DELETE")
        let (_, response) = try await session.data(for: request)
        try APIClient.shared.validate(response, data: Data())
    }

    // MARK: - Helpers

    private func fetch<T: Decodable>(url: URL) async throws -> T {
        let request = try await APIClient.shared.authorizedRequest(url: url)
        let (data, response) = try await session.data(for: request)
        try APIClient.shared.validate(response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func post<T: Decodable, B: Encodable>(url: URL, body: B) async throws -> T {
        var request = try await APIClient.shared.authorizedRequest(url: url, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        try APIClient.shared.validate(response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }
}
