//! Agent Guidance Overlay Module
//!
//! Provides in-app browser guidance for agent-assisted signup:
//! - Highlight elements to click
//! - Auto-fill non-sensitive fields
//! - Pause at sensitive checkpoints
//! - Resume after human action

use serde::{Deserialize, Serialize};

/// Agent guidance overlay
pub struct AgentGuidanceOverlay {
    /// Current guidance state
    pub state: GuidanceState,
    /// Guidance messages to display
    pub messages: Vec<GuidanceMessage>,
    /// Elements to highlight
    pub highlights: Vec<ElementHighlight>,
    /// Fields to auto-fill
    pub auto_fill: Vec<AutoFillField>,
}

/// Guidance state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GuidanceState {
    /// Observing page
    Observing,
    /// Highlighting elements
    Highlighting,
    /// Auto-filling fields
    AutoFilling,
    /// Waiting for human action
    WaitingForHuman,
    /// Resuming after human action
    Resuming,
    /// Complete
    Complete,
}

/// Guidance message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuidanceMessage {
    /// Message text
    pub text: String,
    /// Message type
    pub message_type: MessageType,
    /// Requires user acknowledgment
    pub requires_ack: bool,
}

/// Message types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MessageType {
    /// Informational
    Info,
    /// Warning
    Warning,
    /// Error
    Error,
    /// Success
    Success,
    /// Action required
    Action,
}

/// Element highlight
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementHighlight {
    /// CSS selector
    pub selector: String,
    /// Highlight color
    pub color: String,
    /// Label to show
    pub label: String,
    /// Action to suggest
    pub action: HighlightAction,
}

/// Highlight actions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HighlightAction {
    /// Click this element
    Click,
    /// Fill this field
    Fill,
    /// Read this information
    Read,
    /// Skip this element
    Skip,
}

/// Auto-fill field
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoFillField {
    /// Field selector
    pub selector: String,
    /// Field value
    pub value: String,
    /// Field type (email, name, etc.)
    pub field_type: String,
    /// Is sensitive (requires human confirmation)
    pub is_sensitive: bool,
}

impl AgentGuidanceOverlay {
    /// Create new guidance overlay
    pub fn new() -> Self {
        Self {
            state: GuidanceState::Observing,
            messages: Vec::new(),
            highlights: Vec::new(),
            auto_fill: Vec::new(),
        }
    }

    /// Add guidance message
    pub fn add_message(&mut self, text: String, message_type: MessageType) {
        self.messages.push(GuidanceMessage {
            text,
            message_type,
            requires_ack: false,
        });
    }

    /// Add action message (requires acknowledgment)
    pub fn add_action_message(&mut self, text: String) {
        self.messages.push(GuidanceMessage {
            text,
            message_type: MessageType::Action,
            requires_ack: true,
        });
    }

    /// Highlight element for user
    pub fn highlight_element(
        &mut self,
        selector: String,
        label: String,
        action: HighlightAction,
    ) {
        self.highlights.push(ElementHighlight {
            selector,
            color: match action {
                HighlightAction::Click => "#3b82f6".to_string(),  // Blue
                HighlightAction::Fill => "#10b981".to_string(),   // Green
                HighlightAction::Read => "#f59e0b".to_string(),   // Amber
                HighlightAction::Skip => "#6b7280".to_string(),   // Gray
            },
            label,
            action,
        });
    }

    /// Add auto-fill field
    pub fn add_auto_fill(&mut self, selector: String, value: String, field_type: String) {
        self.auto_fill.push(AutoFillField {
            selector,
            value,
            field_type,
            is_sensitive: false,
        });
    }

    /// Add sensitive auto-fill field (requires confirmation)
    pub fn add_sensitive_auto_fill(&mut self, selector: String, value: String, field_type: String) {
        self.auto_fill.push(AutoFillField {
            selector,
            value,
            field_type,
            is_sensitive: true,
        });
    }

    /// Set state to waiting for human
    pub fn wait_for_human(&mut self, checkpoint: &crate::state_machine::HumanCheckpoint) {
        self.state = GuidanceState::WaitingForHuman;
        self.add_action_message(checkpoint.guidance().to_string());
    }

    /// Resume after human action
    pub fn resume(&mut self) {
        self.state = GuidanceState::Resuming;
        self.add_message("Resuming automation...".to_string(), MessageType::Info);
    }

    /// Clear guidance
    pub fn clear(&mut self) {
        self.messages.clear();
        self.highlights.clear();
        self.auto_fill.clear();
        self.state = GuidanceState::Observing;
    }

    /// Get provider signup URL
    pub fn get_signup_url(provider: crate::capability::SupportedProvider) -> &'static str {
        match provider {
            crate::capability::SupportedProvider::Hetzner => {
                "https://accounts.hetzner.com/register"
            }
            crate::capability::SupportedProvider::DigitalOcean => {
                "https://cloud.digitalocean.com/registrations/new"
            }
            crate::capability::SupportedProvider::Aws => {
                "https://portal.aws.amazon.com/billing/signup"
            }
            crate::capability::SupportedProvider::Manual => {
                ""  // No signup URL for manual mode
            }
        }
    }

    /// Get affiliate link (if configured)
    pub fn get_affiliate_link(
        provider: crate::capability::SupportedProvider,
        affiliate_id: Option<&str>,
    ) -> Option<String> {
        affiliate_id.map(|id| match provider {
            crate::capability::SupportedProvider::Hetzner => {
                format!("https://accounts.hetzner.com/register?ref={}", id)
            }
            crate::capability::SupportedProvider::DigitalOcean => {
                format!("https://m.do.co/c/{}", id)
            }
            crate::capability::SupportedProvider::Aws => {
                format!("https://aws.amazon.com/console/?referral={}", id)
            }
            _ => String::new(),
        })
    }
}

impl Default for AgentGuidanceOverlay {
    fn default() -> Self {
        Self::new()
    }
}

/// Browser automation script for provider signup
pub struct SignupAutomationScript {
    /// Provider
    pub provider: crate::capability::SupportedProvider,
    /// Steps to execute
    pub steps: Vec<AutomationStep>,
}

/// Automation step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationStep {
    /// Step description
    pub description: String,
    /// Action type
    pub action: AutomationAction,
    /// Is sensitive (requires human)
    pub is_sensitive: bool,
}

/// Automation actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutomationAction {
    /// Navigate to URL
    Navigate { url: String },
    /// Wait for element
    WaitForElement { selector: String },
    /// Click element
    Click { selector: String },
    /// Fill field
    Fill { selector: String, value: String },
    /// Wait for human action
    WaitForHuman { reason: String },
    /// Extract text
    ExtractText { selector: String },
    /// Screenshot
    Screenshot,
}

impl SignupAutomationScript {
    /// Create automation script for provider
    pub fn for_provider(provider: crate::capability::SupportedProvider) -> Self {
        match provider {
            crate::capability::SupportedProvider::Hetzner => Self::hetzner_script(),
            crate::capability::SupportedProvider::DigitalOcean => Self::digitalocean_script(),
            crate::capability::SupportedProvider::Aws => Self::aws_script(),
            crate::capability::SupportedProvider::Manual => Self {
                provider,
                steps: Vec::new(),
            },
        }
    }

    /// Hetzner signup automation
    fn hetzner_script() -> Self {
        Self {
            provider: crate::capability::SupportedProvider::Hetzner,
            steps: vec![
                AutomationStep {
                    description: "Navigate to Hetzner signup".to_string(),
                    action: AutomationAction::Navigate {
                        url: "https://accounts.hetzner.com/register".to_string(),
                    },
                    is_sensitive: false,
                },
                AutomationStep {
                    description: "Wait for signup form".to_string(),
                    action: AutomationAction::WaitForElement {
                        selector: "form#registration-form".to_string(),
                    },
                    is_sensitive: false,
                },
                AutomationStep {
                    description: "Fill email field".to_string(),
                    action: AutomationAction::Fill {
                        selector: "input[name='email']".to_string(),
                        value: "{{user_email}}".to_string(),
                    },
                    is_sensitive: false,
                },
                AutomationStep {
                    description: "Fill password field (user confirms)".to_string(),
                    action: AutomationAction::Fill {
                        selector: "input[name='password']".to_string(),
                        value: "{{user_password}}".to_string(),
                    },
                    is_sensitive: true,
                },
                AutomationStep {
                    description: "Wait for human to complete CAPTCHA and payment".to_string(),
                    action: AutomationAction::WaitForHuman {
                        reason: "CAPTCHA and payment require human completion".to_string(),
                    },
                    is_sensitive: true,
                },
            ],
        }
    }

    /// DigitalOcean signup automation
    fn digitalocean_script() -> Self {
        Self {
            provider: crate::capability::SupportedProvider::DigitalOcean,
            steps: vec![
                AutomationStep {
                    description: "Navigate to DigitalOcean signup".to_string(),
                    action: AutomationAction::Navigate {
                        url: "https://cloud.digitalocean.com/registrations/new".to_string(),
                    },
                    is_sensitive: false,
                },
                AutomationStep {
                    description: "Wait for signup form".to_string(),
                    action: AutomationAction::WaitForElement {
                        selector: "form[data-testid='signup-form']".to_string(),
                    },
                    is_sensitive: false,
                },
                AutomationStep {
                    description: "Fill email field".to_string(),
                    action: AutomationAction::Fill {
                        selector: "input[type='email']".to_string(),
                        value: "{{user_email}}".to_string(),
                    },
                    is_sensitive: false,
                },
                AutomationStep {
                    description: "Wait for human to complete verification".to_string(),
                    action: AutomationAction::WaitForHuman {
                        reason: "Email verification requires human completion".to_string(),
                    },
                    is_sensitive: true,
                },
            ],
        }
    }

    /// AWS signup automation
    fn aws_script() -> Self {
        Self {
            provider: crate::capability::SupportedProvider::Aws,
            steps: vec![
                AutomationStep {
                    description: "Navigate to AWS signup".to_string(),
                    action: AutomationAction::Navigate {
                        url: "https://portal.aws.amazon.com/billing/signup".to_string(),
                    },
                    is_sensitive: false,
                },
                AutomationStep {
                    description: "Wait for signup form".to_string(),
                    action: AutomationAction::WaitForElement {
                        selector: "form#aws-signup-form".to_string(),
                    },
                    is_sensitive: false,
                },
                AutomationStep {
                    description: "Wait for human to complete full signup flow".to_string(),
                    action: AutomationAction::WaitForHuman {
                        reason: "AWS requires extensive verification".to_string(),
                    },
                    is_sensitive: true,
                },
            ],
        }
    }
}
