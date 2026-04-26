use super::compiler::{PersonaYaml, TaskTemplateDefinitionYaml, TaskTemplatesYaml, WorkflowYaml};

pub struct YamlValidator {
    policy_engine: std::sync::Arc<allternit_policy::PolicyEngine>,
    tenant_id: String,
}

impl YamlValidator {
    pub fn new(
        policy_engine: std::sync::Arc<allternit_policy::PolicyEngine>,
        tenant_id: String,
    ) -> Self {
        YamlValidator {
            policy_engine,
            tenant_id,
        }
    }

    /// Validate a workflow YAML definition against kernel contracts and policies
    pub fn validate_workflow(&self, yaml_content: &str) -> Result<(), ValidationError> {
        // First, parse the YAML to ensure it's syntactically valid
        let workflow_yaml: WorkflowYaml = serde_yaml::from_str(yaml_content)
            .map_err(|e| ValidationError::ParseError(format!("YAML parse error: {}", e)))?;

        // Validate tenant isolation
        self.validate_tenant_isolation(&workflow_yaml.workflow.tenant_id)?;

        // Validate safety tiers
        self.validate_safety_tiers(&workflow_yaml.workflow.required_tiers)?;

        // Validate workflow phases
        self.validate_workflow_phases(&workflow_yaml.workflow.phases)?;

        // Validate tasks
        self.validate_tasks(&workflow_yaml.workflow.tasks)?;

        // Validate dependencies
        self.validate_dependencies(
            &workflow_yaml.workflow.tasks,
            &workflow_yaml.workflow.dependencies,
        )?;

        Ok(())
    }

    /// Validate a persona YAML definition against kernel contracts and policies
    pub fn validate_persona(&self, yaml_content: &str) -> Result<(), ValidationError> {
        // First, parse the YAML to ensure it's syntactically valid
        let persona_yaml: PersonaYaml = serde_yaml::from_str(yaml_content)
            .map_err(|e| ValidationError::ParseError(format!("YAML parse error: {}", e)))?;

        // Validate each persona
        for persona in &persona_yaml.personas {
            // Validate tenant isolation
            self.validate_tenant_isolation(&persona.tenant_id)?;

            // Validate safety tier if present
            if let Some(constraints) = &persona.constraints {
                if let Some(tier) = &constraints.safety_tier {
                    self.validate_single_safety_tier(tier)?;
                }
            }
        }

        Ok(())
    }

    /// Validate a task template YAML definition against kernel contracts
    pub fn validate_task_templates(&self, yaml_content: &str) -> Result<(), ValidationError> {
        let task_templates_yaml: TaskTemplatesYaml = serde_yaml::from_str(yaml_content)
            .map_err(|e| ValidationError::ParseError(format!("YAML parse error: {}", e)))?;

        for template in &task_templates_yaml.task_templates {
            self.validate_task_template(template)?;
        }

        Ok(())
    }

    fn validate_tenant_isolation(&self, yaml_tenant_id: &str) -> Result<(), ValidationError> {
        if yaml_tenant_id != self.tenant_id {
            return Err(ValidationError::TenantIsolationError(format!(
                "YAML tenant_id '{}' does not match expected '{}'",
                yaml_tenant_id, self.tenant_id
            )));
        }
        Ok(())
    }

    fn validate_safety_tiers(&self, tiers: &[String]) -> Result<(), ValidationError> {
        for tier in tiers {
            self.validate_single_safety_tier(tier)?;
        }
        Ok(())
    }

    fn validate_single_safety_tier(&self, tier: &str) -> Result<(), ValidationError> {
        match tier {
            "T0" | "T1" | "T2" | "T3" | "T4" => Ok(()),
            _ => Err(ValidationError::ValidationError(format!(
                "Invalid safety tier: {}",
                tier
            ))),
        }
    }

    fn validate_workflow_phases(&self, phases: &[String]) -> Result<(), ValidationError> {
        for phase in phases {
            match phase.as_str() {
                "Observe" | "Think" | "Plan" | "Build" | "Execute" | "Verify" | "Learn" => (),
                _ => {
                    return Err(ValidationError::ValidationError(format!(
                        "Invalid workflow phase: {}",
                        phase
                    )))
                }
            }
        }
        Ok(())
    }

    fn validate_tasks(&self, tasks: &[super::compiler::TaskYaml]) -> Result<(), ValidationError> {
        for task in tasks {
            // Validate phase
            match task.phase.as_str() {
                "Observe" | "Think" | "Plan" | "Build" | "Execute" | "Verify" | "Learn" => (),
                _ => {
                    return Err(ValidationError::ValidationError(format!(
                        "Invalid task phase: {}",
                        task.phase
                    )))
                }
            }

            // Validate that required fields are present
            if task.id.is_empty() {
                return Err(ValidationError::ValidationError(
                    "Task ID cannot be empty".to_string(),
                ));
            }

            if task.name.is_empty() {
                return Err(ValidationError::ValidationError(
                    "Task name cannot be empty".to_string(),
                ));
            }

            if task.persona.is_empty() {
                return Err(ValidationError::ValidationError(
                    "Task persona cannot be empty".to_string(),
                ));
            }

            if task.description.is_empty() {
                return Err(ValidationError::ValidationError(
                    "Task description cannot be empty".to_string(),
                ));
            }
        }
        Ok(())
    }

    fn validate_dependencies(
        &self,
        tasks: &[super::compiler::TaskYaml],
        dependencies: &[super::compiler::DependencyYaml],
    ) -> Result<(), ValidationError> {
        // Create a set of valid task IDs
        let valid_task_ids: std::collections::HashSet<&String> =
            tasks.iter().map(|task| &task.id).collect();

        for dependency in dependencies {
            // Validate that both 'from' and 'to' tasks exist
            if !valid_task_ids.contains(&dependency.from) {
                return Err(ValidationError::ValidationError(format!(
                    "Dependency 'from' task does not exist: {}",
                    dependency.from
                )));
            }

            if !valid_task_ids.contains(&dependency.to) {
                return Err(ValidationError::ValidationError(format!(
                    "Dependency 'to' task does not exist: {}",
                    dependency.to
                )));
            }

            // Prevent circular dependencies (basic check - full cycle detection would be more complex)
            if dependency.from == dependency.to {
                return Err(ValidationError::ValidationError(format!(
                    "Circular dependency detected: {} -> {}",
                    dependency.from, dependency.to
                )));
            }
        }

        Ok(())
    }

    fn validate_task_template(
        &self,
        template: &TaskTemplateDefinitionYaml,
    ) -> Result<(), ValidationError> {
        if template.id.is_empty() {
            return Err(ValidationError::ValidationError(
                "Task template ID cannot be empty".to_string(),
            ));
        }

        if template.name.is_empty() {
            return Err(ValidationError::ValidationError(
                "Task template name cannot be empty".to_string(),
            ));
        }

        if template.description.is_empty() {
            return Err(ValidationError::ValidationError(
                "Task template description cannot be empty".to_string(),
            ));
        }

        if !template.input_schema.is_object() {
            return Err(ValidationError::ValidationError(
                "Task template input_schema must be a JSON object".to_string(),
            ));
        }

        if !template.output_schema.is_object() {
            return Err(ValidationError::ValidationError(
                "Task template output_schema must be a JSON object".to_string(),
            ));
        }

        if let Some(schema) = &template.verification_schema {
            if !schema.is_object() {
                return Err(ValidationError::ValidationError(
                    "Task template verification_schema must be a JSON object".to_string(),
                ));
            }
        }

        if let Some(constraints) = &template.default_constraints {
            if let Some(time_budget) = constraints.time_budget {
                if time_budget == 0 {
                    return Err(ValidationError::ValidationError(
                        "Task template time_budget must be greater than 0".to_string(),
                    ));
                }
            }

            if let Some(required_permissions) = &constraints.required_permissions {
                if required_permissions.iter().any(|perm| perm.is_empty()) {
                    return Err(ValidationError::ValidationError(
                        "Task template required_permissions cannot contain empty values"
                            .to_string(),
                    ));
                }
            }

            if let Some(resource_limits) = &constraints.resource_limits {
                if let Some(cpu) = &resource_limits.cpu {
                    if cpu.is_empty() {
                        return Err(ValidationError::ValidationError(
                            "Task template resource_limits.cpu cannot be empty".to_string(),
                        ));
                    }
                }
                if let Some(memory) = &resource_limits.memory {
                    if memory.is_empty() {
                        return Err(ValidationError::ValidationError(
                            "Task template resource_limits.memory cannot be empty".to_string(),
                        ));
                    }
                }
            }
        }

        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Tenant isolation error: {0}")]
    TenantIsolationError(String),
    #[error("Policy error: {0}")]
    PolicyError(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_history::HistoryLedger;
    use allternit_messaging::MessagingSystem;
    use std::sync::Arc;
    use tempfile::NamedTempFile;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_validate_valid_workflow() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = sqlx::SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_validator_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(std::sync::Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        // Register a default identity for testing
        let identity = allternit_policy::Identity {
            id: "workflow_validator".to_string(),
            identity_type: allternit_policy::IdentityType::AgentIdentity,
            name: "workflow_validator".to_string(),
            tenant_id: "tenant-123".to_string(),
            created_at: 0,
            active: true,
            roles: vec!["user".to_string()],
            permissions: vec!["perm_t0_read".to_string(), "perm_t1_read".to_string()],
        };
        policy_engine.register_identity(identity).await.unwrap();
        policy_engine.create_default_permissions().await.unwrap();
        policy_engine.create_default_rules().await.unwrap();

        let validator = YamlValidator::new(policy_engine, "tenant-123".to_string());

        let yaml_content = r#"
version: "1.0"
workflow:
  id: "test-validate-workflow"
  name: "Test Validate Workflow"
  description: "A test workflow for validation"
  version: "1.0.0"
  tenant_id: "tenant-123"
  required_tiers:
    - "T0"
    - "T1"
  success_criteria: "All tasks completed successfully"
  failure_modes:
    - "Any task fails"
  phases:
    - "Observe"
    - "Think"
    - "Plan"
  tasks:
    - id: "task-1"
      name: "First Task"
      phase: "Observe"
      persona: "researcher"
      description: "First task in workflow"
      instructions: "Perform initial observation"
      inputs: []
      outputs: ["observation_result"]
      tools: ["search_tool"]
  dependencies: []
"#;

        let result = validator.validate_workflow(yaml_content);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_invalid_tenant() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = sqlx::SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_validator2_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(std::sync::Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        let validator = YamlValidator::new(policy_engine, "tenant-123".to_string());

        let yaml_content = r#"
version: "1.0"
workflow:
  id: "test-invalid-tenant"
  name: "Test Invalid Tenant Workflow"
  description: "A test workflow with invalid tenant"
  version: "1.0.0"
  tenant_id: "different-tenant"  # This should fail tenant validation
  required_tiers:
    - "T0"
  success_criteria: "All tasks completed successfully"
  failure_modes:
    - "Any task fails"
  phases:
    - "Observe"
  tasks:
    - id: "task-1"
      name: "First Task"
      phase: "Observe"
      persona: "researcher"
      description: "First task in workflow"
      instructions: "Perform initial observation"
      inputs: []
      outputs: ["observation_result"]
      tools: ["search_tool"]
  dependencies: []
"#;

        let result = validator.validate_workflow(yaml_content);
        assert!(result.is_err());
        match result.unwrap_err() {
            ValidationError::TenantIsolationError(_) => (), // Expected
            _ => panic!("Expected TenantIsolationError"),
        }
    }

    #[tokio::test]
    async fn test_validate_invalid_task() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = sqlx::SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_validator3_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(std::sync::Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        // Register a default identity for testing
        let identity = allternit_policy::Identity {
            id: "workflow_validator".to_string(),
            identity_type: allternit_policy::IdentityType::AgentIdentity,
            name: "workflow_validator".to_string(),
            tenant_id: "tenant-123".to_string(),
            created_at: 0,
            active: true,
            roles: vec!["user".to_string()],
            permissions: vec!["perm_t0_read".to_string(), "perm_t1_read".to_string()],
        };
        policy_engine.register_identity(identity).await.unwrap();
        policy_engine.create_default_permissions().await.unwrap();
        policy_engine.create_default_rules().await.unwrap();

        let validator = YamlValidator::new(policy_engine, "tenant-123".to_string());

        let yaml_content = r#"
version: "1.0"
workflow:
  id: "test-invalid-task"
  name: "Test Invalid Task Workflow"
  description: "A test workflow with invalid task"
  version: "1.0.0"
  tenant_id: "tenant-123"
  required_tiers:
    - "T0"
  success_criteria: "All tasks completed successfully"
  failure_modes:
    - "Any task fails"
  phases:
    - "Observe"
  tasks:
    - id: ""  # This should fail validation
      name: "First Task"
      phase: "Observe"
      persona: "researcher"
      description: "First task in workflow"
      instructions: "Perform initial observation"
      inputs: []
      outputs: ["observation_result"]
      tools: ["search_tool"]
  dependencies: []
"#;

        let result = validator.validate_workflow(yaml_content);
        assert!(result.is_err());
        match result.unwrap_err() {
            ValidationError::ValidationError(msg) => {
                assert!(msg.contains("cannot be empty"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[tokio::test]
    async fn test_validate_task_templates_valid() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = sqlx::SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_task_templates_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(std::sync::Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        let validator = YamlValidator::new(policy_engine, "tenant-123".to_string());

        let yaml_content = r#"
version: "1.0"
task_templates:
  - id: "task-template-1"
    name: "Task Template"
    description: "A task template for validation"
    default_constraints:
      time_budget: 60
      resource_limits:
        cpu: "200m"
        memory: "128Mi"
      required_permissions: ["perm_t0_read"]
    input_schema:
      type: "object"
    output_schema:
      type: "object"
    verification_schema:
      type: "object"
"#;

        let result = validator.validate_task_templates(yaml_content);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_task_templates_invalid() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = sqlx::SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_task_templates_invalid_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(std::sync::Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        let validator = YamlValidator::new(policy_engine, "tenant-123".to_string());

        let yaml_content = r#"
version: "1.0"
task_templates:
  - id: ""
    name: ""
    description: ""
    input_schema: "not-an-object"
    output_schema:
      type: "object"
"#;

        let result = validator.validate_task_templates(yaml_content);
        assert!(result.is_err());
    }
}
