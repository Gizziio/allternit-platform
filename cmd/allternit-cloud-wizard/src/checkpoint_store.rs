//! Durable Checkpoint Store
//!
//! Persists wizard state to disk for crash-resume:
//! - File-backed JSON storage
//! - Atomic writes (temp + rename)
//! - Per-deployment state files
//! - Idempotency keys

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
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

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Encryption error: {0}")]
    Crypto(#[from] allternit_cloud_core::CredentialCryptoError),
}

/// Checkpoint store trait
///
/// All operations are scoped by `user_id`: a wizard checkpoint carries
/// provider tokens and SSH keys, so one user must never be able to load,
/// overwrite, or even enumerate another user's sessions.
#[async_trait]
pub trait CheckpointStore: Send + Sync {
    /// Load wizard state for deployment owned by `user_id`
    async fn load(&self, user_id: &str, deployment_id: &str) -> Result<Option<WizardState>, CheckpointStoreError>;

    /// Save wizard state under `user_id`
    async fn save(&self, user_id: &str, state: &WizardState) -> Result<(), CheckpointStoreError>;

    /// Delete checkpoint owned by `user_id`
    async fn delete(&self, user_id: &str, deployment_id: &str) -> Result<(), CheckpointStoreError>;

    /// List all checkpoint deployment IDs owned by `user_id`
    async fn list(&self, user_id: &str) -> Result<Vec<String>, CheckpointStoreError>;
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

    /// Get checkpoint file path (one subdirectory per user)
    fn checkpoint_path(&self, user_id: &str, deployment_id: &str) -> PathBuf {
        self.user_dir(user_id).join(format!("{}.json", deployment_id))
    }

    /// Get temp file path for atomic writes
    fn temp_path(&self, user_id: &str, deployment_id: &str) -> PathBuf {
        self.user_dir(user_id).join(format!("{}.tmp", deployment_id))
    }

    /// Per-user directory; user ids are URL/file-system unsafe in theory, so
    /// scrub to a conservative charset.
    fn user_dir(&self, user_id: &str) -> PathBuf {
        let safe: String = user_id
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        self.root.join(safe)
    }
}

#[async_trait]
impl CheckpointStore for FsCheckpointStore {
    async fn load(&self, user_id: &str, deployment_id: &str) -> Result<Option<WizardState>, CheckpointStoreError> {
        let path = self.checkpoint_path(user_id, deployment_id);

        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path).await?;
        let state: WizardState = serde_json::from_str(&content)
            .map_err(|e| CheckpointStoreError::Corrupted(format!("Invalid JSON: {}", e)))?;

        Ok(Some(state))
    }

    async fn save(&self, user_id: &str, state: &WizardState) -> Result<(), CheckpointStoreError> {
        let path = self.checkpoint_path(user_id, &state.deployment_id);
        let temp_path = self.temp_path(user_id, &state.deployment_id);

        fs::create_dir_all(path.parent().expect("checkpoint path has a parent")).await?;

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

    async fn delete(&self, user_id: &str, deployment_id: &str) -> Result<(), CheckpointStoreError> {
        let path = self.checkpoint_path(user_id, deployment_id);
        
        if path.exists() {
            fs::remove_file(&path).await?;
        }

        Ok(())
    }

    async fn list(&self, user_id: &str) -> Result<Vec<String>, CheckpointStoreError> {
        let mut deployment_ids = Vec::new();

        let dir = self.user_dir(user_id);
        if !dir.exists() {
            return Ok(deployment_ids);
        }
        let mut entries = fs::read_dir(&dir).await?;
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
    data: tokio::sync::RwLock<std::collections::HashMap<(String, String), WizardState>>,
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
    async fn load(&self, user_id: &str, deployment_id: &str) -> Result<Option<WizardState>, CheckpointStoreError> {
        let data = self.data.read().await;
        Ok(data.get(&(user_id.to_string(), deployment_id.to_string())).cloned())
    }

    async fn save(&self, user_id: &str, state: &WizardState) -> Result<(), CheckpointStoreError> {
        let mut data = self.data.write().await;
        data.insert((user_id.to_string(), state.deployment_id.clone()), state.clone());
        Ok(())
    }

    async fn delete(&self, user_id: &str, deployment_id: &str) -> Result<(), CheckpointStoreError> {
        let mut data = self.data.write().await;
        data.remove(&(user_id.to_string(), deployment_id.to_string()));
        Ok(())
    }

    async fn list(&self, user_id: &str) -> Result<Vec<String>, CheckpointStoreError> {
        let data = self.data.read().await;
        Ok(data
            .keys()
            .filter(|(owner, _)| owner == user_id)
            .map(|(_, id)| id.clone())
            .collect())
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
        store.save("user_a", &state).await.unwrap();

        // Load (owner only)
        let loaded = store.load("user_a", "test-123").await.unwrap().unwrap();
        assert_eq!(loaded.deployment_id, "test-123");
        assert!(store.load("user_b", "test-123").await.unwrap().is_none());

        // List
        let list = store.list("user_a").await.unwrap();
        assert_eq!(list.len(), 1);
        assert!(store.list("user_b").await.unwrap().is_empty());

        // Delete
        store.delete("user_a", "test-123").await.unwrap();
        let loaded = store.load("user_a", "test-123").await.unwrap();
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

// ============================================================================
// Postgres checkpoint store (production, survives restarts)
// ============================================================================

use allternit_cloud_core::CredentialCipher;
use sqlx::PgPool;
use std::sync::Arc;

/// Postgres-backed checkpoint store over the `wizard_sessions` table (see
/// `cmd/allternit-cloud-api/migrations_pg/001_initial.sql`). The serialized
/// wizard state carries provider tokens and SSH keys, so when a
/// [`CredentialCipher`] is configured the state column is encrypted at rest.
pub struct PgCheckpointStore {
    pool: PgPool,
    cipher: Option<Arc<CredentialCipher>>,
}

impl PgCheckpointStore {
    /// Create a store over an existing pool. `cipher` encrypts the state
    /// column; pass `None` only in tests/dev where plaintext is acceptable.
    pub fn new(pool: PgPool, cipher: Option<Arc<CredentialCipher>>) -> Self {
        Self { pool, cipher }
    }

    fn encode(&self, state: &WizardState) -> Result<String, CheckpointStoreError> {
        let JSONB = serde_json::to_string(state)?;
        match &self.cipher {
            Some(cipher) => Ok(cipher.encrypt(&JSONB)?),
            None => Ok(JSONB),
        }
    }

    fn decode(&self, stored: &str, deployment_id: &str) -> Result<WizardState, CheckpointStoreError> {
        let JSONB = match &self.cipher {
            Some(cipher) => cipher.decrypt(stored)?,
            None => stored.to_string(),
        };
        serde_json::from_str(&JSONB)
            .map_err(|e| CheckpointStoreError::Corrupted(format!("{}: {}", deployment_id, e)))
    }
}

#[async_trait]
impl CheckpointStore for PgCheckpointStore {
    async fn load(&self, user_id: &str, deployment_id: &str) -> Result<Option<WizardState>, CheckpointStoreError> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT state FROM wizard_sessions WHERE deployment_id = $1 AND user_id = $2",
        )
        .bind(deployment_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        row.map(|(state,)| self.decode(&state, deployment_id)).transpose()
    }

    async fn save(&self, user_id: &str, state: &WizardState) -> Result<(), CheckpointStoreError> {
        let encoded = self.encode(state)?;
        sqlx::query(
            r#"
            INSERT INTO wizard_sessions (deployment_id, user_id, state)
            VALUES ($1, $2, $3)
            ON CONFLICT(deployment_id) DO UPDATE SET
                user_id = excluded.user_id,
                state = excluded.state,
                updated_at = NOW()
            "#,
        )
        .bind(&state.deployment_id)
        .bind(user_id)
        .bind(&encoded)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn delete(&self, user_id: &str, deployment_id: &str) -> Result<(), CheckpointStoreError> {
        sqlx::query("DELETE FROM wizard_sessions WHERE deployment_id = $1 AND user_id = $2")
            .bind(deployment_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn list(&self, user_id: &str) -> Result<Vec<String>, CheckpointStoreError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT deployment_id FROM wizard_sessions WHERE user_id = $1 ORDER BY updated_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }
}

#[cfg(test)]
mod pg_tests {
    //! Tests for [`PgCheckpointStore`] against real PostgreSQL (the store's
    //! only supported backend — `?` placeholders and `PgPool::connect(":memory:")`
    //! were SQLite-isms that could never run). Mirrors the cloud-api test
    //! pattern: one ephemeral schema per test on the shared `allternit_test`
    //! database, with `search_path` pinned per connection.
    use super::*;

    const TEST_DB_URL: &str =
        "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";

    async fn connect(schema: &str) -> PgPool {
        let schema_for_hook = schema.to_string();
        sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .after_connect(move |conn, _meta| {
                let schema = schema_for_hook.clone();
                Box::pin(async move {
                    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query(&format!("SET search_path TO {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(TEST_DB_URL)
            .await
            .unwrap()
    }

    async fn create_wizard_sessions_table(pool: &PgPool) {
        sqlx::query(
            r#"
            CREATE TABLE wizard_sessions (
                deployment_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                state TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(pool)
        .await
        .unwrap();
    }

    async fn fresh_pool() -> PgPool {
        let schema = format!("test_{}", uuid::Uuid::new_v4().simple());
        let pool = connect(&schema).await;
        create_wizard_sessions_table(&pool).await;
        pool
    }

    #[tokio::test]
    async fn pg_store_roundtrip_is_user_scoped() {
        let pool = fresh_pool().await;
        let store = PgCheckpointStore::new(pool, None);
        let mut state = WizardState::new();
        state.deployment_id = "dep-1".to_string();

        store.save("user_a", &state).await.unwrap();
        let loaded = store.load("user_a", "dep-1").await.unwrap().unwrap();
        assert_eq!(loaded.deployment_id, "dep-1");

        // Another user can neither load nor list nor delete it.
        assert!(store.load("user_b", "dep-1").await.unwrap().is_none());
        assert!(store.list("user_b").await.unwrap().is_empty());
        store.delete("user_b", "dep-1").await.unwrap();
        assert!(store.load("user_a", "dep-1").await.unwrap().is_some());

        store.delete("user_a", "dep-1").await.unwrap();
        assert!(store.load("user_a", "dep-1").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn pg_store_encrypts_state_at_rest() {
        let pool = fresh_pool().await;
        let cipher = CredentialCipher::new("wizard-test-key");
        let store = PgCheckpointStore::new(pool.clone(), Some(Arc::new(cipher)));

        let mut state = WizardState::new();
        state.deployment_id = "dep-secret".to_string();
        state.context.api_token = Some("hcx-secret-token".to_string());
        store.save("user_a", &state).await.unwrap();

        // The raw column must not contain the token.
        let (raw,): (String,) =
            sqlx::query_as("SELECT state FROM wizard_sessions WHERE deployment_id = 'dep-secret'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(raw.starts_with("v1:"), "state must be ciphertext, got: {}", &raw[..20.min(raw.len())]);
        assert!(!raw.contains("hcx-secret-token"));

        // ...but the loaded state decrypts back to the original.
        let loaded = store.load("user_a", "dep-secret").await.unwrap().unwrap();
        assert_eq!(loaded.context.api_token.as_deref(), Some("hcx-secret-token"));
    }

    #[tokio::test]
    async fn pg_store_survives_reopen() {
        // A brand-new pool (a "restart" of the store) over the same schema
        // must still see the checkpoint.
        let schema = format!("test_{}", uuid::Uuid::new_v4().simple());

        let pool = connect(&schema).await;
        create_wizard_sessions_table(&pool).await;
        let mut state = WizardState::new();
        state.deployment_id = "dep-restart".to_string();
        PgCheckpointStore::new(pool.clone(), None)
            .save("user_a", &state)
            .await
            .unwrap();
        drop(state);
        drop(pool);

        let pool = connect(&schema).await;
        let loaded = PgCheckpointStore::new(pool, None)
            .load("user_a", "dep-restart")
            .await
            .unwrap();
        assert!(loaded.is_some(), "state must survive a store restart");
    }
}
