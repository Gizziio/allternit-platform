// 7-apps/api/src/browser_recording/capture.rs
//! Frame Capture
//!
//! Captures frames from browser sessions via the browser engine API.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

/// Frame capture from browser
pub struct FrameCapture {
    client: Client,
    browser_api_url: String,
    session_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct ScreenshotRequest {
    action: String,
    full_page: bool,
}

#[derive(Debug, Deserialize)]
struct ScreenshotResponse {
    success: bool,
    data: Option<ScreenshotData>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ScreenshotData {
    image: String,  // base64 encoded
    size: Option<CaptureSize>,
}

#[derive(Debug, Deserialize)]
struct CaptureSize {
    width: u32,
    height: u32,
}

impl FrameCapture {
    /// Create a new frame capture
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            browser_api_url: std::env::var("BROWSER_API_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3010".to_string()),
            session_id: None,
        }
    }

    /// Create with specific session
    pub fn with_session(session_id: String) -> Self {
        Self {
            client: Client::new(),
            browser_api_url: std::env::var("BROWSER_API_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3010".to_string()),
            session_id: Some(session_id),
        }
    }

    /// Set session ID
    pub fn set_session_id(&mut self, session_id: String) {
        self.session_id = Some(session_id);
    }

    /// Capture a frame from the browser
    pub async fn capture_frame(&self) -> Result<Vec<u8>> {
        let session_id = self.session_id.as_ref()
            .context("No browser session ID set")?;

        // Call browser engine screenshot endpoint
        let screenshot_url = format!(
            "{}/browser/{}/action",
            self.browser_api_url,
            session_id
        );

        let request = ScreenshotRequest {
            action: "screenshot".to_string(),
            full_page: false,
        };

        let response = self.client
            .post(&screenshot_url)
            .json(&request)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
            .context("Failed to capture screenshot")?;

        if !response.status().is_success() {
            anyhow::bail!("Screenshot failed: {}", response.status());
        }

        let result: ScreenshotResponse = response
            .json()
            .await
            .context("Failed to parse screenshot response")?;

        if !result.success {
            anyhow::bail!("Screenshot failed: {}", result.error.unwrap_or_default());
        }

        let screenshot_data = result.data
            .context("No screenshot data in response")?;

        // Decode base64 image
        let image_data = base64_decode(&screenshot_data.image)
            .context("Failed to decode base64 image")?;

        debug!("Captured frame: {} bytes", image_data.len());
        Ok(image_data)
    }
}

/// Simple base64 decoder
fn base64_decode(data: &str) -> Result<Vec<u8>> {
    // Handle data URL format: "data:image/png;base64,..."
    let data = data.strip_prefix("data:image/png;base64,").unwrap_or(data);
    let data = data.strip_prefix("data:image/jpeg;base64,").unwrap_or(data);
    
    // Use base64 crate from workspace
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.decode(data)?)
}

impl Default for FrameCapture {
    fn default() -> Self {
        Self::new()
    }
}
