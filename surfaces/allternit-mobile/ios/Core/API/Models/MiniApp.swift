import Foundation

// -----------------------------------------------------------------------------
// Mini-app catalog models — mirrors the web's InstalledMiniApp subset used in
// surfaces/ai.allternit.com/src/views/aci/AciMiniAppsView.tsx and
// mini-app.types.ts.
//
// Phase 1 only models the catalog/browse shape. Harness, lifecycle, OAuth,
// and embedded-web surface contracts are omitted because iOS has no desktop
// bridge for install/start/runtime.
// -----------------------------------------------------------------------------

enum MiniAppCategory: String, Codable, Sendable, CaseIterable {
    case runtime
    case connector
    case tool
    case data
    case communication
    case custom

    var label: String {
        switch self {
        case .runtime: return "Runtime"
        case .connector: return "Connector"
        case .tool: return "Tool"
        case .data: return "Data"
        case .communication: return "Communication"
        case .custom: return "Custom"
        }
    }
}

enum MiniAppStatus: String, Codable, Sendable {
    case available
    case pinned
    case running
    case offline
}

enum MiniAppCatalogSource: String, Codable, Sendable {
    case allternit
    case mcp
    case github
    case url
    case local
    case workspace
}

/// One mini-app in the catalog/store list.
struct MiniApp: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var name: String
    var description: String
    var version: String?
    var category: MiniAppCategory
    var url: String
    var sourceUrl: String?
    var repo: String?
    var githubUrl: String?
    var publisher: String?
    var capabilities: [String]
    var verified: Bool
    var featured: Bool
    var catalogSource: MiniAppCatalogSource
    var status: MiniAppStatus
    var isPinned: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, description, version, category, url, repo, publisher
        case sourceUrl = "source_url"
        case githubUrl = "github_url"
        case capabilities, verified, featured
        case catalogSource = "catalog_source"
        case status
        case isPinned = "is_pinned"
    }
}
