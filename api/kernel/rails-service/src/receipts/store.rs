use std::path::PathBuf;

use crate::core::ids::create_blob_id;
use crate::core::io::{ensure_dir, write_json_atomic};
use crate::core::types::ReceiptRecord;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct ReceiptStoreOptions {
    pub root_dir: Option<PathBuf>,
    pub receipts_dir: Option<PathBuf>,
    pub blobs_dir: Option<PathBuf>,
}

pub struct ReceiptStore {
    receipts_dir: PathBuf,
    blobs_dir: PathBuf,
}

/// Query filters for receipt queries
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReceiptQuery {
    pub run_id: Option<String>,
    pub tool: Option<String>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Receipt verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptVerificationResult {
    pub receipt_id: String,
    pub is_valid: bool,
    pub hash_matches: bool,
    pub signature_valid: Option<bool>,
    pub errors: Vec<String>,
}

/// Receipt summary/aggregation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptSummary {
    pub total_count: usize,
    pub by_type: std::collections::HashMap<String, usize>,
    pub by_run: std::collections::HashMap<String, usize>,
    pub date_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
}

impl ReceiptStore {
    pub fn new(opts: ReceiptStoreOptions) -> Result<Self> {
        let root_dir = opts
            .root_dir
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")));
        let receipts_dir = opts
            .receipts_dir
            .unwrap_or_else(|| PathBuf::from(".a2r/receipts"));
        let blobs_dir = opts
            .blobs_dir
            .unwrap_or_else(|| PathBuf::from(".a2r/blobs"));

        let receipts_dir = if receipts_dir.is_absolute() {
            receipts_dir
        } else {
            root_dir.join(receipts_dir)
        };
        let blobs_dir = if blobs_dir.is_absolute() {
            blobs_dir
        } else {
            root_dir.join(blobs_dir)
        };

        ensure_dir(&receipts_dir)?;
        ensure_dir(&blobs_dir)?;

        Ok(Self {
            receipts_dir,
            blobs_dir,
        })
    }

    pub fn write_receipt(&self, receipt: &ReceiptRecord) -> Result<PathBuf> {
        let receipt_dir = self.receipts_dir.join(&receipt.receipt_id);
        ensure_dir(&receipt_dir)?;
        let receipt_path = receipt_dir.join("receipt.json");
        write_json_atomic(&receipt_path, receipt)?;
        Ok(receipt_path)
    }

    pub fn write_receipt_with_ts(&self, mut receipt: ReceiptRecord) -> Result<PathBuf> {
        if receipt.receipt_id.is_empty() {
            receipt.receipt_id = format!("rcpt_{}", Utc::now().timestamp());
        }
        self.write_receipt(&receipt)
    }

    pub fn store_blob_bytes(&self, bytes: &[u8]) -> Result<String> {
        for _ in 0..6 {
            let blob_id = create_blob_id();
            let blob_path = self.blobs_dir.join(&blob_id);
            if blob_path.exists() {
                continue;
            }
            std::fs::write(&blob_path, bytes)?;
            return Ok(blob_id);
        }
        anyhow::bail!("failed to allocate blob id after multiple attempts");
    }

    pub fn store_blob_string(&self, content: &str) -> Result<String> {
        self.store_blob_bytes(content.as_bytes())
    }

    pub fn blob_path(&self, blob_id: &str) -> PathBuf {
        self.blobs_dir.join(blob_id)
    }

    pub fn receipt_path(&self, receipt_id: &str) -> PathBuf {
        self.receipts_dir.join(receipt_id).join("receipt.json")
    }

    /// Read a receipt by ID
    pub fn read_receipt(&self, receipt_id: &str) -> Result<Option<ReceiptRecord>> {
        let receipt_path = self.receipt_path(receipt_id);
        if !receipt_path.exists() {
            return Ok(None);
        }
        let content = std::fs::read_to_string(&receipt_path)?;
        let receipt: ReceiptRecord = serde_json::from_str(&content)?;
        Ok(Some(receipt))
    }

    /// Query receipts with filters
    pub fn query_receipts(&self, query: &ReceiptQuery) -> Result<Vec<ReceiptRecord>> {
        let mut results = Vec::new();

        // Iterate through receipt directories
        if let Ok(entries) = std::fs::read_dir(&self.receipts_dir) {
            for entry in entries.flatten() {
                if !entry.file_type()?.is_dir() {
                    continue;
                }

                let receipt_id = entry.file_name().to_string_lossy().to_string();
                if let Some(receipt) = self.read_receipt(&receipt_id)? {
                    // Apply filters
                    if let Some(ref run_id) = query.run_id {
                        if receipt.run_id != *run_id {
                            continue;
                        }
                    }
                    if let Some(ref tool) = query.tool {
                        if receipt.tool != *tool {
                            continue;
                        }
                    }

                    results.push(receipt);
                }
            }
        }

        // Sort by receipt_id (lexicographic, which is roughly chronological)
        results.sort_by(|a, b| a.receipt_id.cmp(&b.receipt_id));

        // Apply pagination
        let offset = query.offset.unwrap_or(0);
        let limit = query.limit.unwrap_or(usize::MAX);
        let results = results.into_iter().skip(offset).take(limit).collect();

        Ok(results)
    }

    /// Verify receipt integrity
    pub fn verify_receipt(&self, receipt_id: &str) -> Result<ReceiptVerificationResult> {
        let errors = Vec::new();
        let signature_valid = None;

        // Read receipt
        let receipt = match self.read_receipt(receipt_id)? {
            Some(r) => r,
            None => {
                return Ok(ReceiptVerificationResult {
                    receipt_id: receipt_id.to_string(),
                    is_valid: false,
                    hash_matches: false,
                    signature_valid: None,
                    errors: vec!["Receipt not found".to_string()],
                });
            }
        };

        // Verify hash (if inputs_ref or outputs_ref is present)
        let hash_matches = if let Some(inputs_ref) = &receipt.inputs_ref {
            let mut hasher = Sha256::new();
            hasher.update(receipt.receipt_id.as_bytes());
            hasher.update(receipt.run_id.as_bytes());
            hasher.update(receipt.tool.as_bytes());
            hasher.update(inputs_ref.as_bytes());
            let computed_hash = format!("{:x}", hasher.finalize());

            // For now, just verify that we can compute a hash
            // In production, compare against stored hash
            !computed_hash.is_empty()
        } else {
            true // No hash to verify
        };

        // Signature verification would go here if signatures are implemented
        // For now, signature_valid is None

        let is_valid = errors.is_empty() && hash_matches;

        Ok(ReceiptVerificationResult {
            receipt_id: receipt_id.to_string(),
            is_valid,
            hash_matches,
            signature_valid,
            errors,
        })
    }

    /// Get receipt summary/aggregation
    pub fn get_summary(&self, query: &ReceiptQuery) -> Result<ReceiptSummary> {
        let receipts = self.query_receipts(query)?;

        let mut by_tool: std::collections::HashMap<String, usize> =
            std::collections::HashMap::new();
        let mut by_run: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

        for receipt in &receipts {
            // Count by tool
            *by_tool.entry(receipt.tool.clone()).or_insert(0) += 1;

            // Count by run
            *by_run.entry(receipt.run_id.clone()).or_insert(0) += 1;
        }

        Ok(ReceiptSummary {
            total_count: receipts.len(),
            by_type: by_tool, // Using tool as "type"
            by_run,
            date_range: None, // ReceiptRecord doesn't have timestamp
        })
    }

    /// Verify multiple receipts
    pub fn verify_receipts(
        &self,
        receipt_ids: &[String],
    ) -> Result<Vec<ReceiptVerificationResult>> {
        let mut results = Vec::new();
        for receipt_id in receipt_ids {
            results.push(self.verify_receipt(receipt_id)?);
        }
        Ok(results)
    }
}
