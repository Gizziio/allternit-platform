import Foundation

/// Client for the A://Labs API (`cmd/allternit-api/src/alabs_routes.rs`).
/// Routes live under `/api/v1` on `allternit-api`.
final class LabsClient: @unchecked Sendable {
    static let shared = LabsClient()

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// `GET /api/v1/courses` — bare `[CourseRow]` array.
    func listCourses() async throws -> [ALABSCourse] {
        try await client.get(path: "courses")
    }

    /// `GET /api/v1/lessons?status=published` — bare `[LessonRow]` array.
    func listLessons(status: String = "published") async throws -> [ALABSLesson] {
        let escaped = status.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? status
        return try await client.get(path: "lessons?status=\(escaped)")
    }
}
