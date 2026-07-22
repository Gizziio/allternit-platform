import Foundation

/// Client for the cowork projects API
/// (`cmd/allternit-api/src/cowork_routes.rs`): project CRUD plus the
/// per-project file metadata rows. Request failures surface to callers as
/// an error state, never a crash.
final class ProjectsClient: @unchecked Sendable {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    // MARK: - Projects (REST, /api/v1/cowork/projects)

    /// Lists the signed-in user's projects (`{ projects: [...] }`).
    func listProjects() async throws -> [CoworkProject] {
        let response: CoworkProjectListResponse = try await client.get(path: "cowork/projects")
        return response.projects
    }

    /// Creates a project; returns the new project id
    /// (`201 { project: { id } }`).
    @discardableResult
    func createProject(title: String, description: String? = nil, instructions: String? = nil) async throws -> String {
        let response: CreateCoworkProjectResponse = try await client.post(
            path: "cowork/projects",
            body: CreateCoworkProjectBody(title: title, description: description, instructions: instructions)
        )
        return response.project.id
    }

    /// Renames and/or re-instructs a project. The backend COALESCEs every
    /// field, so nil leaves the stored value untouched.
    func updateProject(id: String, title: String? = nil, description: String? = nil, instructions: String? = nil) async throws {
        try await client.put(
            path: "cowork/projects/\(Self.escape(id))",
            body: UpdateCoworkProjectBody(title: title, description: description, instructions: instructions)
        )
    }

    /// `DELETE /api/v1/cowork/projects/:id`.
    func deleteProject(id: String) async throws {
        try await client.delete(path: "cowork/projects/\(Self.escape(id))")
    }

    // MARK: - Project files (REST, /api/v1/cowork/projects/:id/files)

    /// Lists a project's attached files (`{ files: [...] }`).
    func listFiles(projectId: String) async throws -> [CoworkProjectFile] {
        let response: CoworkProjectFileListResponse = try await client.get(
            path: "cowork/projects/\(Self.escape(projectId))/files"
        )
        return response.files
    }

    /// Attaches a file's metadata to a project; returns the new file id
    /// (`201 { file: { id } }`).
    @discardableResult
    func addFile(projectId: String, name: String, url: String? = nil, uploadId: String? = nil, mediaType: String? = nil) async throws -> String {
        let response: CreateCoworkProjectFileResponse = try await client.post(
            path: "cowork/projects/\(Self.escape(projectId))/files",
            body: CreateCoworkProjectFileBody(name: name, url: url, uploadId: uploadId, mediaType: mediaType)
        )
        return response.file.id
    }

    /// `DELETE /api/v1/cowork/projects/:id/files/:fileId`.
    func deleteFile(projectId: String, fileId: String) async throws {
        try await client.delete(
            path: "cowork/projects/\(Self.escape(projectId))/files/\(Self.escape(fileId))"
        )
    }

    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }
}
