import Foundation

/// Typed errors surfaced by APIClient and AgentChatClient.
enum APIError: Error, LocalizedError, Sendable {
    case invalidResponse
    case httpError(statusCode: Int, message: String?)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an invalid response."
        case .httpError(let statusCode, let message):
            return message ?? "Request failed with status \(statusCode)."
        case .decoding(let error):
            return "Failed to decode the server response: \(error.localizedDescription)"
        case .transport(let error):
            return error.localizedDescription
        }
    }
}

/// Per-request routing for runtime API calls, resolved from EnvironmentStore
/// on every send so switching environments takes effect immediately.
enum APIRoute: Sendable {
    /// Straight to the configured gateway (local "This Device").
    case direct
    /// Cloud relay: wrap the request in the proxy envelope and POST it to the
    /// paired runtime's proxy URL (fetch-interceptor.ts:441-468).
    case relay(proxyURL: URL)
    /// Cloud selected with no paired runtime — mirrors the web interceptor's
    /// 503 `runtime_unavailable` response (fetch-interceptor.ts:470-478).
    case unavailable(reason: String)
}

/// Thin async/await REST client for the Allternit gateway.
///
/// The request builder *awaits* the Clerk Bearer token before returning the
/// request, so the Authorization header is always attached before the request
/// leaves the client — the v1 race (header applied inside a detached Task
/// after the request had already been returned) is gone by construction.
///
/// JSON is decoded with a plain `JSONDecoder`: models carry explicit
/// `CodingKeys` wherever the wire casing differs (snake_case conversations,
/// camelCase replies), so no key-decoding strategy is applied globally.
final class APIClient: @unchecked Sendable {
    static let shared = APIClient(
        tokenProvider: { try await AuthManager.shared.getToken() },
        routeProvider: { await EnvironmentStore.shared.apiRoute() }
    )

    let baseURL: URL
    let session: URLSession

    /// Awaits the current Clerk session token; nil when signed out.
    private let tokenProvider: @Sendable () async throws -> String?

    /// Resolves how the next request reaches the runtime. Called per send,
    /// never captured — environment switches apply to the very next request.
    private let routeProvider: @Sendable () async -> APIRoute

    /// All stored state is immutable after init — safe to share across tasks.
    init(baseURL: URL = AppConfig.apiBaseURL,
         session: URLSession = .shared,
         tokenProvider: @escaping @Sendable () async throws -> String?,
         routeProvider: (@Sendable () async -> APIRoute)? = nil) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
        self.routeProvider = routeProvider ?? { .direct }
    }

    // MARK: - Request building

    /// Builds a JSON request, awaiting and attaching the Bearer token first.
    func authorizedRequest(path: String, method: String = "GET") async throws -> URLRequest {
        try await authorizedRequest(url: baseURL.appendingPathComponent(path), method: method)
    }

    /// Builds a JSON request for an absolute URL outside `baseURL`, with the
    /// same awaited Bearer injection. Needed for `POST /api/agent-chat`, which
    /// is mounted directly under `/api` on allternit-api — NOT under the
    /// `/api/v1` router — so it can't be reached by appending to `baseURL`.
    func authorizedRequest(url: URL, method: String = "GET") async throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = try await tokenProvider(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    // MARK: - Response validation

    /// Throws a typed APIError for non-2xx responses, surfacing the gateway's
    /// `{ "message" | "error" }` body when present (same shape the web reads).
    func validate(_ response: URLResponse, data: Data? = nil) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(
                statusCode: httpResponse.statusCode,
                message: Self.errorMessage(from: data)
            )
        }
    }

    private static func errorMessage(from data: Data?) -> String? {
        guard let data,
              let body = try? JSONDecoder().decode(ErrorBody.self, from: data) else {
            return nil
        }
        return body.message ?? body.error
    }

    private struct ErrorBody: Decodable {
        let message: String?
        let error: String?
    }

    // MARK: - Standard REST requests

    func get<T: Decodable>(path: String) async throws -> T {
        let request = try await authorizedRequest(path: path)
        let (data, response) = try await session.data(for: request)
        try validate(response, data: data)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    @discardableResult
    func post<T: Decodable, B: Encodable>(path: String, body: B) async throws -> T {
        var request = try await authorizedRequest(path: path, method: "POST")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validate(response, data: data)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// POST with no body and no response payload (e.g. reply cancel).
    func post(path: String) async throws {
        let request = try await authorizedRequest(path: path, method: "POST")
        let (data, response) = try await session.data(for: request)
        try validate(response, data: data)
    }
}
