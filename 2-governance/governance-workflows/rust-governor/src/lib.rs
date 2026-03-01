use a2r_substrate::PolicyContext;
use anyhow::Result;

pub struct PolicyEngine;

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl PolicyEngine {
    pub fn new() -> Self {
        Self
    }

    pub async fn evaluate(&self, context: &PolicyContext) -> Result<String> {
        let decision = match context.security_level.as_str() {
            "deny" => "deny",
            "full" => "allow",
            _ => {
                if context.tool == "shell" || context.tool == "bash" {
                    "ask"
                } else {
                    "allow"
                }
            }
        };
        Ok(decision.to_string())
    }
}
