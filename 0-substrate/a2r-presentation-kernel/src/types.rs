use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type SituationId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    Verb,
    Entity,
    Constraint,
    Scope,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentToken {
    pub r#type: TokenType,
    pub value: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentPattern {
    pub token_type: TokenType,
    pub trigger: String,
    pub confidence: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Situation {
    pub situation_id: SituationId,
    pub tokens: Vec<IntentToken>,
    pub journal_context: JournalContext,
    pub active_capsules: Vec<Uuid>,
    pub renderer_constraints: RendererConstraints,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalContext {
    pub recent_events: Vec<Uuid>,
    pub active_node_id: Option<Uuid>,
    pub active_capsules: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RendererConstraints {
    pub renderer_type: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasSelection {
    pub canvas_spec: CanvasSpec,
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractionSpec {
    pub motion: MotionSpec,
    pub color_semantics: ColorSemantics,
    pub spatial_rules: SpatialRules,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MotionSpec {
    pub weight: f32,
    pub resistance: f32,
    pub continuity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorSemantics {
    pub risk: RiskLevel,
    pub confidence: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    Read,
    Write,
    Exec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpatialRules {
    pub layout_preference: String,
    pub interaction_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasSpec {
    pub canvas_id: Uuid,
    pub title: String,
    pub views: Vec<ViewSpec>,
    pub layout_strategy: Option<LayoutStrategy>,
    pub interaction_spec: Option<InteractionSpec>,
    pub theme: Option<String>,
    pub permissions: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutStrategy {
    pub layout_type: String, // vertical, horizontal, grid, flexible
    pub constraints: Option<LayoutConstraints>,
    pub regions: Vec<LayoutRegion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConstraints {
    pub min_width: Option<u32>,
    pub max_width: Option<u32>,
    pub min_height: Option<u32>,
    pub max_height: Option<u32>,
    pub aspect_ratio: Option<String>, // "16:9", "4:3", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutRegion {
    pub id: String,
    pub region_type: String, // primary, sidebar, header, footer, floating
    pub position: Option<LayoutPosition>,
    pub size: Option<LayoutSize>,
    pub allowed_view_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutPosition {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutSize {
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewSpec {
    pub view_id: Uuid,
    pub view_type: String,
    pub title: String,
    pub bindings: Vec<String>,
    pub region_id: Option<String>, // Which layout region this view belongs to
    pub position: Option<ViewPosition>,
    pub size: Option<ViewSize>,
    pub permissions: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewPosition {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewSize {
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleSpec {
    pub capsule_id: Uuid,
    pub title: String,
    pub framework_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub state: serde_json::Value,
}
