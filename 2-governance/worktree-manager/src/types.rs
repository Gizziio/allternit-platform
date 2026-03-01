//! Types for worktree management

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

/// A git worktree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Worktree {
    /// Path to the worktree
    pub path: PathBuf,
    /// Branch name
    pub branch: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Whether the worktree has uncommitted changes
    pub is_clean: bool,
}

/// Worktree configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeConfig {
    /// Whether to auto-create the worktree
    #[serde(default = "default_auto_create")]
    pub auto_create: bool,
    /// Branch name prefix
    #[serde(default = "default_branch_prefix")]
    pub branch_prefix: String,
    /// Cleanup policy
    #[serde(default)]
    pub cleanup_on_done: CleanupPolicy,
    /// Base branch to create from
    #[serde(default = "default_base_branch")]
    pub base_branch: String,
}

impl Default for WorktreeConfig {
    fn default() -> Self {
        Self {
            auto_create: true,
            branch_prefix: "a2r/".to_string(),
            cleanup_on_done: CleanupPolicy::CleanOnly,
            base_branch: "main".to_string(),
        }
    }
}

fn default_auto_create() -> bool {
    true
}

fn default_branch_prefix() -> String {
    "a2r/".to_string()
}

fn default_base_branch() -> String {
    "main".to_string()
}

/// Cleanup policy for worktrees
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CleanupPolicy {
    /// Remove all managed worktrees
    All,
    /// Remove only orphaned worktrees (no corresponding branch)
    Orphaned,
    /// Remove only clean worktrees (no uncommitted changes)
    CleanOnly,
    /// Remove worktrees older than a duration
    #[serde(with = "duration_serde")]
    OlderThan(Duration),
    /// Never cleanup automatically
    Never,
}

impl Default for CleanupPolicy {
    fn default() -> Self {
        CleanupPolicy::CleanOnly
    }
}

impl std::fmt::Display for CleanupPolicy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CleanupPolicy::All => write!(f, "all"),
            CleanupPolicy::Orphaned => write!(f, "orphaned"),
            CleanupPolicy::CleanOnly => write!(f, "clean_only"),
            CleanupPolicy::OlderThan(d) => write!(f, "older_than_{}s", d.as_secs()),
            CleanupPolicy::Never => write!(f, "never"),
        }
    }
}

/// Worktree info for reporting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    /// Path to the worktree
    pub path: PathBuf,
    /// Branch name
    pub branch: String,
    /// Whether the worktree is clean
    pub is_clean: bool,
    /// Whether the branch still exists
    pub branch_exists: bool,
}

/// Serialization helper for Duration
mod duration_serde {
    use serde::{Deserialize, Deserializer, Serializer};
    use std::time::Duration;

    pub fn serialize<S>(duration: &Duration, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_u64(duration.as_secs())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Duration, D::Error>
    where
        D: Deserializer<'de>,
    {
        let secs = u64::deserialize(deserializer)?;
        Ok(Duration::from_secs(secs))
    }
}
