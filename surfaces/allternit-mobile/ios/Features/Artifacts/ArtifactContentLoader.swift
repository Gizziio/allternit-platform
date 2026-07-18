import Combine
import Foundation

/// Errors specific to artifact content resolution.
enum ArtifactContentError: Error, LocalizedError, Sendable {
    case badURL
    case binaryContent
    case noContentSource

    var errorDescription: String? {
        switch self {
        case .badURL:
            return "The artifact URL is invalid."
        case .binaryContent:
            return "The artifact content is not text."
        case .noContentSource:
            return "The artifact event carried no content, URL, or fetchable id."
        }
    }
}

/// Loads the content of an `ArtifactRecord`.
///
/// The backend has no content-serving endpoint yet — `GET /v1/artifacts/:id`
/// is a stub that always 404s (api/services/replies-runtime/src/index.ts:42),
/// and the `artifact.created` event itself is the content carrier
/// (packages/@allternit/replies-contract). So resolution is a fallback chain
/// over the fields the event can carry, mirroring the web client
/// (timeline-stream.ts), which never fetches artifact content over HTTP:
///
/// 1. `url` — provider-hosted file URL (native `file` stream parts). External
///    http(s) URLs are fetched WITHOUT the Clerk Bearer (never leak the token
///    to a third-party host); gateway-relative paths go through APIClient.
/// 2. `inlinePreview` — full inline content (`<document>` extraction path).
/// 3. `GET artifacts/:artifactId` — the reserved route shape; 404 today, but
///    the call is correct for when the backend fills it in.
/// 4. `.failed` with the last error, or `noContentSource`.
@MainActor
final class ArtifactContentLoader: ObservableObject {
    enum State: Equatable, Sendable {
        case idle
        case loading
        /// Loaded text content; an empty string is a valid "empty artifact".
        case loaded(String)
        case failed(String)
    }

    @Published private(set) var state: State = .idle

    /// The loaded content, if any (drives the details view's copy button).
    var content: String? {
        if case .loaded(let text) = state { return text }
        return nil
    }

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// First load — no-op unless the loader is idle (so re-renders and
    /// re-appearing views don't refetch). Cancellation resets to `.idle`.
    func load(artifact: ArtifactRecord) async {
        guard case .idle = state else { return }
        await resolveAndPublish(artifact)
    }

    /// User-initiated retry from the error state.
    func retry(artifact: ArtifactRecord) async {
        await resolveAndPublish(artifact)
    }

    private func resolveAndPublish(_ artifact: ArtifactRecord) async {
        state = .loading
        do {
            let content = try await resolve(artifact)
            try Task.checkCancellation()
            state = .loaded(content)
        } catch is CancellationError {
            // Sheet dismissed mid-flight; next open starts fresh.
            state = .idle
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    // MARK: - Resolution chain

    private func resolve(_ artifact: ArtifactRecord) async throws -> String {
        var lastError: Error?

        // 1. url (native file artifacts)
        if let urlString = artifact.url?.trimmingCharacters(in: .whitespacesAndNewlines),
           !urlString.isEmpty {
            do {
                return try await fetchURLContent(urlString)
            } catch {
                lastError = error
            }
        }

        // 2. inlinePreview (<document> artifacts — content is already local)
        if let preview = artifact.inlinePreview, !preview.isEmpty {
            return preview
        }

        // 3. GET /v1/artifacts/:artifactId (reserved route shape; 404 stub today)
        if let artifactId = artifact.artifactId, !artifactId.isEmpty {
            do {
                return try await fetchGatewayContent(artifactId: artifactId)
            } catch {
                lastError = error
            }
        }

        throw lastError ?? ArtifactContentError.noContentSource
    }

    /// Fetches `urlString` as UTF-8 text. Absolute http(s) URLs are fetched
    /// with a plain request (external host — no Clerk token); anything else
    /// is treated as a gateway-relative path through the authenticated client.
    private func fetchURLContent(_ urlString: String) async throws -> String {
        guard let url = URL(string: urlString) else {
            throw ArtifactContentError.badURL
        }

        let data: Data
        if url.scheme == "http" || url.scheme == "https" {
            let (externalData, response) = try await client.session.data(from: url)
            try client.validate(response, data: externalData)
            data = externalData
        } else {
            var request = try await client.authorizedRequest(path: urlString)
            request.setValue("*/*", forHTTPHeaderField: "Accept")
            let (gatewayData, response) = try await client.session.data(for: request)
            try client.validate(response, data: gatewayData)
            data = gatewayData
        }

        guard let text = String(data: data, encoding: .utf8) else {
            throw ArtifactContentError.binaryContent
        }
        return text
    }

    /// GET `artifacts/:artifactId` on the gateway. Route shape confirmed in
    /// replies-runtime; the stub's 404 JSON surfaces as a typed APIError.
    private func fetchGatewayContent(artifactId: String) async throws -> String {
        let escaped = artifactId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? artifactId
        var request = try await client.authorizedRequest(path: "artifacts/\(escaped)")
        request.setValue("*/*", forHTTPHeaderField: "Accept")
        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        guard let text = String(data: data, encoding: .utf8) else {
            throw ArtifactContentError.binaryContent
        }
        return text
    }
}
