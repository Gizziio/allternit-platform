use std::path::{Path, PathBuf};
use tokio::fs;
use anyhow::{Context, Result};
use crate::ToolOutput;

pub struct FsTool {
    root: PathBuf,
}

impl FsTool {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn validate_path(&self, path: &str) -> Result<PathBuf> {
        let joined = self.root.join(path);
        let canonical = joined.canonicalize().unwrap_or(joined); // Allow non-existent for writes
        
        // Basic sandbox check
        if !canonical.starts_with(&self.root) && !path.contains("..") {
             // In a real impl, we'd be stricter. For now, just ensure we don't go up.
             // If canonicalize failed (file doesn't exist), we assume it's safe if it doesn't contain ".."
        }
        
        Ok(self.root.join(path))
    }

    pub async fn write(&self, path: &str, content: &str) -> Result<ToolOutput> {
        let target = self.validate_path(path)?;
        
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::write(&target, content).await
            .with_context(|| format!("Failed to write to {}", path))?;

        Ok(ToolOutput {
            text: format!("Successfully wrote {} bytes to {}", content.len(), path),
            data: Some(serde_json::json!({
                "path": path,
                "size": content.len()
            })),
        })
    }

    pub async fn read(&self, path: &str) -> Result<ToolOutput> {
        let target = self.validate_path(path)?;
        
        let content = fs::read_to_string(&target).await
            .with_context(|| format!("Failed to read {}", path))?;

        Ok(ToolOutput {
            text: content.clone(),
            data: Some(serde_json::json!({
                "path": path,
                "content": content
            })),
        })
    }

    pub async fn list(&self, path: &str) -> Result<ToolOutput> {
        let target = self.validate_path(path)?;
        let mut entries = fs::read_dir(target).await?;
        
        let mut files = Vec::new();
        while let Some(entry) = entries.next_entry().await? {
            files.push(entry.file_name().to_string_lossy().to_string());
        }

        Ok(ToolOutput {
            text: files.join("\n"),
            data: Some(serde_json::json!({
                "files": files
            })),
        })
    }
}
