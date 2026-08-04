import Foundation

// ------------------------------------------------------------------------------
// A://Labs lesson model — mirrors the web's `ALABSLesson` interface
// (surfaces/ai.allternit.com/src/views/labs/main/LabsView.constants.ts).
//
// The backend (`cmd/allternit-api/src/alabs_routes.rs`) emits snake_case keys;
// Swift properties stay camelCase via explicit CodingKeys.
// ------------------------------------------------------------------------------

struct ALABSLesson: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let courseId: String
    let moduleNumber: Int
    let lessonNumber: Int
    let title: String
    let description: String
    let sceneJson: String?
    let videoUrl: String?
    let durationMinutes: Int
    let status: String
    let publishedAt: String?
    let createdAt: String
    let courseCode: String
    let courseTitle: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, status
        case courseId = "course_id"
        case moduleNumber = "module_number"
        case lessonNumber = "lesson_number"
        case sceneJson = "scene_json"
        case videoUrl = "video_url"
        case durationMinutes = "duration_minutes"
        case publishedAt = "published_at"
        case createdAt = "created_at"
        case courseCode = "course_code"
        case courseTitle = "course_title"
    }
}
