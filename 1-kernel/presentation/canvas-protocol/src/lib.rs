//! A2R Canvas Protocol
//!
//! Implements the Canvas Protocol for A2rchitech:
//! - CanvasSpec - declarative task surface definition
//! - Canvas Runtime - canvas instantiation and management
//! - Canvas State Manager - deterministic state sync
//! - 40+ canonical view types
//!
//! Based on CanvasProtocol.md specification

use a2r_capsule_sdk::{CanvasBundle, CanvasBindings as CapsuleCanvasBindings};
use a2rchitech_system_law::SystemLawEngine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Canvas View Types (Canonical - 40 types from spec)
// ============================================================================

/// Canonical canvas view type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CanvasViewType {
    // A) State & Inspection Views
    ObjectView,
    ArtifactView,
    ConfigView,
    SnapshotView,

    // B) Change & Delta Views
    DiffView,
    PatchView,
    ComparisonView,
    RegressionView,

    // C) Sequence & Time Views
    TimelineView,
    RunView,
    LogStream,
    PlaybackView,

    // D) Collection & Index Views
    TableView,
    ListView,
    GalleryView,
    CapsuleGallery,
    RegistryView,

    // E) Relationship & Structure Views
    GraphView,
    TreeView,
    DependencyView,
    ContextMap,

    // F) Decision & Governance Views
    DecisionLog,
    ProposalView,
    PolicyView,
    RiskView,

    // G) Action & Control Surfaces
    FormView,
    CommandPalette,
    WorkflowView,
    ApprovalQueue,

    // H) Search, Discovery & Sense-Making
    SearchLens,
    FilterLens,
    SummaryLens,
    ExplanationView,
    RecommendationView,

    // I) Memory & Provenance Views
    MemoryTrace,
    ProvenanceView,
    AuditView,

    // J) Spatial & Embodied Views (Optional)
    WorkspaceView,
    ZoneView,
    AvatarPresence,
    AttentionField,
}

impl CanvasViewType {
    /// Get all canonical view types
    pub fn all() -> Vec<CanvasViewType> {
        vec![
            // State & Inspection
            Self::ObjectView,
            Self::ArtifactView,
            Self::ConfigView,
            Self::SnapshotView,
            // Change & Delta
            Self::DiffView,
            Self::PatchView,
            Self::ComparisonView,
            Self::RegressionView,
            // Sequence & Time
            Self::TimelineView,
            Self::RunView,
            Self::LogStream,
            Self::PlaybackView,
            // Collection & Index
            Self::TableView,
            Self::ListView,
            Self::GalleryView,
            Self::CapsuleGallery,
            Self::RegistryView,
            // Relationship & Structure
            Self::GraphView,
            Self::TreeView,
            Self::DependencyView,
            Self::ContextMap,
            // Decision & Governance
            Self::DecisionLog,
            Self::ProposalView,
            Self::PolicyView,
            Self::RiskView,
            // Action & Control
            Self::FormView,
            Self::CommandPalette,
            Self::WorkflowView,
            Self::ApprovalQueue,
            // Search & Discovery
            Self::SearchLens,
            Self::FilterLens,
            Self::SummaryLens,
            Self::ExplanationView,
            Self::RecommendationView,
            // Memory & Provenance
            Self::MemoryTrace,
            Self::ProvenanceView,
            Self::AuditView,
            // Spatial & Embodied
            Self::WorkspaceView,
            Self::ZoneView,
            Self::AvatarPresence,
            Self::AttentionField,
        ]
    }

    /// Get view type category
    pub fn category(&self) -> &'static str {
        match self {
            // A) State & Inspection
            Self::ObjectView | Self::ArtifactView | Self::ConfigView | Self::SnapshotView => {
                "state_inspection"
            }
            // B) Change & Delta
            Self::DiffView | Self::PatchView | Self::ComparisonView | Self::RegressionView => {
                "change_delta"
            }
            // C) Sequence & Time
            Self::TimelineView | Self::RunView | Self::LogStream | Self::PlaybackView => {
                "sequence_time"
            }
            // D) Collection & Index
            Self::TableView | Self::ListView | Self::GalleryView | Self::CapsuleGallery | Self::RegistryView => {
                "collection_index"
            }
            // E) Relationship & Structure
            Self::GraphView | Self::TreeView | Self::DependencyView | Self::ContextMap => {
                "relationship_structure"
            }
            // F) Decision & Governance
            Self::DecisionLog | Self::ProposalView | Self::PolicyView | Self::RiskView => {
                "decision_governance"
            }
            // G) Action & Control
            Self::FormView | Self::CommandPalette | Self::WorkflowView | Self::ApprovalQueue => {
                "action_control"
            }
            // H) Search & Discovery
            Self::SearchLens | Self::FilterLens | Self::SummaryLens | Self::ExplanationView | Self::RecommendationView => {
                "search_discovery"
            }
            // I) Memory & Provenance
            Self::MemoryTrace | Self::ProvenanceView | Self::AuditView => "memory_provenance",
            // J) Spatial & Embodied
            Self::WorkspaceView | Self::ZoneView | Self::AvatarPresence | Self::AttentionField => {
                "spatial_embodied"
            }
        }
    }
}

impl std::fmt::Display for CanvasViewType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

// ============================================================================
// CanvasSpec - Canonical Contract
// ============================================================================

/// CanvasSpec - the authoritative canvas definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasSpec {
    pub canvas_id: String,
    pub view_type: CanvasViewType,
    pub title: Option<String>,
    pub description: Option<String>,
    pub bindings: CanvasBindings,
    pub data_shape: DataShape,
    pub interactions: Vec<CanvasInteraction>,
    pub filters: Vec<CanvasFilter>,
    pub risk: CanvasRisk,
    pub provenance_ui: ProvenanceUI,
}

/// Canvas bindings - binds to Journal artifacts/events
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CanvasBindings {
    pub run_id: Option<String>,
    pub journal_refs: Vec<String>,
    pub artifact_refs: Vec<String>,
    pub repo_snapshot_ref: Option<String>,
}

/// Data shape - primary and secondary data types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataShape {
    pub primary: DataShapeType,
    pub secondary: Vec<DataShapeType>,
}

/// Data shape type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DataShapeType {
    Diff,
    Table,
    Timeline,
    Graph,
    Tree,
    List,
    Metadata,
}

/// Canvas interaction - semantic, not motion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasInteraction {
    pub id: String,
    pub interaction_type: InteractionType,
    pub risk: String,
    pub confirmation_required: bool,
}

/// Interaction type - semantic contract
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum InteractionType {
    Action,      // May request tool execution
    Navigation,  // Switch canvas or capsule
    Filter,      // Refine bound data
    Inspect,     // Expand provenance
    Annotate,    // Add human input
}

/// Canvas filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasFilter {
    pub field: String,
    pub operator: FilterOperator,
    pub value: serde_json::Value,
}

/// Filter operator
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FilterOperator {
    Equals,
    NotEquals,
    Contains,
    StartsWith,
    EndsWith,
    GreaterThan,
    LessThan,
    In,
    NotIn,
}

/// Canvas risk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasRisk {
    pub class: RiskClass,
    pub reason: String,
}

/// Risk class
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RiskClass {
    Read,
    Write,
    Exec,
}

/// Provenance UI settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceUI {
    pub show_trail: bool,
    pub expand_on_hover: bool,
}

// ============================================================================
// Canvas Runtime
// ============================================================================

/// Canvas runtime for instantiation and management
pub struct CanvasRuntime {
    canvases: Arc<RwLock<HashMap<String, CanvasSpec>>>,
    system_law: Arc<SystemLawEngine>,
}

impl CanvasRuntime {
    pub fn new(system_law: Arc<SystemLawEngine>) -> Self {
        Self {
            canvases: Arc::new(RwLock::new(HashMap::new())),
            system_law,
        }
    }

    /// Create canvas from spec
    pub async fn create_canvas(&self, spec: CanvasSpec) -> Result<String, CanvasError> {
        // Validate canvas
        self.validate_canvas(&spec)?;

        let canvas_id = spec.canvas_id.clone();

        let mut canvases = self.canvases.write().await;
        canvases.insert(canvas_id.clone(), spec);

        Ok(canvas_id)
    }

    /// Validate canvas spec
    fn validate_canvas(&self, spec: &CanvasSpec) -> Result<(), CanvasError> {
        // LAW-ONT-001: Must have journal bindings
        if spec.bindings.journal_refs.is_empty() {
            return Err(CanvasError::ValidationFailed(
                "Canvas must have at least one journal reference (LAW-ONT-001)".to_string(),
            ));
        }

        // LAW-ONT-003: Risk must be declared
        if spec.risk.class == RiskClass::Write || spec.risk.class == RiskClass::Exec {
            if spec.risk.reason.is_empty() {
                return Err(CanvasError::ValidationFailed(
                    "Risk reason required for write/exec canvases".to_string(),
                ));
            }
        }

        // LAW-ENF-006: Provenance must be visible
        if !spec.provenance_ui.show_trail {
            return Err(CanvasError::ValidationFailed(
                "Provenance trail must be visible (LAW-ENF-006)".to_string(),
            ));
        }

        Ok(())
    }

    /// Get canvas by ID
    pub async fn get_canvas(&self, canvas_id: &str) -> Option<CanvasSpec> {
        let canvases = self.canvases.read().await;
        canvases.get(canvas_id).cloned()
    }

    /// Update canvas via patch (RFC 6902 style)
    pub async fn update_canvas(
        &self,
        canvas_id: &str,
        patch: CanvasPatch,
    ) -> Result<CanvasSpec, CanvasError> {
        let mut canvases = self.canvases.write().await;
        let canvas = canvases
            .get_mut(canvas_id)
            .ok_or_else(|| CanvasError::CanvasNotFound(canvas_id.to_string()))?;

        // Apply patch
        if let Some(bindings) = patch.bindings {
            canvas.bindings = bindings;
        }
        if let Some(interactions) = patch.interactions {
            canvas.interactions = interactions;
        }
        if let Some(filters) = patch.filters {
            canvas.filters = filters;
        }

        Ok(canvas.clone())
    }

    /// Destroy canvas
    pub async fn destroy_canvas(&self, canvas_id: &str) -> Result<(), CanvasError> {
        let mut canvases = self.canvases.write().await;
        canvases
            .remove(canvas_id)
            .ok_or_else(|| CanvasError::CanvasNotFound(canvas_id.to_string()))?;
        Ok(())
    }

    /// List canvases by view type
    pub async fn list_canvases_by_type(&self, view_type: CanvasViewType) -> Vec<CanvasSpec> {
        let canvases = self.canvases.read().await;
        canvases
            .values()
            .filter(|c| c.view_type == view_type)
            .cloned()
            .collect()
    }

    /// List all active canvases
    pub async fn list_active_canvases(&self) -> Vec<CanvasSpec> {
        let canvases = self.canvases.read().await;
        canvases.values().cloned().collect()
    }
}

/// Canvas patch for updates
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CanvasPatch {
    pub bindings: Option<CanvasBindings>,
    pub interactions: Option<Vec<CanvasInteraction>>,
    pub filters: Option<Vec<CanvasFilter>>,
}

// ============================================================================
// Canvas State Manager
// ============================================================================

/// Canvas state manager for deterministic state sync
pub struct CanvasStateManager {
    state_history: Arc<RwLock<HashMap<String, Vec<CanvasStateSnapshot>>>>,
}

impl CanvasStateManager {
    pub fn new() -> Self {
        Self {
            state_history: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Record state snapshot
    pub async fn record_snapshot(&self, canvas_id: &str, snapshot: CanvasStateSnapshot) {
        let mut history = self.state_history.write().await;
        history
            .entry(canvas_id.to_string())
            .or_insert_with(Vec::new)
            .push(snapshot);
    }

    /// Get state history for canvas
    pub async fn get_state_history(&self, canvas_id: &str) -> Vec<CanvasStateSnapshot> {
        let history = self.state_history.read().await;
        history
            .get(canvas_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Replay canvas state to specific point
    pub async fn replay_to(&self, canvas_id: &str, timestamp: DateTime<Utc>) -> Option<CanvasStateSnapshot> {
        let history = self.state_history.read().await;
        let snapshots = history.get(canvas_id)?;

        snapshots
            .iter()
            .filter(|s| s.timestamp <= timestamp)
            .last()
            .cloned()
    }
}

/// Canvas state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasStateSnapshot {
    pub canvas_id: String,
    pub timestamp: DateTime<Utc>,
    pub state_hash: String,
    pub data: serde_json::Value,
}

// ============================================================================
// Canvas UI Components (40+ canonical types)
// ============================================================================

/// Canvas UI component registry
pub struct CanvasComponentRegistry {
    components: Arc<RwLock<HashMap<CanvasViewType, CanvasComponentInfo>>>,
}

impl CanvasComponentRegistry {
    pub fn new() -> Self {
        Self {
            components: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a canvas component
    pub async fn register_component(&self, view_type: CanvasViewType, info: CanvasComponentInfo) {
        let mut components = self.components.write().await;
        components.insert(view_type, info);
    }

    /// Get component info
    pub async fn get_component(&self, view_type: CanvasViewType) -> Option<CanvasComponentInfo> {
        let components = self.components.read().await;
        components.get(&view_type).cloned()
    }

    /// List all registered components
    pub async fn list_components(&self) -> Vec<(CanvasViewType, CanvasComponentInfo)> {
        let components = self.components.read().await;
        components.iter().map(|(k, v)| (*k, v.clone())).collect()
    }
}

/// Canvas component info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasComponentInfo {
    pub name: String,
    pub description: String,
    pub version: String,
    pub renderer: String,
    pub props_schema: serde_json::Value,
}

// ============================================================================
// Canvas Errors
// ============================================================================

/// Canvas error types
#[derive(Debug, thiserror::Error)]
pub enum CanvasError {
    #[error("Canvas not found: {0}")]
    CanvasNotFound(String),

    #[error("Validation failed: {0}")]
    ValidationFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_system_law() -> Arc<SystemLawEngine> {
        Arc::new(SystemLawEngine::new())
    }

    fn create_test_canvas_spec() -> CanvasSpec {
        CanvasSpec {
            canvas_id: format!("cnv_{}", Uuid::new_v4().simple()),
            view_type: CanvasViewType::DiffView,
            title: Some("Diff Review".to_string()),
            description: Some("Review code changes".to_string()),
            bindings: CanvasBindings {
                run_id: Some("run_001".to_string()),
                journal_refs: vec!["jrnl_001".to_string()],
                artifact_refs: vec!["art_diff_001".to_string()],
                repo_snapshot_ref: Some("git:abc123".to_string()),
            },
            data_shape: DataShape {
                primary: DataShapeType::Diff,
                secondary: vec![DataShapeType::Metadata],
            },
            interactions: vec![CanvasInteraction {
                id: "approve_patch".to_string(),
                interaction_type: InteractionType::Action,
                risk: "write".to_string(),
                confirmation_required: true,
            }],
            filters: vec![],
            risk: CanvasRisk {
                class: RiskClass::Read,
                reason: "View-only canvas".to_string(),
            },
            provenance_ui: ProvenanceUI {
                show_trail: true,
                expand_on_hover: true,
            },
        }
    }

    #[tokio::test]
    async fn test_create_canvas() {
        let runtime = CanvasRuntime::new(create_test_system_law());
        let spec = create_test_canvas_spec();

        let canvas_id = runtime.create_canvas(spec).await;
        assert!(canvas_id.is_ok());
    }

    #[tokio::test]
    async fn test_create_canvas_no_journal_refs() {
        let runtime = CanvasRuntime::new(create_test_system_law());

        let spec = CanvasSpec {
            canvas_id: format!("cnv_{}", Uuid::new_v4().simple()),
            view_type: CanvasViewType::DiffView,
            title: None,
            description: None,
            bindings: CanvasBindings::default(), // No journal refs
            data_shape: DataShape {
                primary: DataShapeType::Diff,
                secondary: vec![],
            },
            interactions: vec![],
            filters: vec![],
            risk: CanvasRisk {
                class: RiskClass::Read,
                reason: "Test".to_string(),
            },
            provenance_ui: ProvenanceUI {
                show_trail: true,
                expand_on_hover: true,
            },
        };

        let result = runtime.create_canvas(spec).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_canvas() {
        let runtime = CanvasRuntime::new(create_test_system_law());
        let spec = create_test_canvas_spec();
        let canvas_id = runtime.create_canvas(spec.clone()).await.unwrap();

        let retrieved = runtime.get_canvas(&canvas_id).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().view_type, CanvasViewType::DiffView);
    }

    #[tokio::test]
    async fn test_update_canvas() {
        let runtime = CanvasRuntime::new(create_test_system_law());
        let spec = create_test_canvas_spec();
        let canvas_id = runtime.create_canvas(spec).await.unwrap();

        let patch = CanvasPatch {
            bindings: Some(CanvasBindings {
                run_id: Some("run_002".to_string()),
                journal_refs: vec!["jrnl_002".to_string()],
                artifact_refs: vec![],
                repo_snapshot_ref: None,
            }),
            interactions: None,
            filters: None,
        };

        let updated = runtime.update_canvas(&canvas_id, patch).await;
        assert!(updated.is_ok());
        assert_eq!(updated.unwrap().bindings.run_id, Some("run_002".to_string()));
    }

    #[tokio::test]
    async fn test_destroy_canvas() {
        let runtime = CanvasRuntime::new(create_test_system_law());
        let spec = create_test_canvas_spec();
        let canvas_id = runtime.create_canvas(spec).await.unwrap();

        let result = runtime.destroy_canvas(&canvas_id).await;
        assert!(result.is_ok());

        let retrieved = runtime.get_canvas(&canvas_id).await;
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_list_canvases_by_type() {
        let runtime = CanvasRuntime::new(create_test_system_law());

        // Create multiple canvases of same type
        for i in 0..3 {
            let mut spec = create_test_canvas_spec();
            spec.canvas_id = format!("cnv_{}", i);
            spec.bindings.journal_refs = vec![format!("jrnl_{}", i)];
            runtime.create_canvas(spec).await.unwrap();
        }

        let canvases = runtime.list_canvases_by_type(CanvasViewType::DiffView).await;
        assert_eq!(canvases.len(), 3);
    }

    #[tokio::test]
    async fn test_view_type_category() {
        assert_eq!(CanvasViewType::DiffView.category(), "change_delta");
        assert_eq!(CanvasViewType::TimelineView.category(), "sequence_time");
        assert_eq!(CanvasViewType::GraphView.category(), "relationship_structure");
        assert_eq!(CanvasViewType::FormView.category(), "action_control");
    }

    #[tokio::test]
    async fn test_state_manager() {
        let state_manager = CanvasStateManager::new();

        let snapshot = CanvasStateSnapshot {
            canvas_id: "cnv_001".to_string(),
            timestamp: Utc::now(),
            state_hash: "abc123".to_string(),
            data: serde_json::json!({"key": "value"}),
        };

        state_manager.record_snapshot("cnv_001", snapshot.clone()).await;

        let history = state_manager.get_state_history("cnv_001").await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].state_hash, "abc123");
    }

    #[tokio::test]
    async fn test_component_registry() {
        let registry = CanvasComponentRegistry::new();

        let info = CanvasComponentInfo {
            name: "DiffViewer".to_string(),
            description: "View code diffs".to_string(),
            version: "1.0.0".to_string(),
            renderer: "react".to_string(),
            props_schema: serde_json::json!({}),
        };

        registry
            .register_component(CanvasViewType::DiffView, info.clone())
            .await;

        let retrieved = registry.get_component(CanvasViewType::DiffView).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "DiffViewer");
    }
}
