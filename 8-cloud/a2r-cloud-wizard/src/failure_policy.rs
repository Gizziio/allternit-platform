//! Failure Policy Module
//!
//! Defines how failures are handled:
//! - Automatic cleanup
//! - Preserve for debugging
//! - Retry logic
//! - Error reporting

use serde::{Deserialize, Serialize};

/// Failure policy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FailurePolicy {
    /// Automatically clean up on failure
    Cleanup,
    /// Preserve resources for debugging
    Preserve,
    /// Ask user what to do
    Ask,
}

impl Default for FailurePolicy {
    fn default() -> Self {
        Self::Cleanup
    }
}

/// Failure action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureAction {
    /// Action to take
    pub policy: FailurePolicy,
    /// Retry count
    pub retry_count: u32,
    /// Maximum retries
    pub max_retries: u32,
    /// Cleanup resources
    pub cleanup_resources: Vec<String>,
    /// Error message
    pub error_message: String,
    /// Error code
    pub error_code: String,
}

impl FailureAction {
    /// Create new failure action
    pub fn new(policy: FailurePolicy, error_code: String, error_message: String) -> Self {
        Self {
            policy,
            retry_count: 0,
            max_retries: 3,
            cleanup_resources: Vec::new(),
            error_message,
            error_code,
        }
    }

    /// Check if can retry
    pub fn can_retry(&self) -> bool {
        self.retry_count < self.max_retries
    }

    /// Increment retry count
    pub fn retry(&mut self) {
        self.retry_count += 1;
    }

    /// Add resource to cleanup
    pub fn add_cleanup_resource(&mut self, resource: String) {
        self.cleanup_resources.push(resource);
    }

    /// Execute failure action
    pub async fn execute(&self) -> FailureResult {
        match self.policy {
            FailurePolicy::Cleanup => {
                // Clean up resources
                for resource in &self.cleanup_resources {
                    // In production, actually clean up
                    tracing::info!("Cleaning up resource: {}", resource);
                }
                FailureResult::CleanedUp
            }
            FailurePolicy::Preserve => {
                // Preserve for debugging
                tracing::warn!("Preserving resources for debugging: {:?}", self.cleanup_resources);
                FailureResult::Preserved
            }
            FailurePolicy::Ask => {
                // Would prompt user in UI
                FailureResult::AwaitingDecision
            }
        }
    }
}

/// Failure result
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FailureResult {
    CleanedUp,
    Preserved,
    AwaitingDecision,
    Retrying,
}

/// Failure context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureContext {
    /// Deployment ID
    pub deployment_id: String,
    /// Current step
    pub step: String,
    /// Error code
    pub error_code: String,
    /// Error message
    pub error_message: String,
    /// Resources created
    pub resources: Vec<String>,
    /// Logs
    pub logs: String,
}

impl FailureContext {
    /// Create new failure context
    pub fn new(
        deployment_id: String,
        step: String,
        error_code: String,
        error_message: String,
    ) -> Self {
        Self {
            deployment_id,
            step,
            error_code,
            error_message,
            resources: Vec::new(),
            logs: String::new(),
        }
    }

    /// Add resource
    pub fn add_resource(&mut self, resource: String) {
        self.resources.push(resource);
    }

    /// Add log
    pub fn add_log(&mut self, log: String) {
        if !self.logs.is_empty() {
            self.logs.push('\n');
        }
        self.logs.push_str(&log);
    }

    /// Create failure action from context
    pub fn to_failure_action(&self, policy: FailurePolicy) -> FailureAction {
        let mut action = FailureAction::new(
            policy,
            self.error_code.clone(),
            self.error_message.clone(),
        );
        
        for resource in &self.resources {
            action.add_cleanup_resource(resource.clone());
        }
        
        action
    }
}

/// Common error codes
pub mod error_codes {
    pub const CREDENTIAL_INVALID: &str = "CREDENTIAL_INVALID";
    pub const CONNECTION_FAILED: &str = "CONNECTION_FAILED";
    pub const TIMEOUT: &str = "TIMEOUT";
    pub const PROVISIONING_FAILED: &str = "PROVISIONING_FAILED";
    pub const BOOTSTRAP_FAILED: &str = "BOOTSTRAP_FAILED";
    pub const VERIFICATION_FAILED: &str = "VERIFICATION_FAILED";
    pub const QUOTA_EXCEEDED: &str = "QUOTA_EXCEEDED";
    pub const UNSUPPORTED_OS: &str = "UNSUPPORTED_OS";
    pub const INSUFFICIENT_RESOURCES: &str = "INSUFFICIENT_RESOURCES";
}
