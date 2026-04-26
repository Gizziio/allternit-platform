//! Parity Capture System
//!
//! Captures all OpenClaw I/O for deterministic replay and comparison.
//! This is LOCK 2 compliance: parity corpus is the authority.
//!
//! ARCHITECTURE LOCK: Every call to OpenClaw must generate a receipt.
//! No exceptions. Receipts are immutable and archived for the migration lifetime.

use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Receipt for a single OpenClaw call
///
/// This is the core data structure for parity testing.
/// All fields are deterministic except timing (which is recorded but not compared).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Receipt {
    /// Unique identifier for this receipt
    pub id: Uuid,

    /// Timestamp of call initiation (UTC)
    pub timestamp: DateTime<Utc>,

    /// Call duration in milliseconds
    pub duration_ms: u64,

    /// OpenClaw method called
    pub method: String,

    /// Request parameters (normalized)
    pub request: Value,

    /// Response from OpenClaw (normalized)
    pub response: Value,

    /// stderr output (if any)
    pub stderr: String,

    /// Process exit code (0 = success)
    pub exit_code: i32,

    /// Additional metadata
    pub metadata: ReceiptMetadata,
}

/// Metadata about the receipt environment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptMetadata {
    /// Allternit version
    pub version: String,

    /// OpenClaw version
    pub host_version: String,

    /// Environment identifier
    pub environment: String,

    /// Host machine identifier (hashed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_hash: Option<String>,
}

/// Normalized receipt for comparison
///
/// Removes non-deterministic fields (timestamps, temp paths, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NormalizedReceipt {
    pub method: String,
    pub request: Value,
    pub response: Value,
    pub stderr: String,
    pub exit_code: i32,
}

/// Capture configuration
#[derive(Debug, Clone)]
pub struct CaptureConfig {
    /// Base directory for corpus storage
    pub corpus_dir: PathBuf,

    /// Enable/disable capture
    pub enabled: bool,

    /// Compress files larger than this (bytes)
    pub compress_threshold: usize,

    /// Retention period (days)
    pub retention_days: u32,

    /// Async channel size
    pub channel_size: usize,
}

impl Default for CaptureConfig {
    fn default() -> Self {
        Self {
            corpus_dir: PathBuf::from(".migration/openclaw-absorption/corpus/raw"),
            enabled: true,
            compress_threshold: 1024 * 1024, // 1MB
            retention_days: 30,
            channel_size: 1000,
        }
    }
}

/// Capture manager
pub struct CaptureManager {
    config: CaptureConfig,
    tx: mpsc::Sender<CaptureTask>,
    _worker: tokio::task::JoinHandle<()>,
}

/// Internal capture task
struct CaptureTask {
    receipt: Receipt,
}

impl CaptureManager {
    /// Initialize capture system
    pub async fn init(config: CaptureConfig) -> Result<Self, CaptureError> {
        // Ensure corpus directory exists
        fs::create_dir_all(&config.corpus_dir)
            .await
            .map_err(|e| CaptureError::Storage(e.to_string()))?;

        // Ensure date subdirectory exists
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let date_dir = config.corpus_dir.join(&today);
        fs::create_dir_all(&date_dir)
            .await
            .map_err(|e| CaptureError::Storage(e.to_string()))?;

        // Set up async channel for non-blocking writes
        let (tx, mut rx) = mpsc::channel::<CaptureTask>(config.channel_size);

        let corpus_dir = config.corpus_dir.clone();
        let compress_threshold = config.compress_threshold;

        // Spawn background worker for writing receipts
        let worker = tokio::spawn(async move {
            while let Some(task) = rx.recv().await {
                if let Err(e) =
                    write_receipt_to_disk(&task.receipt, &corpus_dir, compress_threshold).await
                {
                    warn!("Failed to write receipt: {}", e);
                }
            }
        });

        info!("Parity capture initialized at: {:?}", config.corpus_dir);

        Ok(Self {
            config,
            tx,
            _worker: worker,
        })
    }

    /// Capture a receipt (non-blocking)
    pub fn capture(&self, receipt: Receipt) -> Result<(), CaptureError> {
        if !self.config.enabled {
            return Ok(());
        }

        // Send to background worker (non-blocking)
        match self.tx.try_send(CaptureTask { receipt }) {
            Ok(_) => Ok(()),
            Err(mpsc::error::TrySendError::Full(_)) => {
                warn!("Capture channel full, dropping receipt");
                Err(CaptureError::ChannelFull)
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                error!("Capture channel closed");
                Err(CaptureError::ChannelClosed)
            }
        }
    }

    /// Shutdown capture manager gracefully
    pub async fn shutdown(self) {
        drop(self.tx); // Close channel
        self._worker.await.ok();
    }
}

/// Write receipt to disk
pub async fn write_receipt_to_disk(
    receipt: &Receipt,
    corpus_dir: &PathBuf,
    compress_threshold: usize,
) -> Result<(), CaptureError> {
    // Organize by date
    let date = receipt.timestamp.format("%Y-%m-%d").to_string();
    let date_dir = corpus_dir.join(&date);
    fs::create_dir_all(&date_dir)
        .await
        .map_err(|e| CaptureError::Storage(e.to_string()))?;

    let receipt_num = receipt.id.simple().to_string();
    let base_path = date_dir.join(format!("receipt-{}-", &receipt_num[..8]));

    // Write request
    let request_json = serde_json::to_string_pretty(&receipt.request)
        .map_err(|e| CaptureError::Serialization(e.to_string()))?;
    write_file(
        &base_path.with_extension("request.json"),
        request_json.as_bytes(),
        compress_threshold,
    )
    .await?;

    // Write response
    let response_json = serde_json::to_string_pretty(&receipt.response)
        .map_err(|e| CaptureError::Serialization(e.to_string()))?;
    write_file(
        &base_path.with_extension("response.json"),
        response_json.as_bytes(),
        compress_threshold,
    )
    .await?;

    // Write metadata
    let meta_json = serde_json::to_string_pretty(&serde_json::json!({
        "id": receipt.id,
        "timestamp": receipt.timestamp,
        "duration_ms": receipt.duration_ms,
        "method": receipt.method,
        "exit_code": receipt.exit_code,
        "metadata": receipt.metadata,
    }))
    .map_err(|e| CaptureError::Serialization(e.to_string()))?;
    write_file(
        &base_path.with_extension("meta.json"),
        meta_json.as_bytes(),
        compress_threshold,
    )
    .await?;

    // Write stderr (if any)
    if !receipt.stderr.is_empty() {
        write_file(
            &base_path.with_extension("stderr.log"),
            receipt.stderr.as_bytes(),
            compress_threshold,
        )
        .await?;
    }

    // Update index
    update_index(corpus_dir, receipt).await?;

    debug!(
        "Receipt written: {} (method: {})",
        receipt.id, receipt.method
    );

    Ok(())
}

/// Write file, optionally compressing
async fn write_file(
    path: &PathBuf,
    data: &[u8],
    compress_threshold: usize,
) -> Result<(), CaptureError> {
    if data.len() > compress_threshold {
        // Compress large files
        let compressed = compress(data).map_err(|e| CaptureError::Compression(e.to_string()))?;
        fs::write(path.with_extension("json.gz"), compressed)
            .await
            .map_err(|e| CaptureError::Storage(e.to_string()))?;
    } else {
        fs::write(path, data)
            .await
            .map_err(|e| CaptureError::Storage(e.to_string()))?;
    }
    Ok(())
}

/// Update corpus index
async fn update_index(corpus_dir: &PathBuf, receipt: &Receipt) -> Result<(), CaptureError> {
    let index_path = corpus_dir.join("index.jsonl");

    let index_entry = serde_json::json!({
        "id": receipt.id,
        "timestamp": receipt.timestamp,
        "method": receipt.method,
        "duration_ms": receipt.duration_ms,
        "exit_code": receipt.exit_code,
        "date": receipt.timestamp.format("%Y-%m-%d").to_string(),
    });

    let line = format!(
        "{}\n",
        serde_json::to_string(&index_entry)
            .map_err(|e| CaptureError::Serialization(e.to_string()))?
    );

    // Append to index
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&index_path)
        .await
        .map_err(|e| CaptureError::Storage(e.to_string()))?;

    file.write_all(line.as_bytes())
        .await
        .map_err(|e| CaptureError::Storage(e.to_string()))?;

    Ok(())
}

/// Compress data using gzip
fn compress(data: &[u8]) -> Result<Vec<u8>, std::io::Error> {
    use std::io::Write;

    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(data)?;
    encoder.finish()
}

/// Normalize receipt for comparison
///
/// Removes non-deterministic fields:
/// - Timestamps (converted to relative if needed)
/// - Temp file paths (normalized)
/// - IDs (stable sorting)
/// - Whitespace differences
pub fn normalize_receipt(receipt: &Receipt) -> NormalizedReceipt {
    let mut request = receipt.request.clone();
    let mut response = receipt.response.clone();
    let mut stderr = receipt.stderr.clone();

    // Normalize temp paths
    normalize_paths(&mut request);
    normalize_paths(&mut response);
    normalize_paths_in_string(&mut stderr);

    // Sort JSON keys for stability
    request = sort_json_keys(request);
    response = sort_json_keys(response);

    NormalizedReceipt {
        method: receipt.method.clone(),
        request,
        response,
        stderr,
        exit_code: receipt.exit_code,
    }
}

/// Normalize temp paths in JSON value
fn normalize_paths(value: &mut Value) {
    match value {
        Value::String(s) => {
            // Replace temp directory paths with placeholder
            if s.contains("/tmp/") || s.contains("/var/tmp/") {
                *s = s.replace(
                    regex::Regex::new(r"/tmp/[^/]+")
                        .unwrap()
                        .find(s)
                        .map(|m| m.as_str())
                        .unwrap_or(""),
                    "{{TMP_DIR}}",
                );
            }
            if s.contains("/Users/") || s.contains("/home/") {
                *s = regex::Regex::new(r"/Users/[^/]+|/home/[^/]+")
                    .unwrap()
                    .replace_all(s, "{{HOME_DIR}}")
                    .to_string();
            }
        }
        Value::Array(arr) => {
            for item in arr {
                normalize_paths(item);
            }
        }
        Value::Object(map) => {
            for (_, v) in map {
                normalize_paths(v);
            }
        }
        _ => {}
    }
}

/// Normalize paths in string
fn normalize_paths_in_string(s: &mut String) {
    // Similar logic for plain strings
    *s = s.replace(
        &std::env::temp_dir().to_string_lossy().to_string(),
        "{{TMP_DIR}}",
    );
    if let Some(home) = dirs::home_dir() {
        *s = s.replace(&home.to_string_lossy().to_string(), "{{HOME_DIR}}");
    }
}

/// Sort JSON keys alphabetically for stable comparison
fn sort_json_keys(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut sorted: serde_json::Map<String, Value> = serde_json::Map::new();
            let mut keys: Vec<_> = map.keys().cloned().collect();
            keys.sort();
            for key in keys {
                if let Some(v) = map.get(&key) {
                    sorted.insert(key, sort_json_keys(v.clone()));
                }
            }
            Value::Object(sorted)
        }
        Value::Array(arr) => Value::Array(arr.into_iter().map(sort_json_keys).collect()),
        other => other,
    }
}

/// Capture errors
#[derive(Debug, thiserror::Error)]
pub enum CaptureError {
    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Compression error: {0}")]
    Compression(String),

    #[error("Channel full - dropping receipt")]
    ChannelFull,

    #[error("Channel closed")]
    ChannelClosed,
}

/// Convenience function for capturing receipts from OpenClawHost
pub async fn write_receipt(receipt: Receipt) -> Result<(), CaptureError> {
    let config = CaptureConfig::default();
    write_receipt_to_disk(&receipt, &config.corpus_dir, config.compress_threshold).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_receipt() {
        let receipt = Receipt {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            duration_ms: 100,
            method: "skills.execute".to_string(),
            request: serde_json::json!({
                "path": "/Users/test/project",
                "temp": "/tmp/xyz123",
            }),
            response: serde_json::json!({
                "z_key": "last",
                "a_key": "first",
            }),
            stderr: String::new(),
            exit_code: 0,
            metadata: ReceiptMetadata {
                version: "1.0.0".to_string(),
                host_version: "2026.1.29".to_string(),
                environment: "test".to_string(),
                host_hash: None,
            },
        };

        let normalized = normalize_receipt(&receipt);

        // Keys should be sorted
        let keys: Vec<_> = normalized.request.as_object().unwrap().keys().collect();
        assert_eq!(keys, vec!["path", "temp"]);

        // Paths should be normalized
        assert!(normalized.request["path"]
            .as_str()
            .unwrap()
            .contains("{{HOME_DIR}}"));
        assert!(normalized.request["temp"]
            .as_str()
            .unwrap()
            .contains("{{TMP_DIR}}"));
    }
}
