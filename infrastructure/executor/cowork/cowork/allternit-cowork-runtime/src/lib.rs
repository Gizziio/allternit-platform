//! Allternit Cowork Runtime
//!
//! Manages persistent, detachable compute runs with Rails backend integration.
//! Provides checkpoint/restore, client attachment, and event streaming capabilities.

#![warn(missing_docs)]

pub mod attachment;
pub mod checkpoint;
pub mod error;
pub mod risk_policy;
pub mod run;
pub mod sqlite_store;
pub mod transport;
pub mod types;

// Re-export common types
pub use crate::attachment::AttachmentRegistry;
pub use crate::checkpoint::CheckpointManager;
pub use crate::risk_policy::{
    evaluate_protection, ApprovalPolicy, ProtectionDecision, RiskLevel, RiskRule,
};
pub use crate::transport::{
    hash_token, ApprovalBinding, CompleteOutcome, ExpiryAction, LeaseGrant, PrincipalRecord,
    TransportError, TransportErrorCode,
};
pub use crate::error::{CoworkError, Result};
pub use crate::run::{RunManager, RunManagerConfig, RailsClient};
pub use crate::types::{
    Attachment, AttachmentState, Checkpoint, ClientType, CreateJobSpec, CreateRunSpec, Job,
    JobId, JobState, PermissionSet, Run, RunId, RunMode, RunState, CoworkEvent,
};

/// Version of this crate
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
