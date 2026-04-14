//! Test utilities for OpenClaw Host

use crate::{OpenClawHost, HostConfig};
use tokio;

/// Create a mock OpenClawHost for testing purposes
pub async fn mock_openclaw_host() -> OpenClawHost {
    // For testing, we'll create a minimal host that doesn't actually launch OpenClaw
    // In a real test scenario, you'd want to mock the subprocess communication
    
    // Create a temporary config for testing
    let config = HostConfig::default();
    
    // For the test, we'll return a placeholder host
    // In a real implementation, this would need to properly mock the subprocess
    OpenClawHost::new(config).await.unwrap()
}