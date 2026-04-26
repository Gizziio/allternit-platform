//! Memory storage implementation for WASM backend

use serde::{Serialize, Deserialize};
use crate::wasm::storage::BrowserStorage;
use crate::Result;

/// Memory entry type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MemoryEntryType {
    Note,
    Event,
    Observation,
    Decision,
    TaskResult,
    Conversation,
}

impl Default for MemoryEntryType {
    fn default() -> Self {
        MemoryEntryType::Note
    }
}

/// Memory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub entry_type: MemoryEntryType,
    pub content: String,
    pub tags: Vec<String>,
    pub timestamp: String,
    pub session_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

impl MemoryEntry {
    /// Create a new memory entry
    pub fn new(entry_type: MemoryEntryType, content: impl Into<String>) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: format!("mem-{}", uuid()),
            entry_type,
            content: content.into(),
            tags: Vec::new(),
            timestamp: now,
            session_id: None,
            metadata: None,
        }
    }
    
    /// Add tags
    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }
    
    /// Set session ID
    pub fn with_session(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }
}

/// Memory storage manager
pub struct MemoryStore {
    storage: BrowserStorage,
    workspace_id: String,
}

impl MemoryStore {
    /// Create new memory store
    pub fn new(storage: BrowserStorage, workspace_id: &str) -> Self {
        Self {
            storage,
            workspace_id: workspace_id.to_string(),
        }
    }
    
    fn entry_key(&self, entry_id: &str) -> String {
        format!("{}/memory/{}", self.workspace_id, entry_id)
    }
    
    /// Get all memory entries
    pub fn list_entries(&self) -> Result<Vec<MemoryEntry>> {
        let prefix = format!("{}/memory/", self.workspace_id);
        self.storage.get_all_with_prefix(&prefix)
    }
    
    /// Get entry by ID
    pub fn get_entry(&self, entry_id: &str) -> Result<Option<MemoryEntry>> {
        self.storage.get(&self.entry_key(entry_id))
    }
    
    /// Create a new memory entry
    pub fn create_entry(
        &self,
        entry_type: MemoryEntryType,
        content: impl Into<String>,
        tags: Option<Vec<String>>,
    ) -> Result<MemoryEntry> {
        let mut entry = MemoryEntry::new(entry_type, content);
        if let Some(t) = tags {
            entry.tags = t;
        }
        
        self.storage.set(&self.entry_key(&entry.id), &entry)?;
        Ok(entry)
    }
    
    /// Update a memory entry
    pub fn update_entry(&self, entry_id: &str, content: impl Into<String>, tags: Option<Vec<String>>) -> Result<MemoryEntry> {
        let mut entry = self.get_entry(entry_id)?
            .ok_or_else(|| format!("Memory entry not found: {}", entry_id))?;
        
        entry.content = content.into();
        if let Some(t) = tags {
            entry.tags = t;
        }
        entry.timestamp = chrono::Utc::now().to_rfc3339();
        
        self.storage.set(&self.entry_key(&entry.id), &entry)?;
        Ok(entry)
    }
    
    /// Delete a memory entry
    pub fn delete_entry(&self, entry_id: &str) -> Result<()> {
        self.storage.delete(&self.entry_key(entry_id))
    }
    
    /// Search memory entries by content or tags
    pub fn search(&self, query: &str) -> Result<Vec<MemoryEntry>> {
        let entries = self.list_entries()?;
        let query_lower = query.to_lowercase();
        
        let results: Vec<MemoryEntry> = entries
            .into_iter()
            .filter(|entry| {
                entry.content.to_lowercase().contains(&query_lower) ||
                entry.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
            })
            .collect();
        
        Ok(results)
    }
    
    /// Get entries by type
    pub fn get_by_type(&self, entry_type: MemoryEntryType) -> Result<Vec<MemoryEntry>> {
        let entries = self.list_entries()?;
        let filtered: Vec<MemoryEntry> = entries
            .into_iter()
            .filter(|e| e.entry_type == entry_type)
            .collect();
        Ok(filtered)
    }
    
    /// Get entries by tag
    pub fn get_by_tag(&self, tag: &str) -> Result<Vec<MemoryEntry>> {
        let entries = self.list_entries()?;
        let filtered: Vec<MemoryEntry> = entries
            .into_iter()
            .filter(|e| e.tags.contains(&tag.to_string()))
            .collect();
        Ok(filtered)
    }
    
    /// Get recent entries (last N)
    pub fn get_recent(&self, limit: usize) -> Result<Vec<MemoryEntry>> {
        let mut entries = self.list_entries()?;
        entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        entries.truncate(limit);
        Ok(entries)
    }
    
    /// Append to an existing entry (for streaming/large content)
    pub fn append_to_entry(&self, entry_id: &str, additional_content: impl Into<String>) -> Result<MemoryEntry> {
        let mut entry = self.get_entry(entry_id)?
            .ok_or_else(|| format!("Memory entry not found: {}", entry_id))?;
        
        entry.content.push('\n');
        entry.content.push_str(&additional_content.into());
        entry.timestamp = chrono::Utc::now().to_rfc3339();
        
        self.storage.set(&self.entry_key(&entry.id), &entry)?;
        Ok(entry)
    }
    
    /// Clear all memory entries
    pub fn clear_all(&self) -> Result<()> {
        let prefix = format!("{}/memory/", self.workspace_id);
        self.storage.clear_prefix(&prefix)
    }
}

// UUID helper
fn uuid() -> String {
    use js_sys::Math;
    
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
