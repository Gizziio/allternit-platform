use crate::error::{SwarmError, SwarmResult};
use crate::types::EntityId;
use std::collections::{HashMap, HashSet};
use tokio::sync::RwLock;

/// Manages file locks to prevent conflicts between agents
#[derive(Debug)]
pub struct FileLockManager {
    locks: RwLock<HashMap<String, EntityId>>,
    waiting: RwLock<HashMap<EntityId, HashSet<String>>>,
}

impl FileLockManager {
    pub fn new() -> Self {
        Self {
            locks: RwLock::new(HashMap::new()),
            waiting: RwLock::new(HashMap::new()),
        }
    }

    /// Try to acquire a lock on a file
    pub async fn try_lock(&self, agent_id: EntityId, file_path: &str) -> SwarmResult<bool> {
        let mut locks = self.locks.write().await;
        
        if let Some(current_owner) = locks.get(file_path) {
            if *current_owner == agent_id {
                return Ok(true); // Already locked by this agent
            }
            return Ok(false); // Locked by another agent
        }

        locks.insert(file_path.to_string(), agent_id);
        Ok(true)
    }

    /// Acquire lock or wait until available
    pub async fn acquire_lock(&self, agent_id: EntityId, file_path: &str) -> SwarmResult<()> {
        loop {
            if self.try_lock(agent_id, file_path).await? {
                return Ok(());
            }
            
            // Add to waiting
            {
                let mut waiting = self.waiting.write().await;
                waiting
                    .entry(agent_id)
                    .or_insert_with(HashSet::new)
                    .insert(file_path.to_string());
            }

            // Check for deadlock
            if self.detect_deadlock().await? {
                return Err(SwarmError::Execution(crate::error::ExecutionError::Deadlock));
            }

            // Wait a bit before retrying
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    }

    /// Release a lock
    pub async fn release_lock(&self, agent_id: EntityId, file_path: &str) -> SwarmResult<()> {
        let mut locks = self.locks.write().await;
        
        if let Some(owner) = locks.get(file_path) {
            if *owner == agent_id {
                locks.remove(file_path);
            }
        }

        // Remove from waiting
        let mut waiting = self.waiting.write().await;
        if let Some(files) = waiting.get_mut(&agent_id) {
            files.remove(file_path);
        }

        Ok(())
    }

    /// Release all locks held by an agent
    pub async fn release_all(&self, agent_id: EntityId) -> SwarmResult<()> {
        let mut locks = self.locks.write().await;
        let files_to_remove: Vec<String> = locks
            .iter()
            .filter(|(_, owner)| **owner == agent_id)
            .map(|(file, _)| file.clone())
            .collect();

        for file in files_to_remove {
            locks.remove(&file);
        }

        let mut waiting = self.waiting.write().await;
        waiting.remove(&agent_id);

        Ok(())
    }

    /// Check if a file is locked
    pub async fn is_locked(&self, file_path: &str) -> bool {
        let locks = self.locks.read().await;
        locks.contains_key(file_path)
    }

    /// Get the owner of a lock
    pub async fn get_lock_owner(&self, file_path: &str) -> Option<EntityId> {
        let locks = self.locks.read().await;
        locks.get(file_path).copied()
    }

    /// Detect potential deadlocks
    async fn detect_deadlock(&self) -> SwarmResult<bool> {
        let waiting = self.waiting.read().await;
        let locks = self.locks.read().await;

        // Build wait-for graph
        for (agent_id, files) in waiting.iter() {
            for file in files {
                if let Some(owner) = locks.get(file) {
                    if *owner == *agent_id {
                        continue;
                    }
                    // Check if owner is waiting for something agent_id holds
                    if let Some(owner_waiting) = waiting.get(owner) {
                        for owner_file in owner_waiting {
                            if let Some(owner_file_owner) = locks.get(owner_file) {
                                if *owner_file_owner == *agent_id {
                                    return Ok(true); // Cycle detected
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(false)
    }

    /// Get all locked files
    pub async fn locked_files(&self) -> Vec<(String, EntityId)> {
        let locks = self.locks.read().await;
        locks.iter().map(|(f, a)| (f.clone(), *a)).collect()
    }
}

impl Default for FileLockManager {
    fn default() -> Self {
        Self::new()
    }
}
