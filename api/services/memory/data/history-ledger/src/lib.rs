use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEntry {
    pub id: String,
    pub prev_hash: Option<String>,
    pub content_hash: String,
    pub content: serde_json::Value,
    pub timestamp: u64,
}

impl LedgerEntry {
    pub fn new(
        prev_hash: Option<String>,
        content: serde_json::Value,
    ) -> Result<Self, HistoryError> {
        let content_hash = calculate_content_hash(&content)?;
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| HistoryError::TimeError(e.to_string()))?
            .as_secs();

        Ok(LedgerEntry {
            id: Uuid::new_v4().to_string(),
            prev_hash,
            content_hash,
            content,
            timestamp,
        })
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
    #[error("Invalid path: path contains invalid UTF-8 characters")]
    InvalidUtf8Path,
    #[error("Time error: {0}")]
    TimeError(String),
}

pub struct HistoryLedger {
    path: String,
    current_hash: Option<String>,
}

impl HistoryLedger {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self, HistoryError> {
        let path_str = path
            .as_ref()
            .to_str()
            .ok_or(HistoryError::InvalidUtf8Path)?
            .to_string();

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
        let entry = LedgerEntry::new(self.current_hash.clone(), content)?;

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
            let calculated_hash = calculate_content_hash(&entry.content)?;
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
}

fn calculate_content_hash(content: &serde_json::Value) -> Result<String, HistoryError> {
    let content_str = serde_json::to_string(content)?;
    let mut hasher = Sha256::new();
    hasher.update(content_str.as_bytes());
    let result = hasher.finalize();
    Ok(hex::encode(result))
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
