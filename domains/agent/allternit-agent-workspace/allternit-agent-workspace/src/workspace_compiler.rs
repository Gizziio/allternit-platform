//! Workspace Compiler
//!
//! Compiles all markdown governance files into structured representations
//! for runtime use by the Allternit engine.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use anyhow::Result;

/// Compilation error types
#[derive(Debug, Clone)]
pub enum CompileError {
    MissingFile(String),
    ParseError(String),
    InvalidStructure(String),
}

impl std::fmt::Display for CompileError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CompileError::MissingFile(path) => write!(f, "Missing required file: {}", path),
            CompileError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            CompileError::InvalidStructure(msg) => write!(f, "Invalid structure: {}", msg),
        }
    }
}

impl std::error::Error for CompileError {}

/// Compiled workspace representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledWorkspace {
    /// Layer 2: Identity
    pub identity: AgentIdentity,
    /// Layer 2: Soul
    pub soul: SoulContent,
    /// Layer 2: User preferences
    pub user_prefs: UserPreferences,
    /// Layer 3: Constitution from AGENTS.md
    pub constitution: Constitution,
    /// Layer 3: Playbook
    pub playbook: Playbook,
    /// Layer 3: Tools config
    pub tools_config: ToolsConfig,
    /// Layer 3: Heartbeat config
    pub heartbeat: HeartbeatConfig,
    /// Layer 4: Skills index
    pub skills_index: SkillsIndex,
    /// Layer 5: Business topology
    pub business_topology: BusinessTopology,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentIdentity {
    pub name: String,
    pub nature: String,
    pub vibe: String,
    pub emoji: String,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SoulContent {
    pub core_truths: Vec<String>,
    pub identity_statement: String,
    pub system_instructions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserPreferences {
    pub communication_style: String,
    pub technical_depth: String,
    pub decision_style: String,
    pub preferences: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Constitution {
    pub prime_directive: String,
    pub scope: Vec<String>,
    pub boundaries: Vec<String>,
    pub permissions: PermissionsModel,
    pub definition_of_done: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PermissionsModel {
    pub read_only: Vec<String>,
    pub write_scoped: Vec<String>,
    pub destructive_requires_approval: bool,
    pub network_default: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Playbook {
    pub procedures: Vec<Procedure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Procedure {
    pub name: String,
    pub trigger: String,
    pub steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolsConfig {
    pub enabled_tools: Vec<String>,
    pub tool_policies: HashMap<String, ToolPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPolicy {
    pub allowed: bool,
    pub requires_approval: bool,
    pub tier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HeartbeatConfig {
    pub enabled: bool,
    pub interval_seconds: u64,
    pub tasks: Vec<HeartbeatTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatTask {
    pub name: String,
    pub schedule: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillsIndex {
    pub skills: HashMap<String, SkillEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillEntry {
    pub id: String,
    pub version: String,
    pub intent: String,
    pub contract_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BusinessTopology {
    pub clients: Vec<ClientEntry>,
    pub active_projects: Vec<ProjectEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientEntry {
    pub name: String,
    pub industry: String,
    pub voice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectEntry {
    pub name: String,
    pub client: String,
    pub status: String,
}

/// Workspace compiler
pub struct WorkspaceCompiler {
    workspace_root: PathBuf,
}

impl WorkspaceCompiler {
    pub fn new(workspace_root: &Path) -> Self {
        Self {
            workspace_root: workspace_root.to_path_buf(),
        }
    }

    /// Compile all workspace files
    pub fn compile(&self) -> Result<CompiledWorkspace, CompileError> {
        Ok(CompiledWorkspace {
            identity: self.parse_identity()?,
            soul: self.parse_soul()?,
            user_prefs: self.parse_user_prefs()?,
            constitution: self.parse_constitution()?,
            playbook: self.parse_playbook()?,
            tools_config: self.parse_tools_config()?,
            heartbeat: self.parse_heartbeat()?,
            skills_index: self.parse_skills_index()?,
            business_topology: self.parse_business_topology()?,
        })
    }

    fn parse_identity(&self) -> Result<AgentIdentity, CompileError> {
        let path = self.workspace_root.join("IDENTITY.md");
        if !path.exists() {
            return Ok(AgentIdentity::default());
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| CompileError::ParseError(format!("Failed to read IDENTITY.md: {}", e)))?;

        // Simple parsing - in production would use proper markdown parser
        let mut identity = AgentIdentity::default();
        
        for line in content.lines() {
            if line.starts_with("| **Name** |") {
                identity.name = Self::extract_table_value(line);
            } else if line.starts_with("| **Nature** |") {
                identity.nature = Self::extract_table_value(line);
            } else if line.starts_with("| **Vibe** |") {
                identity.vibe = Self::extract_table_value(line);
            } else if line.starts_with("| **Emoji** |") {
                identity.emoji = Self::extract_table_value(line);
            }
        }

        Ok(identity)
    }

    fn parse_soul(&self) -> Result<SoulContent, CompileError> {
        let path = self.workspace_root.join("SOUL.md");
        if !path.exists() {
            return Ok(SoulContent::default());
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| CompileError::ParseError(format!("Failed to read SOUL.md: {}", e)))?;

        Ok(SoulContent {
            core_truths: Vec::new(),
            identity_statement: String::new(),
            system_instructions: content,
        })
    }

    fn parse_user_prefs(&self) -> Result<UserPreferences, CompileError> {
        let path = self.workspace_root.join("USER.md");
        if !path.exists() {
            return Ok(UserPreferences::default());
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| CompileError::ParseError(format!("Failed to read USER.md: {}", e)))?;

        let mut prefs = UserPreferences::default();
        
        // Extract checked communication style
        for line in content.lines() {
            if line.contains("[x]") || line.contains("[X]") {
                if line.contains("Concise") {
                    prefs.communication_style = "concise".to_string();
                } else if line.contains("Detailed") {
                    prefs.communication_style = "detailed".to_string();
                } else if line.contains("Casual") {
                    prefs.communication_style = "casual".to_string();
                } else if line.contains("Formal") {
                    prefs.communication_style = "formal".to_string();
                }
            }
        }

        Ok(prefs)
    }

    fn parse_constitution(&self) -> Result<Constitution, CompileError> {
        let path = self.workspace_root.join("AGENTS.md");
        if !path.exists() {
            return Ok(Constitution::default());
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| CompileError::ParseError(format!("Failed to read AGENTS.md: {}", e)))?;

        let mut constitution = Constitution::default();

        // Extract prime directive (content after "## Prime Directive")
        if let Some(start) = content.find("## Prime Directive") {
            let start = start + "## Prime Directive".len();
            if let Some(end) = content[start..].find("##") {
                constitution.prime_directive = content[start..start + end].trim().to_string();
            } else {
                constitution.prime_directive = content[start..].trim().to_string();
            }
        }

        Ok(constitution)
    }

    fn parse_playbook(&self) -> Result<Playbook, CompileError> {
        let path = self.workspace_root.join("PLAYBOOK.md");
        if !path.exists() {
            return Ok(Playbook::default());
        }

        let _content = std::fs::read_to_string(&path)
            .map_err(|e| CompileError::ParseError(format!("Failed to read PLAYBOOK.md: {}", e)))?;

        // Parse procedures - simplified
        Ok(Playbook {
            procedures: Vec::new(),
        })
    }

    fn parse_tools_config(&self) -> Result<ToolsConfig, CompileError> {
        let path = self.workspace_root.join("TOOLS.md");
        if !path.exists() {
            return Ok(ToolsConfig::default());
        }

        let _content = std::fs::read_to_string(&path)
            .map_err(|e| CompileError::ParseError(format!("Failed to read TOOLS.md: {}", e)))?;

        Ok(ToolsConfig {
            enabled_tools: vec![
                "read".to_string(),
                "write".to_string(),
                "edit".to_string(),
                "list".to_string(),
            ],
            tool_policies: HashMap::new(),
        })
    }

    fn parse_heartbeat(&self) -> Result<HeartbeatConfig, CompileError> {
        let path = self.workspace_root.join("HEARTBEAT.md");
        if !path.exists() {
            return Ok(HeartbeatConfig::default());
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| CompileError::ParseError(format!("Failed to read HEARTBEAT.md: {}", e)))?;

        // Check if heartbeat is disabled (empty or only comments)
        let has_tasks = content.lines()
            .any(|line| !line.trim().starts_with('#') && !line.trim().is_empty());

        Ok(HeartbeatConfig {
            enabled: has_tasks,
            interval_seconds: 3600,
            tasks: Vec::new(),
        })
    }

    fn parse_skills_index(&self) -> Result<SkillsIndex, CompileError> {
        let skills_dir = self.workspace_root.join("skills");
        if !skills_dir.exists() {
            return Ok(SkillsIndex::default());
        }

        let mut index = SkillsIndex::default();

        // Iterate through skill directories
        if let Ok(entries) = std::fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && !path.file_name().unwrap_or_default().to_string_lossy().starts_with('_') {
                    let contract_path = path.join("contract.json");
                    if contract_path.exists() {
                        if let Ok(content) = std::fs::read_to_string(&contract_path) {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                                if let Some(id) = json["skill_id"].as_str() {
                                    index.skills.insert(id.to_string(), SkillEntry {
                                        id: id.to_string(),
                                        version: json["version"].as_str().unwrap_or("1.0.0").to_string(),
                                        intent: json["intent"].as_str().unwrap_or("").to_string(),
                                        contract_path,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(index)
    }

    fn parse_business_topology(&self) -> Result<BusinessTopology, CompileError> {
        let clients_path = self.workspace_root.join("business/CLIENTS.md");
        if !clients_path.exists() {
            return Ok(BusinessTopology::default());
        }

        let _content = std::fs::read_to_string(&clients_path)
            .map_err(|e| CompileError::ParseError(format!("Failed to read CLIENTS.md: {}", e)))?;

        Ok(BusinessTopology {
            clients: Vec::new(),
            active_projects: Vec::new(),
        })
    }

    fn extract_table_value(line: &str) -> String {
        line.split('|')
            .nth(2)
            .map(|s| s.trim().to_string())
            .unwrap_or_default()
    }
}

/// Compile a workspace and save the result
pub fn compile_and_save(workspace: &Path, output: &Path) -> Result<()> {
    let compiler = WorkspaceCompiler::new(workspace);
    let compiled = compiler.compile().map_err(|e| anyhow::anyhow!("{}", e))?;
    
    let content = serde_json::to_string_pretty(&compiled)?;
    std::fs::write(output, content)?;
    
    log::info!("Compiled workspace to {}", output.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_compile_empty_workspace() {
        let temp = TempDir::new().unwrap();
        let compiler = WorkspaceCompiler::new(temp.path());
        
        let compiled = compiler.compile().unwrap();
        assert!(compiled.identity.name.is_empty());
        assert!(compiled.constitution.prime_directive.is_empty());
    }

    #[test]
    fn test_compile_with_identity() {
        let temp = TempDir::new().unwrap();
        
        // Create IDENTITY.md
        let identity_content = r#"# IDENTITY.md

| Field | Value |
|-------|-------|
| **Name** | TestAgent |
| **Nature** | Code Assistant |
| **Vibe** | Helpful and direct |
| **Emoji** | 🤖 |
"#;
        std::fs::write(temp.path().join("IDENTITY.md"), identity_content).unwrap();
        
        let compiler = WorkspaceCompiler::new(temp.path());
        let compiled = compiler.compile().unwrap();
        
        assert_eq!(compiled.identity.name, "TestAgent");
        assert_eq!(compiled.identity.nature, "Code Assistant");
        assert_eq!(compiled.identity.emoji, "🤖");
    }
}
