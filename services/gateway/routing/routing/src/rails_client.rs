//! Rails Client
//!
//! HTTP client for communicating with A2R Rails service.

use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// Rails HTTP client
pub struct RailsClient {
    http: Client,
    base_url: String,
}

/// Receipt record for Rails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RailsReceiptRecord {
    pub receipt_id: String,
    pub run_id: String,
    pub step: Option<i32>,
    pub tool: String,
    pub tool_version: Option<String>,
    pub inputs_ref: Option<String>,
    pub outputs_ref: Option<String>,
    pub exit: Option<RailsReceiptExit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RailsReceiptExit {
    pub code: Option<i32>,
    pub summary: Option<String>,
}

impl RailsClient {
    /// Create a new Rails client
    pub fn new(base_url: String) -> Self {
        Self {
            http: Client::new(),
            base_url,
        }
    }

    /// Append a receipt to the Rails ledger
    pub async fn append_receipt(&self, receipt: &RailsReceiptRecord) -> Result<()> {
        let url = format!("{}/api/v1/receipts", self.base_url.trim_end_matches('/'));
        
        let response = self
            .http
            .post(&url)
            .json(receipt)
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Rails receipt append failed: {}", response.status());
        }

        Ok(())
    }

    /// Get the base URL
    pub fn base_url(&self) -> &str {
        &self.base_url
    }
}
