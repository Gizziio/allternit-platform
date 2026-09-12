//! A:// fabric transport and lease protocol types (contract v0.1 §8).
//!
//! Errors use the explicit A_* vocabulary from §8.23 so Cowork and the audit
//! ledger can observe exactly why a transport step failed.

use serde::{Deserialize, Serialize};

/// Explicit fabric-transport failure codes (A:// §8.23).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransportErrorCode {
    /// Bearer token is missing, unknown, or invalid.
    AuthenticationFailed,
    /// The authenticated identity does not resolve to a known principal.
    PrincipalNotFound,
    /// The principal's workspace does not match the job's workspace.
    WorkspaceMismatch,
    /// The principal lacks a mandatory job capability (§8.6–8.7).
    CapabilityMissing,
    /// The principal is not permitted to perform this action.
    PermissionDenied,
    /// No queued job matches the principal's workspace and capabilities.
    NoEligibleWorker,
    /// The job was claimed by another worker first (CAS conflict).
    JobAlreadyLeased,
    /// The presented lease_id does not own the job.
    InvalidLease,
    /// The presented lease_generation is not the job's current generation.
    StaleLeaseGeneration,
    /// The lease has expired or is no longer active (server clock).
    LeaseExpired,
    /// The job's run is cancelled.
    RunCancelled,
    /// The terminal result was already committed (idempotent replay signal).
    ResultAlreadyCommitted,
    /// The job id does not exist in the canonical store.
    JobNotFound,
    /// The canonical store itself failed.
    Store,
}

impl TransportErrorCode {
    /// Stable wire string (`A_...`) for each code.
    pub fn as_wire(&self) -> &'static str {
        match self {
            Self::AuthenticationFailed => "A_AUTHENTICATION_FAILED",
            Self::PrincipalNotFound => "A_PRINCIPAL_NOT_FOUND",
            Self::WorkspaceMismatch => "A_WORKSPACE_MISMATCH",
            Self::CapabilityMissing => "A_CAPABILITY_MISSING",
            Self::PermissionDenied => "A_PERMISSION_DENIED",
            Self::NoEligibleWorker => "A_NO_ELIGIBLE_WORKER",
            Self::JobAlreadyLeased => "A_JOB_ALREADY_LEASED",
            Self::InvalidLease => "A_INVALID_LEASE",
            Self::StaleLeaseGeneration => "A_STALE_LEASE_GENERATION",
            Self::LeaseExpired => "A_LEASE_EXPIRED",
            Self::RunCancelled => "A_RUN_CANCELLED",
            Self::ResultAlreadyCommitted => "A_RESULT_ALREADY_COMMITTED",
            Self::JobNotFound => "A_JOB_NOT_FOUND",
            Self::Store => "A_STORE_ERROR",
        }
    }

    /// Suggested HTTP status for API surfaces.
    pub fn http_status(&self) -> u16 {
        match self {
            Self::AuthenticationFailed | Self::PrincipalNotFound => 401,
            Self::PermissionDenied | Self::WorkspaceMismatch => 403,
            Self::CapabilityMissing | Self::NoEligibleWorker => 422,
            Self::JobNotFound => 404,
            Self::Store => 500,
            // Lease/claim conflicts are concurrency outcomes, not client bugs.
            _ => 409,
        }
    }
}

/// A fabric-transport protocol failure.
#[derive(Debug, Clone)]
pub struct TransportError {
    /// Machine-readable failure code.
    pub code: TransportErrorCode,
    /// Human-readable detail.
    pub message: String,
}

impl TransportError {
    /// Create a new error with a code and detail message.
    pub fn new(code: TransportErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    /// Stable wire string for this error's code.
    pub fn wire(&self) -> &'static str {
        self.code.as_wire()
    }

    /// Suggested HTTP status for API surfaces.
    pub fn http_status(&self) -> u16 {
        self.code.http_status()
    }
}

impl std::fmt::Display for TransportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.wire(), self.message)
    }
}

impl std::error::Error for TransportError {}

/// A workspace-scoped principal authenticated by bearer token (§8.3–8.4).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrincipalRecord {
    /// Canonical workspace-scoped identity, e.g. `a://workspace/ws/bot/research`.
    pub id: String,
    /// Workspace this principal resolves inside.
    pub workspace: String,
    /// Declared capability strings (§8.6).
    pub capabilities: Vec<String>,
    /// Registration status; only `active` principals may claim work.
    pub status: String,
}

/// A lease grant returned by a successful claim (§8.9–8.10).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseGrant {
    /// The claimed job.
    pub job_id: String,
    /// The run the job belongs to.
    pub run_id: String,
    /// Opaque lease token; required on heartbeat/renew/complete.
    pub lease_id: String,
    /// Monotonic ownership counter; increases on every ownership change.
    pub lease_generation: i64,
    /// Server-authoritative expiry (RFC3339 UTC).
    pub lease_expires_at: String,
    /// Job input payload (deterministic step sequence).
    pub payload: serde_json::Value,
    /// Capabilities the job mandates.
    pub required_capabilities: Vec<String>,
    /// Run's current checkpoint pointer — the worker replays from the last
    /// committed checkpoint under this new lease generation (lock 3).
    pub current_checkpoint_id: Option<String>,
    /// Initiator principal (attribution, §8.18).
    pub initiator: Option<String>,
    /// Delegator principal (attribution, §8.18).
    pub delegator: Option<String>,
}

/// Outcome of a completion attempt (§8.16).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum CompleteOutcome {
    /// This request committed the terminal result.
    Committed {
        /// Terminal job state (`completed` or `failed`).
        job_state: String,
        /// The committed typed result envelope.
        result: serde_json::Value,
    },
    /// The job was already terminal; the canonical existing result is returned
    /// so at-least-once delivery never becomes duplicate side effects.
    AlreadyCommitted {
        /// Terminal job state.
        job_state: String,
        /// The canonical result envelope.
        result: serde_json::Value,
    },
}

/// One lease expiry action taken by the sweeper (§8.13), reported so callers
/// can sync in-memory mirrors.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpiryAction {
    /// Expired job.
    pub job_id: String,
    /// Run the job belongs to.
    pub run_id: String,
    /// The lease that expired.
    pub lease_id: Option<String>,
    /// Generation of the expired lease.
    pub lease_generation: i64,
    /// Principal that held the expired lease.
    pub executor: Option<String>,
    /// `queued` (requeued for a new lease generation) or `dead_letter`.
    pub outcome: String,
    /// retry_count after this expiry.
    pub retry_count: i64,
}

/// Hash a bearer token for storage/compared lookup (SHA-256 hex).
pub fn hash_token(token: &str) -> String {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}
