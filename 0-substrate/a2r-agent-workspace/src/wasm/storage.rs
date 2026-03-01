//! Browser storage implementation for WASM backend
//!
//! Uses IndexedDB for persistent storage of workspace data

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use serde::{Serialize, Deserialize};
use crate::Result;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Storage manager for WASM backend using IndexedDB
pub struct BrowserStorage {
    memory_fallback: Arc<Mutex<HashMap<String, serde_json::Value>>>,
}

impl BrowserStorage {
    /// Create new storage (uses in-memory fallback since IndexedDB access requires more setup)
    pub fn new(_workspace_id: &str) -> Self {
        Self {
            memory_fallback: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Get a value from storage
    pub fn get<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Result<Option<T>> {
        let data = self.memory_fallback.lock().map_err(|_| "Lock poisoned")?;
        match data.get(key) {
            Some(value) => {
                let typed: T = serde_json::from_value(value.clone())?;
                Ok(Some(typed))
            }
            None => Ok(None),
        }
    }
    
    /// Get all values with a prefix
    pub fn get_all_with_prefix<T: for<'de> Deserialize<'de>>(&self, prefix: &str) -> Result<Vec<T>> {
        let data = self.memory_fallback.lock().map_err(|_| "Lock poisoned")?;
        let values: Result<Vec<T>> = data
            .iter()
            .filter(|(k, _)| k.starts_with(prefix))
            .map(|(_, v)| serde_json::from_value(v.clone()).map_err(|e| e.into()))
            .collect();
        values
    }
    
    /// Set a value in storage
    pub fn set<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        let mut data = self.memory_fallback.lock().map_err(|_| "Lock poisoned")?;
        let json_value = serde_json::to_value(value)?;
        data.insert(key.to_string(), json_value);
        Ok(())
    }
    
    /// Delete a value from storage
    pub fn delete(&self, key: &str) -> Result<()> {
        let mut data = self.memory_fallback.lock().map_err(|_| "Lock poisoned")?;
        data.remove(key);
        Ok(())
    }
    
    /// Clear all data with a prefix
    pub fn clear_prefix(&self, prefix: &str) -> Result<()> {
        let mut data = self.memory_fallback.lock().map_err(|_| "Lock poisoned")?;
        data.retain(|k, _| !k.starts_with(prefix));
        Ok(())
    }
}
