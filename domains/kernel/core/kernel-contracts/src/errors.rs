//! Unified Error Taxonomy for Allternit Kernel (N17)
//!
//! Standardizes error handling across drivers, policy engines,
//! schedulers, and infrastructure.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Unified Kernel Error
#[derive(Debug, Clone, Error, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "details", rename_all = "snake_case")]
pub enum KernelError {
    /// Layer 1: Execution Driver Errors
    #[error("Driver Error: {0}")]
    Driver(DriverError),

    /// Layer 2: Governance & Policy Errors
    #[error("Policy Error: {0}")]
    Policy(PolicyError),

    /// Layer 2: Workflow & Scheduling Errors
    #[error("Workflow Error: {0}")]
    Workflow(WorkflowError),

    /// Layer 2: Budget & Resource Errors
    #[error("Budget Error: {0}")]
    Budget(BudgetError),

    /// Layer 1/2: Infrastructure Errors
    #[error("Infrastructure Error: {0}")]
    Infrastructure(String),
}

/// Detailed Driver Errors
#[derive(Debug, Clone, Error, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DriverError {
    #[error("Spawn failed: {reason}")]
    SpawnFailed { reason: String },

    #[error("Execution timeout after {timeout}s")]
    Timeout { timeout: u32 },

    #[error("Insufficient resources: {resource}")]
    ResourceExhausted { resource: String },

    #[error("Isolation breach detected: {details}")]
    IsolationBreach { details: String },

    #[error("Substrate unavailable: {substrate}")]
    SubstrateDown { substrate: String },
}

/// Detailed Policy Errors
#[derive(Debug, Clone, Error, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PolicyError {
    #[error("Access denied: {reason}")]
    Denied { reason: String },

    #[error("Validation failed: {field} - {reason}")]
    InvalidInput { field: String, reason: String },

    #[error("Trust tier mismatch: requested {requested} but assigned {assigned}")]
    TierMismatch { requested: String, assigned: String },

    #[error("Missing required approval: {role}")]
    ApprovalRequired { role: String },
}

/// Detailed Workflow Errors
#[derive(Debug, Clone, Error, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowError {
    #[error("Cycle detected in DAG")]
    CircularDependency,

    #[error("Node failed: {node_id} - {error}")]
    NodeFailed { node_id: String, error: String },

    #[error("Workflow not found: {workflow_id}")]
    NotFound { workflow_id: String },
}

/// Detailed Budget Errors
#[derive(Debug, Clone, Error, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BudgetError {
    #[error("Quota exceeded: {resource}")]
    QuotaExceeded { resource: String },

    #[error("Admission denied: {reason}")]
    AdmissionDenied { reason: String },
}
