// Agent template validator module
// This module handles validation of agent templates against policies and schemas

use std::sync::Arc;

pub struct AgentTemplateValidator {
    policy_engine: Arc<a2rchitech_policy::PolicyEngine>,
}

impl AgentTemplateValidator {
    pub fn new(policy_engine: Arc<a2rchitech_policy::PolicyEngine>) -> Self {
        AgentTemplateValidator { policy_engine }
    }

    pub async fn validate(
        &self,
        template: &crate::templates::AgentTemplate,
    ) -> Result<(), crate::WorkflowError> {
        // Basic structural validation
        self.validate_structure(template)?;

        // Policy-based validation
        self.validate_policies(template).await?;

        // Capability validation
        self.validate_capabilities(template)?;

        Ok(())
    }

    fn validate_structure(
        &self,
        template: &crate::templates::AgentTemplate,
    ) -> Result<(), crate::WorkflowError> {
        // Check that template ID is not empty
        if template.template_id.is_empty() {
            return Err(crate::WorkflowError::ExecutionFailed(
                "Template ID cannot be empty".to_string(),
            ));
        }

        // Check that name is not empty
        if template.name.is_empty() {
            return Err(crate::WorkflowError::ExecutionFailed(
                "Template name cannot be empty".to_string(),
            ));
        }

        Ok(())
    }

    async fn validate_policies(
        &self,
        template: &crate::templates::AgentTemplate,
    ) -> Result<(), crate::WorkflowError> {
        // In a real implementation, this would check the template against policy rules
        // For now, we'll just ensure all required permissions exist
        for perm in &template.permissions {
            // Placeholder validation - in reality, this would check against a permission registry
            if perm.is_empty() {
                return Err(crate::WorkflowError::ExecutionFailed(
                    "Permission cannot be empty".to_string(),
                ));
            }
        }

        Ok(())
    }

    fn validate_capabilities(
        &self,
        template: &crate::templates::AgentTemplate,
    ) -> Result<(), crate::WorkflowError> {
        // Validate that all capabilities are properly defined
        for cap in &template.capabilities {
            if cap.name.is_empty() {
                return Err(crate::WorkflowError::ExecutionFailed(
                    "Capability name cannot be empty".to_string(),
                ));
            }
        }

        Ok(())
    }
}
