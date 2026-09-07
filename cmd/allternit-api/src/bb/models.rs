//! bb-compatible entity models.
//!
//! Mirrors the core tables added in `migrations/V92__bb_core_entities.sql`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbHost {
    pub id: String,
    pub user_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub host_type: String,
    pub connect_machine_id: Option<String>,
    pub max_permission_mode: String,
    pub destroyed_at: Option<i64>,
    pub last_seen_at: Option<i64>,
    pub last_rejected_protocol_version: Option<i32>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbProject {
    pub id: String,
    pub user_id: String,
    pub kind: String,
    pub name: String,
    pub git_remote_url: Option<String>,
    pub sort_key: String,
    pub deleted_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbProjectSource {
    pub id: String,
    pub project_id: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub host_id: String,
    pub path: Option<String>,
    pub is_default: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbProjectExecutionDefaults {
    pub project_id: String,
    pub provider_id: String,
    pub model: String,
    pub service_tier: String,
    pub reasoning_level: Option<String>,
    pub permission_mode: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbEnvironment {
    pub id: String,
    pub project_id: String,
    pub host_id: String,
    pub name: Option<String>,
    pub path: Option<String>,
    pub managed: bool,
    pub is_git_repo: bool,
    pub is_worktree: bool,
    pub branch_name: Option<String>,
    pub base_branch: Option<String>,
    pub default_branch: Option<String>,
    pub merge_base_branch: Option<String>,
    pub destroy_attempt_id: Option<String>,
    pub retire_requested_at: Option<i64>,
    pub workspace_provision_type: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbThreadSection {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbThread {
    pub id: String,
    pub project_id: String,
    pub environment_id: Option<String>,
    pub provider_id: String,
    pub model_override: Option<String>,
    pub reasoning_level_override: Option<String>,
    pub title: Option<String>,
    pub title_fallback: Option<String>,
    pub section_id: Option<String>,
    pub status: String,
    pub parent_thread_id: Option<String>,
    pub source_thread_id: Option<String>,
    pub origin_kind: Option<String>,
    pub origin_plugin_id: Option<String>,
    pub visibility: String,
    pub archived_at: Option<i64>,
    pub pinned_at: Option<i64>,
    pub pin_sort_key: Option<String>,
    pub deleted_at: Option<i64>,
    pub last_read_at: Option<i64>,
    pub latest_attention_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbEvent {
    pub id: String,
    pub thread_id: String,
    pub environment_id: Option<String>,
    pub scope_kind: String,
    pub turn_id: Option<String>,
    pub provider_thread_id: Option<String>,
    pub sequence: i64,
    #[serde(rename = "type")]
    pub event_type: String,
    pub item_id: Option<String>,
    pub item_kind: Option<String>,
    pub parent_tool_call_id: Option<String>,
    pub data: serde_json::Value,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbPromptHistoryEntry {
    pub id: String,
    pub project_id: String,
    pub thread_id: String,
    pub scope: String,
    pub request_sequence: i64,
    pub input: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbQueuedThreadMessage {
    pub id: String,
    pub thread_id: String,
    pub content: String,
    pub sender_thread_id: Option<String>,
    pub model: String,
    pub reasoning_level: String,
    pub permission_mode: String,
    pub service_tier: String,
    pub group_with_next: bool,
    pub claimed_at: Option<i64>,
    pub claim_token: Option<String>,
    pub sort_key: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BbHostDaemonSession {
    pub id: String,
    pub host_id: String,
    pub instance_id: String,
    pub host_name: String,
    pub host_type: String,
    pub data_dir: String,
    pub protocol_version: i32,
    pub heartbeat_interval_ms: i32,
    pub lease_timeout_ms: i32,
    pub status: String,
    pub lease_expires_at: i64,
    pub closed_at: Option<i64>,
    pub close_reason: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}
