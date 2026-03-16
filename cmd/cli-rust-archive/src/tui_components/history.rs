//! Persistent command history management
//!
//! Features:
//! - Save history to disk (~/.a2r/history.jsonl)
//! - Load on startup
//! - Configurable limit (default 1000)
//! - Deduplication
//! - Fuzzy search support

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// A single history entry
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HistoryEntry {
    pub command: String,
    pub timestamp: u64,
    pub session_id: Option<String>,
}

impl HistoryEntry {
    pub fn new(command: impl Into<String>) -> Self {
        Self {
            command: command.into(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            session_id: None,
        }
    }

    pub fn with_session(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }
}

/// History persistence configuration
#[derive(Debug, Clone)]
pub struct HistoryConfig {
    pub max_entries: usize,
    pub deduplicate: bool,
    pub save_on_add: bool,
}

impl Default for HistoryConfig {
    fn default() -> Self {
        Self {
            max_entries: 1000,
            deduplicate: true,
            save_on_add: true,
        }
    }
}

/// Persistent command history manager
pub struct HistoryManager {
    entries: Vec<HistoryEntry>,
    config: HistoryConfig,
    history_file: PathBuf,
    dirty: bool,
}

impl HistoryManager {
    /// Create a new history manager
    pub fn new(history_file: impl AsRef<Path>) -> Self {
        let history_file = history_file.as_ref().to_path_buf();
        let entries = Self::load_history(&history_file);
        
        Self {
            entries,
            config: HistoryConfig::default(),
            history_file,
            dirty: false,
        }
    }

    /// Create with configuration
    pub fn with_config(history_file: impl AsRef<Path>, config: HistoryConfig) -> Self {
        let history_file = history_file.as_ref().to_path_buf();
        let entries = Self::load_history(&history_file);
        
        Self {
            entries,
            config,
            history_file,
            dirty: false,
        }
    }

    /// Load history from file
    fn load_history(path: &Path) -> Vec<HistoryEntry> {
        if !path.exists() {
            return Vec::new();
        }

        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        content
            .lines()
            .filter_map(|line| {
                // Try JSON format first
                if let Ok(entry) = serde_json::from_str::<HistoryEntry>(line) {
                    return Some(entry);
                }
                // Fallback to plain text (just command)
                if !line.trim().is_empty() {
                    return Some(HistoryEntry::new(line));
                }
                None
            })
            .collect()
    }

    /// Save history to file
    pub fn save(&mut self) -> std::io::Result<()> {
        if !self.dirty {
            return Ok(());
        }

        // Ensure parent directory exists
        if let Some(parent) = self.history_file.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut file = std::fs::File::create(&self.history_file)?;
        
        for entry in &self.entries {
            let line = serde_json::to_string(entry)?;
            use std::io::Write;
            writeln!(file, "{}", line)?;
        }

        self.dirty = false;
        Ok(())
    }

    /// Add a command to history
    pub fn add(&mut self, command: impl Into<String>) {
        let command = command.into();
        let trimmed = command.trim();
        
        if trimmed.is_empty() {
            return;
        }

        // Check for duplicates if enabled
        if self.config.deduplicate {
            if let Some(pos) = self.entries.iter().position(|e| e.command.trim() == trimmed) {
                // Move to end (most recent)
                let entry = self.entries.remove(pos);
                self.entries.push(entry);
                self.dirty = true;
                
                if self.config.save_on_add {
                    self.save().ok();
                }
                return;
            }
        }

        // Add new entry
        let entry = HistoryEntry::new(command);
        self.entries.push(entry);
        self.dirty = true;

        // Enforce limit
        self.enforce_limit();

        // Save if configured
        if self.config.save_on_add {
            self.save().ok();
        }
    }

    /// Enforce the maximum number of entries
    fn enforce_limit(&mut self) {
        if self.entries.len() > self.config.max_entries {
            let to_remove = self.entries.len() - self.config.max_entries;
            self.entries.drain(0..to_remove);
            self.dirty = true;
        }
    }

    /// Get all commands as strings (for compatibility)
    pub fn get_commands(&self) -> Vec<String> {
        self.entries
            .iter()
            .map(|e| e.command.clone())
            .collect()
    }

    /// Get entries (newest first)
    pub fn get_entries(&self) -> &[HistoryEntry] {
        &self.entries
    }

    /// Get entries reversed (newest first)
    pub fn get_entries_rev(&self) -> impl Iterator<Item = &HistoryEntry> {
        self.entries.iter().rev()
    }

    /// Search history with fuzzy matching
    pub fn search(&self, query: &str) -> Vec<&HistoryEntry> {
        let query_lower = query.to_ascii_lowercase();
        
        self.entries
            .iter()
            .filter(|e| e.command.to_ascii_lowercase().contains(&query_lower))
            .collect()
    }

    /// Get unique commands (deduplicated, newest first)
    pub fn get_unique_commands(&self) -> Vec<String> {
        let mut seen = HashSet::new();
        let mut result = Vec::new();
        
        for entry in self.entries.iter().rev() {
            let trimmed = entry.command.trim().to_string();
            if seen.insert(trimmed.clone()) {
                result.push(trimmed);
            }
        }
        
        result
    }

    /// Clear all history
    pub fn clear(&mut self) {
        self.entries.clear();
        self.dirty = true;
    }

    /// Get entry count
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Check if history is empty
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Update configuration
    pub fn set_config(&mut self, config: HistoryConfig) {
        self.config = config;
        self.enforce_limit();
    }

    /// Get current configuration
    pub fn config(&self) -> &HistoryConfig {
        &self.config
    }

    /// Get history file path
    pub fn history_file(&self) -> &Path {
        &self.history_file
    }

    /// Import commands from a list (e.g., from in-memory history)
    pub fn import_commands(&mut self, commands: &[String]) {
        for cmd in commands {
            self.add(cmd.clone());
        }
    }

    /// Export commands for use elsewhere
    pub fn export_commands(&self) -> Vec<String> {
        self.get_commands()
    }
}

impl Drop for HistoryManager {
    fn drop(&mut self) {
        // Auto-save on drop if dirty
        if self.dirty {
            self.save().ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_add_and_get_commands() {
        let temp_file = NamedTempFile::new().unwrap();
        let mut manager = HistoryManager::new(temp_file.path());
        
        manager.add("command1");
        manager.add("command2");
        manager.add("command3");
        
        let commands = manager.get_commands();
        assert_eq!(commands.len(), 3);
        assert_eq!(commands[0], "command1");
        assert_eq!(commands[2], "command3");
    }

    #[test]
    fn test_deduplication() {
        let temp_file = NamedTempFile::new().unwrap();
        let mut manager = HistoryManager::new(temp_file.path());
        
        manager.add("command1");
        manager.add("command2");
        manager.add("command1"); // Duplicate
        
        let commands = manager.get_commands();
        assert_eq!(commands.len(), 2); // Should dedupe
        assert_eq!(commands[0], "command2"); // Original first instance moved to end
        assert_eq!(commands[1], "command1");
    }

    #[test]
    fn test_max_entries_limit() {
        let temp_file = NamedTempFile::new().unwrap();
        let mut config = HistoryConfig::default();
        config.max_entries = 3;
        
        let mut manager = HistoryManager::with_config(temp_file.path(), config);
        
        manager.add("cmd1");
        manager.add("cmd2");
        manager.add("cmd3");
        manager.add("cmd4"); // Should push out cmd1
        
        let commands = manager.get_commands();
        assert_eq!(commands.len(), 3);
        assert!(!commands.contains(&"cmd1".to_string()));
        assert!(commands.contains(&"cmd4".to_string()));
    }

    #[test]
    fn test_search() {
        let temp_file = NamedTempFile::new().unwrap();
        let mut manager = HistoryManager::new(temp_file.path());
        
        manager.add("git status");
        manager.add("git commit");
        manager.add("cargo build");
        
        let results = manager.search("git");
        assert_eq!(results.len(), 2);
        
        let results = manager.search("cargo");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_save_and_load() {
        let temp_file = NamedTempFile::new().unwrap();
        
        // Create and save
        {
            let mut manager = HistoryManager::new(temp_file.path());
            manager.add("command1");
            manager.add("command2");
            manager.save().unwrap();
        }
        
        // Load and verify
        let manager = HistoryManager::new(temp_file.path());
        let commands = manager.get_commands();
        assert_eq!(commands.len(), 2);
        assert_eq!(commands[0], "command1");
        assert_eq!(commands[1], "command2");
    }

    #[test]
    fn test_get_unique_commands() {
        let temp_file = NamedTempFile::new().unwrap();
        let mut manager = HistoryManager::new(temp_file.path());
        
        manager.add("first");
        manager.add("second");
        manager.add("first"); // Duplicate (moves to end)
        
        let unique = manager.get_unique_commands();
        assert_eq!(unique.len(), 2);
        // Newest first order
        assert_eq!(unique[0], "first"); // Most recent
        assert_eq!(unique[1], "second");
    }
}
