//! Wizard State Machine
//!
//! Manages deployment flow with:
//! - Persisted state
//! - Checkpoint/resume
//! - Retry logic
//! - Progress tracking

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::capability::{SupportedProvider, SupportedOS, AuthMethod};

/// Wizard state machine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WizardState {
    /// Unique deployment ID
    pub deployment_id: String,
    /// Current step
    pub current_step: WizardStep,
    /// Wizard context (accumulated data)
    pub context: WizardContext,
    /// State timestamps
    pub timestamps: StateTimestamps,
    /// Retry count
    pub retry_count: u32,
    /// Maximum retries
    pub max_retries: u32,
    /// Bootstrap attempts so far (visible in session JSON as a guardrail)
    #[serde(default)]
    pub bootstrap_attempts: u32,
    /// Maximum bootstrap attempts before a failure is terminal for real
    #[serde(default = "default_max_bootstrap_attempts")]
    pub max_bootstrap_attempts: u32,
    /// Whether the last recorded bootstrap failure was marked recoverable
    #[serde(default)]
    pub last_bootstrap_recoverable: Option<bool>,
}

/// Default cap on bootstrap attempts per session.
pub const DEFAULT_MAX_BOOTSTRAP_ATTEMPTS: u32 = 5;

fn default_max_bootstrap_attempts() -> u32 {
    DEFAULT_MAX_BOOTSTRAP_ATTEMPTS
}

/// Wizard steps (state machine states)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WizardStep {
    /// Initial state - selecting provider
    SelectProvider,
    /// Agent-assisted provider signup (human checkpoints at payment/CAPTCHA)
    AgentAssistedSignup,
    /// Human completes payment/verification (agent waits)
    HumanPaymentCheckpoint,
    /// Human completes identity verification (agent waits)
    HumanVerificationCheckpoint,
    /// Entering credentials
    EnterCredentials,
    /// Validating credentials
    ValidateCredentials,
    /// Running preflight checks
    Preflight,
    /// Provisioning (API mode) or connecting (SSH mode)
    Provisioning,
    /// Running bootstrap installer
    Bootstrap,
    /// Running post-install verification
    Verification,
    /// Deployment complete
    Complete,
    /// Deployment failed (can retry)
    Failed,
    /// Deployment cancelled
    Cancelled,
    /// Waiting for human action (payment/verification)
    AwaitingHumanAction,
}

impl WizardStep {
    /// Get next step
    pub fn next(&self) -> Option<Self> {
        match self {
            Self::SelectProvider => Some(Self::EnterCredentials),
            Self::AgentAssistedSignup => Some(Self::HumanPaymentCheckpoint),
            Self::HumanPaymentCheckpoint => Some(Self::HumanVerificationCheckpoint),
            Self::HumanVerificationCheckpoint => Some(Self::EnterCredentials),
            Self::EnterCredentials => Some(Self::ValidateCredentials),
            Self::ValidateCredentials => Some(Self::Preflight),
            Self::Preflight => Some(Self::Provisioning),
            Self::Provisioning => Some(Self::Bootstrap),
            Self::Bootstrap => Some(Self::Verification),
            Self::Verification => Some(Self::Complete),
            Self::Complete | Self::Failed | Self::Cancelled => None,
            Self::AwaitingHumanAction => None,  // Requires explicit resume
        }
    }

    /// Check if step is terminal
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Complete | Self::Failed | Self::Cancelled)
    }

    /// Check if step requires human action
    pub fn requires_human(&self) -> bool {
        matches!(
            self,
            Self::HumanPaymentCheckpoint
                | Self::HumanVerificationCheckpoint
                | Self::AwaitingHumanAction
        )
    }

    /// Check if step can retry
    pub fn can_retry(&self) -> bool {
        matches!(self, Self::Failed)
    }

    /// Check if agent can automate this step
    pub fn can_automate(&self) -> bool {
        matches!(
            self,
            Self::SelectProvider
                | Self::AgentAssistedSignup
                | Self::EnterCredentials
                | Self::ValidateCredentials
                | Self::Preflight
                | Self::Provisioning
                | Self::Bootstrap
                | Self::Verification
        )
    }
}

/// Wizard context (accumulated data through flow)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WizardContext {
    /// Selected provider
    pub provider: Option<SupportedProvider>,
    /// Detected OS
    pub os: Option<SupportedOS>,
    /// Auth method
    pub auth_method: Option<AuthMethod>,
    
    // API mode credentials
    /// API token (encrypted at rest in production)
    pub api_token: Option<String>,
    /// Region for provisioning
    pub region: Option<String>,
    /// Instance type
    pub instance_type: Option<String>,
    /// Instance name
    pub instance_name: Option<String>,
    /// Storage size (GB)
    pub storage_gb: Option<u32>,
    
    // SSH mode credentials
    /// SSH host
    pub ssh_host: Option<String>,
    /// SSH port
    pub ssh_port: Option<u16>,
    /// SSH username
    pub ssh_username: Option<String>,
    /// SSH private key (encrypted at rest in production)
    pub ssh_private_key: Option<String>,
    /// SSH password (encrypted at rest in production)
    pub ssh_password: Option<String>,
    
    // Provisioning results
    /// Provisioned instance ID
    pub instance_id: Option<String>,
    /// Provisioned instance IP
    pub instance_ip: Option<String>,
    
    // Bootstrap results
    /// Bootstrap log output
    pub bootstrap_log: Option<String>,
    
    // Verification results
    /// Verification passed
    pub verification_passed: Option<bool>,
    /// Verification errors
    pub verification_errors: Vec<String>,
    
    // Agent-assisted signup
    /// Provider signup URL
    pub provider_signup_url: Option<String>,
    /// Affiliate/referral link
    pub affiliate_link: Option<String>,
    /// Human checkpoint type
    pub human_checkpoint: Option<HumanCheckpoint>,
    /// Agent guidance messages
    pub agent_guidance: Vec<String>,
}

/// Human checkpoint types (where agent pauses)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HumanCheckpoint {
    /// Payment completion required
    Payment,
    /// CAPTCHA completion required
    Captcha,
    /// Email verification required
    EmailVerification,
    /// Phone verification required
    PhoneVerification,
    /// Identity verification required
    IdentityVerification,
    /// Terms acceptance required
    TermsAcceptance,
}

impl HumanCheckpoint {
    /// Get guidance message for checkpoint
    pub fn guidance(&self) -> &'static str {
        match self {
            Self::Payment => "Please complete payment. I'll resume once payment is confirmed.",
            Self::Captcha => "Please complete the CAPTCHA. I'll wait here.",
            Self::EmailVerification => "Please check your email and verify. I'll resume after verification.",
            Self::PhoneVerification => "Please complete phone verification. I'll wait here.",
            Self::IdentityVerification => "Please complete identity verification. I'll resume after confirmation.",
            Self::TermsAcceptance => "Please accept the terms of service. I'll wait here.",
        }
    }

    /// Check if checkpoint is sensitive (requires human)
    pub fn is_sensitive(&self) -> bool {
        matches!(
            self,
            Self::Payment | Self::Captcha | Self::IdentityVerification
        )
    }
}

/// State timestamps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateTimestamps {
    /// When deployment was created
    pub created_at: DateTime<Utc>,
    /// When last step started
    pub last_step_started_at: Option<DateTime<Utc>>,
    /// When last step completed
    pub last_step_completed_at: Option<DateTime<Utc>>,
    /// When deployment completed
    pub completed_at: Option<DateTime<Utc>>,
}

impl Default for StateTimestamps {
    fn default() -> Self {
        Self {
            created_at: Utc::now(),
            last_step_started_at: None,
            last_step_completed_at: None,
            completed_at: None,
        }
    }
}

impl WizardState {
    /// Create new wizard state
    pub fn new() -> Self {
        Self {
            deployment_id: Uuid::new_v4().to_string(),
            current_step: WizardStep::SelectProvider,
            context: WizardContext::default(),
            timestamps: StateTimestamps::default(),
            retry_count: 0,
            max_retries: 3,
            bootstrap_attempts: 0,
            max_bootstrap_attempts: DEFAULT_MAX_BOOTSTRAP_ATTEMPTS,
            last_bootstrap_recoverable: None,
        }
    }

    /// Create new wizard state with deployment ID
    pub fn with_deployment_id(deployment_id: String) -> Self {
        Self {
            deployment_id,
            ..Self::new()
        }
    }

    /// Advance to next step
    pub fn advance(&mut self) -> Result<(), String> {
        if let Some(next) = self.current_step.next() {
            self.timestamps.last_step_completed_at = Some(Utc::now());
            self.current_step = next;
            self.timestamps.last_step_started_at = Some(Utc::now());
            Ok(())
        } else {
            Err("No next step available".to_string())
        }
    }

    /// Mark as failed
    pub fn fail(&mut self) -> bool {
        if self.retry_count < self.max_retries {
            self.retry_count += 1;
            self.current_step = WizardStep::Failed;
            true  // Can retry
        } else {
            self.current_step = WizardStep::Failed;
            false  // Max retries exceeded
        }
    }

    /// Mark as cancelled
    pub fn cancel(&mut self) {
        self.current_step = WizardStep::Cancelled;
        self.timestamps.completed_at = Some(Utc::now());
    }

    /// Mark as complete
    pub fn complete(&mut self) {
        self.current_step = WizardStep::Complete;
        self.timestamps.completed_at = Some(Utc::now());
    }

    /// Reset for retry
    pub fn retry(&mut self) -> Result<(), String> {
        if self.current_step.can_retry() {
            self.current_step = WizardStep::Preflight;  // Retry from preflight
            self.timestamps.last_step_started_at = Some(Utc::now());
            self.retry_count += 1;
            Ok(())
        } else {
            Err("Cannot retry from current state".to_string())
        }
    }

    /// Re-enter the Bootstrap step after a recoverable bootstrap failure.
    ///
    /// Gated on three conditions: the session is `Failed`, the recorded
    /// bootstrap failure was marked recoverable, and the per-session attempt
    /// cap has not been reached. Unlike [`Self::retry`] (which restarts at
    /// Preflight), this only re-runs the idempotent bootstrap script.
    pub fn retry_bootstrap(&mut self) -> Result<(), String> {
        if self.current_step != WizardStep::Failed {
            return Err(format!(
                "Cannot retry bootstrap from step {:?}",
                self.current_step
            ));
        }
        if self.last_bootstrap_recoverable != Some(true) {
            return Err("Last bootstrap failure is not recoverable".to_string());
        }
        if self.bootstrap_attempts >= self.max_bootstrap_attempts {
            return Err(format!(
                "Bootstrap attempt cap reached ({}/{})",
                self.bootstrap_attempts, self.max_bootstrap_attempts
            ));
        }
        self.current_step = WizardStep::Bootstrap;
        self.timestamps.last_step_started_at = Some(Utc::now());
        Ok(())
    }

    /// Check if can proceed
    pub fn can_proceed(&self) -> bool {
        !self.current_step.is_terminal()
    }

    /// Get progress percentage
    pub fn progress(&self) -> u8 {
        match self.current_step {
            WizardStep::SelectProvider => 5,
            WizardStep::AgentAssistedSignup => 8,
            WizardStep::HumanPaymentCheckpoint => 10,
            WizardStep::HumanVerificationCheckpoint => 12,
            WizardStep::EnterCredentials => 15,
            WizardStep::ValidateCredentials => 20,
            WizardStep::Preflight => 30,
            WizardStep::Provisioning => 50,
            WizardStep::Bootstrap => 70,
            WizardStep::Verification => 90,
            WizardStep::Complete => 100,
            WizardStep::Failed | WizardStep::Cancelled | WizardStep::AwaitingHumanAction => 0,
        }
    }
}

impl Default for WizardState {
    fn default() -> Self {
        Self::new()
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    fn failed_wizard(recoverable: Option<bool>, attempts: u32) -> WizardState {
        let mut wizard = WizardState::new();
        wizard.current_step = WizardStep::Failed;
        wizard.last_bootstrap_recoverable = recoverable;
        wizard.bootstrap_attempts = attempts;
        wizard
    }

    #[test]
    fn retry_bootstrap_reenters_bootstrap_after_recoverable_failure() {
        let mut wizard = failed_wizard(Some(true), 1);
        wizard.retry_bootstrap().unwrap();
        assert_eq!(wizard.current_step, WizardStep::Bootstrap);
        assert!(wizard.timestamps.last_step_started_at.is_some());
        // The attempt counter is untouched here; the handler counts the run.
        assert_eq!(wizard.bootstrap_attempts, 1);
    }

    #[test]
    fn retry_bootstrap_rejects_non_recoverable_failure() {
        let mut wizard = failed_wizard(Some(false), 1);
        assert!(wizard.retry_bootstrap().is_err());
        assert_eq!(wizard.current_step, WizardStep::Failed);

        // Never recorded a recoverable flag (e.g. legacy checkpoint).
        let mut wizard = failed_wizard(None, 1);
        assert!(wizard.retry_bootstrap().is_err());
        assert_eq!(wizard.current_step, WizardStep::Failed);
    }

    #[test]
    fn retry_bootstrap_enforces_attempt_cap() {
        let mut wizard = failed_wizard(Some(true), DEFAULT_MAX_BOOTSTRAP_ATTEMPTS);
        assert!(wizard.retry_bootstrap().is_err());
        assert_eq!(wizard.current_step, WizardStep::Failed);
    }

    #[test]
    fn retry_bootstrap_rejects_non_failed_steps() {
        let mut wizard = WizardState::new();
        wizard.current_step = WizardStep::Bootstrap;
        wizard.last_bootstrap_recoverable = Some(true);
        assert!(wizard.retry_bootstrap().is_err());
    }

    #[test]
    fn legacy_checkpoint_without_attempt_fields_deserializes() {
        let wizard = WizardState::new();
        let mut json = serde_json::to_value(&wizard).unwrap();
        let obj = json.as_object_mut().unwrap();
        obj.remove("bootstrap_attempts");
        obj.remove("max_bootstrap_attempts");
        obj.remove("last_bootstrap_recoverable");

        let restored: WizardState = serde_json::from_value(json).unwrap();
        assert_eq!(restored.bootstrap_attempts, 0);
        assert_eq!(
            restored.max_bootstrap_attempts,
            DEFAULT_MAX_BOOTSTRAP_ATTEMPTS
        );
        assert_eq!(restored.last_bootstrap_recoverable, None);
    }
}
