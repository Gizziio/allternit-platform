import Foundation

// -----------------------------------------------------------------------------
// Cowork task REST models — base path /api/v1/tasks (cmd/allternit-cloud-api,
// tasks.rs — the cloud-API host RuntimeDevicesClient talks to, NOT
// gizzi-code's /v1/* routes). The API emits snake_case keys on the wire;
// Swift properties stay camelCase via explicit CodingKeys.
// -----------------------------------------------------------------------------

/// Task workflow status (`TaskStatus`, cowork_models.rs:726-735) — kebab-case
/// on the wire (`#[serde(rename_all = "kebab-case")]`).
enum CoworkTaskStatus: String, Codable, Sendable, CaseIterable, Hashable {
    case backlog
    case todo
    case inProgress = "in-progress"
    case inReview = "in-review"
    case done

    var label: String {
        switch self {
        case .backlog: return "Backlog"
        case .todo: return "Todo"
        case .inProgress: return "In Progress"
        case .inReview: return "In Review"
        case .done: return "Done"
        }
    }
}

/// Task assignee type (`AssigneeType`, cowork_models.rs:744-750) — lowercase
/// on the wire (`#[serde(rename_all = "lowercase")]`).
enum CoworkAssigneeType: String, Codable, Sendable, CaseIterable, Hashable {
    case human
    case agent
}

/// Task risk level (`TaskRisk`, cowork_models.rs:759-766) — lowercase on the
/// wire. Decoded for parity with the full `Task` record; Phase 1's UI never
/// sets or displays it (out of scope per the map doc).
enum CoworkTaskRisk: String, Codable, Sendable, Hashable {
    case low
    case medium
    case high
}

/// One task (`Task`, cowork_models.rs:795-816). `deadline`/`createdAt`/
/// `updatedAt` stay raw Strings (RFC-3339 on the wire, `DateTime<Utc>`
/// server-side) — display-only here, no Date parsing (RuntimeDevice's
/// convention for opaque timestamps).
struct CoworkTask: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let workspaceId: String
    let tenantId: String?
    let ownerId: String?
    let title: String
    let description: String?
    let status: CoworkTaskStatus
    let priority: Int
    let estimatedMinutes: Int?
    let deadline: String?
    let assigneeType: CoworkAssigneeType?
    let assigneeId: String?
    let assigneeName: String?
    let assigneeAvatar: String?
    let dependencies: [String]?
    let optimizeRank: Int?
    let risk: CoworkTaskRisk?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, status, priority, deadline, dependencies, risk
        case workspaceId = "workspace_id"
        case tenantId = "tenant_id"
        case ownerId = "owner_id"
        case estimatedMinutes = "estimated_minutes"
        case assigneeType = "assignee_type"
        case assigneeId = "assignee_id"
        case assigneeName = "assignee_name"
        case assigneeAvatar = "assignee_avatar"
        case optimizeRank = "optimize_rank"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Body of `POST /api/v1/tasks` (`CreateTaskRequest`, tasks.rs) — only the
/// fields Phase 1's create sheet sends. `status` is always `"todo"`
/// (Phase 1 has no status field on create; the map doc's scope note has new
/// tasks default to "todo" rather than the server's own "backlog" default,
/// see COWORK_TASKS_MAP.md:42). No `tenant_id`/`owner_id` — server-derived
/// from the auth token.
struct CreateCoworkTaskRequest: Encodable, Sendable {
    let workspaceId: String
    let title: String
    let description: String?
    let status: String
    let assigneeType: String?

    enum CodingKeys: String, CodingKey {
        case title, description, status
        case workspaceId = "workspace_id"
        case assigneeType = "assignee_type"
    }
}

/// Body of `PUT /api/v1/tasks/:id` (`UpdateTaskRequest`, tasks.rs) —
/// COALESCE-style, every field optional; a nil field leaves the stored value
/// untouched server-side.
struct UpdateCoworkTaskRequest: Encodable, Sendable {
    let status: String?
    let title: String?
    let description: String?
}
