//! bb-compatible request/response contracts.

use serde::{Deserialize, Serialize};

// Projects
#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub kind: Option<String>,
    pub git_remote_url: Option<String>,
    pub source: Option<CreateProjectSourceRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectSourceRequest {
    #[serde(rename = "type")]
    pub source_type: String,
    pub host_id: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub sort_key: Option<String>,
}

// Threads
#[derive(Debug, Deserialize)]
pub struct CreateThreadRequest {
    pub project_id: String,
    pub environment_id: Option<String>,
    pub provider_id: Option<String>,
    pub title: Option<String>,
    pub input: Vec<ThreadInputItem>,
}

#[derive(Debug, Deserialize)]
pub struct ThreadInputItem {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateThreadRequest {
    pub title: Option<String>,
    pub status: Option<String>,
    pub archived_at: Option<i64>,
    pub pinned_at: Option<i64>,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub input: Vec<ThreadInputItem>,
    pub mode: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SendMessageResponse {
    pub ok: bool,
    pub delivery: String,
}

// Hosts
#[derive(Debug, Deserialize)]
pub struct CreateHostRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub host_type: Option<String>,
    pub max_permission_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHostRequest {
    pub name: Option<String>,
    pub max_permission_mode: Option<String>,
}

// Generic list wrappers
#[derive(Debug, Serialize)]
pub struct ListResponse<T> {
    pub items: Vec<T>,
}
