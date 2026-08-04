import Foundation

// ------------------------------------------------------------------------------
// A://Labs course model — mirrors the web's `ALABSCourse` interface
// (surfaces/ai.allternit.com/src/views/labs/main/LabsView.constants.ts).
//
// The backend (`cmd/allternit-api/src/alabs_routes.rs`) emits snake_case keys;
// Swift properties stay camelCase via explicit CodingKeys.
// ------------------------------------------------------------------------------

struct ALABSCourse: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let code: String
    let title: String
    let description: String
    let tier: String
    let canvasUrl: String
    let modules: Int
    let capstone: String
    let coverImage: String
    let demosUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, code, title, description, tier, modules, capstone
        case canvasUrl = "canvas_url"
        case coverImage = "cover_image"
        case demosUrl = "demos_url"
    }
}
