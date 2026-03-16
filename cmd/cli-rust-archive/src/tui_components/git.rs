//! Git integration for auto-commit functionality
//!
//! Features:
//! - Auto-commit before/after AI changes
//! - Commit message generation
//! - Diff summary in commits
//! - Configurable behavior

use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;

/// Git auto-commit configuration
#[derive(Debug, Clone)]
pub struct GitAutoCommitConfig {
    pub enabled: bool,
    pub mode: AutoCommitMode,
    pub include_diff: bool,
    pub max_diff_lines: usize,
    pub commit_prefix: String,
}

impl Default for GitAutoCommitConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: AutoCommitMode::Ask,
            include_diff: true,
            max_diff_lines: 50,
            commit_prefix: "a2r:".to_string(),
        }
    }
}

/// Auto-commit behavior mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AutoCommitMode {
    /// Always auto-commit
    Auto,
    /// Ask before committing
    Ask,
    /// Never auto-commit
    Off,
}

impl AutoCommitMode {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "auto" | "on" => Some(AutoCommitMode::Auto),
            "ask" => Some(AutoCommitMode::Ask),
            "off" | "disabled" => Some(AutoCommitMode::Off),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            AutoCommitMode::Auto => "auto",
            AutoCommitMode::Ask => "ask",
            AutoCommitMode::Off => "off",
        }
    }
}

/// Git repository status
#[derive(Debug, Clone)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub has_changes: bool,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
}

/// Git integration manager
pub struct GitManager {
    config: GitAutoCommitConfig,
    repo_path: PathBuf,
}

impl GitManager {
    /// Create a new git manager
    pub fn new(repo_path: impl AsRef<Path>) -> Self {
        Self {
            config: GitAutoCommitConfig::default(),
            repo_path: repo_path.as_ref().to_path_buf(),
        }
    }

    /// Create with configuration
    pub fn with_config(repo_path: impl AsRef<Path>, config: GitAutoCommitConfig) -> Self {
        Self {
            config,
            repo_path: repo_path.as_ref().to_path_buf(),
        }
    }

    /// Update configuration
    pub fn set_config(&mut self, config: GitAutoCommitConfig) {
        self.config = config;
    }

    /// Get current configuration
    pub fn config(&self) -> &GitAutoCommitConfig {
        &self.config
    }

    /// Check if git is available and we're in a repo
    pub async fn is_git_repo(&self) -> bool {
        let result = Command::new("git")
            .args(["rev-parse", "--git-dir"])
            .current_dir(&self.repo_path)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await;

        matches!(result, Ok(status) if status.success())
    }

    /// Get git status
    pub async fn get_status(&self) -> Option<GitStatus> {
        if !self.is_git_repo().await {
            return Some(GitStatus {
                is_repo: false,
                branch: String::new(),
                has_changes: false,
                staged_count: 0,
                unstaged_count: 0,
                untracked_count: 0,
            });
        }

        let branch = self.get_current_branch().await.unwrap_or_default();
        
        let output = Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&self.repo_path)
            .output()
            .await
            .ok()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().collect();

        let staged_count = lines.iter().filter(|l| l.starts_with('A') || l.starts_with('M') || l.starts_with('D') || l.starts_with('R')).count();
        let unstaged_count = lines.iter().filter(|l| l.starts_with(' ') || l.starts_with('?')).count();
        let untracked_count = lines.iter().filter(|l| l.starts_with("??")).count();

        Some(GitStatus {
            is_repo: true,
            branch,
            has_changes: !lines.is_empty(),
            staged_count,
            unstaged_count,
            untracked_count,
        })
    }

    /// Get current branch name
    pub async fn get_current_branch(&self) -> Option<String> {
        let output = Command::new("git")
            .args(["branch", "--show-current"])
            .current_dir(&self.repo_path)
            .output()
            .await
            .ok()?;

        if output.status.success() {
            Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            None
        }
    }

    /// Get diff summary for commit message
    pub async fn get_diff_summary(&self, max_lines: usize) -> String {
        let output = Command::new("git")
            .args(["diff", "--stat"])
            .current_dir(&self.repo_path)
            .output()
            .await;

        match output {
            Ok(output) if output.status.success() => {
                let diff = String::from_utf8_lossy(&output.stdout);
                let lines: Vec<&str> = diff.lines().collect();
                if lines.len() > max_lines {
                    format!("{}\n... ({} more lines)", 
                        lines[..max_lines].join("\n"),
                        lines.len() - max_lines
                    )
                } else {
                    diff.to_string()
                }
            }
            _ => String::new(),
        }
    }

    /// Stage all changes
    pub async fn stage_all(&self) -> Result<(), String> {
        let result = Command::new("git")
            .args(["add", "-A"])
            .current_dir(&self.repo_path)
            .status()
            .await;

        match result {
            Ok(status) if status.success() => Ok(()),
            Ok(_) => Err("Failed to stage changes".to_string()),
            Err(e) => Err(format!("Git error: {}", e)),
        }
    }

    /// Commit with generated message
    pub async fn commit(&self, message: impl AsRef<str>) -> Result<String, String> {
        let output = Command::new("git")
            .args(["commit", "-m", message.as_ref()])
            .current_dir(&self.repo_path)
            .output()
            .await;

        match output {
            Ok(output) if output.status.success() => {
                Ok(String::from_utf8_lossy(&output.stdout).to_string())
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Commit failed: {}", stderr))
            }
            Err(e) => Err(format!("Git error: {}", e)),
        }
    }

    /// Generate commit message for AI changes
    pub async fn generate_commit_message(&self, description: Option<&str>) -> String {
        let diff_stat = self.get_diff_summary(self.config.max_diff_lines).await;
        let prefix = &self.config.commit_prefix;
        
        let message = if let Some(desc) = description {
            format!("{} {}", prefix, desc)
        } else {
            format!("{} AI-assisted changes", prefix)
        };

        if self.config.include_diff && !diff_stat.is_empty() {
            format!("{}\n\nChanges:\n{}", message, diff_stat)
        } else {
            message
        }
    }

    /// Auto-commit changes if enabled
    pub async fn auto_commit(&self, description: Option<&str>) -> Result<String, String> {
        if !self.config.enabled || self.config.mode == AutoCommitMode::Off {
            return Err("Auto-commit is disabled".to_string());
        }

        // Check if there are changes
        let status = self.get_status().await.ok_or("Failed to get git status")?;
        if !status.has_changes {
            return Err("No changes to commit".to_string());
        }

        // Stage all changes
        self.stage_all().await?;

        // Generate and use commit message
        let message = self.generate_commit_message(description).await;
        self.commit(&message).await
    }

    /// Get recent commits
    pub async fn get_recent_commits(&self, count: usize) -> Vec<String> {
        let output = Command::new("git")
            .args(["log", "--oneline", "-n", &count.to_string()])
            .current_dir(&self.repo_path)
            .output()
            .await;

        match output {
            Ok(output) if output.status.success() => {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .map(|s| s.to_string())
                    .collect()
            }
            _ => Vec::new(),
        }
    }

    /// Check if auto-commit should proceed (for Ask mode)
    pub fn should_ask(&self) -> bool {
        self.config.enabled && self.config.mode == AutoCommitMode::Ask
    }

    /// Check if auto-commit is automatic
    pub fn is_auto(&self) -> bool {
        self.config.enabled && self.config.mode == AutoCommitMode::Auto
    }
}

/// Parse git auto-commit config from string (YAML-like)
pub fn parse_git_config(content: &str) -> GitAutoCommitConfig {
    let mut config = GitAutoCommitConfig::default();

    for line in content.lines() {
        let trimmed = line.trim();
        
        if trimmed.starts_with("enabled:") {
            config.enabled = trimmed
                .split(':')
                .nth(1)
                .map(|s| s.trim().parse::<bool>().unwrap_or(false))
                .unwrap_or(false);
        } else if trimmed.starts_with("mode:") {
            if let Some(mode_str) = trimmed.split(':').nth(1) {
                if let Some(mode) = AutoCommitMode::from_str(mode_str.trim()) {
                    config.mode = mode;
                }
            }
        } else if trimmed.starts_with("include_diff:") {
            config.include_diff = trimmed
                .split(':')
                .nth(1)
                .map(|s| s.trim().parse::<bool>().unwrap_or(true))
                .unwrap_or(true);
        } else if trimmed.starts_with("max_diff_lines:") {
            config.max_diff_lines = trimmed
                .split(':')
                .nth(1)
                .map(|s| s.trim().parse::<usize>().unwrap_or(50))
                .unwrap_or(50);
        } else if trimmed.starts_with("commit_prefix:") {
            config.commit_prefix = trimmed
                .splitn(2, ':')
                .nth(1)
                .map(|s| {
                    let s = s.trim();
                    // Strip quotes if present
                    if (s.starts_with('"') && s.ends_with('"')) || 
                       (s.starts_with('\'') && s.ends_with('\'')) {
                        s[1..s.len()-1].to_string()
                    } else {
                        s.to_string()
                    }
                })
                .unwrap_or_else(|| "a2r:".to_string());
        }
    }

    config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auto_commit_mode_from_str() {
        assert_eq!(AutoCommitMode::from_str("auto"), Some(AutoCommitMode::Auto));
        assert_eq!(AutoCommitMode::from_str("AUTO"), Some(AutoCommitMode::Auto));
        assert_eq!(AutoCommitMode::from_str("ask"), Some(AutoCommitMode::Ask));
        assert_eq!(AutoCommitMode::from_str("off"), Some(AutoCommitMode::Off));
        assert_eq!(AutoCommitMode::from_str("disabled"), Some(AutoCommitMode::Off));
        assert_eq!(AutoCommitMode::from_str("invalid"), None);
    }

    #[test]
    fn test_parse_git_config() {
        let config_str = r#"
enabled: true
mode: auto
include_diff: true
max_diff_lines: 100
commit_prefix: "ai:"
"#;

        let config = parse_git_config(config_str);
        assert!(config.enabled);
        assert_eq!(config.mode, AutoCommitMode::Auto);
        assert!(config.include_diff);
        assert_eq!(config.max_diff_lines, 100);
        assert_eq!(config.commit_prefix, "ai:");
    }

    #[test]
    fn test_default_config() {
        let config = GitAutoCommitConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.mode, AutoCommitMode::Ask);
        assert!(config.include_diff);
        assert_eq!(config.max_diff_lines, 50);
        assert_eq!(config.commit_prefix, "a2r:");
    }
}
