//! Vision Configuration
//!
//! Configurable vision brain settings for GUI automation.
//! Sources (priority order):
//! 1. CLI flag (passed via request body)
//! 2. Environment variable: A2_VISION_BRAIN
//! 3. Config file: ~/.a2rc
//! 4. Default: "claude-code"

use serde::{Deserialize, Serialize};
use std::env;

/// Vision configuration struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionConfig {
    /// Which brain to use for vision tasks
    pub brain: String,
    /// Where the config was loaded from
    pub source: ConfigSource,
    /// Default vision brain
    pub default_brain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConfigSource {
    EnvVar,     // From A2_VISION_BRAIN env var
    ConfigFile, // From ~/.a2rc
    Default,    // Fallback default
    Request,    // Override in API request
}

impl Default for VisionConfig {
    fn default() -> Self {
        Self::load()
    }
}

impl VisionConfig {
    /// Load vision config from environment or defaults
    pub fn load() -> Self {
        // Check environment variable first
        if let Ok(brain) = env::var("A2_VISION_BRAIN") {
            if !brain.is_empty() {
                return Self {
                    brain,
                    source: ConfigSource::EnvVar,
                    default_brain: "claude-code".to_string(),
                };
            }
        }

        // Check for config file (would be loaded here in full impl)
        // For now, use default
        Self {
            brain: "claude-code".to_string(),
            source: ConfigSource::Default,
            default_brain: "claude-code".to_string(),
        }
    }

    /// Get the configured brain, or override from request
    pub fn get_brain(&self, override_brain: Option<&str>) -> String {
        override_brain.unwrap_or(&self.brain).to_string()
    }

    /// Check if a brain supports vision
    pub fn is_vision_capable(brain: &str) -> bool {
        matches!(
            brain,
            "claude-code" | "gemini-cli" | "qwen" | "opencode" | "cursor"
        )
    }

    /// Get list of available vision-capable brains
    pub fn available_vision_brains() -> Vec<&'static str> {
        vec!["claude-code", "gemini-cli", "qwen", "opencode", "cursor"]
    }

    /// Pretty print config info
    pub fn info(&self) -> serde_json::Value {
        serde_json::json!({
            "configured_brain": self.brain,
            "source": match self.source {
                ConfigSource::EnvVar => "A2_VISION_BRAIN environment variable",
                ConfigSource::ConfigFile => "~/.a2rc config file",
                ConfigSource::Default => "default (claude-code)",
                ConfigSource::Request => "API request override",
            },
            "default_brain": self.default_brain,
            "available_brains": Self::available_vision_brains(),
            "set_via_env": format!("export A2_VISION_BRAIN=<brain>"),
            "example": "export A2_VISION_BRAIN=qwen"
        })
    }
}

/// Helper to get vision config from request or environment
pub fn get_vision_config(request_brain: Option<&str>) -> VisionConfig {
    let mut config = VisionConfig::load();

    if let Some(brain) = request_brain {
        if !brain.is_empty() && VisionConfig::is_vision_capable(brain) {
            config.brain = brain.to_string();
            config.source = ConfigSource::Request;
        }
    }

    config
}
