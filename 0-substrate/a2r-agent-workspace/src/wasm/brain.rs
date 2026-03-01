//! Brain (Task Graph) implementation for WASM backend

use serde::{Serialize, Deserialize};
use crate::wasm::storage::BrowserStorage;
use crate::Result;

/// Task status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Pending
    }
}

/// Task priority
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskPriority {
    Low,
    Medium,
    High,
}

impl Default for TaskPriority {
    fn default() -> Self {
        TaskPriority::Medium
    }
}

/// Task definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub dependencies: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub metadata: Option<serde_json::Value>,
}

impl Task {
    /// Create a new task
    pub fn new(title: impl Into<String>) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: format!("task-{}", uuid::Uuid::new_v4()),
            title: title.into(),
            description: None,
            status: TaskStatus::Pending,
            priority: TaskPriority::Medium,
            dependencies: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
            metadata: None,
        }
    }
    
    /// Update the task
    pub fn update(&mut self, updates: TaskUpdate) {
        if let Some(title) = updates.title {
            self.title = title;
        }
        if let Some(description) = updates.description {
            self.description = Some(description);
        }
        if let Some(status) = updates.status {
            self.status = status;
        }
        if let Some(priority) = updates.priority {
            self.priority = priority;
        }
        if let Some(dependencies) = updates.dependencies {
            self.dependencies = dependencies;
        }
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }
}

/// Task update input
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaskUpdate {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>,
    pub dependencies: Option<Vec<String>>,
}

/// Task graph edge (dependency)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEdge {
    pub from: String,
    pub to: String,
}

/// Task graph structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskGraph {
    pub tasks: Vec<Task>,
    pub edges: Vec<TaskEdge>,
}

/// Brain (Task Graph) manager
pub struct Brain {
    storage: BrowserStorage,
    workspace_id: String,
}

impl Brain {
    /// Create new brain instance
    pub fn new(storage: BrowserStorage, workspace_id: &str) -> Self {
        Self {
            storage,
            workspace_id: workspace_id.to_string(),
        }
    }
    
    fn task_key(&self, task_id: &str) -> String {
        format!("{}/tasks/{}", self.workspace_id, task_id)
    }
    
    fn task_index_key(&self) -> String {
        format!("{}/task_index", self.workspace_id)
    }
    
    /// Get all tasks
    pub fn list_tasks(&self) -> Result<Vec<Task>> {
        let prefix = format!("{}/tasks/", self.workspace_id);
        self.storage.get_all_with_prefix(&prefix)
    }
    
    /// Get task by ID
    pub fn get_task(&self, task_id: &str) -> Result<Option<Task>> {
        self.storage.get(&self.task_key(task_id))
    }
    
    /// Create a new task
    pub fn create_task(&self, title: impl Into<String>, description: Option<String>, priority: Option<TaskPriority>) -> Result<Task> {
        let mut task = Task::new(title);
        task.description = description;
        if let Some(p) = priority {
            task.priority = p;
        }
        
        self.storage.set(&self.task_key(&task.id), &task)?;
        self.update_task_index(&task.id, true)?;
        
        Ok(task)
    }
    
    /// Update a task
    pub fn update_task(&self, task_id: &str, updates: TaskUpdate) -> Result<Task> {
        let mut task = self.get_task(task_id)?
            .ok_or_else(|| format!("Task not found: {}", task_id))?;
        
        task.update(updates);
        self.storage.set(&self.task_key(&task.id), &task)?;
        
        Ok(task)
    }
    
    /// Delete a task
    pub fn delete_task(&self, task_id: &str) -> Result<()> {
        self.storage.delete(&self.task_key(task_id))?;
        self.update_task_index(task_id, false)?;
        Ok(())
    }
    
    /// Get task graph (all tasks with edges)
    pub fn get_task_graph(&self) -> Result<TaskGraph> {
        let tasks = self.list_tasks()?;
        let edges: Vec<TaskEdge> = tasks
            .iter()
            .flat_map(|task| {
                task.dependencies.iter().map(move |dep| TaskEdge {
                    from: dep.clone(),
                    to: task.id.clone(),
                })
            })
            .collect();
        
        Ok(TaskGraph { tasks, edges })
    }
    
    /// Add dependency between tasks
    pub fn add_dependency(&self, task_id: &str, depends_on: &str) -> Result<Task> {
        let mut task = self.get_task(task_id)?
            .ok_or_else(|| format!("Task not found: {}", task_id))?;
        
        if !task.dependencies.contains(&depends_on.to_string()) {
            task.dependencies.push(depends_on.to_string());
            task.updated_at = chrono::Utc::now().to_rfc3339();
            self.storage.set(&self.task_key(&task.id), &task)?;
        }
        
        Ok(task)
    }
    
    /// Remove dependency
    pub fn remove_dependency(&self, task_id: &str, depends_on: &str) -> Result<Task> {
        let mut task = self.get_task(task_id)?
            .ok_or_else(|| format!("Task not found: {}", task_id))?;
        
        task.dependencies.retain(|d| d != depends_on);
        task.updated_at = chrono::Utc::now().to_rfc3339();
        self.storage.set(&self.task_key(&task.id), &task)?;
        
        Ok(task)
    }
    
    /// Get tasks that are ready to run (all dependencies completed)
    pub fn get_ready_tasks(&self) -> Result<Vec<Task>> {
        let tasks = self.list_tasks()?;
        let completed_ids: std::collections::HashSet<String> = tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Completed)
            .map(|t| t.id.clone())
            .collect();
        
        let ready: Vec<Task> = tasks
            .into_iter()
            .filter(|t| {
                t.status == TaskStatus::Pending &&
                t.dependencies.iter().all(|dep| completed_ids.contains(dep))
            })
            .collect();
        
        Ok(ready)
    }
    
    // Helper to maintain task index
    fn update_task_index(&self, task_id: &str, add: bool) -> Result<()> {
        let index_key = self.task_index_key();
        let mut index: Vec<String> = self.storage.get(&index_key)?.unwrap_or_default();
        
        if add {
            if !index.contains(&task_id.to_string()) {
                index.push(task_id.to_string());
            }
        } else {
            index.retain(|id| id != task_id);
        }
        
        self.storage.set(&index_key, &index)?;
        Ok(())
    }
}

// UUID generation helper for WASM
mod uuid {
    use js_sys::Math;
    
    pub struct Uuid;
    
    impl Uuid {
        pub fn new_v4() -> String {
            let mut uuid = [0u8; 16];
            for i in 0..16 {
                uuid[i] = (Math::random() * 256.0) as u8;
            }
            
            // Set version (4) and variant bits
            uuid[6] = (uuid[6] & 0x0f) | 0x40;
            uuid[8] = (uuid[8] & 0x3f) | 0x80;
            
            format!(
                "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
                uuid[0], uuid[1], uuid[2], uuid[3],
                uuid[4], uuid[5],
                uuid[6], uuid[7],
                uuid[8], uuid[9],
                uuid[10], uuid[11], uuid[12], uuid[13], uuid[14], uuid[15]
            )
        }
    }
}
