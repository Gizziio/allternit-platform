use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtectionReport {
    pub risk_score: f32,
    pub flagged_patterns: Vec<String>,
    pub recommendation: ProtectionAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProtectionAction {
    Allow,
    Warn,
    Block,
}

pub struct ProtectionGate;

impl ProtectionGate {
    pub fn scan_intent(text: &str) -> ProtectionReport {
        let lower = text.to_lowercase();
        let mut flags = Vec::new();
        let mut score: f32 = 0.0;

        // Pattern 1: Credential theft
        if lower.contains("password")
            || lower.contains("secret key")
            || lower.contains("private key")
        {
            flags.push("potential_credential_leak".to_string());
            score += 0.5;
        }

        // Pattern 2: Financial fraud / Unsupervised transaction
        if lower.contains("transfer money")
            || lower.contains("send $")
            || lower.contains("credit card")
        {
            flags.push("financial_risk".to_string());
            score += 0.6;
        }

        // Pattern 3: Social Engineering
        if lower.contains("as an admin") || lower.contains("ignore previous instructions") {
            flags.push("jailbreak_attempt".to_string());
            score += 0.8;
        }

        // Pattern 4: Hostile commands
        if lower.contains("rm -rf /") || lower.contains("format c:") {
            flags.push("destructive_command".to_string());
            score += 1.0;
        }

        let recommendation = if score >= 0.8 {
            ProtectionAction::Block
        } else if score >= 0.4 {
            ProtectionAction::Warn
        } else {
            ProtectionAction::Allow
        };

        ProtectionReport {
            risk_score: score.min(1.0),
            flagged_patterns: flags,
            recommendation,
        }
    }
}
