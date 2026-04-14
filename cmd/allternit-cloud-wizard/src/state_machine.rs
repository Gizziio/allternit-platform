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
