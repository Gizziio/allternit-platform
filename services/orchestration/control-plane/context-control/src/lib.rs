//! A2R Context Control Plane
//!
//! Git Context Controller (GCC) implementation:
//! - Context as first-class object (not chat history)
//! - Versioned memory ops: commit/branch/merge/context
//! - Multi-resolution retrieval: summary → state → traces
//! - Shareable context bundles

use a2r_memory_kernel::{MemoryKernel, MemoryEvent};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Context Types
// ============================================================================

/// Context state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ContextState {
    Active,
    Archived,
    Shared,
}

/// Branch in context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branch {
    pub branch_id: String,
    pub name: String,
    pub commits: Vec<Commit>,
    pub summary: Option<String>,
}

/// Commit in branch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub commit_id: String,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub content_hash: String,
    pub parent_id: Option<String>,
}

/// Context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Context {
    pub context_id: String,
    pub name: String,
    pub state: ContextState,
    pub branches: Vec<Branch>,
    pub active_branch: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Context bundle for sharing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextBundle {
    pub bundle_id: String,
    pub context_id: String,
    pub branch_name: String,
    pub content: Vec<u8>,
    pub manifest: BundleManifest,
    pub created_at: DateTime<Utc>,
}

/// Bundle manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleManifest {
    pub commit_count: usize,
    pub event_count: usize,
    pub entity_count: usize,
    pub size_bytes: u64,
    pub hash: String,
}

// ============================================================================
// Context Resolution
// ============================================================================

/// Context resolution level
#[derive(Debug, Clone, Copy)]
pub enum ContextResolution {
    Summary,
    State,
    Traces,
}

/// Context snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSnapshot {
    pub context_id: String,
    pub data: SnapshotData,
}

/// Snapshot data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SnapshotData {
    Summary(String),
    State(Context),
    Traces(Context),
}

// ============================================================================
// Context Control Plane
// ============================================================================

/// Context Control Plane
pub struct ContextControlPlane {
    contexts: Arc<RwLock<HashMap<String, Context>>>,
    memory: Arc<MemoryKernel>,
}

impl ContextControlPlane {
    pub fn new(memory: Arc<MemoryKernel>) -> Self {
        Self {
            contexts: Arc::new(RwLock::new(HashMap::new())),
            memory,
        }
    }

    /// Create new context
    pub async fn create_context(&self, name: &str) -> String {
        let context_id = format!("ctx_{}", Uuid::new_v4().simple());
        let now = Utc::now();

        let context = Context {
            context_id: context_id.clone(),
            name: name.to_string(),
            state: ContextState::Active,
            branches: vec![Branch {
                branch_id: format!("br_{}", Uuid::new_v4().simple()),
                name: "main".to_string(),
                commits: vec![],
                summary: None,
            }],
            active_branch: "main".to_string(),
            created_at: now,
            updated_at: now,
        };

        let mut contexts = self.contexts.write().await;
        contexts.insert(context_id.clone(), context);

        // Log event
        self.memory
            .append_event(MemoryEvent::new(
                "context_created",
                serde_json::json!({"context_id": context_id, "name": name}),
            ))
            .await;

        context_id
    }

    /// Get context
    pub async fn get_context(&self, context_id: &str) -> Option<Context> {
        let contexts = self.contexts.read().await;
        contexts.get(context_id).cloned()
    }

    /// Commit to context
    pub async fn commit(
        &self,
        context_id: &str,
        branch_name: &str,
        message: &str,
        content: &str,
    ) -> Result<String, ContextError> {
        let mut contexts = self.contexts.write().await;
        let context = contexts
            .get_mut(context_id)
            .ok_or_else(|| ContextError::NotFound(format!("Context {}", context_id)))?;

        // Find branch
        let branch = context
            .branches
            .iter_mut()
            .find(|b| b.name == branch_name)
            .ok_or_else(|| ContextError::NotFound(format!("Branch {}", branch_name)))?;

        // Create commit
        let commit_id = format!("cmt_{}", Uuid::new_v4().simple());
        let content_hash = Self::hash_content(content);
        let parent_id = branch.commits.last().map(|c| c.commit_id.clone());

        let commit = Commit {
            commit_id: commit_id.clone(),
            message: message.to_string(),
            timestamp: Utc::now(),
            content_hash,
            parent_id,
        };

        branch.commits.push(commit);
        context.updated_at = Utc::now();

        // Log event
        self.memory
            .append_event(MemoryEvent::new(
                "context_committed",
                serde_json::json!({"context_id": context_id, "commit_id": commit_id}),
            ))
            .await;

        Ok(commit_id)
    }

    /// Create branch
    pub async fn create_branch(
        &self,
        context_id: &str,
        from_branch: &str,
        name: &str,
    ) -> Result<String, ContextError> {
        let mut contexts = self.contexts.write().await;
        let context = contexts
            .get_mut(context_id)
            .ok_or_else(|| ContextError::NotFound(format!("Context {}", context_id)))?;

        // Find source branch
        let source = context
            .branches
            .iter()
            .find(|b| b.name == from_branch)
            .ok_or_else(|| ContextError::NotFound(format!("Branch {}", from_branch)))?;

        // Create new branch with commits copied
        let new_branch = Branch {
            branch_id: format!("br_{}", Uuid::new_v4().simple()),
            name: name.to_string(),
            commits: source.commits.clone(),
            summary: None,
        };

        let branch_id = new_branch.branch_id.clone();
        context.branches.push(new_branch);
        context.updated_at = Utc::now();

        Ok(branch_id)
    }

    /// Merge branch
    pub async fn merge(
        &self,
        context_id: &str,
        source_branch: &str,
        target_branch: &str,
        strategy: &str,
    ) -> Result<(), ContextError> {
        let mut contexts = self.contexts.write().await;
        let context = contexts
            .get_mut(context_id)
            .ok_or_else(|| ContextError::NotFound(format!("Context {}", context_id)))?;

        // Verify branches exist
        if !context.branches.iter().any(|b| b.name == source_branch) {
            return Err(ContextError::NotFound(format!("Branch {}", source_branch)));
        }
        if !context.branches.iter().any(|b| b.name == target_branch) {
            return Err(ContextError::NotFound(format!("Branch {}", target_branch)));
        }

        // Log merge event
        self.memory
            .append_event(MemoryEvent::new(
                "context_merged",
                serde_json::json!({
                    "context_id": context_id,
                    "source": source_branch,
                    "target": target_branch,
                    "strategy": strategy
                }),
            ))
            .await;

        Ok(())
    }

    /// Get context at specific point (multi-resolution retrieval)
    pub async fn get_context_at(
        &self,
        context_id: &str,
        resolution: ContextResolution,
    ) -> Result<ContextSnapshot, ContextError> {
        let contexts = self.contexts.read().await;
        let context = contexts
            .get(context_id)
            .ok_or_else(|| ContextError::NotFound(format!("Context {}", context_id)))?
            .clone();

        match resolution {
            ContextResolution::Summary => {
                let branch = context
                    .branches
                    .iter()
                    .find(|b| b.name == context.active_branch)
                    .ok_or_else(|| ContextError::NotFound("Active branch".to_string()))?;

                Ok(ContextSnapshot {
                    context_id: context.context_id.clone(),
                    data: SnapshotData::Summary(branch.summary.clone().unwrap_or_default()),
                })
            }
            ContextResolution::State => Ok(ContextSnapshot {
                context_id: context.context_id.clone(),
                data: SnapshotData::State(context),
            }),
            ContextResolution::Traces => Ok(ContextSnapshot {
                context_id: context.context_id.clone(),
                data: SnapshotData::Traces(context),
            }),
        }
    }

    /// Export context bundle
    pub async fn export_bundle(
        &self,
        context_id: &str,
        branch_name: &str,
    ) -> Result<ContextBundle, ContextError> {
        let contexts = self.contexts.read().await;
        let context = contexts
            .get(context_id)
            .ok_or_else(|| ContextError::NotFound(format!("Context {}", context_id)))?;

        let branch = context
            .branches
            .iter()
            .find(|b| b.name == branch_name)
            .ok_or_else(|| ContextError::NotFound(format!("Branch {}", branch_name)))?;

        // Create bundle
        let content = serde_json::to_vec(&context)?;
        let content_len = content.len() as u64;
        let hash = Self::hash_content(&String::from_utf8_lossy(&content));

        let stats = self.memory.get_stats().await;

        let bundle = ContextBundle {
            bundle_id: format!("bundle_{}", Uuid::new_v4().simple()),
            context_id: context_id.to_string(),
            branch_name: branch_name.to_string(),
            content,
            manifest: BundleManifest {
                commit_count: branch.commits.len(),
                event_count: stats.event_count,
                entity_count: stats.entity_count,
                size_bytes: content_len,
                hash,
            },
            created_at: Utc::now(),
        };

        Ok(bundle)
    }

    /// Hash content
    fn hash_content(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

/// Context error types
#[derive(Debug, thiserror::Error)]
pub enum ContextError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_memory() -> Arc<MemoryKernel> {
        Arc::new(MemoryKernel::default())
    }

    #[tokio::test]
    async fn test_create_context() {
        let cp = ContextControlPlane::new(create_test_memory());

        let context_id = cp.create_context("Test Context").await;
        assert!(context_id.starts_with("ctx_"));

        let context = cp.get_context(&context_id).await;
        assert!(context.is_some());
        assert_eq!(context.unwrap().name, "Test Context");
    }

    #[tokio::test]
    async fn test_commit() {
        let cp = ContextControlPlane::new(create_test_memory());

        let context_id = cp.create_context("Test").await;

        let commit_id = cp
            .commit(&context_id, "main", "Initial commit", "content")
            .await;
        assert!(commit_id.is_ok());

        let context = cp.get_context(&context_id).await.unwrap();
        let branch = &context.branches[0];
        assert_eq!(branch.commits.len(), 1);
    }

    #[tokio::test]
    async fn test_create_branch() {
        let cp = ContextControlPlane::new(create_test_memory());

        let context_id = cp.create_context("Test").await;
        cp.commit(&context_id, "main", "Commit", "content")
            .await
            .unwrap();

        let branch_id = cp.create_branch(&context_id, "main", "feature").await;
        assert!(branch_id.is_ok());

        let context = cp.get_context(&context_id).await.unwrap();
        assert_eq!(context.branches.len(), 2);
    }

    #[tokio::test]
    async fn test_merge() {
        let cp = ContextControlPlane::new(create_test_memory());

        let context_id = cp.create_context("Test").await;
        cp.create_branch(&context_id, "main", "feature")
            .await
            .unwrap();

        let result = cp.merge(&context_id, "feature", "main", "fast-forward").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_export_bundle() {
        let cp = ContextControlPlane::new(create_test_memory());

        let context_id = cp.create_context("Test").await;
        cp.commit(&context_id, "main", "Commit", "content")
            .await
            .unwrap();

        let bundle = cp.export_bundle(&context_id, "main").await;
        assert!(bundle.is_ok());

        let bundle = bundle.unwrap();
        assert!(bundle.bundle_id.starts_with("bundle_"));
        assert!(bundle.manifest.size_bytes > 0);
    }

    #[tokio::test]
    async fn test_get_context_at() {
        let cp = ContextControlPlane::new(create_test_memory());

        let context_id = cp.create_context("Test").await;
        cp.commit(&context_id, "main", "Commit", "content")
            .await
            .unwrap();

        let snapshot = cp
            .get_context_at(&context_id, ContextResolution::Summary)
            .await;
        assert!(snapshot.is_ok());
    }
}
