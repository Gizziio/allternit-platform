//! Checkpoint management for WASM backend

use serde::{Serialize, Deserialize};
use crate::wasm::storage::BrowserStorage;
use crate::Result;

/// Checkpoint representing agent state at a point in time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub timestamp: String,
    pub session_id: String,
    pub label: Option<String>,
    pub agent_state: AgentState,
    pub task_state: TaskState,
    pub memory_summary: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// Agent state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentState {
    pub current_goal: String,
    pub recent_decisions: Vec<String>,
    pub open_questions: Vec<String>,
    pub blockers: Vec<String>,
    pub mood: AgentMood,
}

impl Default for AgentState {
    fn default() -> Self {
        Self {
            current_goal: "Initialize".to_string(),
            recent_decisions: Vec::new(),
            open_questions: Vec::new(),
            blockers: Vec::new(),
            mood: AgentMood::Focused,
        }
    }
}

/// Agent mood
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentMood {
    Focused,
    Exploring,
    Blocked,
    Reviewing,
    Completing,
}

/// Task state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskState {
    pub active_task_id: Option<String>,
    pub progress_percent: u8,
    pub completed_steps: Vec<String>,
    pub pending_steps: Vec<String>,
    pub verification_status: VerificationStatus,
}

impl Default for TaskState {
    fn default() -> Self {
        Self {
            active_task_id: None,
            progress_percent: 0,
            completed_steps: Vec::new(),
            pending_steps: Vec::new(),
            verification_status: VerificationStatus::NotStarted,
        }
    }
}

/// Verification status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VerificationStatus {
    NotStarted,
    InProgress,
    Passed,
    Failed,
}

/// Checkpoint manager
pub struct CheckpointManager {
    storage: BrowserStorage,
    workspace_id: String,
}

impl CheckpointManager {
    /// Create new checkpoint manager
    pub fn new(storage: BrowserStorage, workspace_id: &str) -> Self {
        Self {
            storage,
            workspace_id: workspace_id.to_string(),
        }
    }
    
    fn checkpoint_key(&self, checkpoint_id: &str) -> String {
        format!("{}/checkpoints/{}", self.workspace_id, checkpoint_id)
    }
    
    fn checkpoints_index_key(&self) -> String {
        format!("{}/checkpoints_index", self.workspace_id)
    }
    
    /// Create a new checkpoint
    pub fn create(
        &self,
        session_id: impl Into<String>,
        agent_state: Option<AgentState>,
        task_state: Option<TaskState>,
        label: Option<String>,
    ) -> Result<Checkpoint> {
        let now = chrono::Utc::now().to_rfc3339();
        let checkpoint = Checkpoint {
            id: format!("chk-{}", uuid()),
            timestamp: now,
            session_id: session_id.into(),
            label,
            agent_state: agent_state.unwrap_or_default(),
            task_state: task_state.unwrap_or_default(),
            memory_summary: None,
            metadata: None,
        };
        
        self.storage.set(&self.checkpoint_key(&checkpoint.id), &checkpoint)?;
        self.update_index(&checkpoint.id, true)?;
        
        Ok(checkpoint)
    }
    
    /// Get checkpoint by ID
    pub fn get(&self, checkpoint_id: &str) -> Result<Option<Checkpoint>> {
        self.storage.get(&self.checkpoint_key(checkpoint_id))
    }
    
    /// Get latest checkpoint
    pub fn get_latest(&self) -> Result<Option<Checkpoint>> {
        let index: Vec<String> = self.storage.get(&self.checkpoints_index_key())?.unwrap_or_default();
        
        if index.is_empty() {
            return Ok(None);
        }
        
        // Get all checkpoints and find latest by timestamp
        let mut checkpoints: Vec<Checkpoint> = index
            .iter()
            .filter_map(|id| self.get(id).ok().flatten())
            .collect();
        
        checkpoints.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(checkpoints.into_iter().next())
    }
    
    /// List checkpoints (most recent first)
    pub fn list(&self, limit: Option<usize>) -> Result<Vec<Checkpoint>> {
        let index: Vec<String> = self.storage.get(&self.checkpoints_index_key())?.unwrap_or_default();
        
        let mut checkpoints: Vec<Checkpoint> = index
            .iter()
            .filter_map(|id| self.get(id).ok().flatten())
            .collect();
        
        checkpoints.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        
        if let Some(l) = limit {
            checkpoints.truncate(l);
        }
        
        Ok(checkpoints)
    }
    
    /// Delete a checkpoint
    pub fn delete(&self, checkpoint_id: &str) -> Result<()> {
        self.storage.delete(&self.checkpoint_key(checkpoint_id))?;
        self.update_index(checkpoint_id, false)?;
        Ok(())
    }
    
    /// Restore from checkpoint (returns the checkpoint data for restoration)
    pub fn restore(&self, checkpoint_id: &str) -> Result<Checkpoint> {
        let checkpoint = self.get(checkpoint_id)?
            .ok_or_else(|| format!("Checkpoint not found: {}", checkpoint_id))?;
        
        Ok(checkpoint)
    }
    
    /// Create a quick checkpoint with minimal state
    pub fn quick_save(&self, session_id: impl Into<String>, label: Option<String>) -> Result<Checkpoint> {
        self.create(
            session_id,
            None,
            None,
            label.or_else(|| Some("Quick save".to_string())),
        )
    }
    
    /// Update checkpoint metadata
    pub fn update_metadata(
        &self,
        checkpoint_id: &str,
        metadata: serde_json::Value,
    ) -> Result<Checkpoint> {
        let mut checkpoint = self.get(checkpoint_id)?
            .ok_or_else(|| format!("Checkpoint not found: {}", checkpoint_id))?;
        
        checkpoint.metadata = Some(metadata);
        self.storage.set(&self.checkpoint_key(checkpoint_id), &checkpoint)?;
        
        Ok(checkpoint)
    }
    
    /// Add memory summary to checkpoint
    pub fn add_memory_summary(&self, checkpoint_id: &str, summary: impl Into<String>) -> Result<Checkpoint> {
        let mut checkpoint = self.get(checkpoint_id)?
            .ok_or_else(|| format!("Checkpoint not found: {}", checkpoint_id))?;
        
        checkpoint.memory_summary = Some(summary.into());
        self.storage.set(&self.checkpoint_key(checkpoint_id), &checkpoint)?;
        
        Ok(checkpoint)
    }
    
    /// Get checkpoints by session
    pub fn get_by_session(&self, session_id: &str) -> Result<Vec<Checkpoint>> {
        let checkpoints = self.list(None)?;
        let filtered: Vec<Checkpoint> = checkpoints
            .into_iter()
            .filter(|c| c.session_id == session_id)
            .collect();
        Ok(filtered)
    }
    
    /// Clear all checkpoints
    pub fn clear_all(&self) -> Result<()> {
        let index: Vec<String> = self.storage.get(&self.checkpoints_index_key())?.unwrap_or_default();
        
        for id in &index {
            let _ = self.storage.delete(&self.checkpoint_key(id));
        }
        
        self.storage.set(&self.checkpoints_index_key(), &Vec::<String>::new())?;
        Ok(())
    }
    
    // Helper to maintain checkpoints index
    fn update_index(&self, checkpoint_id: &str, add: bool) -> Result<()> {
        let key = self.checkpoints_index_key();
        let mut index: Vec<String> = self.storage.get(&key)?.unwrap_or_default();
        
        if add {
            if !index.contains(&checkpoint_id.to_string()) {
                index.push(checkpoint_id.to_string());
            }
        } else {
            index.retain(|id| id != checkpoint_id);
        }
        
        self.storage.set(&key, &index)?;
        Ok(())
    }
}

// UUID helper
fn uuid() -> String {
    use js_sys::Math;
    
    let mut uuid = [0u8; 16];
    for i in 0..16 {
        uuid[i] = (Math::random() * 256.0) as u8;
    }
    
    // Set version (4) and variant bits
    uuid[6] = (uuid[6] & 0x0f) | 0x40;
    uuid[8] = (uuid[8] & 0x3f) | 0x80;
    
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        uuid[0], uuid[1], uuid[2], uuid[3],
        uuid[4], uuid[5],
        uuid[6], uuid[7],
        uuid[8], uuid[9],
        uuid[10], uuid[11], uuid[12], uuid[13], uuid[14], uuid[15]
    )
}
