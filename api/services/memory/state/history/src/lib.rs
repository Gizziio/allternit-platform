use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use uuid::Uuid;

/// WASM-related events for the history ledger.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type")]
pub enum WasmEvent {
    /// A capsule was loaded into memory
    CapsuleLoaded {
        capsule_id: String,
        tenant_id: String,
        loader_identity_id: String,
        capabilities_granted: Vec<String>,
        timestamp: u64,
    },

    /// A capsule was unloaded from memory
    CapsuleUnloaded {
        capsule_id: String,
        tenant_id: String,
        reason: String,
        timestamp: u64,
    },

    /// A capability was granted to a capsule
    CapabilityGranted {
        capsule_id: String,
        tenant_id: String,
        capability: String,
        granted_by: String,
        expires_at: Option<u64>,
        timestamp: u64,
    },

    /// A capability was denied to a capsule
    CapabilityDenied {
        capsule_id: String,
        tenant_id: String,
        capability: String,
        reason: String,
        timestamp: u64,
    },

    /// Tool execution started
    ToolExecutionStarted {
        execution_id: String,
        capsule_id: String,
        tenant_id: String,
        session_id: Option<String>,
        input_hash: String,
        timestamp: u64,
    },

    /// Tool execution completed successfully
    ToolExecutionCompleted {
        execution_id: String,
        capsule_id: String,
        tenant_id: String,
        execution_time_ms: u64,
        output_hash: String,
        side_effects: Vec<String>,
        timestamp: u64,
    },

    /// Tool execution failed
    ToolExecutionFailed {
        execution_id: String,
        capsule_id: String,
        tenant_id: String,
        error_type: String,
        error_message: String,
        execution_time_ms: u64,
        timestamp: u64,
    },

    /// Resource usage exceeded limits
    ResourceLimitExceeded {
        execution_id: String,
        capsule_id: String,
        resource_type: String,
        usage: u64,
        limit: u64,
        timestamp: u64,
    },

    /// Host function called by tool
    HostFunctionCalled {
        execution_id: String,
        capsule_id: String,
        function_name: String,
        allowed: bool,
        timestamp: u64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEntry {
    pub id: String,
    pub prev_hash: Option<String>,
    pub content_hash: String,
    pub content: serde_json::Value,
    pub timestamp: u64,
}

impl LedgerEntry {
    pub fn new(prev_hash: Option<String>, content: serde_json::Value) -> Self {
        let content_hash = calculate_content_hash(&content);
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        LedgerEntry {
            id: Uuid::new_v4().to_string(),
            prev_hash,
            content_hash,
            content,
            timestamp,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum HistoryError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Integrity error: {0}")]
    Integrity(String),
}

pub struct HistoryLedger {
    path: String,
    current_hash: Option<String>,
}

impl HistoryLedger {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self, HistoryError> {
        let path_str = path.as_ref().to_str().unwrap().to_string();

        // Create the file if it doesn't exist
        if !std::path::Path::new(&path_str).exists() {
            File::create(&path_str)?;
        }

        let mut ledger = HistoryLedger {
            path: path_str,
            current_hash: None,
        };

        // Load existing entries to set current hash
        ledger.load_existing_hashes()?;

        Ok(ledger)
    }

    fn load_existing_hashes(&mut self) -> Result<(), HistoryError> {
        let file = File::open(&self.path)?;
        let reader = BufReader::new(file);

        let mut last_hash: Option<String> = None;
        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }

            let entry: LedgerEntry = serde_json::from_str(&line)?;
            last_hash = Some(entry.content_hash.clone());
        }

        self.current_hash = last_hash;
        Ok(())
    }

    pub fn append(&mut self, content: serde_json::Value) -> Result<LedgerEntry, HistoryError> {
        let entry = LedgerEntry::new(self.current_hash.clone(), content);

        let mut file = OpenOptions::new()
            .append(true)
            .create(true)
            .open(&self.path)?;

        writeln!(file, "{}", serde_json::to_string(&entry)?)?;
        file.flush()?;

        self.current_hash = Some(entry.content_hash.clone());

        Ok(entry)
    }

    pub fn verify_integrity(&self) -> Result<bool, HistoryError> {
        let file = File::open(&self.path)?;
        let reader = BufReader::new(file);

        let mut expected_prev_hash: Option<String> = None;

        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }

            let entry: LedgerEntry = serde_json::from_str(&line)?;

            // Verify content hash
            let calculated_hash = calculate_content_hash(&entry.content);
            if calculated_hash != entry.content_hash {
                return Ok(false);
            }

            // Verify chain integrity
            if entry.prev_hash != expected_prev_hash {
                return Ok(false);
            }

            expected_prev_hash = Some(entry.content_hash);
        }

        Ok(true)
    }

    pub fn get_entries(&self) -> Result<Vec<LedgerEntry>, HistoryError> {
        let file = File::open(&self.path)?;
        let reader = BufReader::new(file);

        let mut entries = Vec::new();
        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }

            let entry: LedgerEntry = serde_json::from_str(&line)?;
            entries.push(entry);
        }

        Ok(entries)
    }

    pub fn get_entry_by_id(&self, id: &str) -> Result<Option<LedgerEntry>, HistoryError> {
        let file = File::open(&self.path)?;
        let reader = BufReader::new(file);

        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }

            let entry: LedgerEntry = serde_json::from_str(&line)?;
            if entry.id == id {
                return Ok(Some(entry));
            }
        }

        Ok(None)
    }

    /// Log a WASM event to the ledger.
    pub fn log_wasm_event(&mut self, event: WasmEvent) -> Result<LedgerEntry, HistoryError> {
        let content = serde_json::to_value(event)?;
        self.append(content)
    }

    /// Query WASM events by capsule ID.
    pub fn query_wasm_events_by_capsule(
        &self,
        capsule_id: &str,
    ) -> Result<Vec<WasmEvent>, HistoryError> {
        let entries = self.get_entries()?;
        let mut events = Vec::new();

        for entry in entries {
            if let Ok(event) = serde_json::from_value::<WasmEvent>(entry.content) {
                match &event {
                    WasmEvent::CapsuleLoaded { capsule_id: id, .. }
                    | WasmEvent::CapsuleUnloaded { capsule_id: id, .. }
                    | WasmEvent::CapabilityGranted { capsule_id: id, .. }
                    | WasmEvent::CapabilityDenied { capsule_id: id, .. }
                    | WasmEvent::ToolExecutionStarted { capsule_id: id, .. }
                    | WasmEvent::ToolExecutionCompleted { capsule_id: id, .. }
                    | WasmEvent::ToolExecutionFailed { capsule_id: id, .. }
                    | WasmEvent::ResourceLimitExceeded { capsule_id: id, .. }
                    | WasmEvent::HostFunctionCalled { capsule_id: id, .. } => {
                        if id == capsule_id {
                            events.push(event);
                        }
                    }
                }
            }
        }

        Ok(events)
    }

    /// Query WASM events by tenant ID.
    pub fn query_wasm_events_by_tenant(
        &self,
        tenant_id: &str,
    ) -> Result<Vec<WasmEvent>, HistoryError> {
        let entries = self.get_entries()?;
        let mut events = Vec::new();

        for entry in entries {
            if let Ok(event) = serde_json::from_value::<WasmEvent>(entry.content) {
                let matches = match &event {
                    WasmEvent::CapsuleLoaded { tenant_id: id, .. }
                    | WasmEvent::CapsuleUnloaded { tenant_id: id, .. }
                    | WasmEvent::CapabilityGranted { tenant_id: id, .. }
                    | WasmEvent::CapabilityDenied { tenant_id: id, .. }
                    | WasmEvent::ToolExecutionStarted { tenant_id: id, .. }
                    | WasmEvent::ToolExecutionCompleted { tenant_id: id, .. }
                    | WasmEvent::ToolExecutionFailed { tenant_id: id, .. } => id == tenant_id,
                    WasmEvent::ResourceLimitExceeded { .. }
                    | WasmEvent::HostFunctionCalled { .. } => false,
                };
                if matches {
                    events.push(event);
                }
            }
        }

        Ok(events)
    }

    /// Query WASM events by execution ID.
    pub fn query_wasm_events_by_execution(
        &self,
        execution_id: &str,
    ) -> Result<Vec<WasmEvent>, HistoryError> {
        let entries = self.get_entries()?;
        let mut events = Vec::new();

        for entry in entries {
            if let Ok(event) = serde_json::from_value::<WasmEvent>(entry.content) {
                let matches = match &event {
                    WasmEvent::ToolExecutionStarted {
                        execution_id: id, ..
                    }
                    | WasmEvent::ToolExecutionCompleted {
                        execution_id: id, ..
                    }
                    | WasmEvent::ToolExecutionFailed {
                        execution_id: id, ..
                    }
                    | WasmEvent::ResourceLimitExceeded {
                        execution_id: id, ..
                    }
                    | WasmEvent::HostFunctionCalled {
                        execution_id: id, ..
                    } => id == execution_id,
                    _ => false,
                };
                if matches {
                    events.push(event);
                }
            }
        }

        Ok(events)
    }
}

fn calculate_content_hash(content: &serde_json::Value) -> String {
    let content_str = serde_json::to_string(content).unwrap();
    let mut hasher = Sha256::new();
    hasher.update(content_str.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ledger_creation() {
        let temp_path = format!("/tmp/test_ledger_{}.jsonl", Uuid::new_v4());
        let mut ledger = HistoryLedger::new(&temp_path).unwrap();

        let content = serde_json::json!({
            "event": "test_event",
            "data": "test_data"
        });

        let entry = ledger.append(content).unwrap();
        assert_eq!(entry.content["event"], "test_event");

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[test]
    fn test_ledger_integrity() {
        let temp_path = format!("/tmp/test_integrity_{}.jsonl", Uuid::new_v4());
        let mut ledger = HistoryLedger::new(&temp_path).unwrap();

        let content1 = serde_json::json!({"event": "event1"});
        let entry1 = ledger.append(content1).unwrap();

        let content2 = serde_json::json!({"event": "event2"});
        let entry2 = ledger.append(content2).unwrap();

        assert_eq!(entry2.prev_hash, Some(entry1.content_hash));

        let is_valid = ledger.verify_integrity().unwrap();
        assert!(is_valid);

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[test]
    fn test_ledger_retrieval() {
        let temp_path = format!("/tmp/test_retrieval_{}.jsonl", Uuid::new_v4());
        let mut ledger = HistoryLedger::new(&temp_path).unwrap();

        let content = serde_json::json!({"event": "retrieval_test", "value": 42});
        let entry = ledger.append(content).unwrap();

        let retrieved_entry = ledger.get_entry_by_id(&entry.id).unwrap();
        assert!(retrieved_entry.is_some());
        assert_eq!(retrieved_entry.unwrap().content["value"], 42);

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }
}
