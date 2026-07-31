import Foundation

/// One entry of a canvas's `components` array. The web persists artifacts as
/// `{ type: 'artifact', artifactId, kind, title, content, url }`
/// (mode-session-store.ts persistArtifactToCanvas); every field except `type`
/// is optional on the wire, and non-artifact component shapes decode with
/// whatever subset matches.
struct CanvasComponent: Codable, Sendable {
    let type: String?
    let artifactId: String?
    let kind: String?
    let title: String?
    let content: String?
    let url: String?
}

/// A persisted canvas row (canvas_routes.rs CanvasResponse). `components` is
/// arbitrary JSON server-side; anything that isn't an array of component
/// objects decodes as empty rather than failing the whole list.
struct CanvasRecord: Decodable, Sendable {
    let id: String
    let sessionId: String
    let title: String?
    let components: [CanvasComponent]
    let artifactKey: String?
    let version: Int
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, components
        case version
        case artifactKey = "artifact_key"
        case sessionId = "session_id"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        sessionId = try container.decode(String.self, forKey: .sessionId)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        components = (try? container.decode([CanvasComponent].self, forKey: .components)) ?? []
        artifactKey = try container.decodeIfPresent(String.self, forKey: .artifactKey)
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1
        updatedAt = try container.decode(String.self, forKey: .updatedAt)
    }
}

/// Canvas CRUD over the routes in canvas_routes.rs — the backend's only
/// persistent artifact store (`GET /v1/artifacts/:id` is a 404 stub). The
/// web writes one canvas per artifact; this client mirrors that contract so
/// artifacts round-trip between surfaces.
struct CanvasClient: Sendable {
    private struct ListResponse: Decodable {
        let canvases: [CanvasRecord]
    }

    private struct WritePayload: Encodable {
        let title: String
        let components: [CanvasComponent]
    }

    /// POST returns a slim `{ id, session_id }`, not the full row
    /// (canvas_routes.rs create_canvas).
    private struct CreateResponse: Decodable {
        let id: String
    }

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// GET /api/v1/canvases → the authenticated user's newest canvases,
    /// including artifacts published under non-chat synthetic session ids.
    func listCanvases() async throws -> [CanvasRecord] {
        let envelope: ListResponse = try await client.get(path: "canvases")
        return envelope.canvases
    }

    /// GET /api/v1/agent-sessions/:id/canvases → { canvases: [...] }
    func listCanvases(sessionId: String) async throws -> [CanvasRecord] {
        let escaped = sessionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? sessionId
        let envelope: ListResponse = try await client.get(path: "agent-sessions/\(escaped)/canvases")
        return envelope.canvases
    }

    /// POST /api/v1/agent-sessions/:id/canvases — one canvas per artifact,
    /// matching the web's create shape. Returns the created row's id.
    func createArtifactCanvas(sessionId: String, artifact: ArtifactRecord) async throws -> String {
        let escaped = sessionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? sessionId
        let created: CreateResponse = try await client.post(
            path: "agent-sessions/\(escaped)/canvases",
            body: WritePayload(title: artifact.title, components: [Self.component(for: artifact)])
        )
        return created.id
    }

    /// PATCH /api/v1/canvases/:id — refreshed content for a re-seen artifact.
    func updateArtifactCanvas(canvasId: String, artifact: ArtifactRecord) async throws {
        let escaped = canvasId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? canvasId
        try await client.patch(
            path: "canvases/\(escaped)",
            body: WritePayload(title: artifact.title, components: [Self.component(for: artifact)])
        )
    }

    private static func component(for artifact: ArtifactRecord) -> CanvasComponent {
        CanvasComponent(
            type: "artifact",
            artifactId: artifact.artifactId ?? artifact.id,
            kind: artifact.artifactType ?? artifact.fileType,
            title: artifact.title,
            content: artifact.inlinePreview,
            url: artifact.url
        )
    }
}
