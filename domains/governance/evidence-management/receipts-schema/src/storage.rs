//! Receipt Storage Module
//!
//! Persistent storage for receipts.

use crate::{Receipt, ReceiptError, ReceiptQuery};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::sync::RwLock;

/// Receipt storage with indexing
pub struct ReceiptStore {
    base_path: PathBuf,
    // In-memory indexes (would be persistent in production)
    run_index: RwLock<HashMap<String, Vec<String>>>,
    workflow_index: RwLock<HashMap<String, Vec<String>>>,
    kind_index: RwLock<HashMap<String, Vec<String>>>,
    correlation_index: RwLock<HashMap<String, Vec<String>>>,
}

impl ReceiptStore {
    /// Create a new receipt store
    pub fn new(base_path: impl AsRef<Path>) -> Self {
        Self {
            base_path: base_path.as_ref().to_path_buf(),
            run_index: RwLock::new(HashMap::new()),
            workflow_index: RwLock::new(HashMap::new()),
            kind_index: RwLock::new(HashMap::new()),
            correlation_index: RwLock::new(HashMap::new()),
        }
    }

    /// Save a receipt
    pub async fn save(&self, receipt: &Receipt) -> Result<(), ReceiptError> {
        let receipt_path = self.receipt_path(&receipt.receipt_id);
        
        // Ensure directory exists
        if let Some(parent) = receipt_path.parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| ReceiptError::StorageError(format!("Failed to create directory: {}", e)))?;
        }
        
        let json = serde_json::to_vec_pretty(receipt)
            .map_err(|e| ReceiptError::SerializationError(e))?;
        
        tokio::fs::write(&receipt_path, json).await
            .map_err(|e| ReceiptError::StorageError(format!("Failed to write receipt: {}", e)))?;
        
        // Update indexes
        {
            let mut run_index = self.run_index.write().await;
            run_index.entry(receipt.run_id.clone())
                .or_default()
                .push(receipt.receipt_id.clone());
        }

        {
            let mut workflow_index = self.workflow_index.write().await;
            workflow_index.entry(receipt.workflow_id.clone())
                .or_default()
                .push(receipt.receipt_id.clone());
        }

        {
            let mut kind_index = self.kind_index.write().await;
            if !receipt.kind.is_empty() {
                kind_index.entry(receipt.kind.clone())
                    .or_default()
                    .push(receipt.receipt_id.clone());
            }
        }

        {
            let mut correlation_index = self.correlation_index.write().await;
            if !receipt.correlation_id.is_empty() {
                correlation_index.entry(receipt.correlation_id.clone())
                    .or_default()
                    .push(receipt.receipt_id.clone());
            }
        }

        Ok(())
    }

    /// Load a receipt by ID
    pub async fn load(&self, receipt_id: &str) -> Result<Option<Receipt>, ReceiptError> {
        let receipt_path = self.receipt_path(receipt_id);
        
        match tokio::fs::read(&receipt_path).await {
            Ok(data) => {
                let receipt: Receipt = serde_json::from_slice(&data)
                    .map_err(|e| ReceiptError::SerializationError(e))?;
                Ok(Some(receipt))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(ReceiptError::IoError(e)),
        }
    }

    /// Load receipts by run ID
    pub async fn load_by_run(&self, run_id: &str) -> Result<Vec<Receipt>, ReceiptError> {
        let receipt_ids = {
            let run_index = self.run_index.read().await;
            run_index.get(run_id).cloned().unwrap_or_default()
        };
        
        let mut receipts = Vec::new();
        for receipt_id in receipt_ids {
            if let Some(receipt) = self.load(&receipt_id).await? {
                receipts.push(receipt);
            }
        }
        Ok(receipts)
    }

    /// Load receipts by workflow ID
    pub async fn load_by_workflow(&self, workflow_id: &str) -> Result<Vec<Receipt>, ReceiptError> {
        let receipt_ids = {
            let workflow_index = self.workflow_index.read().await;
            workflow_index.get(workflow_id).cloned().unwrap_or_default()
        };

        let mut receipts = Vec::new();
        for receipt_id in receipt_ids {
            if let Some(receipt) = self.load(&receipt_id).await? {
                receipts.push(receipt);
            }
        }
        Ok(receipts)
    }

    /// Query receipts by filters (LAW-AUT-004)
    pub async fn query_by_filters(&self, query: &ReceiptQuery) -> Result<Vec<Receipt>, ReceiptError> {
        // Get candidate receipt IDs from appropriate index
        let candidate_ids = if let Some(run_id) = &query.run_id {
            let run_index = self.run_index.read().await;
            run_index.get(run_id).cloned().unwrap_or_default()
        } else if let Some(workflow_id) = &query.workflow_id {
            let workflow_index = self.workflow_index.read().await;
            workflow_index.get(workflow_id).cloned().unwrap_or_default()
        } else if let Some(kind) = &query.kind {
            let kind_index = self.kind_index.read().await;
            kind_index.get(kind).cloned().unwrap_or_default()
        } else if let Some(correlation_id) = &query.correlation_id {
            let correlation_index = self.correlation_index.read().await;
            correlation_index.get(correlation_id).cloned().unwrap_or_default()
        } else {
            // If no filter specified, return all receipts (from run index)
            let run_index = self.run_index.read().await;
            run_index.values().flatten().cloned().collect()
        };

        // Load and filter receipts
        let mut receipts = Vec::new();
        for receipt_id in candidate_ids {
            if let Some(receipt) = self.load(&receipt_id).await? {
                // Apply additional filters
                if let Some(wih_id) = &query.wih_id {
                    if receipt.wih_id != *wih_id {
                        continue;
                    }
                }
                if let Some(tool_id) = &query.tool_id {
                    if receipt.tool_id != *tool_id {
                        continue;
                    }
                }
                if let Some(kind) = &query.kind {
                    if receipt.kind != *kind {
                        continue;
                    }
                }
                if let Some(correlation_id) = &query.correlation_id {
                    if receipt.correlation_id != *correlation_id {
                        continue;
                    }
                }
                receipts.push(receipt);
            }
        }

        // Apply pagination
        if let (Some(offset), Some(page_size)) = (query.page_offset, query.page_size) {
            receipts = receipts.into_iter()
                .skip(offset)
                .take(page_size)
                .collect();
        }

        Ok(receipts)
    }

    /// Query receipts by kind
    pub async fn query_by_kind(&self, kind: &str) -> Result<Vec<Receipt>, ReceiptError> {
        let receipt_ids = {
            let kind_index = self.kind_index.read().await;
            kind_index.get(kind).cloned().unwrap_or_default()
        };

        let mut receipts = Vec::new();
        for receipt_id in receipt_ids {
            if let Some(receipt) = self.load(&receipt_id).await? {
                receipts.push(receipt);
            }
        }
        Ok(receipts)
    }

    /// Query receipts by correlation ID
    pub async fn query_by_correlation(&self, correlation_id: &str) -> Result<Vec<Receipt>, ReceiptError> {
        let receipt_ids = {
            let correlation_index = self.correlation_index.read().await;
            correlation_index.get(correlation_id).cloned().unwrap_or_default()
        };

        let mut receipts = Vec::new();
        for receipt_id in receipt_ids {
            if let Some(receipt) = self.load(&receipt_id).await? {
                receipts.push(receipt);
            }
        }
        Ok(receipts)
    }

    /// Get path for a receipt
    fn receipt_path(&self, receipt_id: &str) -> PathBuf {
        // Organize by prefix for better filesystem performance
        let prefix = &receipt_id[..receipt_id.len().min(4)];
        self.base_path.join("receipts").join(prefix).join(format!("{}.json", receipt_id))
    }
}
