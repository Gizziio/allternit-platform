//! Purpose Enforcement Module
//!
//! Enforces purpose-based access control decisions.

use crate::{DataSubject, OperationType, Purpose, PurposeBinding};

/// Enforcement decision
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EnforcementDecision {
    /// Operation is permitted
    Allow,
    /// Operation is denied
    Deny,
    /// Operation requires additional review
    ReviewRequired,
    /// Operation is permitted with conditions
    AllowWithConditions(Vec<EnforcementCondition>),
}

/// Conditions for allowed operations
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EnforcementCondition {
    /// Must log the operation
    MustLog,
    /// Must notify data subject
    MustNotify,
    /// Must anonymize data
    MustAnonymize,
    /// Limited retention period (days)
    RetentionLimit(u32),
    /// Custom condition
    Custom(String),
}

/// Purpose enforcer
pub struct PurposeEnforcer;

impl PurposeEnforcer {
    /// Create a new enforcer
    pub fn new() -> Self {
        Self
    }

    /// Check if an operation is permitted
    pub fn check_operation(
        &self,
        purpose: &Purpose,
        binding: &PurposeBinding,
        operation: &OperationType,
        data_subject: Option<&DataSubject>,
    ) -> EnforcementDecision {
        // Check if operation is in allowed list
        if !purpose.allowed_operations.contains(operation) {
            return EnforcementDecision::Deny;
        }

        // Check if binding allows this operation
        if binding.context.operation_type != *operation {
            // Allow if the new operation is also permitted by purpose
            if !purpose.allowed_operations.contains(operation) {
                return EnforcementDecision::Deny;
            }
        }

        // Check data subject sensitivity
        if let Some(subject) = data_subject {
            // Special handling for protected data - requires review
            if subject.sensitivity_level == crate::SensitivityLevel::Protected {
                return EnforcementDecision::ReviewRequired;
            }

            // Check if sensitivity level is allowed
            if !purpose
                .allowed_sensitivity_levels
                .contains(&subject.sensitivity_level)
            {
                return EnforcementDecision::Deny;
            }
        }

        // Check for conditions
        let mut conditions = Vec::new();

        if purpose.requires_consent && binding.consent_record.is_none() {
            return EnforcementDecision::Deny;
        }

        // Add logging requirement for sensitive operations
        match operation {
            OperationType::Share | OperationType::Delete => {
                conditions.push(EnforcementCondition::MustLog);
            }
            _ => {}
        }

        // Require notification for sharing
        if *operation == OperationType::Share && !purpose.allows_third_party_sharing {
            conditions.push(EnforcementCondition::MustNotify);
        }

        if conditions.is_empty() {
            EnforcementDecision::Allow
        } else {
            EnforcementDecision::AllowWithConditions(conditions)
        }
    }

    /// Check if data sharing is permitted
    pub fn check_sharing(
        &self,
        purpose: &Purpose,
        recipient: &str,
        is_third_party: bool,
    ) -> EnforcementDecision {
        // Check if recipient is allowed
        if !purpose.allowed_recipients.is_empty()
            && !purpose.allowed_recipients.contains(&recipient.to_string())
        {
            return EnforcementDecision::Deny;
        }

        // Check third-party sharing
        if is_third_party && !purpose.allows_third_party_sharing {
            return EnforcementDecision::Deny;
        }

        EnforcementDecision::AllowWithConditions(vec![
            EnforcementCondition::MustLog,
            EnforcementCondition::MustNotify,
        ])
    }

    /// Check if automated decision making is permitted
    pub fn check_automated_decision(&self, purpose: &Purpose) -> EnforcementDecision {
        if purpose.allows_automated_decisions {
            EnforcementDecision::AllowWithConditions(vec![
                EnforcementCondition::MustLog,
                EnforcementCondition::Custom("human_oversight_required".to_string()),
            ])
        } else {
            EnforcementDecision::Deny
        }
    }
}

impl Default for PurposeEnforcer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{PurposeCategory, SensitivityLevel};

    fn create_test_purpose() -> Purpose {
        Purpose {
            purpose_id: "test".to_string(),
            name: "Test".to_string(),
            description: "Test purpose".to_string(),
            category: PurposeCategory::UserRequested,
            allowed_operations: vec![OperationType::Read, OperationType::Process],
            allowed_sensitivity_levels: vec![SensitivityLevel::Internal, SensitivityLevel::Public],
            requires_consent: false,
            allows_retention: true,
            max_retention_days: Some(30),
            allowed_recipients: vec!["internal".to_string()],
            allows_third_party_sharing: false,
            allows_automated_decisions: false,
            created_at: chrono::Utc::now(),
            expires_at: None,
        }
    }

    #[test]
    fn test_allowed_operation() {
        let enforcer = PurposeEnforcer::new();
        let purpose = create_test_purpose();
        let binding = PurposeBinding {
            binding_id: "bind-1".to_string(),
            purpose_id: "test".to_string(),
            context: crate::OperationContext {
                operation_id: "op-1".to_string(),
                operation_type: OperationType::Read,
                actor_id: "actor".to_string(),
                session_id: "session".to_string(),
                request_id: "req".to_string(),
                timestamp: chrono::Utc::now(),
                metadata: std::collections::HashMap::new(),
            },
            data_subjects: vec![],
            tools: vec![],
            authorized_by: "admin".to_string(),
            authorized_at: chrono::Utc::now(),
            expires_at: None,
            consent_record: None,
            audit_refs: vec![],
        };

        let decision = enforcer.check_operation(&purpose, &binding, &OperationType::Read, None);
        assert_eq!(decision, EnforcementDecision::Allow);
    }

    #[test]
    fn test_disallowed_operation() {
        let enforcer = PurposeEnforcer::new();
        let purpose = create_test_purpose();
        let binding = PurposeBinding {
            binding_id: "bind-1".to_string(),
            purpose_id: "test".to_string(),
            context: crate::OperationContext {
                operation_id: "op-1".to_string(),
                operation_type: OperationType::Read,
                actor_id: "actor".to_string(),
                session_id: "session".to_string(),
                request_id: "req".to_string(),
                timestamp: chrono::Utc::now(),
                metadata: std::collections::HashMap::new(),
            },
            data_subjects: vec![],
            tools: vec![],
            authorized_by: "admin".to_string(),
            authorized_at: chrono::Utc::now(),
            expires_at: None,
            consent_record: None,
            audit_refs: vec![],
        };

        let decision = enforcer.check_operation(&purpose, &binding, &OperationType::Delete, None);
        assert_eq!(decision, EnforcementDecision::Deny);
    }

    #[test]
    fn test_protected_data_requires_review() {
        let enforcer = PurposeEnforcer::new();
        let purpose = create_test_purpose();
        let binding = PurposeBinding {
            binding_id: "bind-1".to_string(),
            purpose_id: "test".to_string(),
            context: crate::OperationContext {
                operation_id: "op-1".to_string(),
                operation_type: OperationType::Read,
                actor_id: "actor".to_string(),
                session_id: "session".to_string(),
                request_id: "req".to_string(),
                timestamp: chrono::Utc::now(),
                metadata: std::collections::HashMap::new(),
            },
            data_subjects: vec![],
            tools: vec![],
            authorized_by: "admin".to_string(),
            authorized_at: chrono::Utc::now(),
            expires_at: None,
            consent_record: None,
            audit_refs: vec![],
        };

        let data_subject = DataSubject {
            subject_id: "user-1".to_string(),
            subject_type: "user".to_string(),
            sensitivity_level: SensitivityLevel::Protected,
            data_types: vec!["personal".to_string()],
            has_consent: false,
        };

        let decision = enforcer.check_operation(
            &purpose,
            &binding,
            &OperationType::Read,
            Some(&data_subject),
        );
        assert_eq!(decision, EnforcementDecision::ReviewRequired);
    }
}
