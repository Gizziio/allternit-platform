//! Allternit Agent Workspace - 5-Layer Living Workspace Runtime
//!
//! This crate provides the client-side agent workspace runtime that implements
//! the 5-layer living workspace architecture for AI agents.
//!
//! # Architecture Overview
//!
//! ```text
//! Kernel (Authoritative) ←→ Markdown (Distillation) ←→ Agent Workspace ←→ Agent (LLM)
//! ```
//!
//! The Agent Workspace is NOT the kernel. It is the bridge between:
//! - Users (who edit markdown files)
//! - Agents (who read markdown files to understand constraints)
//! - Kernel (which enforces deterministically)
//!
//! # The 5 Layers
//!
//! 1. **Cognitive Persistence** - BRAIN.md, MEMORY.md, memory/, checkpoints
//! 2. **Identity Stabilization** - IDENTITY.md, SOUL.md, USER.md, VOICE.md, POLICY.md
//! 3. **Governance & Decision** - AGENTS.md, PLAYBOOK.md, TOOLS.md, HEARTBEAT.md
//! 4. **Modular Skills** - skills/ with SKILL.md and contract.json
//! 5. **Business Topology** - CLIENTS.md, business/ for multi-tenancy

// std-only modules
#[cfg(feature = "std")]
pub mod boot_sequence;
#[cfg(feature = "std")]
pub mod checkpoint;
#[cfg(feature = "std")]
pub mod context_pack;
#[cfg(feature = "std")]
pub mod policy_engine;
#[cfg(feature = "std")]
pub mod skills_registry;
#[cfg(feature = "std")]
pub mod workspace_compiler;

// WASM module
#[cfg(feature = "wasm")]
pub mod wasm;

// Core types that work in both std and wasm
use serde::{Deserialize, Serialize};

/// Core file load order (Phase 2 of boot sequence)
pub const CORE_FILES: &[&str] = &[
    "AGENTS.md",
    "SOUL.md",
    "USER.md",
    "IDENTITY.md",
];

/// Workspace metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceMetadata {
    pub workspace_id: String,
    pub workspace_version: String,
    pub agent_name: String,
    pub created_at: String, // ISO 8601 format
    pub layers: WorkspaceLayers,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLayers {
    pub cognitive: bool,
    pub identity: bool,
    pub governance: bool,
    pub skills: bool,
    pub business: bool,
}

/// Error types for workspace operations
#[derive(Debug)]
pub enum WorkspaceError {
    NotFound(String),
    InvalidStructure(String),
    MissingFile(String),
    ParseError(String),
    Io(String),
    Serialization(String),
}

impl core::fmt::Display for WorkspaceError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            WorkspaceError::NotFound(s) => write!(f, "Workspace not found: {}", s),
            WorkspaceError::InvalidStructure(s) => write!(f, "Invalid workspace structure: {}", s),
            WorkspaceError::MissingFile(s) => write!(f, "Missing required file: {}", s),
            WorkspaceError::ParseError(s) => write!(f, "Parse error: {}", s),
            WorkspaceError::Io(s) => write!(f, "IO error: {}", s),
            WorkspaceError::Serialization(s) => write!(f, "Serialization error: {}", s),
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for WorkspaceError {}

/// Result type for workspace operations
pub type WorkspaceResult<T> = core::result::Result<T, WorkspaceError>;

// Re-exports for std feature
#[cfg(feature = "std")]
pub use boot_sequence::{BootContext, BootPhase, BootSequence};
#[cfg(feature = "std")]
pub use checkpoint::{Checkpoint, CheckpointManager, AgentState, TaskState};
#[cfg(feature = "std")]
pub use context_pack::{ContextPack, ContextPackBuilder, ContextSummary};
#[cfg(feature = "std")]
pub use policy_engine::{PolicyDecision, PolicyEngine, PolicyAction, SafetyTier};
#[cfg(feature = "std")]
pub use skills_registry::{SkillsRegistry, SkillDefinition, SkillRouter};
#[cfg(feature = "std")]
pub use workspace_compiler::{CompiledWorkspace, WorkspaceCompiler};

#[cfg(feature = "std")]
use std::path::Path;

#[cfg(feature = "std")]
/// Initialize an agent workspace
pub async fn initialize_workspace(workspace: &Path) -> anyhow::Result<BootContext> {
    let mut boot = BootSequence::new(workspace);
    boot.run().await
}

#[cfg(feature = "std")]
/// Quick check if a directory is an agent workspace
pub fn is_agent_workspace(path: &Path) -> bool {
    path.join("AGENTS.md").exists() || path.join(".allternit/manifest.json").exists()
}

#[cfg(feature = "std")]
/// Get workspace version from manifest
pub fn workspace_version(workspace: &Path) -> Option<String> {
    let manifest = workspace.join(".allternit/manifest.json");
    if manifest.exists() {
        let content = std::fs::read_to_string(manifest).ok()?;
        let json: serde_json::Value = serde_json::from_str(&content).ok()?;
        json["workspace_version"].as_str().map(|s| s.to_string())
    } else {
        None
    }
}

#[cfg(all(test, feature = "std"))]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_is_agent_workspace() {
        let temp = TempDir::new().unwrap();
        assert!(!is_agent_workspace(temp.path()));
        
        // Create AGENTS.md
        std::fs::write(temp.path().join("AGENTS.md"), "# AGENTS.md").unwrap();
        assert!(is_agent_workspace(temp.path()));
    }

    #[test]
    fn test_workspace_version() {
        let temp = TempDir::new().unwrap();
        assert!(workspace_version(temp.path()).is_none());
        
        // Create manifest
        std::fs::create_dir(temp.path().join(".allternit")).unwrap();
        let manifest = serde_json::json!({
            "workspace_version": "1.0.0"
        });
        std::fs::write(
            temp.path().join(".allternit/manifest.json"),
            serde_json::to_string(&manifest).unwrap()
        ).unwrap();
        
        assert_eq!(workspace_version(temp.path()), Some("1.0.0".to_string()));
    }
}
