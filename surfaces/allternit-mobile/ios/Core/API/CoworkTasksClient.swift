import Foundation

/// Cloud-API client for Cowork's flat task list — `/api/v1/tasks`
/// (cmd/allternit-cloud-api/src/routes/tasks.rs). Like RuntimeDevicesClient,
/// requests go DIRECT to `AppConfig.cloudAPIBaseURL` with the Clerk Bearer —
/// never through the EnvironmentStore relay route, and never gizzi-code's
/// `/v1/*` routes (a different host entirely).
final class CoworkTasksClient: @unchecked Sendable {
    /// `GET {cloud}/api/v1/tasks?workspace_id=<id>` — `workspace_id` is
    /// required server-side; `"default"` matches web's own fallback
    /// (`task.workspaceId || 'default'`, useTaskStore.ts:197).
    func listTasks(workspaceId: String = "default") async throws -> [CoworkTask] {
        guard var components = URLComponents(
            url: AppConfig.cloudAPIBaseURL.appendingPathComponent("api/v1/tasks"),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidResponse
        }
        components.queryItems = [URLQueryItem(name: "workspace_id", value: workspaceId)]
        guard let url = components.url else {
            throw APIError.invalidResponse
        }

        let client = APIClient.shared
        let request = try await client.authorizedRequest(url: url)

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode([CoworkTask].self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// `POST {cloud}/api/v1/tasks` — tenant/owner stamped server-side from
    /// the auth token; `workspace_id` always `"default"` (see `listTasks`).
    func createTask(
        workspaceId: String = "default",
        title: String,
        description: String?,
        assigneeType: String?
    ) async throws -> CoworkTask {
        let url = AppConfig.cloudAPIBaseURL.appendingPathComponent("api/v1/tasks")
        let client = APIClient.shared
        var request = try await client.authorizedRequest(url: url, method: "POST")
        request.httpBody = try JSONEncoder().encode(CreateCoworkTaskRequest(
            workspaceId: workspaceId,
            title: title,
            description: description,
            status: "todo",
            assigneeType: assigneeType
        ))

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(CoworkTask.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// `PUT {cloud}/api/v1/tasks/:id` — COALESCE-style; only non-nil fields
    /// change server-side.
    func updateTask(
        id: String,
        status: String? = nil,
        title: String? = nil,
        description: String? = nil
    ) async throws -> CoworkTask {
        let url = AppConfig.cloudAPIBaseURL
            .appendingPathComponent("api/v1/tasks")
            .appendingPathComponent(id)
        let client = APIClient.shared
        var request = try await client.authorizedRequest(url: url, method: "PUT")
        request.httpBody = try JSONEncoder().encode(UpdateCoworkTaskRequest(
            status: status,
            title: title,
            description: description
        ))

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
        do {
            return try JSONDecoder().decode(CoworkTask.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// `DELETE {cloud}/api/v1/tasks/:id`.
    func deleteTask(id: String) async throws {
        let url = AppConfig.cloudAPIBaseURL
            .appendingPathComponent("api/v1/tasks")
            .appendingPathComponent(id)
        let client = APIClient.shared
        let request = try await client.authorizedRequest(url: url, method: "DELETE")

        let (data, response) = try await client.session.data(for: request)
        try client.validate(response, data: data)
    }
}
