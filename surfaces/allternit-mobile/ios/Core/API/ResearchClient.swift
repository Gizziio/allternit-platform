import Foundation

/// Client for the Open Notebook research backend.
///
/// Mirrors `useNotebookApi.ts` on the web. The backend runs on its own host
/// (default `http://127.0.0.1:5055`), independent of `allternit-api`.
final class ResearchClient: @unchecked Sendable {
    static let shared = ResearchClient()

    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = URL(string: "http://127.0.0.1:5055")!, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: - Health

    func health() async throws -> Bool {
        var request = URLRequest(url: baseURL.appendingPathComponent("health"))
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (_, response) = try await session.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    // MARK: - Notebooks

    func listNotebooks() async throws -> [ResearchNotebook] {
        try await get(path: "api/notebooks")
    }

    func createNotebook(title: String, description: String? = nil) async throws -> ResearchNotebook {
        try await post(
            path: "api/notebooks",
            body: CreateNotebookBody(title: title, description: description)
        )
    }

    func deleteNotebook(id: String) async throws {
        try await delete(path: "api/notebooks/\(Self.escape(id))")
    }

    // MARK: - Sources

    func listSources(notebookId: String) async throws -> [ResearchSource] {
        try await get(path: "api/notebooks/\(Self.escape(notebookId))/sources")
    }

    func addTextSource(notebookId: String, title: String, content: String) async throws -> ResearchSource {
        try await post(
            path: "api/notebooks/\(Self.escape(notebookId))/sources",
            body: AddSourceBody(type: "text", title: title, content: content)
        )
    }

    func addURLSource(notebookId: String, title: String, url: String) async throws -> ResearchSource {
        try await post(
            path: "api/notebooks/\(Self.escape(notebookId))/sources",
            body: AddSourceBody(type: "url", title: title, url: url)
        )
    }

    func removeSource(notebookId: String, sourceId: String) async throws {
        try await delete(
            path: "api/notebooks/\(Self.escape(notebookId))/sources/\(Self.escape(sourceId))"
        )
    }

    // MARK: - Messages

    func listMessages(notebookId: String) async throws -> [ResearchChatMessage] {
        try await get(path: "api/notebooks/\(Self.escape(notebookId))/chat/messages")
    }

    /// Sends a message and returns the full assistant reply by reading the SSE
    /// stream. Phase 1: no per-chunk streaming UI yet.
    func sendMessage(notebookId: String, message: String) async throws -> String {
        var request = URLRequest(
            url: baseURL.appendingPathComponent("api/notebooks/\(Self.escape(notebookId))/chat")
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(["message": message])

        let (bytes, response) = try await session.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }

        var content = ""
        var buffer = ""
        for try await byte in bytes {
            buffer.append(Character(Unicode.Scalar(byte)))
            if byte == 10 { // newline
                let line = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
                buffer = ""
                if line.hasPrefix("data: ") {
                    let json = String(line.dropFirst(6))
                    if let data = json.data(using: .utf8),
                       let chunk = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        if let text = chunk["text"] as? String {
                            content.append(text)
                        }
                        if chunk["done"] as? Bool == true {
                            break
                        }
                    }
                }
            }
        }
        return content.isEmpty ? "No response" : content
    }

    // MARK: - Generic helpers

    private func get<T: Decodable>(path: String) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        try validate(response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func post<T: Decodable, B: Encodable>(path: String, body: B) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        try validate(response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func delete(path: String) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "DELETE"
        let (_, response) = try await session.data(for: request)
        try validate(response)
    }

    private func validate(_ response: URLResponse, data: Data? = nil) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            let message = data.flatMap { String(data: $0, encoding: .utf8) }
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: message)
        }
    }

    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }

    private struct CreateNotebookBody: Encodable, Sendable {
        let title: String
        let description: String?
    }

    private struct AddSourceBody: Encodable, Sendable {
        let type: String
        let title: String
        let content: String?
        let url: String?

        init(type: String, title: String, content: String? = nil, url: String? = nil) {
            self.type = type
            self.title = title
            self.content = content
            self.url = url
        }
    }
}
