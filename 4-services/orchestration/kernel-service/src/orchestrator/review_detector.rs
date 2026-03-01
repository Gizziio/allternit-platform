use std::path::Path;
use std::process::Command;
use tracing::{info, warn};

pub struct ReviewDetector;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ReviewSignal {
    pub is_dirty: bool,
    pub has_diff: bool,
    pub diff_summary: String,
}

impl ReviewDetector {
    pub fn detect_changes(repo_path: &str) -> anyhow::Result<ReviewSignal> {
        let path = Path::new(repo_path);
        if !path.exists() {
            return Err(anyhow::anyhow!("Repo path does not exist: {}", repo_path));
        }

        // Check git status
        let status_output = Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .current_dir(path)
            .output()?;

        let is_dirty = !status_output.stdout.is_empty();

        // Get diff summary
        let diff_stat_output = Command::new("git")
            .arg("diff")
            .arg("--stat")
            .current_dir(path)
            .output()?;

        let diff_summary = String::from_utf8_lossy(&diff_stat_output.stdout).to_string();
        let has_diff = !diff_summary.is_empty();

        Ok(ReviewSignal {
            is_dirty,
            has_diff,
            diff_summary,
        })
    }
}
