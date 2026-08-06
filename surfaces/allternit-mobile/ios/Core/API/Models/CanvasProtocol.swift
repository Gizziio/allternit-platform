import Foundation

// -----------------------------------------------------------------------------
// Canvas Protocol models — mirrors the Rust crate in
// platform/protocols/canvas-protocol/src/lib.rs.
//
// These types ride inside CanvasRecord.metadata (arbitrary JSON on the
// backend), so no schema change is needed.
// -----------------------------------------------------------------------------

/// Canonical canvas view type — 40 types from the Rust protocol.
enum CanvasViewType: String, Codable, Sendable, CaseIterable {
    // A) State & Inspection
    case objectView = "ObjectView"
    case artifactView = "ArtifactView"
    case configView = "ConfigView"
    case snapshotView = "SnapshotView"

    // B) Change & Delta
    case diffView = "DiffView"
    case patchView = "PatchView"
    case comparisonView = "ComparisonView"
    case regressionView = "RegressionView"

    // C) Sequence & Time
    case timelineView = "TimelineView"
    case runView = "RunView"
    case logStream = "LogStream"
    case playbackView = "PlaybackView"

    // D) Collection & Index
    case tableView = "TableView"
    case listView = "ListView"
    case galleryView = "GalleryView"
    case capsuleGallery = "CapsuleGallery"
    case registryView = "RegistryView"

    // E) Relationship & Structure
    case graphView = "GraphView"
    case treeView = "TreeView"
    case dependencyView = "DependencyView"
    case contextMap = "ContextMap"

    // F) Decision & Governance
    case decisionLog = "DecisionLog"
    case proposalView = "ProposalView"
    case policyView = "PolicyView"
    case riskView = "RiskView"

    // G) Action & Control Surfaces
    case formView = "FormView"
    case commandPalette = "CommandPalette"
    case workflowView = "WorkflowView"
    case approvalQueue = "ApprovalQueue"

    // H) Search, Discovery & Sense-Making
    case searchLens = "SearchLens"
    case filterLens = "FilterLens"
    case summaryLens = "SummaryLens"
    case explanationView = "ExplanationView"
    case recommendationView = "RecommendationView"

    // I) Memory & Provenance Views
    case memoryTrace = "MemoryTrace"
    case provenanceView = "ProvenanceView"
    case auditView = "AuditView"

    // J) Spatial & Embodied Views
    case workspaceView = "WorkspaceView"
    case zoneView = "ZoneView"
    case avatarPresence = "AvatarPresence"
    case attentionField = "AttentionField"

    /// Category name matching the Rust `category()` method.
    var category: String {
        switch self {
        case .objectView, .artifactView, .configView, .snapshotView:
            return "state_inspection"
        case .diffView, .patchView, .comparisonView, .regressionView:
            return "change_delta"
        case .timelineView, .runView, .logStream, .playbackView:
            return "sequence_time"
        case .tableView, .listView, .galleryView, .capsuleGallery, .registryView:
            return "collection_index"
        case .graphView, .treeView, .dependencyView, .contextMap:
            return "relationship_structure"
        case .decisionLog, .proposalView, .policyView, .riskView:
            return "decision_governance"
        case .formView, .commandPalette, .workflowView, .approvalQueue:
            return "action_control"
        case .searchLens, .filterLens, .summaryLens, .explanationView, .recommendationView:
            return "search_discovery"
        case .memoryTrace, .provenanceView, .auditView:
            return "memory_provenance"
        case .workspaceView, .zoneView, .avatarPresence, .attentionField:
            return "spatial_embodied"
        }
    }
}

/// Authoritative canvas definition.
struct CanvasSpec: Codable, Sendable {
    let canvasId: String
    let viewType: CanvasViewType
    let title: String?
    let description: String?
    let bindings: CanvasBindings
    let dataShape: DataShape
    let interactions: [CanvasInteraction]
    let filters: [CanvasFilter]
    let risk: CanvasRisk
    let provenanceUI: ProvenanceUI

    enum CodingKeys: String, CodingKey {
        case canvasId = "canvas_id"
        case viewType = "view_type"
        case title, description, bindings
        case dataShape = "data_shape"
        case interactions, filters, risk
        case provenanceUI = "provenance_ui"
    }
}

/// Binds a canvas to journal artifacts/events.
struct CanvasBindings: Codable, Sendable {
    var runId: String?
    var journalRefs: [String]
    var artifactRefs: [String]
    var repoSnapshotRef: String?

    enum CodingKeys: String, CodingKey {
        case runId = "run_id"
        case journalRefs = "journal_refs"
        case artifactRefs = "artifact_refs"
        case repoSnapshotRef = "repo_snapshot_ref"
    }
}

/// Primary and secondary data shapes.
struct DataShape: Codable, Sendable {
    let primary: DataShapeType
    let secondary: [DataShapeType]
}

enum DataShapeType: String, Codable, Sendable {
    case diff
    case table
    case timeline
    case graph
    case tree
    case list
    case metadata
}

/// Semantic canvas interaction.
struct CanvasInteraction: Codable, Sendable {
    let id: String
    let interactionType: InteractionType
    let risk: String
    let confirmationRequired: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case interactionType = "interaction_type"
        case risk
        case confirmationRequired = "confirmation_required"
    }
}

enum InteractionType: String, Codable, Sendable {
    case action
    case navigation
    case filter
    case inspect
    case annotate
}

/// Canvas filter.
struct CanvasFilter: Codable, Sendable {
    let field: String
    let op: FilterOperator
    let value: JSONValue

    enum CodingKeys: String, CodingKey {
        case field
        case op = "operator"
        case value
    }
}

enum FilterOperator: String, Codable, Sendable {
    case equals
    case notEquals = "not_equals"
    case contains
    case startsWith = "starts_with"
    case endsWith = "ends_with"
    case greaterThan = "greater_than"
    case lessThan = "less_than"
    case inList = "in"
    case notInList = "not_in"
}

/// Canvas risk classification.
struct CanvasRisk: Codable, Sendable {
    let riskClass: RiskClass
    let reason: String

    enum CodingKeys: String, CodingKey {
        case riskClass = "class"
        case reason
    }
}

enum RiskClass: String, Codable, Sendable {
    case read
    case write
    case exec
}

/// Provenance UI hints.
struct ProvenanceUI: Codable, Sendable {
    let showLineage: Bool?
    let showConfidence: Bool?
    let showSources: Bool?

    enum CodingKeys: String, CodingKey {
        case showLineage = "show_lineage"
        case showConfidence = "show_confidence"
        case showSources = "show_sources"
    }
}

/// Opaque JSON value for filter values and future extension.
enum JSONValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([JSONValue])
    case object([String: JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else if let object = try? container.decode([String: JSONValue].self) {
            self = .object(object)
        } else if container.decodeNil() {
            self = .null
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}
