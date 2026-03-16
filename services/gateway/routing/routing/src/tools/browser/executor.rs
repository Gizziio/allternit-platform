// 7-apps/api/src/tools/browser/executor.rs
//! Browser Tool Executor
//!
//! Executes browser tools via the browser-use backend service.

use super::*;
use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Session metadata
#[derive(Debug, Deserialize)]
pub struct SessionMetadata {
    pub session_id: String,
}

/// Browser tool executor
pub struct BrowserToolExecutor {
    client: Client,
    browser_use_url: String,
    session_store: Arc<RwLock<BrowserSessionStore>>,
}

/// Browser session store
pub struct BrowserSessionStore {
    sessions: std::collections::HashMap<String, String>,
}

impl BrowserToolExecutor {
    /// Create new executor
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            browser_use_url: std::env::var("BROWSER_USE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string()),
            session_store: Arc::new(RwLock::new(BrowserSessionStore {
                sessions: std::collections::HashMap::new(),
            })),
        }
    }

    /// Execute browser actions
    pub async fn act(&self, params: ActParams) -> Result<Vec<ActionResult>> {
        let session_id = self.get_or_create_session().await?;
        
        let response = self.client
            .post(&format!("{}/browser/{}/action", self.browser_use_url, session_id))
            .json(&serde_json::json!({
                "actions": params.actions,
                "timeout_ms": params.timeout_ms,
                "wait_for_navigation": params.wait_for_navigation,
            }))
            .send()
            .await
            .context("Failed to execute browser actions")?;

        if !response.status().is_success() {
            anyhow::bail!("Browser action failed: {}", response.status());
        }

        let result: Vec<ActionResult> = response.json().await?;
        Ok(result)
    }

    /// Navigate to URL
    pub async fn navigate(&self, url: &str) -> Result<()> {
        let session_id = self.get_or_create_session().await?;
        
        let response = self.client
            .post(&format!("{}/browser/{}/navigate", self.browser_use_url, session_id))
            .json(&serde_json::json!({
                "url": url,
                "wait_until": "networkidle",
            }))
            .send()
            .await
            .context("Failed to navigate")?;

        if !response.status().is_success() {
            anyhow::bail!("Navigation failed: {}", response.status());
        }

        Ok(())
    }

    /// Take screenshot
    pub async fn screenshot(&self, full_page: bool) -> Result<String> {
        let session_id = self.get_or_create_session().await?;
        
        let response = self.client
            .post(&format!("{}/browser/{}/screenshot", self.browser_use_url, session_id))
            .json(&serde_json::json!({
                "full_page": full_page,
                "format": "png",
            }))
            .send()
            .await
            .context("Failed to capture screenshot")?;

        if !response.status().is_success() {
            anyhow::bail!("Screenshot failed: {}", response.status());
        }

        let result: serde_json::Value = response.json().await?;
        let image = result.get("image")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        
        Ok(image)
    }

    /// Click element (convenience method)
    pub async fn click(&self, selector: &str) -> Result<ActionResult> {
        let params = ActParams {
            actions: vec![BrowserAction::Click {
                target: Target::Selector { value: selector.to_string() },
                options: ActionOptions::default(),
            }],
            timeout_ms: 10000,
            wait_for_navigation: false,
        };
        
        let results = self.act(params).await?;
        results.into_iter().next()
            .context("No result returned")
    }

    /// Type text (convenience method)
    pub async fn type_text(&self, selector: &str, text: &str) -> Result<ActionResult> {
        let params = ActParams {
            actions: vec![BrowserAction::Type {
                target: Target::Selector { value: selector.to_string() },
                text: text.to_string(),
                options: TypeOptions::default(),
            }],
            timeout_ms: 10000,
            wait_for_navigation: false,
        };
        
        let results = self.act(params).await?;
        results.into_iter().next()
            .context("No result returned")
    }

    /// Get or create browser session
    async fn get_or_create_session(&self) -> Result<String> {
        // For now, create a new session each time
        self.create_session().await
    }

    /// Create new browser session
    async fn create_session(&self) -> Result<String> {
        let response = self.client
            .post(&format!("{}/browser/session", self.browser_use_url))
            .json(&serde_json::json!({
                "headless": false,
                "viewport": {
                    "width": 1280,
                    "height": 720,
                }
            }))
            .send()
            .await
            .context("Failed to create browser session")?;

        if !response.status().is_success() {
            anyhow::bail!("Failed to create session: {}", response.status());
        }

        let session: SessionMetadata = response.json().await?;
        info!("Created browser session: {}", session.session_id);
        Ok(session.session_id)
    }
}

impl Default for BrowserToolExecutor {
    fn default() -> Self {
        Self::new()
    }
}
