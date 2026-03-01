// Validator module for workflow definitions
// This module handles validation of workflow definitions against policies and schemas

use std::sync::Arc;

pub struct WorkflowValidator {
    policy_engine: Arc<a2rchitech_policy::PolicyEngine>,
}

impl WorkflowValidator {
    pub fn new(policy_engine: Arc<a2rchitech_policy::PolicyEngine>) -> Self {
        WorkflowValidator { policy_engine }
    }

    pub async fn validate(
        &self,
        workflow_definition: &crate::WorkflowDefinition,
    ) -> Result<(), crate::WorkflowError> {
        // Basic structural validation
        self.validate_structure(workflow_definition)?;

        // Policy-based validation
        self.validate_policies(workflow_definition).await?;

        // Phase ordering validation
        self.validate_phase_ordering(workflow_definition)?;

        Ok(())
    }

    fn validate_structure(
        &self,
        workflow_definition: &crate::WorkflowDefinition,
    ) -> Result<(), crate::WorkflowError> {
        // Check for duplicate node IDs
        let mut seen_ids = std::collections::HashSet::new();
        for node in &workflow_definition.nodes {
            if !seen_ids.insert(&node.id) {
                return Err(crate::WorkflowError::ExecutionFailed(format!(
                    "Duplicate node ID: {}",
                    node.id
                )));
            }
        }

        // Check for valid edges
        let node_ids: std::collections::HashSet<&String> =
            workflow_definition.nodes.iter().map(|n| &n.id).collect();
        for edge in &workflow_definition.edges {
            if !node_ids.contains(&edge.from) {
                return Err(crate::WorkflowError::NodeNotFound(edge.from.clone()));
            }
            if !node_ids.contains(&edge.to) {
                return Err(crate::WorkflowError::NodeNotFound(edge.to.clone()));
            }
        }

        Ok(())
    }

    async fn validate_policies(
        &self,
        workflow_definition: &crate::WorkflowDefinition,
    ) -> Result<(), crate::WorkflowError> {
        // In a real implementation, this would check the workflow against policy rules
        // For now, we'll just ensure all required roles exist
        for role in &workflow_definition.required_roles {
            // Placeholder validation - in reality, this would check against a role registry
            if role.is_empty() {
                return Err(crate::WorkflowError::ExecutionFailed(
                    "Role cannot be empty".to_string(),
                ));
            }
        }

        Ok(())
    }

    fn validate_phase_ordering(
        &self,
        workflow_definition: &crate::WorkflowDefinition,
    ) -> Result<(), crate::WorkflowError> {
        // Check if phases follow logical order (scientific loop: Observe -> Think -> Plan -> Execute -> Verify -> Learn)
        let phase_indices: std::collections::HashMap<crate::WorkflowPhase, usize> = [
            (crate::WorkflowPhase::Observe, 0),
            (crate::WorkflowPhase::Think, 1),
            (crate::WorkflowPhase::Plan, 2),
            (crate::WorkflowPhase::Build, 3),
            (crate::WorkflowPhase::Execute, 4),
            (crate::WorkflowPhase::Verify, 5),
            (crate::WorkflowPhase::Learn, 6),
        ]
        .iter()
        .cloned()
        .collect();

        // This is a simplified check - a full implementation would be more sophisticated
        Ok(())
    }
}
