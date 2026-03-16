//! Browser View Models
//!
//! Data models for the Browser View Service.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Resource types that can be browsed
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    Dashboard,
    Graph,
    Task,
    Workflow,
    Artifact,
    Receipt,
    Session,
    Tool,
    Agent,
    Memory,
    Policy,
    Custom(String),
}

impl ResourceType {
    /// Get display name for the resource type
    pub fn display_name(&self) -> String {
        match self {
            ResourceType::Dashboard => "Dashboard".to_string(),
            ResourceType::Graph => "Graph".to_string(),
            ResourceType::Task => "Task".to_string(),
            ResourceType::Workflow => "Workflow".to_string(),
            ResourceType::Artifact => "Artifact".to_string(),
            ResourceType::Receipt => "Receipt".to_string(),
            ResourceType::Session => "Session".to_string(),
            ResourceType::Tool => "Tool".to_string(),
            ResourceType::Agent => "Agent".to_string(),
            ResourceType::Memory => "Memory".to_string(),
            ResourceType::Policy => "Policy".to_string(),
            ResourceType::Custom(s) => s.clone(),
        }
    }

    /// Get icon identifier for the resource type
    pub fn icon(&self) -> &'static str {
        match self {
            ResourceType::Dashboard => "dashboard",
            ResourceType::Graph => "graph",
            ResourceType::Task => "task",
            ResourceType::Workflow => "workflow",
            ResourceType::Artifact => "artifact",
            ResourceType::Receipt => "receipt",
            ResourceType::Session => "session",
            ResourceType::Tool => "tool",
            ResourceType::Agent => "agent",
            ResourceType::Memory => "memory",
            ResourceType::Policy => "policy",
            ResourceType::Custom(_) => "custom",
        }
    }
}

/// Reference to a resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceRef {
    pub resource_type: ResourceType,
    pub resource_id: String,
    pub display_name: String,
}

/// Resource summary (for list views)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceSummary {
    pub resource_type: ResourceType,
    pub resource_id: String,
    pub display_name: String,
    pub description: Option<String>,
    pub status: ResourceStatus,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Resource status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResourceStatus {
    Active,
    Inactive,
    Pending,
    Running,
    Completed,
    Failed,
    Archived,
}

/// Resource detail (for detail views)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDetail {
    pub resource_type: ResourceType,
    pub resource_id: String,
    pub display_name: String,
    pub description: Option<String>,
    pub status: ResourceStatus,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub content: serde_json::Value,
    pub related_resources: Vec<ResourceRef>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Browse session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowseSession {
    pub session_id: String,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub history: Vec<ResourceRef>,
    pub current_index: usize,
    pub view_mode: ViewMode,
    pub filters: ResourceFilters,
}

/// View mode
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ViewMode {
    List,
    Grid,
    Tree,
    Detail,
}

/// Resource filters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResourceFilters {
    pub search_query: Option<String>,
    pub resource_types: Vec<ResourceType>,
    pub status_filter: Option<ResourceStatus>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub tags: Vec<String>,
    pub custom_filters: HashMap<String, serde_json::Value>,
}

/// Breadcrumb for navigation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breadcrumb {
    pub index: usize,
    pub resource_type: ResourceType,
    pub resource_id: String,
    pub display_name: String,
    pub is_current: bool,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub resource_type: ResourceType,
    pub resource_id: String,
    pub display_name: String,
    pub description: Option<String>,
    pub relevance_score: f64,
    pub matched_fields: Vec<String>,
}

/// Cached view
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewCache {
    pub cache_id: String,
    pub resource_type: ResourceType,
    pub filters: ResourceFilters,
    pub results: Vec<ResourceSummary>,
    pub cached_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Navigation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigateRequest {
    pub resource_type: ResourceType,
    pub resource_id: String,
    pub display_name: String,
}

/// Create session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub user_id: String,
    pub initial_resource: Option<ResourceRef>,
}

/// Create session response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub session: BrowseSession,
}

/// Search request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub resource_types: Vec<ResourceType>,
    pub limit: Option<usize>,
}

/// Provider info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub provider_id: String,
    pub name: String,
    pub description: String,
    pub supported_types: Vec<ResourceType>,
}
