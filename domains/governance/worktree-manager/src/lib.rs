//! Worktree Manager
//!
//! Provides automated git worktree management for agent isolation.

use std::path::{Path, PathBuf};
use tracing::{debug, error, info, warn};

pub mod types;

pub use types::{CleanupPolicy, Worktree, WorktreeConfig, WorktreeInfo};

/// Worktree manager
#[derive(Debug, Clone)]
pub struct WorktreeManager {
    base_repo: PathBuf,
    worktree_root: PathBuf,
}

impl WorktreeManager {
    /// Create a new worktree manager
    pub fn new(base_repo: impl AsRef<Path>) -> anyhow::Result<Self> {
        let base_repo = base_repo.as_ref().canonicalize()?;
        let worktree_root = base_repo.join(".a2r").join("worktrees");

        Ok(Self {
            base_repo,
            worktree_root,
        })
    }

    /// Create a new worktree manager with custom root
    pub fn with_root(
        base_repo: impl AsRef<Path>,
        worktree_root: impl AsRef<Path>,
    ) -> anyhow::Result<Self> {
        let base_repo = base_repo.as_ref().canonicalize()?;
        let worktree_root = worktree_root.as_ref().to_path_buf();

        Ok(Self {
            base_repo,
            worktree_root,
        })
    }

    /// Generate a branch name from DAG and node IDs
    pub fn generate_branch_name(&self, dag_id: &str, node_id: &str) -> String {
        let sanitized_dag = dag_id.replace(|c: char| !c.is_alphanumeric(), "-");
        let sanitized_node = node_id.replace(|c: char| !c.is_alphanumeric(), "-");
        format!("a2r/{}/{}", sanitized_dag, sanitized_node)
    }

    /// Ensure a worktree exists (create if necessary)
    pub async fn ensure_worktree(
        &self,
        branch: &str,
        base_branch: Option<&str>,
    ) -> anyhow::Result<Worktree> {
        // Check if worktree already exists
        if let Some(worktree) = self.find_worktree(branch).await? {
            info!("Worktree already exists: {}", worktree.path.display());
            return Ok(worktree);
        }

        // Create worktree path
        let worktree_path = self.worktree_root.join(branch.replace('/', "-"));
        std::fs::create_dir_all(&worktree_path)?;

        // Ensure branch exists
        self.ensure_branch(branch, base_branch).await?;

        // Create worktree
        info!("Creating worktree for branch '{}' at {}", branch, worktree_path.display());

        let output = tokio::process::Command::new("git")
            .args(["worktree", "add", worktree_path.to_str().unwrap(), branch])
            .current_dir(&self.base_repo)
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Failed to create worktree: {}", stderr);
            anyhow::bail!("Failed to create worktree: {}", stderr);
        }

        let worktree = Worktree {
            path: worktree_path.clone(),
            branch: branch.to_string(),
            created_at: chrono::Utc::now(),
            is_clean: true,
        };

        info!("Created worktree: {} -> {}", branch, worktree_path.display());
        Ok(worktree)
    }

    /// Ensure a branch exists (create from base if necessary)
    async fn ensure_branch(&self, branch: &str, base_branch: Option<&str>) -> anyhow::Result<()> {
        // Check if branch exists
        let output = tokio::process::Command::new("git")
            .args(["branch", "--list", branch])
            .current_dir(&self.base_repo)
            .output()
            .await?;

        if !output.stdout.is_empty() {
            debug!("Branch '{}' already exists", branch);
            return Ok(());
        }

        // Create branch from base
        let base = base_branch.unwrap_or("HEAD");
        info!("Creating branch '{}' from '{}'", branch, base);

        let output = tokio::process::Command::new("git")
            .args(["branch", branch, base])
            .current_dir(&self.base_repo)
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to create branch: {}", stderr);
        }

        Ok(())
    }

    /// Find an existing worktree by branch name
    pub async fn find_worktree(&self, branch: &str) -> anyhow::Result<Option<Worktree>> {
        let worktrees = self.list_worktrees().await?;
        Ok(worktrees.into_iter().find(|w| w.branch == branch))
    }

    /// List all worktrees
    pub async fn list_worktrees(&self) -> anyhow::Result<Vec<Worktree>> {
        let output = tokio::process::Command::new("git")
            .args(["worktree", "list", "--porcelain"])
            .current_dir(&self.base_repo)
            .output()
            .await?;

        if !output.status.success() {
            anyhow::bail!("Failed to list worktrees");
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut worktrees = Vec::new();
        let mut current_path: Option<PathBuf> = None;
        let mut current_branch: Option<String> = None;

        for line in stdout.lines() {
            if line.starts_with("worktree ") {
                // Save previous worktree
                if let (Some(path), Some(branch)) = (&current_path, &current_branch) {
                    worktrees.push(Worktree {
                        path: path.clone(),
                        branch: branch.clone(),
                        created_at: chrono::Utc::now(), // Git doesn't track creation time
                        is_clean: true,
                    });
                }
                current_path = Some(PathBuf::from(&line[9..]));
                current_branch = None;
            } else if line.starts_with("branch ") {
                let branch_ref = &line[7..];
                // Extract branch name from refs/heads/...
                current_branch = branch_ref.strip_prefix("refs/heads/").map(|s| s.to_string());
            }
        }

        // Don't forget the last one
        if let (Some(path), Some(branch)) = (current_path, current_branch) {
            worktrees.push(Worktree {
                path,
                branch,
                created_at: chrono::Utc::now(),
                is_clean: true,
            });
        }

        Ok(worktrees)
    }

    /// Remove a worktree
    pub async fn remove_worktree(&self, branch: &str) -> anyhow::Result<()> {
        info!("Removing worktree for branch: {}", branch);

        let output = tokio::process::Command::new("git")
            .args(["worktree", "remove", branch, "--force"])
            .current_dir(&self.base_repo)
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            warn!("Failed to remove worktree: {}", stderr);
            // Try manual cleanup
        }

        // Also remove the worktree directory if it exists
        let worktree_path = self.worktree_root.join(branch.replace('/', "-"));
        if worktree_path.exists() {
            tokio::fs::remove_dir_all(&worktree_path).await.ok();
        }

        info!("Removed worktree: {}", branch);
        Ok(())
    }

    /// Check if a worktree has uncommitted changes
    pub async fn is_clean(&self, worktree_path: &Path) -> anyhow::Result<bool> {
        let output = tokio::process::Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(worktree_path)
            .output()
            .await?;

        Ok(output.stdout.is_empty())
    }

    /// Clean up worktrees based on policy
    pub async fn cleanup(&self, policy: CleanupPolicy) -> anyhow::Result<Vec<String>> {
        info!("Running cleanup with policy: {:?}", policy);

        let worktrees = self.list_worktrees().await?;
        let mut removed = Vec::new();

        for worktree in worktrees {
            // Skip main worktree
            if worktree.path == self.base_repo {
                continue;
            }

            let should_remove = match &policy {
                CleanupPolicy::All => true,
                CleanupPolicy::Orphaned => !self.branch_exists(&worktree.branch).await?,
                CleanupPolicy::CleanOnly => self.is_clean(&worktree.path).await?,
                CleanupPolicy::OlderThan(duration) => {
                    let metadata = tokio::fs::metadata(&worktree.path).await?;
                    let modified = metadata.modified()?;
                    let age = std::time::SystemTime::now().duration_since(modified)?;
                    age > *duration
                }
                CleanupPolicy::Never => false,
            };

            if should_remove {
                self.remove_worktree(&worktree.branch).await?;
                removed.push(worktree.branch);
            }
        }

        info!("Cleaned up {} worktrees", removed.len());
        Ok(removed)
    }

    /// Check if a branch exists
    async fn branch_exists(&self, branch: &str) -> anyhow::Result<bool> {
        let output = tokio::process::Command::new("git")
            .args(["branch", "--list", branch])
            .current_dir(&self.base_repo)
            .output()
            .await?;

        Ok(!output.stdout.is_empty())
    }

    /// Get worktree info
    pub async fn get_worktree_info(&self, branch: &str) -> anyhow::Result<WorktreeInfo> {
        let worktree = self
            .find_worktree(branch)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Worktree not found: {}", branch))?;

        let is_clean = self.is_clean(&worktree.path).await?;
        let has_branch = self.branch_exists(branch).await?;

        Ok(WorktreeInfo {
            path: worktree.path,
            branch: worktree.branch,
            is_clean,
            branch_exists: has_branch,
        })
    }

    /// Prune stale worktree entries
    pub async fn prune(&self) -> anyhow::Result<()> {
        info!("Pruning stale worktree entries");

        let output = tokio::process::Command::new("git")
            .args(["worktree", "prune"])
            .current_dir(&self.base_repo)
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to prune worktrees: {}", stderr);
        }

        Ok(())
    }
}

impl Default for WorktreeManager {
    fn default() -> Self {
        Self::new(std::env::current_dir().unwrap()).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_branch_name() {
        let manager = WorktreeManager::new("/tmp").unwrap();
        let name = manager.generate_branch_name("D2026-02-13", "N1");
        assert_eq!(name, "a2r/D2026-02-13/N1");
    }

    #[test]
    fn test_generate_branch_name_special_chars() {
        let manager = WorktreeManager::new("/tmp").unwrap();
        let name = manager.generate_branch_name("D2026.02.13", "N1.2");
        assert_eq!(name, "a2r/D2026-02-13/N1-2");
    }
}
