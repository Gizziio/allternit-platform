//! WASM backend implementation for allternit-agent-workspace
//!
//! This module provides a complete workspace implementation
//! that runs entirely in the browser using in-memory storage.

pub mod storage;
pub mod brain;
pub mod memory;
pub mod skills;
pub mod identity;
pub mod checkpoints;

pub use storage::BrowserStorage;
pub use brain::{Brain, Task, TaskStatus, TaskPriority, TaskUpdate, TaskGraph};
pub use memory::{MemoryStore, MemoryEntry, MemoryEntryType};
pub use skills::{SkillsRegistry, Skill, SkillMetadata};
pub use identity::{IdentityManager, Identity, IdentityUpdate, SoulConfig, WorkingPreferences};
pub use checkpoints::{CheckpointManager, Checkpoint, AgentState, TaskState, AgentMood, VerificationStatus};

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

/// Complete workspace for WASM backend
pub struct WasmWorkspace {
    pub storage: BrowserStorage,
    pub workspace_id: String,
    pub path: String,
    pub brain: Brain,
    pub memory: MemoryStore,
    pub skills: SkillsRegistry,
    pub identity: IdentityManager,
    pub checkpoints: CheckpointManager,
}

impl WasmWorkspace {
    /// Create a new WASM workspace
    pub fn new(path: impl Into<String>) -> Self {
        let path = path.into();
        let workspace_id = hash_path(&path);
        let storage = BrowserStorage::new(&workspace_id);
        
        Self {
            storage: storage.clone(),
            workspace_id: workspace_id.clone(),
            path: path.clone(),
            brain: Brain::new(storage.clone(), &workspace_id),
            memory: MemoryStore::new(storage.clone(), &workspace_id),
            skills: SkillsRegistry::new(storage.clone(), &workspace_id),
            identity: IdentityManager::new(storage.clone(), &workspace_id),
            checkpoints: CheckpointManager::new(storage, &workspace_id),
        }
    }
    
    /// Initialize workspace with default data
    pub fn init(&self) -> Result<(), String> {
        // Initialize identity
        self.identity.init_default().map_err(|e| e.to_string())?;
        
        // Initialize default skills
        self.skills.init_default_skills().map_err(|e| e.to_string())?;
        
        Ok(())
    }
}

/// Hash a path to create a workspace ID
fn hash_path(path: &str) -> String {
    use sha2::{Sha256, Digest};
    
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    let result = hasher.finalize();
    
    // Take first 16 bytes for shorter ID
    hex::encode(&result[..16])
}

/// Workspace API exposed to JavaScript
#[wasm_bindgen]
pub struct WorkspaceApi {
    workspace: WasmWorkspace,
}

#[wasm_bindgen]
impl WorkspaceApi {
    /// Create a new workspace API
    #[wasm_bindgen(constructor)]
    pub fn new(path: String) -> Self {
        let workspace = WasmWorkspace::new(path);
        // Initialize on creation
        let _ = workspace.init();
        Self { workspace }
    }
    
    /// Get the workspace path
    #[wasm_bindgen(getter)]
    pub fn path(&self) -> String {
        self.workspace.path.clone()
    }
    
    /// Get workspace ID
    #[wasm_bindgen(getter)]
    pub fn workspace_id(&self) -> String {
        self.workspace.workspace_id.clone()
    }
    
    /// Check if workspace is valid
    #[wasm_bindgen(js_name = isValid)]
    pub fn is_valid(&self) -> bool {
        true // WASM workspaces are always valid once created
    }
    
    /// Get workspace version
    #[wasm_bindgen(js_name = getVersion)]
    pub fn get_version(&self) -> String {
        "0.1.0-wasm".to_string()
    }
    
    /// Boot the workspace
    pub async fn boot(&self) -> JsValue {
        match self.workspace.init() {
            Ok(_) => {
                let result = serde_json::json!({
                    "success": true,
                    "message": "Workspace booted successfully",
                    "workspace_id": self.workspace.workspace_id,
                });
                serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::UNDEFINED)
            }
            Err(e) => {
                let result = serde_json::json!({
                    "success": false,
                    "error": e,
                });
                serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    /// Get workspace metadata
    #[wasm_bindgen(js_name = getMetadata)]
    pub fn get_metadata(&self) -> JsValue {
        let identity = self.workspace.identity.get_identity().ok().flatten().unwrap_or_default();
        
        let metadata = serde_json::json!({
            "workspace_id": self.workspace.workspace_id,
            "workspace_version": "0.1.0",
            "agent_name": identity.name,
            "created_at": chrono::Utc::now().to_rfc3339(),
            "layers": {
                "cognitive": true,
                "identity": true,
                "governance": true,
                "skills": true,
                "business": false,
            }
        });
        
        serde_wasm_bindgen::to_value(&metadata).unwrap_or(JsValue::UNDEFINED)
    }
    
    // === Brain (Tasks) ===
    
    /// List all tasks
    #[wasm_bindgen(js_name = listTasks)]
    pub fn list_tasks(&self) -> JsValue {
        let tasks = self.workspace.brain.list_tasks().unwrap_or_default();
        serde_wasm_bindgen::to_value(&tasks).unwrap_or(JsValue::UNDEFINED)
    }
    
    /// Get task by ID
    #[wasm_bindgen(js_name = getTask)]
    pub fn get_task(&self, task_id: String) -> JsValue {
        match self.workspace.brain.get_task(&task_id) {
            Ok(Some(task)) => serde_wasm_bindgen::to_value(&task).unwrap_or(JsValue::UNDEFINED),
            _ => JsValue::NULL,
        }
    }
    
    /// Create a new task
    #[wasm_bindgen(js_name = createTask)]
    pub fn create_task(&self, title: String, description: Option<String>, priority: Option<String>) -> JsValue {
        let priority = priority.and_then(|p| match p.as_str() {
            "low" => Some(TaskPriority::Low),
            "medium" => Some(TaskPriority::Medium),
            "high" => Some(TaskPriority::High),
            _ => None,
        });
        
        match self.workspace.brain.create_task(title, description, priority) {
            Ok(task) => serde_wasm_bindgen::to_value(&task).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    /// Update a task
    #[wasm_bindgen(js_name = updateTask)]
    pub fn update_task(&self, task_id: String, updates_js: JsValue) -> JsValue {
        let updates: TaskUpdate = match serde_wasm_bindgen::from_value(&updates_js) {
            Ok(u) => u,
            Err(e) => {
                let err = serde_json::json!({"error": format!("Invalid updates: {}", e)});
                return serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED);
            }
        };
        
        match self.workspace.brain.update_task(&task_id, updates) {
            Ok(task) => serde_wasm_bindgen::to_value(&task).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    /// Delete a task
    #[wasm_bindgen(js_name = deleteTask)]
    pub fn delete_task(&self, task_id: String) -> JsValue {
        match self.workspace.brain.delete_task(&task_id) {
            Ok(_) => serde_wasm_bindgen::to_value(&serde_json::json!({"success": true})).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    /// Get task graph
    #[wasm_bindgen(js_name = getTaskGraph)]
    pub fn get_task_graph(&self) -> JsValue {
        match self.workspace.brain.get_task_graph() {
            Ok(graph) => serde_wasm_bindgen::to_value(&graph).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    // === Memory ===
    
    /// List memory entries
    #[wasm_bindgen(js_name = listMemoryEntries)]
    pub fn list_memory_entries(&self) -> JsValue {
        let entries = self.workspace.memory.list_entries().unwrap_or_default();
        serde_wasm_bindgen::to_value(&entries).unwrap_or(JsValue::UNDEFINED)
    }
    
    /// Create memory entry
    #[wasm_bindgen(js_name = createMemoryEntry)]
    pub fn create_memory_entry(&self, entry_type: String, content: String, tags: Option<Vec<String>>) -> JsValue {
        let entry_type = match entry_type.as_str() {
            "note" => MemoryEntryType::Note,
            "event" => MemoryEntryType::Event,
            "observation" => MemoryEntryType::Observation,
            "decision" => MemoryEntryType::Decision,
            "task_result" => MemoryEntryType::TaskResult,
            "conversation" => MemoryEntryType::Conversation,
            _ => MemoryEntryType::Note,
        };
        
        match self.workspace.memory.create_entry(entry_type, content, tags) {
            Ok(entry) => serde_wasm_bindgen::to_value(&entry).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    /// Search memory
    #[wasm_bindgen(js_name = searchMemory)]
    pub fn search_memory(&self, query: String) -> JsValue {
        let results = self.workspace.memory.search(&query).unwrap_or_default();
        serde_wasm_bindgen::to_value(&results).unwrap_or(JsValue::UNDEFINED)
    }
    
    // === Skills ===
    
    /// List all skills
    #[wasm_bindgen(js_name = listSkills)]
    pub fn list_skills(&self) -> JsValue {
        let skills = self.workspace.skills.list_skills().unwrap_or_default();
        serde_wasm_bindgen::to_value(&skills).unwrap_or(JsValue::UNDEFINED)
    }
    
    /// Install skill
    #[wasm_bindgen(js_name = installSkill)]
    pub fn install_skill(&self, skill_id: String) -> JsValue {
        match self.workspace.skills.install_skill(&skill_id, None) {
            Ok(skill) => serde_wasm_bindgen::to_value(&skill).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    /// Uninstall skill
    #[wasm_bindgen(js_name = uninstallSkill)]
    pub fn uninstall_skill(&self, skill_id: String) -> JsValue {
        match self.workspace.skills.uninstall_skill(&skill_id) {
            Ok(skill) => serde_wasm_bindgen::to_value(&skill).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    // === Identity ===
    
    /// Get identity
    #[wasm_bindgen(js_name = getIdentity)]
    pub fn get_identity(&self) -> JsValue {
        let identity = self.workspace.identity.get_identity().ok().flatten().unwrap_or_default();
        serde_wasm_bindgen::to_value(&identity).unwrap_or(JsValue::UNDEFINED)
    }
    
    /// Update identity
    #[wasm_bindgen(js_name = updateIdentity)]
    pub fn update_identity(&self, updates_js: JsValue) -> JsValue {
        let updates: IdentityUpdate = match serde_wasm_bindgen::from_value(&updates_js) {
            Ok(u) => u,
            Err(e) => {
                let err = serde_json::json!({"error": format!("Invalid updates: {}", e)});
                return serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED);
            }
        };
        
        match self.workspace.identity.update_identity(updates) {
            Ok(identity) => serde_wasm_bindgen::to_value(&identity).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    // === Checkpoints ===
    
    /// Create checkpoint
    #[wasm_bindgen(js_name = createCheckpoint)]
    pub fn create_checkpoint(&self, session_id: String, label: Option<String>) -> JsValue {
        match self.workspace.checkpoints.create(session_id, None, None, label) {
            Ok(checkpoint) => serde_wasm_bindgen::to_value(&checkpoint).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
    
    /// List checkpoints
    #[wasm_bindgen(js_name = listCheckpoints)]
    pub fn list_checkpoints(&self, limit: Option<usize>) -> JsValue {
        let checkpoints = self.workspace.checkpoints.list(limit).unwrap_or_default();
        serde_wasm_bindgen::to_value(&checkpoints).unwrap_or(JsValue::UNDEFINED)
    }
    
    /// Restore checkpoint
    #[wasm_bindgen(js_name = restoreCheckpoint)]
    pub fn restore_checkpoint(&self, checkpoint_id: String) -> JsValue {
        match self.workspace.checkpoints.restore(&checkpoint_id) {
            Ok(checkpoint) => serde_wasm_bindgen::to_value(&checkpoint).unwrap_or(JsValue::UNDEFINED),
            Err(e) => {
                let err = serde_json::json!({"error": e.to_string()});
                serde_wasm_bindgen::to_value(&err).unwrap_or(JsValue::UNDEFINED)
            }
        }
    }
}

// Re-export types for use in bindings
pub use brain::TaskUpdate;
pub use identity::IdentityUpdate;
