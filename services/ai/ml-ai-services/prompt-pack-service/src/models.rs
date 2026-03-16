use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

/// A prompt pack is a versioned collection of related prompt templates
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct PromptPack {
    pub pack_id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub deterministic: bool,
    pub author: String,
    pub tags: Vec<String>,
    
    #[validate(nested)]
    pub dependencies: Vec<PackDependency>,
    
    #[validate(nested)]
    pub variables: Vec<PackVariable>,
    
    #[validate(nested)]
    pub prompts: Vec<PromptTemplate>,
    
    // Metadata
    pub created_at: DateTime<Utc>,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct PackDependency {
    pub pack_id: String,
    pub version: String,  // semver range
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct PackVariable {
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: String,  // string, number, array, object
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// A single prompt template within a pack
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct PromptTemplate {
    pub id: String,
    pub template: String,  // Path to template file
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partials: Option<Vec<String>>,  // Included partials
}

/// Request to render a prompt
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct RenderRequest {
    pub pack_id: String,
    pub prompt_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,  // None = latest
    pub variables: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<RenderOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trim_whitespace: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validate_variables: Option<bool>,
}

/// Result of rendering a prompt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderResult {
    pub rendered: String,
    pub content_hash: String,
    pub rendered_hash: String,
    pub receipt_id: String,
    pub pack_id: String,
    pub prompt_id: String,
    pub version: String,
    pub rendered_at: DateTime<Utc>,
    pub deterministic: bool,
}

/// A receipt for a rendered prompt (for Rails ledger)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptReceipt {
    pub receipt_id: String,
    pub pack_id: String,
    pub prompt_id: String,
    pub version: String,
    pub content_hash: String,      // Hash of the template
    pub rendered_hash: String,     // Hash of the rendered output
    pub variables_hash: String,    // Hash of the variables
    pub rendered_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rails_ledger_tx: Option<String>,
}

/// Request to render multiple prompts (batch)
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct BatchRenderRequest {
    pub renders: Vec<RenderRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchRenderResult {
    pub results: Vec<RenderResult>,
}

/// Context-aware render request (DAK integration)
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct ContextualRenderRequest {
    pub context_pack_id: String,
    pub prompt_refs: Vec<PromptRef>,
    pub variables: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct PromptRef {
    pub pack_id: String,
    pub prompt_id: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualRenderResult {
    pub rendered_prompts: Vec<RenderResult>,
    pub context_hash: String,
    pub receipt_id: String,
}

/// Pack metadata (for listing)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackMetadata {
    pub pack_id: String,
    pub name: String,
    pub latest_version: String,
    pub versions: Vec<String>,
    pub tags: Vec<String>,
    pub description: String,
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub file: String,
    pub line: Option<u32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationWarning {
    pub file: String,
    pub line: Option<u32>,
    pub message: String,
}

/// Diff between two pack versions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackDiff {
    pub from_version: String,
    pub to_version: String,
    pub changes: Vec<Change>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    #[serde(rename = "type")]
    pub change_type: String,  // added, removed, modified
    pub file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diff: Option<String>,
}

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub packs_loaded: u64,
    pub cache_hit_rate: f64,
}

/// Error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

/// Record ledger transaction request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordLedgerRequest {
    pub rails_ledger_tx: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wih_id: Option<String>,
}
