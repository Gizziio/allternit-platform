//! Checkpoint management
//!
//! Checkpoints use Rails ContextPacks for state persistence.
//! They enable recovery after disconnects and crashes.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::error::{CoworkError, Result};
use crate::types::{Checkpoint, JobId, RunId};

/// Manages checkpoint creation and restoration
pub struct CheckpointManager {
    data_dir: PathBuf,
    rails_base_url: String,
    client: reqwest::Client,
}

/// Rails ContextPack reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextPackRef {
    pub pack_id: String,
    pub created_at: DateTime<Utc>,
    pub payload_uri: Option<String>,
}

/// Local checkpoint state stored alongside ContextPack reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointState {
    pub checkpoint_id: String,
    pub run_id: RunId,
    pub job_id: Option<JobId>,
    pub step_index: i32,
    pub pack_ref: ContextPackRef,
    pub cursor_state: serde_json::Value,
    pub pending_approvals: Vec<String>,
    pub artifact_refs: Vec<String>,
    pub created_at: DateTime<Utc>,
}

impl CheckpointManager {
    /// Create a new checkpoint manager
    pub async fn new(data_dir: PathBuf, rails_base_url: impl Into<String>) -> Result<Self> {
        fs::create_dir_all(&data_dir).await?;

        Ok(Self {
            data_dir,
            rails_base_url: rails_base_url.into(),
            client: reqwest::Client::new(),
        })
    }

    /// Create a checkpoint
    pub async fn create(
        &self,
        run_id: RunId,
        job_id: Option<JobId>,
        step_index: i32,
        cursor_state: serde_json::Value,
        pending_approvals: Vec<String>,
        artifact_refs: Vec<String>,
    ) -> Result<Checkpoint> {
        let checkpoint_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Store local state
        let local_state = CheckpointState {
            checkpoint_id: checkpoint_id.clone(),
            run_id,
            job_id,
            step_index,
            pack_ref: ContextPackRef {
                pack_id: checkpoint_id.clone(),
                created_at: now,
                payload_uri: None,
            },
            cursor_state: cursor_state.clone(),
            pending_approvals: pending_approvals.clone(),
            artifact_refs: artifact_refs.clone(),
            created_at: now,
        };

        // Save to local storage
        let state_path = self.state_path(&checkpoint_id);
        let state_json = serde_json::to_string(&local_state)?;
        fs::write(&state_path, state_json).await?;

        // Create ContextPack in Rails
        match self.create_context_pack(&checkpoint_id, &cursor_state).await {
            Ok(pack_id) => {
                info!(
                    checkpoint_id = %checkpoint_id,
                    pack_id = %pack_id,
                    run_id = %run_id,
                    "Created checkpoint with Rails ContextPack"
                );
            }
            Err(e) => {
                warn!(
                    checkpoint_id = %checkpoint_id,
                    error = %e,
                    "Failed to create Rails ContextPack, using local storage only"
                );
            }
        }

        Ok(Checkpoint {
            id: checkpoint_id,
            run_id,
            job_id,
            step_index,
            pack_id: local_state.pack_ref.pack_id,
            cursor_state,
            pending_approvals,
            artifact_refs,
            created_at: now,
        })
    }

    /// Create a ContextPack in Rails
    async fn create_context_pack(
        &self,
        pack_id: &str,
        state: &serde_json::Value,
    ) -> anyhow::Result<String> {
        let url = format!("{}/context_packs", self.rails_base_url);

        let payload = serde_json::json!({
            "context_pack": {
                "pack_id": pack_id,
                "pack_type": "cowork_checkpoint",
                "state": state,
            }
        });

        let response = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await?;

        if response.status().is_success() {
            // Extract pack_id from response
            let body: serde_json::Value = response.json().await?;
            let id = body["pack_id"].as_str().unwrap_or(pack_id);
            Ok(id.to_string())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(anyhow::anyhow!(
                "Rails error: {} - {}",
                status,
                text
            ))
        }
    }

    /// Load a checkpoint
    pub async fn load(&self, checkpoint_id: &str) -> Result<Checkpoint> {
        let state_path = self.state_path(checkpoint_id);

        let state_json = fs::read_to_string(&state_path).await.map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                CoworkError::CheckpointNotFound(checkpoint_id.to_string())
            } else {
                CoworkError::Io(e)
            }
        })?;

        let state: CheckpointState = serde_json::from_str(&state_json)?;

        Ok(Checkpoint {
            id: state.checkpoint_id,
            run_id: state.run_id,
            job_id: state.job_id,
            step_index: state.step_index,
            pack_id: state.pack_ref.pack_id,
            cursor_state: state.cursor_state,
            pending_approvals: state.pending_approvals,
            artifact_refs: state.artifact_refs,
            created_at: state.created_at,
        })
    }

    /// Get the latest checkpoint for a run
    pub async fn get_latest(&self, run_id: RunId) -> Result<Option<Checkpoint>> {
        let mut dir = fs::read_dir(&self.data_dir).await?;

        let mut checkpoints = Vec::new();

        while let Some(entry) = dir.next_entry().await? {
            if entry.file_type().await?.is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".json") {
                        let checkpoint_id = name.trim_end_matches(".json");
                        if let Ok(cp) = self.load(checkpoint_id).await {
                            if cp.run_id == run_id {
                                checkpoints.push(cp);
                            }
                        }
                    }
                }
            }
        }

        // Sort by creation time, most recent first
        checkpoints.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(checkpoints.into_iter().next())
    }

    /// List all checkpoints for a run
    pub async fn list(&self, run_id: RunId) -> Result<Vec<Checkpoint>> {
        let mut dir = fs::read_dir(&self.data_dir).await?;

        let mut checkpoints = Vec::new();

        while let Some(entry) = dir.next_entry().await? {
            if entry.file_type().await?.is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".json") {
                        let checkpoint_id = name.trim_end_matches(".json");
                        if let Ok(cp) = self.load(checkpoint_id).await {
                            if cp.run_id == run_id {
                                checkpoints.push(cp);
                            }
                        }
                    }
                }
            }
        }

        // Sort by creation time, most recent first
        checkpoints.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(checkpoints)
    }

    /// Delete a checkpoint
    pub async fn delete(&self, checkpoint_id: &str) -> Result<()> {
        let state_path = self.state_path(checkpoint_id);

        match fs::remove_file(&state_path).await {
            Ok(_) => {
                info!(checkpoint_id = %checkpoint_id, "Deleted checkpoint");
                Ok(())
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    Err(CoworkError::CheckpointNotFound(checkpoint_id.to_string()))
                } else {
                    Err(CoworkError::Io(e))
                }
            }
        }
    }

    /// Get the path for a checkpoint state file
    fn state_path(&self, checkpoint_id: &str) -> PathBuf {
        self.data_dir.join(format!("{}.json", checkpoint_id))
    }

    /// Recover from the latest checkpoint
    /// Returns the checkpoint and the event cursor to replay from
    pub async fn recover(&self, run_id: RunId) -> Result<Option<(Checkpoint, String)>> {
        let checkpoint = self.get_latest(run_id).await?;

        match checkpoint {
            Some(cp) => {
                // Extract cursor from checkpoint state
                let cursor = cp
                    .cursor_state
                    .get("event_cursor")
                    .and_then(|v| v.as_str())
                    .unwrap_or("0")
                    .to_string();

                info!(
                    run_id = %run_id,
                    checkpoint_id = %cp.id,
                    "Recovering from checkpoint"
                );

                Ok(Some((cp, cursor)))
            }
            None => {
                debug!(run_id = %run_id, "No checkpoint found for recovery");
                Ok(None)
            }
        }
    }

    /// Prune old checkpoints for a run, keeping only the N most recent
    pub async fn prune(&self, run_id: RunId, keep_count: usize) -> Result<usize> {
        let mut checkpoints = self.list(run_id).await?;

        if checkpoints.len() <= keep_count {
            return Ok(0);
        }

        // Sort oldest first for deletion
        checkpoints.sort_by(|a, b| a.created_at.cmp(&b.created_at));

        let to_delete = checkpoints.len() - keep_count;
        let mut deleted = 0;

        for cp in checkpoints.into_iter().take(to_delete) {
            if let Err(e) = self.delete(&cp.id).await {
                warn!(checkpoint_id = %cp.id, error = %e, "Failed to delete checkpoint during prune");
            } else {
                deleted += 1;
            }
        }

        if deleted > 0 {
            info!(run_id = %run_id, deleted = deleted, "Pruned old checkpoints");
        }

        Ok(deleted)
    }
}
