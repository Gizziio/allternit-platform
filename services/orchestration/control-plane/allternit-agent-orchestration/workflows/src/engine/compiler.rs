use crate::{
    FilesystemAccess, NetworkAccess, NodeConstraints, ResourceLimits, WorkflowDefinition,
    WorkflowEdge, WorkflowNode,
};
use a2rchitech_kernel_contracts::{
    EventEnvelope, ResourceRequirements, RunModel, RunState, ToolABI, VerificationResults,
    VerifyArtifact,
};
use serde::{Deserialize, Serialize};
use serde_yaml;
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowYaml {
    pub version: String,
    pub workflow: WorkflowDefinitionYaml,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinitionYaml {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub tenant_id: String,
    pub required_tiers: Vec<String>,
    pub success_criteria: String,
    pub failure_modes: Vec<String>,
    pub phases: Vec<String>,
    pub tasks: Vec<TaskYaml>,
    pub dependencies: Vec<DependencyYaml>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskYaml {
    pub id: String,
    pub name: String,
    pub phase: String,
    pub persona: String,
    pub description: String,
    pub instructions: String,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
    pub tools: Vec<String>,
    pub constraints: Option<ConstraintsYaml>,
    pub expected_output_schema: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyYaml {
    pub from: String,
    pub to: String,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintsYaml {
    pub time_budget: Option<u64>,
    pub resource_limits: Option<ResourceLimitsYaml>,
    pub allowed_tools: Option<Vec<String>>,
    pub required_permissions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimitsYaml {
    pub cpu: Option<String>,
    pub memory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaYaml {
    pub version: String,
    pub personas: Vec<PersonaDefinitionYaml>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaDefinitionYaml {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tenant_id: String,
    pub context_overlay: ContextOverlayYaml,
    pub goals: Vec<String>,
    pub constraints: Option<PersonaConstraintsYaml>,
    pub provider_preferences: Option<ProviderPreferencesYaml>,
    pub signature: Option<SignatureYaml>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextOverlayYaml {
    pub expertise: String,
    pub methodology: String,
    pub limitations: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaConstraintsYaml {
    pub safety_tier: Option<String>,
    pub required_permissions: Option<Vec<String>>,
    pub resource_limits: Option<ResourceLimitsYaml>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPreferencesYaml {
    pub priority_order: Vec<String>,
    pub fallback_timeout: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureYaml {
    pub manifest_sig: String,
    pub bundle_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskTemplatesYaml {
    pub version: String,
    pub task_templates: Vec<TaskTemplateDefinitionYaml>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskTemplateDefinitionYaml {
    pub id: String,
    pub name: String,
    pub description: String,
    pub default_constraints: Option<TaskTemplateConstraintsYaml>,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
    pub verification_schema: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskTemplateConstraintsYaml {
    pub time_budget: Option<u64>,
    pub resource_limits: Option<TaskTemplateResourceLimitsYaml>,
    pub required_permissions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskTemplateResourceLimitsYaml {
    pub cpu: Option<String>,
    pub memory: Option<String>,
}

#[derive(Debug, Clone)]
pub struct KernelCompilationContext {
    pub session_id: String,
    pub created_by: String,
    pub timestamp: u64,
}

impl Default for KernelCompilationContext {
    fn default() -> Self {
        KernelCompilationContext {
            session_id: "compiled".to_string(),
            created_by: "compiler".to_string(),
            timestamp: 0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CompiledWorkflowContracts {
    pub workflow_definition: WorkflowDefinition,
    pub run_model: RunModel,
    pub compilation_event: EventEnvelope,
}

#[derive(Debug, Clone)]
pub struct CompiledTaskTemplateContracts {
    pub tool_abi: ToolABI,
    pub verify_artifact: Option<VerifyArtifact>,
}

pub struct YamlCompiler;

impl YamlCompiler {
    /// Compile a workflow YAML definition to a kernel contract
    pub fn compile_workflow(
        &self,
        yaml_content: &str,
    ) -> Result<WorkflowDefinition, CompilerError> {
        let workflow_yaml: WorkflowYaml = serde_yaml::from_str(yaml_content)
            .map_err(|e| CompilerError::ParseError(format!("YAML parse error: {}", e)))?;

        // Convert required tiers to SafetyTier enums
        let allowed_skill_tiers = workflow_yaml
            .workflow
            .required_tiers
            .iter()
            .map(|tier_str| self.parse_safety_tier(tier_str))
            .collect::<Result<Vec<_>, _>>()?;

        // Convert phases to WorkflowPhase enums
        let phases_used = workflow_yaml
            .workflow
            .phases
            .iter()
            .map(|phase_str| self.parse_workflow_phase(phase_str))
            .collect::<Result<Vec<_>, _>>()?;

        // Convert tasks to WorkflowNodes
        let nodes = workflow_yaml
            .workflow
            .tasks
            .iter()
            .map(|task| self.compile_task(task))
            .collect::<Result<Vec<_>, _>>()?;

        // Convert dependencies to WorkflowEdges
        let edges = workflow_yaml
            .workflow
            .dependencies
            .iter()
            .map(|dep| self.compile_dependency(dep))
            .collect::<Result<Vec<_>, _>>()?;

        let workflow_def = WorkflowDefinition {
            workflow_id: workflow_yaml.workflow.id,
            version: workflow_yaml.workflow.version,
            description: workflow_yaml.workflow.description,
            required_roles: vec!["user".to_string()], // Default role, can be customized
            allowed_skill_tiers,
            phases_used,
            success_criteria: workflow_yaml.workflow.success_criteria,
            failure_modes: workflow_yaml.workflow.failure_modes,
            nodes,
            edges,
        };

        Ok(workflow_def)
    }

    /// Compile a persona YAML definition to kernel contracts
    pub fn compile_persona(
        &self,
        yaml_content: &str,
    ) -> Result<Vec<PersonaDefinitionYaml>, CompilerError> {
        let persona_yaml: PersonaYaml = serde_yaml::from_str(yaml_content)
            .map_err(|e| CompilerError::ParseError(format!("YAML parse error: {}", e)))?;

        Ok(persona_yaml.personas)
    }

    /// Compile a workflow YAML definition to kernel contracts
    pub fn compile_workflow_contracts(
        &self,
        yaml_content: &str,
        context: KernelCompilationContext,
    ) -> Result<CompiledWorkflowContracts, CompilerError> {
        let workflow_yaml: WorkflowYaml = serde_yaml::from_str(yaml_content)
            .map_err(|e| CompilerError::ParseError(format!("YAML parse error: {}", e)))?;

        let workflow_definition = self.compile_workflow(yaml_content)?;

        let mut metadata = HashMap::new();
        metadata.insert(
            "workflow_name".to_string(),
            serde_json::json!(workflow_yaml.workflow.name),
        );
        metadata.insert(
            "workflow_version".to_string(),
            serde_json::json!(workflow_yaml.workflow.version),
        );
        metadata.insert(
            "success_criteria".to_string(),
            serde_json::json!(workflow_yaml.workflow.success_criteria),
        );
        metadata.insert(
            "failure_modes".to_string(),
            serde_json::json!(workflow_yaml.workflow.failure_modes),
        );

        let run_model = RunModel {
            run_id: workflow_yaml.workflow.id.clone(),
            state: RunState::Created,
            tenant_id: workflow_yaml.workflow.tenant_id.clone(),
            session_id: context.session_id.clone(),
            created_by: context.created_by.clone(),
            created_at: context.timestamp,
            updated_at: context.timestamp,
            completed_at: None,
            error_message: None,
            metadata,
        };

        let compilation_event = EventEnvelope {
            event_id: format!("compile-{}", workflow_yaml.workflow.id),
            event_type: "WorkflowCompiled".to_string(),
            session_id: context.session_id,
            tenant_id: workflow_yaml.workflow.tenant_id,
            actor_id: context.created_by,
            role: "compiler".to_string(),
            timestamp: context.timestamp,
            correlation_id: None,
            causation_id: None,
            idempotency_key: None,
            trace_id: None,
            payload: serde_json::json!({
                "workflow_id": workflow_definition.workflow_id,
                "workflow_version": workflow_definition.version,
            }),
        };

        Ok(CompiledWorkflowContracts {
            workflow_definition,
            run_model,
            compilation_event,
        })
    }

    /// Compile task template YAML to kernel contracts
    pub fn compile_task_template_contracts(
        &self,
        yaml_content: &str,
    ) -> Result<Vec<CompiledTaskTemplateContracts>, CompilerError> {
        let task_templates_yaml: TaskTemplatesYaml = serde_yaml::from_str(yaml_content)
            .map_err(|e| CompilerError::ParseError(format!("YAML parse error: {}", e)))?;

        let mut compiled = Vec::new();
        for template in &task_templates_yaml.task_templates {
            self.validate_task_template_yaml(template)?;
            let tool_abi = self.build_tool_abi(template);
            let verify_artifact = template
                .verification_schema
                .as_ref()
                .map(|schema| self.build_verify_artifact(template, schema));

            compiled.push(CompiledTaskTemplateContracts {
                tool_abi,
                verify_artifact,
            });
        }

        Ok(compiled)
    }

    fn compile_task(&self, task: &TaskYaml) -> Result<WorkflowNode, CompilerError> {
        let phase = self.parse_workflow_phase(&task.phase)?;

        let constraints = if let Some(constraints_yaml) = &task.constraints {
            NodeConstraints {
                time_budget: constraints_yaml.time_budget,
                resource_limits: constraints_yaml.resource_limits.as_ref().map(|rl| {
                    ResourceLimits {
                        cpu: rl.cpu.clone(),
                        memory: rl.memory.clone(),
                        network: NetworkAccess::None,
                        filesystem: FilesystemAccess::None,
                        time_limit: constraints_yaml.time_budget.unwrap_or(0),
                    }
                }),
                allowed_tools: constraints_yaml.allowed_tools.clone().unwrap_or_default(),
                required_permissions: constraints_yaml
                    .required_permissions
                    .clone()
                    .unwrap_or_default(),
            }
        } else {
            NodeConstraints {
                time_budget: None,
                resource_limits: None,
                allowed_tools: vec![],
                required_permissions: vec![],
            }
        };

        Ok(WorkflowNode {
            id: task.id.clone(),
            name: task.name.clone(),
            phase,
            skill_id: task.persona.clone(), // In A2rchitech, persona maps to skill_id
            inputs: task.inputs.clone(),
            outputs: task.outputs.clone(),
            constraints,
        })
    }

    fn compile_dependency(&self, dep: &DependencyYaml) -> Result<WorkflowEdge, CompilerError> {
        Ok(WorkflowEdge {
            from: dep.from.clone(),
            to: dep.to.clone(),
            condition: dep.condition.clone(),
        })
    }

    fn parse_safety_tier(
        &self,
        tier_str: &str,
    ) -> Result<a2rchitech_policy::SafetyTier, CompilerError> {
        match tier_str {
            "T0" => Ok(a2rchitech_policy::SafetyTier::T0),
            "T1" => Ok(a2rchitech_policy::SafetyTier::T1),
            "T2" => Ok(a2rchitech_policy::SafetyTier::T2),
            "T3" => Ok(a2rchitech_policy::SafetyTier::T3),
            "T4" => Ok(a2rchitech_policy::SafetyTier::T4),
            _ => Err(CompilerError::ValidationError(format!(
                "Invalid safety tier: {}",
                tier_str
            ))),
        }
    }

    fn parse_workflow_phase(&self, phase_str: &str) -> Result<crate::WorkflowPhase, CompilerError> {
        match phase_str {
            "Observe" => Ok(crate::WorkflowPhase::Observe),
            "Think" => Ok(crate::WorkflowPhase::Think),
            "Plan" => Ok(crate::WorkflowPhase::Plan),
            "Build" => Ok(crate::WorkflowPhase::Build),
            "Execute" => Ok(crate::WorkflowPhase::Execute),
            "Verify" => Ok(crate::WorkflowPhase::Verify),
            "Learn" => Ok(crate::WorkflowPhase::Learn),
            _ => Err(CompilerError::ValidationError(format!(
                "Invalid workflow phase: {}",
                phase_str
            ))),
        }
    }

    fn validate_task_template_yaml(
        &self,
        template: &TaskTemplateDefinitionYaml,
    ) -> Result<(), CompilerError> {
        if template.id.is_empty() {
            return Err(CompilerError::ValidationError(
                "Task template ID cannot be empty".to_string(),
            ));
        }

        if template.name.is_empty() {
            return Err(CompilerError::ValidationError(
                "Task template name cannot be empty".to_string(),
            ));
        }

        if template.description.is_empty() {
            return Err(CompilerError::ValidationError(
                "Task template description cannot be empty".to_string(),
            ));
        }

        if !template.input_schema.is_object() {
            return Err(CompilerError::ValidationError(
                "Task template input_schema must be a JSON object".to_string(),
            ));
        }

        if !template.output_schema.is_object() {
            return Err(CompilerError::ValidationError(
                "Task template output_schema must be a JSON object".to_string(),
            ));
        }

        if let Some(schema) = &template.verification_schema {
            if !schema.is_object() {
                return Err(CompilerError::ValidationError(
                    "Task template verification_schema must be a JSON object".to_string(),
                ));
            }
        }

        Ok(())
    }

    fn build_tool_abi(&self, template: &TaskTemplateDefinitionYaml) -> ToolABI {
        let (cpu_millicores, memory_mb, max_execution_time_ms, requires_policy_approval) =
            if let Some(constraints) = &template.default_constraints {
                let cpu_millicores = constraints
                    .resource_limits
                    .as_ref()
                    .and_then(|limits| limits.cpu.as_deref())
                    .map(Self::parse_cpu_millicores)
                    .unwrap_or(0);
                let memory_mb = constraints
                    .resource_limits
                    .as_ref()
                    .and_then(|limits| limits.memory.as_deref())
                    .map(Self::parse_memory_mb)
                    .unwrap_or(0);
                let max_execution_time_ms = constraints
                    .time_budget
                    .map(|seconds| seconds.saturating_mul(1000))
                    .unwrap_or(0);
                let requires_policy_approval = constraints
                    .required_permissions
                    .as_ref()
                    .map(|perms| !perms.is_empty())
                    .unwrap_or(false);
                (
                    cpu_millicores,
                    memory_mb,
                    max_execution_time_ms,
                    requires_policy_approval,
                )
            } else {
                (0, 0, 0, false)
            };

        ToolABI {
            tool_id: template.id.clone(),
            name: template.name.clone(),
            description: template.description.clone(),
            input_schema: template.input_schema.clone(),
            output_schema: template.output_schema.clone(),
            has_side_effects: false,
            requires_policy_approval,
            max_execution_time_ms,
            resource_requirements: ResourceRequirements {
                cpu_millicores,
                memory_mb,
                storage_mb: 0,
            },
        }
    }

    fn build_verify_artifact(
        &self,
        template: &TaskTemplateDefinitionYaml,
        schema: &serde_json::Value,
    ) -> VerifyArtifact {
        let mut metadata = HashMap::new();
        metadata.insert(
            "task_template_id".to_string(),
            serde_json::json!(template.id),
        );

        VerifyArtifact {
            verify_id: format!("verify-{}", template.id),
            run_id: template.id.clone(),
            step_id: template.id.clone(),
            outputs_hash: Self::hash_json_value(schema),
            results: VerificationResults {
                passed: true,
                details: schema.clone(),
                confidence: 1.0,
                issues: Vec::new(),
            },
            timestamp: 0,
            verified_by: "compiler".to_string(),
            metadata,
        }
    }

    fn parse_cpu_millicores(value: &str) -> u32 {
        let trimmed = value.trim();
        if let Some(stripped) = trimmed.strip_suffix('m') {
            stripped.parse::<u32>().unwrap_or(0)
        } else if let Ok(cores) = trimmed.parse::<f64>() {
            (cores * 1000.0) as u32
        } else {
            0
        }
    }

    fn parse_memory_mb(value: &str) -> u32 {
        let trimmed = value.trim();
        if let Some(stripped) = trimmed.strip_suffix("Mi") {
            stripped.parse::<u32>().unwrap_or(0)
        } else if let Some(stripped) = trimmed.strip_suffix("Gi") {
            stripped
                .parse::<u32>()
                .map(|g| g.saturating_mul(1024))
                .unwrap_or(0)
        } else if let Some(stripped) = trimmed.strip_suffix('M') {
            stripped.parse::<u32>().unwrap_or(0)
        } else if let Some(stripped) = trimmed.strip_suffix('G') {
            stripped
                .parse::<u32>()
                .map(|g| g.saturating_mul(1024))
                .unwrap_or(0)
        } else {
            trimmed.parse::<u32>().unwrap_or(0)
        }
    }

    fn hash_json_value(value: &serde_json::Value) -> String {
        let serialized = serde_json::to_string(value).unwrap_or_default();
        format!("{:x}", Sha256::digest(serialized.as_bytes()))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CompilerError {
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Reference error: {0}")]
    ReferenceError(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compile_simple_workflow() {
        let yaml_content = r#"
version: "1.0"
workflow:
  id: "test-workflow"
  name: "Test Workflow"
  description: "A test workflow"
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

        let compiler = YamlCompiler;
        let result = compiler.compile_workflow(yaml_content);

        assert!(result.is_ok());
        let workflow_def = result.unwrap();

        assert_eq!(workflow_def.workflow_id, "test-workflow");
        assert_eq!(workflow_def.nodes.len(), 1);
        assert_eq!(workflow_def.phases_used.len(), 3);
    }

    #[test]
    fn test_compile_workflow_with_dependencies() {
        let yaml_content = r#"
version: "1.0"
workflow:
  id: "test-workflow-deps"
  name: "Test Workflow with Dependencies"
  description: "A test workflow with dependencies"
  version: "1.0.0"
  tenant_id: "tenant-123"
  required_tiers:
    - "T0"
  success_criteria: "All tasks completed successfully"
  failure_modes:
    - "Any task fails"
  phases:
    - "Observe"
    - "Think"
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
    - id: "task-2"
      name: "Second Task"
      phase: "Think"
      persona: "analyst"
      description: "Second task in workflow"
      instructions: "Analyze the observation"
      inputs: ["observation_result"]
      outputs: ["analysis_result"]
      tools: ["analysis_tool"]
  dependencies:
    - from: "task-1"
      to: "task-2"
      condition: "observation_result.length > 0"
"#;

        let compiler = YamlCompiler;
        let result = compiler.compile_workflow(yaml_content);

        assert!(result.is_ok());
        let workflow_def = result.unwrap();

        assert_eq!(workflow_def.workflow_id, "test-workflow-deps");
        assert_eq!(workflow_def.nodes.len(), 2);
        assert_eq!(workflow_def.edges.len(), 1);
        assert_eq!(workflow_def.edges[0].from, "task-1");
        assert_eq!(workflow_def.edges[0].to, "task-2");
    }

    #[test]
    fn test_compile_invalid_phase() {
        let yaml_content = r#"
version: "1.0"
workflow:
  id: "invalid-phase-workflow"
  name: "Invalid Phase Workflow"
  description: "A workflow with invalid phase"
  version: "1.0.0"
  tenant_id: "tenant-123"
  required_tiers:
    - "T0"
  success_criteria: "All tasks completed successfully"
  failure_modes:
    - "Any task fails"
  phases:
    - "InvalidPhase"
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

        let compiler = YamlCompiler;
        let result = compiler.compile_workflow(yaml_content);

        assert!(result.is_err());
        match result.unwrap_err() {
            CompilerError::ValidationError(msg) => {
                assert!(msg.contains("Invalid workflow phase"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[test]
    fn test_compile_workflow_contracts() {
        let yaml_content = r#"
version: "1.0"
workflow:
  id: "kernel-workflow"
  name: "Kernel Workflow"
  description: "Workflow for kernel contract compilation"
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

        let compiler = YamlCompiler;
        let context = KernelCompilationContext::default();
        let contracts = compiler
            .compile_workflow_contracts(yaml_content, context)
            .unwrap();

        assert_eq!(contracts.workflow_definition.workflow_id, "kernel-workflow");
        assert_eq!(contracts.run_model.run_id, "kernel-workflow");
        assert_eq!(contracts.run_model.session_id, "compiled");
        assert_eq!(contracts.run_model.created_by, "compiler");
        assert_eq!(
            contracts.compilation_event.event_id,
            "compile-kernel-workflow"
        );
    }

    #[test]
    fn test_compile_task_template_contracts() {
        let yaml_content = r#"
version: "1.0"
task_templates:
  - id: "task-template-1"
    name: "Task Template"
    description: "A task template for kernel compilation"
    default_constraints:
      time_budget: 5
      resource_limits:
        cpu: "250m"
        memory: "128Mi"
      required_permissions: ["perm_t0_read"]
    input_schema:
      type: "object"
    output_schema:
      type: "object"
    verification_schema:
      type: "object"
"#;

        let compiler = YamlCompiler;
        let compiled = compiler
            .compile_task_template_contracts(yaml_content)
            .unwrap();

        assert_eq!(compiled.len(), 1);
        let tool_abi = &compiled[0].tool_abi;
        assert_eq!(tool_abi.tool_id, "task-template-1");
        assert_eq!(tool_abi.max_execution_time_ms, 5000);
        assert_eq!(tool_abi.resource_requirements.cpu_millicores, 250);
        assert_eq!(tool_abi.resource_requirements.memory_mb, 128);
        assert!(compiled[0].verify_artifact.is_some());
    }
}
