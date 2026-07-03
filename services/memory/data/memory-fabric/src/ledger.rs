//! Append-only JSONL ledger with chained SHA-256 hashes.
//!
//! This module was adapted from the original `allternit-history` crate
//! (`services/memory/data/history-ledger`). It is now the canonical audit
//! log implementation inside the unified memory fabric.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use uuid::Uuid;

/// A single entry in the history ledger.
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

/// Errors returned by ledger operations.
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

/// Append-only ledger with chained content hashes.
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

        if !std::path::Path::new(&path_str).exists() {
            File::create(&path_str)?;
        }

        let mut ledger = HistoryLedger {
            path: path_str,
            current_hash: None,
        };

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

    /// Append a JSON value to the ledger.
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

    /// Verify the integrity of the entire chain.
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

            let calculated_hash = calculate_content_hash(&entry.content)?;
            if calculated_hash != entry.content_hash {
                return Ok(false);
            }

            if entry.prev_hash != expected_prev_hash {
                return Ok(false);
            }

            expected_prev_hash = Some(entry.content_hash);
        }

        Ok(true)
    }

    /// Return all entries in the ledger.
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

    /// Find a single entry by id.
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
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ledger_creation_and_integrity() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("ledger.jsonl");
        let mut ledger = HistoryLedger::new(&path).unwrap();

        let entry1 = ledger.append(serde_json::json!({"event": "event1"})).unwrap();
        let entry2 = ledger.append(serde_json::json!({"event": "event2"})).unwrap();

        assert_eq!(entry2.prev_hash, Some(entry1.content_hash));
        assert!(ledger.verify_integrity().unwrap());
    }

    #[test]
    fn test_ledger_retrieval() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("ledger.jsonl");
        let mut ledger = HistoryLedger::new(&path).unwrap();

        let content = serde_json::json!({"event": "retrieval_test", "value": 42});
        let entry = ledger.append(content).unwrap();

        let retrieved = ledger.get_entry_by_id(&entry.id).unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().content["value"], 42);
    }
}
