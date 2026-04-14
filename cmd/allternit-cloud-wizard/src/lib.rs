//! A2R Cloud Deploy Wizard
//!
//! Enterprise-grade BYOC deployment wizard with:
//! - Capability matrix enforcement
//! - State machine with checkpoints
//! - Preflight validation
//! - Idempotent bootstrap
//! - Post-install verification
//! - Provider driver abstraction (REAL API CALLS)
//! - Failure policy handling
//! - Agent-assisted signup with human checkpoints
//! - Affiliate/referral tracking
//! - Durable checkpoint store (crash-resume)
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
pub mod e2e_tests;

pub use capability::{CapabilityMatrix, SupportedProvider, SupportedOS, AuthMethod};
pub use state_machine::{WizardState, WizardStep, WizardContext, HumanCheckpoint};
pub use preflight::{PreflightChecker, PreflightResult, PreflightError};
pub use bootstrap::{BootstrapContract, BootstrapResult, BootstrapError};
pub use verifier::{PostInstallVerifier, VerificationResult, VerificationError};
pub use provider::{ProviderDriver, ProviderCapabilities, HetznerDriver, DigitalOceanDriver};
pub use failure_policy::{FailurePolicy, FailureAction};
pub use guidance::{AgentGuidanceOverlay, SignupAutomationScript, GuidanceState};
pub use affiliate::{AffiliateTracker, MonetizationTier};
pub use checkpoint_store::{CheckpointStore, FsCheckpointStore, InMemoryCheckpointStore, IdempotencyKey};
pub use handlers::WizardAppState;
