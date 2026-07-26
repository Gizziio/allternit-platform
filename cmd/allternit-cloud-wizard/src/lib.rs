//! Allternit Cloud Deploy Wizard
//!
//! Enterprise-grade BYOC deployment wizard with:
//! - Capability matrix enforcement
//! - State machine with checkpoints
//! - Preflight validation (real API tokens + real SSH logins)
//! - Idempotent gizzi-code bootstrap over SSH (checksum-pinned release,
//!   systemd unit, Headscale tailnet join via tailscaled)
//! - Provider driver abstraction (REAL API CALLS: Hetzner, DigitalOcean)
//! - Failure policy handling
//! - Agent-assisted signup with human checkpoints
//! - Affiliate/referral tracking
//! - Durable, user-scoped checkpoint store (SQLite, encrypted state at rest)
//! - E2E integration tests

pub mod capability;
pub mod state_machine;
pub mod preflight;
pub mod bootstrap;
pub mod verifier;
pub mod provider;
pub mod failure_policy;
pub mod guidance;
pub mod affiliate;
pub mod checkpoint_store;
pub mod handlers;
pub mod routes;
pub mod e2e_tests;

pub use capability::{CapabilityMatrix, SupportedProvider, SupportedOS, AuthMethod};
pub use state_machine::{WizardState, WizardStep, WizardContext, HumanCheckpoint};
pub use preflight::{PreflightChecker, PreflightResult, PreflightError};
pub use bootstrap::{
    BootstrapConfig, BootstrapError, BootstrapResult, MeshBootstrap, SshAuth,
};
pub use verifier::{PostInstallVerifier, VerificationResult, VerificationError};
pub use provider::{
    driver_for, CreateServerRequest, DigitalOceanDriver, HetznerDriver, ProviderCapabilities,
    ProviderDriver, ProviderError, ServerStatus,
};
pub use failure_policy::{FailurePolicy, FailureAction};
pub use guidance::{AgentGuidanceOverlay, SignupAutomationScript, GuidanceState};
pub use affiliate::{AffiliateTracker, MonetizationTier};
pub use checkpoint_store::{
    CheckpointStore, FsCheckpointStore, InMemoryCheckpointStore, IdempotencyKey,
    SqliteCheckpointStore,
};
pub use handlers::{
    AuthenticatedUser, InstanceRegistrar, MeshKeyMinter, StartWizardRequest, WizardAppState,
};
pub use routes::create_wizard_router;
