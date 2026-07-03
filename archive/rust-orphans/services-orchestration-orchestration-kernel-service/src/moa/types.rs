/**
 * MoA Types
 * 
 * Core data structures for Mixture of Agents orchestration.
 */

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::collections::HashMap;

/// Task types that can be routed to different models
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    Text,
    Code,
    Image,
    Audio,
    Video,
    Search,
    Telephony,
    Browser,
    FileRead,
    FileWrite,
    Command,
}

/// Task status in the execution graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    Running,
    Complete,
    Error,
    Skipped,
}

/// Model routing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRouting {
    pub task_type: TaskType,
    pub model_id: String,
    pub provider: String,
    pub priority: u8,
}

/// A single task in the MoA graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoATask {
    pub id: String,
    pub task_type: TaskType,
    pub model_id: String,
    pub prompt: String,
    pub status: TaskStatus,
    pub progress: Option<u8>,
    pub output: Option<TaskOutput>,
    pub error: Option<String>,
    pub dependencies: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Task output (varies by task type)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum TaskOutput {
    Text(String),
    Code {
        language: String,
        content: String,
    },
    Image {
        url: String,
        width: Option<u32>,
        height: Option<u32>,
    },
    Audio {
        url: String,
        duration_secs: Option<f32>,
    },
    Video {
        url: String,
        duration_secs: Option<f32>,
    },
    Search {
        results: Vec<SearchResult>,
    },
    Data(serde_json::Value),
}

/// Search result from web search tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
    pub relevance_score: f32,
}

/// Complete MoA task graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoAGraph {
    pub id: String,
    pub original_prompt: String,
    pub tasks: Vec<MoATask>,
    pub status: GraphStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Overall graph status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GraphStatus {
    Pending,
    Running,
    Complete,
    Error,
    Cancelled,
}

impl MoAGraph {
    pub fn new(original_prompt: String) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: Uuid::new_v4().to_string(),
            original_prompt,
            tasks: Vec::new(),
            status: GraphStatus::Pending,
            created_at: now,
            updated_at: now,
            completed_at: None,
            metadata: HashMap::new(),
        }
    }

    /// Calculate overall progress (0-100)
    pub fn progress(&self) -> u8 {
        if self.tasks.is_empty() {
            return 0;
        }
        let completed = self.tasks.iter()
            .filter(|t| t.status == TaskStatus::Complete)
            .count();
        ((completed as f32 / self.tasks.len() as f32) * 100.0) as u8
    }

    /// Get tasks by status
    pub fn tasks_by_status(&self, status: TaskStatus) -> Vec<&MoATask> {
        self.tasks.iter().filter(|t| t.status == status).collect()
    }

    /// Check if all tasks are complete
    pub fn is_complete(&self) -> bool {
        self.tasks.iter().all(|t| {
            t.status == TaskStatus::Complete || t.status == TaskStatus::Skipped
        })
    }

    /// Check if graph has errors
    pub fn has_errors(&self) -> bool {
        self.tasks.iter().any(|t| t.status == TaskStatus::Error)
    }
}

/// MoA configuration (loaded from config.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoAConfig {
    pub enabled: bool,
    pub router_model: String,
    pub default_models: DefaultModels,
    pub max_parallel_tasks: usize,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultModels {
    pub text: String,
    pub code: String,
    pub image: String,
    pub audio: String,
    pub video: String,
    pub search: String,
}

impl Default for MoAConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            router_model: "gemini-2.5-flash".to_string(),
            default_models: DefaultModels {
                text: "anthropic:claude-3-7-sonnet".to_string(),
                code: "anthropic:claude-3-7-sonnet".to_string(),
                image: "replicate:flux-1.1".to_string(),
                audio: "elevenlabs:turbo".to_string(),
                video: "kling:1.5".to_string(),
                search: "gemini-2.5-flash".to_string(),
            },
            max_parallel_tasks: 5,
            timeout_seconds: 300,
        }
    }
}
