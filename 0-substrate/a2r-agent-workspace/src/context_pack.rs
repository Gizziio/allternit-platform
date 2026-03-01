//! Context Pack Builder
//! 
//! Compiles all workspace files into a deterministic context bundle
//! that is loaded into the agent's working memory.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use anyhow::Result;

/// Compiled context pack for agent consumption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextPack {
    /// Unique pack identifier
    pub id: String,
    
    /// When this pack was created
    pub created_at: chrono::DateTime<chrono::Utc>,
    
    /// Pack version (incremented on each build)
    pub version: u32,
    
    /// Summary for quick reference (always loaded first)
    pub summary: ContextSummary,
    
    /// Layer 1: Cognitive Persistence
    pub cognitive: CognitiveLayer,
    
    /// Layer 2: Identity Stabilization
    pub identity: IdentityLayer,
    
    /// Layer 3: Governance & Decision
    pub governance: GovernanceLayer,
    
    /// Layer 4: Modular Skills
    pub skills: SkillsLayer,
    
    /// Layer 5: Business Topology
    pub business: BusinessLayer,
    
    /// Metadata
    pub metadata: PackMetadata,
}

/// Quick-reference summary (lightweight, always loaded)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSummary {
    pub agent_name: String,
    pub agent_role: String,
    pub current_focus: String,
    pub active_tasks: Vec<String>,
    pub recent_lessons: Vec<String>,
    pub key_preferences: HashMap<String, String>,
    pub context_pressure: ContextPressure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextPressure {
    Low,
    Medium,
    High,
}

/// Layer 1: Cognitive Persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveLayer {
    pub working_memory: WorkingMemory,
    pub short_term: Vec<MemoryEntry>,
    pub long_term: Vec<MemoryEntry>,
    pub task_graph: TaskGraphSummary,
    pub checkpoints: Vec<CheckpointRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkingMemory {
    pub current_goal: String,
    pub recent_decisions: Vec<String>,
    pub open_questions: Vec<String>,
    pub blockers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub source: String,
    pub content: String,
    pub importance: Importance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Importance {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskGraphSummary {
    pub in_progress: Vec<TaskNode>,
    pub recently_completed: Vec<TaskNode>,
    pub blocked: Vec<TaskNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskNode {
    pub id: String,
    pub title: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointRef {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub path: PathBuf,
}

/// Layer 2: Identity Stabilization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityLayer {
    pub name: String,
    pub nature: String,
    pub vibe: String,
    pub emoji: String,
    pub avatar: Option<String>,
    pub soul_content: String,
    pub voice: VoiceConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    pub tone_style: String,
    pub formality: String,
    pub technical_depth: String,
    pub response_format: String,
    pub things_to_avoid: Vec<String>,
    pub things_to_emphasize: Vec<String>,
}

/// Layer 3: Governance & Decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceLayer {
    pub constitution: AgentConstitution,
    pub playbook: Vec<Procedure>,
    pub policies: PolicySet,
    pub tools_allowed: Vec<ToolPermission>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConstitution {
    pub prime_directive: String,
    pub scope_and_boundaries: Vec<String>,
    pub permissions_model: PermissionsModel,
    pub definition_of_done: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionsModel {
    pub read_only: Vec<String>,
    pub write_allowed: Vec<String>,
    pub destructive_requires_approval: bool,
    pub network_default: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Procedure {
    pub name: String,
    pub trigger: String,
    pub steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicySet {
    pub tool_overrides: HashMap<String, String>,
    pub approval_requirements: Vec<String>,
    pub rate_limits: HashMap<String, u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPermission {
    pub tool_id: String,
    pub allowed: bool,
    pub requires_approval: bool,
    pub tier: String,
}

/// Layer 4: Modular Skills
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsLayer {
    pub available_skills: Vec<SkillRef>,
    pub skill_index: HashMap<String, SkillRef>,
    pub default_skill: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRef {
    pub id: String,
    pub version: String,
    pub intent: String,
    pub triggers: Vec<String>,
    pub contract_path: PathBuf,
}

/// Layer 5: Business Topology
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessLayer {
    pub active_clients: Vec<ClientRef>,
    pub current_project: Option<ProjectRef>,
    pub business_rules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientRef {
    pub name: String,
    pub industry: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRef {
    pub name: String,
    pub client: String,
    pub status: String,
    pub deadline: Option<String>,
}

/// Pack metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackMetadata {
    pub workspace_id: String,
    pub workspace_version: String,
    pub engine_version: String,
    pub files_included: Vec<String>,
    pub total_size_bytes: usize,
    pub compression: Option<String>,
}

/// Context Pack Builder
pub struct ContextPackBuilder {
    workspace: PathBuf,
    pack: ContextPack,
}

impl ContextPackBuilder {
    pub fn new(workspace: &Path) -> Self {
        Self {
            workspace: workspace.to_path_buf(),
            pack: ContextPack {
                id: format!("pack_{}", chrono::Utc::now().timestamp()),
                created_at: chrono::Utc::now(),
                version: 1,
                summary: ContextSummary {
                    agent_name: String::new(),
                    agent_role: String::new(),
                    current_focus: String::new(),
                    active_tasks: Vec::new(),
                    recent_lessons: Vec::new(),
                    key_preferences: HashMap::new(),
                    context_pressure: ContextPressure::Low,
                },
                cognitive: CognitiveLayer {
                    working_memory: WorkingMemory {
                        current_goal: String::new(),
                        recent_decisions: Vec::new(),
                        open_questions: Vec::new(),
                        blockers: Vec::new(),
                    },
                    short_term: Vec::new(),
                    long_term: Vec::new(),
                    task_graph: TaskGraphSummary {
                        in_progress: Vec::new(),
                        recently_completed: Vec::new(),
                        blocked: Vec::new(),
                    },
                    checkpoints: Vec::new(),
                },
                identity: IdentityLayer {
                    name: String::new(),
                    nature: String::new(),
                    vibe: String::new(),
                    emoji: "🤖".to_string(),
                    avatar: None,
                    soul_content: String::new(),
                    voice: VoiceConfig {
                        tone_style: String::new(),
                        formality: String::new(),
                        technical_depth: String::new(),
                        response_format: String::new(),
                        things_to_avoid: Vec::new(),
                        things_to_emphasize: Vec::new(),
                    },
                },
                governance: GovernanceLayer {
                    constitution: AgentConstitution {
                        prime_directive: String::new(),
                        scope_and_boundaries: Vec::new(),
                        permissions_model: PermissionsModel {
                            read_only: Vec::new(),
                            write_allowed: Vec::new(),
                            destructive_requires_approval: true,
                            network_default: "deny".to_string(),
                        },
                        definition_of_done: Vec::new(),
                    },
                    playbook: Vec::new(),
                    policies: PolicySet {
                        tool_overrides: HashMap::new(),
                        approval_requirements: Vec::new(),
                        rate_limits: HashMap::new(),
                    },
                    tools_allowed: Vec::new(),
                },
                skills: SkillsLayer {
                    available_skills: Vec::new(),
                    skill_index: HashMap::new(),
                    default_skill: None,
                },
                business: BusinessLayer {
                    active_clients: Vec::new(),
                    current_project: None,
                    business_rules: Vec::new(),
                },
                metadata: PackMetadata {
                    workspace_id: String::new(),
                    workspace_version: "1.0.0".to_string(),
                    engine_version: env!("CARGO_PKG_VERSION").to_string(),
                    files_included: Vec::new(),
                    total_size_bytes: 0,
                    compression: None,
                },
            },
        }
    }

    /// Load identity files (IDENTITY.md, SOUL.md, VOICE.md)
    pub fn load_identity(&mut self) -> Result<&mut Self> {
        // Implementation: parse IDENTITY.md, SOUL.md, VOICE.md
        // Extract fields and populate self.pack.identity
        Ok(self)
    }

    /// Load governance files (AGENTS.md, PLAYBOOK.md, POLICY.md)
    pub fn load_governance(&mut self) -> Result<&mut Self> {
        // Implementation: parse governance files
        // Extract constitution, procedures, policies
        Ok(self)
    }

    /// Load cognitive files (memory/, BRAIN.md, MEMORY.md)
    pub fn load_cognitive(&mut self) -> Result<&mut Self> {
        // Implementation: load memory files
        // Build working memory, task graph
        Ok(self)
    }

    /// Load skills from skills/ directory
    pub fn load_skills(&mut self) -> Result<&mut Self> {
        // Implementation: scan skills/, parse contracts
        // Build skill index
        Ok(self)
    }

    /// Load business files (CLIENTS.md, business/)
    pub fn load_business(&mut self) -> Result<&mut Self> {
        // Implementation: parse client files
        Ok(self)
    }

    /// Build the summary (lightweight always-loaded view)
    pub fn build_summary(&mut self) -> Result<&mut Self> {
        // Extract key info for quick reference
        self.pack.summary.agent_name = self.pack.identity.name.clone();
        self.pack.summary.agent_role = self.pack.identity.nature.clone();
        // ...
        Ok(self)
    }

    /// Finalize and save the pack
    pub fn build(self) -> Result<ContextPack> {
        // Save to .a2r/context/pack.current.json
        // Archive previous pack
        Ok(self.pack)
    }
}

/// Load the current context pack
pub fn load_current_pack(workspace: &Path) -> Result<ContextPack> {
    let pack_path = workspace.join(".a2r/context/pack.current.json");
    let content = std::fs::read_to_string(pack_path)?;
    let pack: ContextPack = serde_json::from_str(&content)?;
    Ok(pack)
}

/// Check if a new pack needs to be built
pub fn should_rebuild(workspace: &Path) -> bool {
    let pack_path = workspace.join(".a2r/context/pack.current.json");
    
    if !pack_path.exists() {
        return true;
    }
    
    // Check if any core files have been modified since pack was built
    let pack_meta = std::fs::metadata(&pack_path).ok();
    let pack_modified = pack_meta.and_then(|m| m.modified().ok());
    
    for file in super::CORE_FILES {
        let file_path = workspace.join(file);
        if let Ok(meta) = std::fs::metadata(&file_path) {
            if let Ok(file_modified) = meta.modified() {
                if let Some(pack_time) = pack_modified {
                    if file_modified > pack_time {
                        return true;
                    }
                }
            }
        }
    }
    
    false
}
