//! Durable Checkpoint Store
//!
//! Persists wizard state to disk for crash-resume:
//! - File-backed JSON storage
//! - Atomic writes (temp + rename)
//! - Per-deployment state files
//! - Idempotency keys

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::state_machine::WizardState;

/// Checkpoint store error
#[derive(Debug, thiserror::Error)]
pub enum CheckpointStoreError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Checkpoint not found: {0}")]
    NotFound(String),

    #[error("Corrupted checkpoint: {0}")]
    Corrupted(String),
}

/// Checkpoint store trait
#[async_trait]
pub trait CheckpointStore: Send + Sync {
    /// Load wizard state for deployment
    async fn load(&self, deployment_id: &str) -> Result<Option<WizardState>, CheckpointStoreError>;

    /// Save wizard state
    async fn save(&self, state: &WizardState) -> Result<(), CheckpointStoreError>;

    /// Delete checkpoint
    async fn delete(&self, deployment_id: &str) -> Result<(), CheckpointStoreError>;

    /// List all checkpoints
    async fn list(&self) -> Result<Vec<String>, CheckpointStoreError>;
}

/// File-based checkpoint store
pub struct FsCheckpointStore {
    root: PathBuf,
}

impl FsCheckpointStore {
    /// Create new file-based checkpoint store
    pub fn new(root: PathBuf) -> Result<Self, CheckpointStoreError> {
        std::fs::create_dir_all(&root)?;
        Ok(Self { root })
    }

    /// Create default checkpoint store (~/.allternit/wizard/)
    pub fn default_store() -> Result<Self, CheckpointStoreError> {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        
        let root = PathBuf::from(home).join(".allternit").join("wizard");
        Self::new(root)
    }

    /// Get checkpoint file path
    fn checkpoint_path(&self, deployment_id: &str) -> PathBuf {
        self.root.join(format!("{}.json", deployment_id))
    }

    /// Get temp file path for atomic writes
    fn temp_path(&self, deployment_id: &str) -> PathBuf {
        self.root.join(format!("{}.tmp", deployment_id))
    }
}

#[async_trait]
impl CheckpointStore for FsCheckpointStore {
    async fn load(&self, deployment_id: &str) -> Result<Option<WizardState>, CheckpointStoreError> {
        let path = self.checkpoint_path(deployment_id);
        
        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path).await?;
        let state: WizardState = serde_json::from_str(&content)
            .map_err(|e| CheckpointStoreError::Corrupted(format!("Invalid JSON: {}", e)))?;

        Ok(Some(state))
    }

    async fn save(&self, state: &WizardState) -> Result<(), CheckpointStoreError> {
        let path = self.checkpoint_path(&state.deployment_id);
        let temp_path = self.temp_path(&state.deployment_id);

        // Serialize to temp file
        let content = serde_json::to_string_pretty(state)?;
        let mut file = fs::File::create(&temp_path).await?;
        file.write_all(content.as_bytes()).await?;
        file.sync_all().await?;
        drop(file);

        // Atomic rename
        fs::rename(&temp_path, &path).await?;

        Ok(())
    }

    async fn delete(&self, deployment_id: &str) -> Result<(), CheckpointStoreError> {
        let path = self.checkpoint_path(deployment_id);
        
        if path.exists() {
            fs::remove_file(&path).await?;
        }

        Ok(())
    }

    async fn list(&self) -> Result<Vec<String>, CheckpointStoreError> {
        let mut deployment_ids = Vec::new();
        
        let mut entries = fs::read_dir(&self.root).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    deployment_ids.push(stem.to_string());
                }
            }
        }

        Ok(deployment_ids)
    }
}

/// In-memory checkpoint store (for testing)
pub struct InMemoryCheckpointStore {
    data: tokio::sync::RwLock<std::collections::HashMap<String, WizardState>>,
}

impl InMemoryCheckpointStore {
    pub fn new() -> Self {
        Self {
            data: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        }
    }
}

impl Default for InMemoryCheckpointStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CheckpointStore for InMemoryCheckpointStore {
    async fn load(&self, deployment_id: &str) -> Result<Option<WizardState>, CheckpointStoreError> {
        let data = self.data.read().await;
        Ok(data.get(deployment_id).cloned())
    }

    async fn save(&self, state: &WizardState) -> Result<(), CheckpointStoreError> {
        let mut data = self.data.write().await;
        data.insert(state.deployment_id.clone(), state.clone());
        Ok(())
    }

    async fn delete(&self, deployment_id: &str) -> Result<(), CheckpointStoreError> {
        let mut data = self.data.write().await;
        data.remove(deployment_id);
        Ok(())
    }

    async fn list(&self) -> Result<Vec<String>, CheckpointStoreError> {
        let data = self.data.read().await;
        Ok(data.keys().cloned().collect())
    }
}

/// Idempotency key for preventing duplicate operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdempotencyKey {
    /// Unique key
    pub key: String,
    /// Created at
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Operation type
    pub operation: String,
}

impl IdempotencyKey {
    /// Generate new idempotency key for operation
    pub fn new(operation: &str) -> Self {
        Self {
            key: Uuid::new_v4().to_string(),
            created_at: chrono::Utc::now(),
            operation: operation.to_string(),
        }
    }

    /// Generate idempotency key from deployment ID and step
    pub fn for_step(deployment_id: &str, step: &str) -> Self {
        Self {
            key: format!("{}:{}", deployment_id, step),
            created_at: chrono::Utc::now(),
            operation: step.to_string(),
        }
    }
}

/// Idempotency store for tracking operations
pub struct IdempotencyStore {
    keys: tokio::sync::RwLock<std::collections::HashSet<String>>,
}

impl IdempotencyStore {
    pub fn new() -> Self {
        Self {
            keys: tokio::sync::RwLock::new(std::collections::HashSet::new()),
        }
    }

    /// Check if operation is duplicate
    pub async fn is_duplicate(&self, key: &str) -> bool {
        let keys = self.keys.read().await;
        keys.contains(key)
    }

    /// Mark operation as started
    pub async fn mark_started(&self, key: &str) -> bool {
        let mut keys = self.keys.write().await;
        if keys.contains(key) {
            false  // Already started
        } else {
            keys.insert(key.to_string());
            true  // First time
        }
    }

    /// Mark operation as completed
    pub async fn mark_completed(&self, key: &str) {
        let mut keys = self.keys.write().await;
        keys.remove(key);
    }

    /// Clear all keys
    pub async fn clear(&self) {
        let mut keys = self.keys.write().await;
        keys.clear();
    }
}

impl Default for IdempotencyStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state_machine::WizardStep;

    #[tokio::test]
    async fn test_in_memory_store() {
        let store = InMemoryCheckpointStore::new();
        let mut state = WizardState::new();
        state.deployment_id = "test-123".to_string();

        // Save
        store.save(&state).await.unwrap();

        // Load
        let loaded = store.load("test-123").await.unwrap().unwrap();
        assert_eq!(loaded.deployment_id, "test-123");

        // List
        let list = store.list().await.unwrap();
        assert_eq!(list.len(), 1);

        // Delete
        store.delete("test-123").await.unwrap();
        let loaded = store.load("test-123").await.unwrap();
        assert!(loaded.is_none());
    }

    #[tokio::test]
    async fn test_idempotency_store() {
        let store = IdempotencyStore::new();

        // First mark should succeed
        assert!(store.mark_started("op-1").await);

        // Second mark should fail (duplicate)
        assert!(!store.mark_started("op-1").await);

        // Check is_duplicate
        assert!(store.is_duplicate("op-1").await);

        // Mark completed
        store.mark_completed("op-1").await;

        // Should not be duplicate anymore
        assert!(!store.is_duplicate("op-1").await);
    }
}
