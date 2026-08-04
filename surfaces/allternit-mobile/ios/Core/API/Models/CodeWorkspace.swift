import Foundation

// -----------------------------------------------------------------------------
// Code Workspace local models — mirrors the web's CodeWorkspaceRecord shape in
// surfaces/ai.allternit.com/src/views/code/CodeModeStore.ts.
//
// There is no backend API for code workspaces today; the web persists these
// records in Zustand/localStorage. iOS keeps phase-1 workspace state in memory
// only, backed by the existing agent-session list.
// -----------------------------------------------------------------------------

/// Layout mode for a code workspace. Web uses `thread` | `canvas`.
enum CodeLayoutMode: String, Codable, Sendable {
    case thread
    case canvas
}

/// A tile in a code workspace. Phase 1 only supports `session` tiles; other
/// types (preview, diff, terminal, notes, knowledge, etc.) are deferred.
struct CodeCanvasTile: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var type: CodeCanvasTileType
    var sessionId: String?
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var zIndex: Int
    var label: String?
}

enum CodeCanvasTileType: String, Codable, Sendable {
    case session
    case preview
    case diff
    case terminal
    case notes
    case knowledge
    case knowledgeGraph = "knowledge-graph"
    case executor
}

/// A code workspace. Phase 1 keeps only the metadata needed for a workspace
// shell; full canvas viewport/history/selection are deferred.
struct CodeWorkspace: Identifiable, Codable, Sendable {
    let id: String
    var displayName: String
    var rootPath: String?
    var sessionIds: [String]
    var layoutMode: CodeLayoutMode
    var tiles: [CodeCanvasTile]
}
