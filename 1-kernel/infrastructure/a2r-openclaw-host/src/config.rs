//! OpenClaw Host Configuration

use std::path::PathBuf;

/// Configuration for OpenClawHost
#[derive(Debug, Clone)]
pub struct HostConfig {
    /// Path to openclaw executable
    pub openclaw_path: PathBuf,

    /// OpenClaw workspace directory
    pub workspace_dir: Option<PathBuf>,

    /// Port for OpenClaw gateway
    pub port: Option<u16>,

    /// OpenClaw version for compatibility
    pub openclaw_version: String,

    /// Corpus directory for parity receipt capture
    pub corpus_dir: Option<PathBuf>,
}

impl Default for HostConfig {
    fn default() -> Self {
        Self {
            openclaw_path: PathBuf::from("openclaw"),
            workspace_dir: None,
            port: Some(18789),
            openclaw_version: "2026.1.29".to_string(),
            corpus_dir: None,
        }
    }
}

impl HostConfig {
    /// Create a new config with the OpenClaw path
    pub fn new(openclaw_path: impl Into<PathBuf>) -> Self {
        Self {
            openclaw_path: openclaw_path.into(),
            ..Default::default()
        }
    }

    /// Set the workspace directory
    pub fn with_workspace(mut self, workspace: impl Into<PathBuf>) -> Self {
        self.workspace_dir = Some(workspace.into());
        self
    }

    /// Set the port
    pub fn with_port(mut self, port: u16) -> Self {
        self.port = Some(port);
        self
    }

    /// Set the corpus directory
    pub fn with_corpus_dir(mut self, corpus_dir: impl Into<PathBuf>) -> Self {
        self.corpus_dir = Some(corpus_dir.into());
        self
    }
}
