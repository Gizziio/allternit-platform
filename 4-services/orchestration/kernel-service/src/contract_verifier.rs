use a2rchitech_kernel_contracts;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug)]
pub struct ContractComplianceResult {
    pub is_compliant: bool,
    pub violations: Vec<ContractViolation>,
    pub confidence: f64,
}

#[derive(Debug, Clone)]
pub struct ContractViolation {
    pub contract_id: String,
    pub element: String,
    pub severity: ViolationSeverity,
    pub description: String,
}

#[derive(Debug, Clone)]
pub enum ViolationSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug)]
pub struct ContractVerifier;

impl ContractVerifier {
    pub fn new() -> Self {
        Self {}
    }

    /// Verify that a ContextBundle complies with the kernel contract specification
    pub fn verify_context_bundle(
        &self,
        bundle: &a2rchitech_kernel_contracts::ContextBundle,
    ) -> ContractComplianceResult {
        let mut violations = Vec::new();

        // Verify bundle hash is not empty
        if bundle.bundle_hash.is_empty() {
            violations.push(ContractViolation {
                contract_id: "CONTEXT_BUNDLE_SPEC".to_string(),
                element: "bundle_hash".to_string(),
                severity: ViolationSeverity::Error,
                description: "Bundle hash cannot be empty".to_string(),
            });
        }

        // Verify inputs are not completely empty
        if bundle.inputs.user_inputs.is_null()
            && bundle.inputs.system_inputs.is_null()
            && bundle.inputs.previous_outputs.is_empty()
        {
            violations.push(ContractViolation {
                contract_id: "CONTEXT_BUNDLE_SPEC".to_string(),
                element: "inputs".to_string(),
                severity: ViolationSeverity::Warning,
                description: "Context bundle has no meaningful inputs".to_string(),
            });
        }

        // Verify timestamp is reasonable (not too far in the future)
        let current_time = chrono::Utc::now().timestamp() as u64;
        if bundle.timestamp > current_time + 86400 {
            // More than 1 day in the future
            violations.push(ContractViolation {
                contract_id: "CONTEXT_BUNDLE_SPEC".to_string(),
                element: "timestamp".to_string(),
                severity: ViolationSeverity::Error,
                description: "Timestamp is more than 1 day in the future".to_string(),
            });
        }

        // Verify memory references are reasonable
        if bundle.memory_refs.len() > 100 {
            violations.push(ContractViolation {
                contract_id: "CONTEXT_BUNDLE_SPEC".to_string(),
                element: "memory_refs".to_string(),
                severity: ViolationSeverity::Warning,
                description: "Too many memory references (>100)".to_string(),
            });
        }

        // Verify budgets are within reasonable bounds
        if let Some(max_tokens) = bundle.budgets.max_tokens {
            if max_tokens > 1_000_000 {
                // 1M tokens is likely too much for a single context
                violations.push(ContractViolation {
                    contract_id: "CONTEXT_BUNDLE_SPEC".to_string(),
                    element: "budgets.max_tokens".to_string(),
                    severity: ViolationSeverity::Warning,
                    description: "Max tokens budget is extremely high (>1M)".to_string(),
                });
            }
        }

        ContractComplianceResult {
            is_compliant: violations.is_empty(),
            violations: violations.clone(),
            confidence: if violations.is_empty() { 1.0 } else { 0.5 }, // Simplified confidence calculation
        }
    }

    /// Verify that an EventEnvelope complies with the kernel contract specification
    pub fn verify_event_envelope(
        &self,
        envelope: &a2rchitech_kernel_contracts::EventEnvelope,
    ) -> ContractComplianceResult {
        let mut violations = Vec::new();

        // Verify required fields are present
        if envelope.event_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "EVENT_ENVELOPE_SPEC".to_string(),
                element: "event_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Event ID cannot be empty".to_string(),
            });
        }

        if envelope.event_type.is_empty() {
            violations.push(ContractViolation {
                contract_id: "EVENT_ENVELOPE_SPEC".to_string(),
                element: "event_type".to_string(),
                severity: ViolationSeverity::Error,
                description: "Event type cannot be empty".to_string(),
            });
        }

        if envelope.session_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "EVENT_ENVELOPE_SPEC".to_string(),
                element: "session_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Session ID cannot be empty".to_string(),
            });
        }

        if envelope.tenant_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "EVENT_ENVELOPE_SPEC".to_string(),
                element: "tenant_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Tenant ID cannot be empty".to_string(),
            });
        }

        if envelope.actor_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "EVENT_ENVELOPE_SPEC".to_string(),
                element: "actor_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Actor ID cannot be empty".to_string(),
            });
        }

        if envelope.role.is_empty() {
            violations.push(ContractViolation {
                contract_id: "EVENT_ENVELOPE_SPEC".to_string(),
                element: "role".to_string(),
                severity: ViolationSeverity::Error,
                description: "Role cannot be empty".to_string(),
            });
        }

        // Verify timestamp is reasonable
        let current_time = chrono::Utc::now().timestamp();
        if envelope.timestamp as i64 > current_time + 3600 {
            // More than 1 hour in the future
            violations.push(ContractViolation {
                contract_id: "EVENT_ENVELOPE_SPEC".to_string(),
                element: "timestamp".to_string(),
                severity: ViolationSeverity::Error,
                description: "Timestamp is more than 1 hour in the future".to_string(),
            });
        }

        ContractComplianceResult {
            is_compliant: violations.is_empty(),
            violations: violations.clone(),
            confidence: if violations.is_empty() { 1.0 } else { 0.5 }, // Simplified confidence calculation
        }
    }

    /// Verify that a RunModel complies with the kernel contract specification
    pub fn verify_run_model(
        &self,
        run_model: &a2rchitech_kernel_contracts::RunModel,
    ) -> ContractComplianceResult {
        let mut violations = Vec::new();

        // Verify required fields are present
        if run_model.run_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "RUN_MODEL_SPEC".to_string(),
                element: "run_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Run ID cannot be empty".to_string(),
            });
        }

        if run_model.tenant_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "RUN_MODEL_SPEC".to_string(),
                element: "tenant_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Tenant ID cannot be empty".to_string(),
            });
        }

        if run_model.session_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "RUN_MODEL_SPEC".to_string(),
                element: "session_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Session ID cannot be empty".to_string(),
            });
        }

        if run_model.created_by.is_empty() {
            violations.push(ContractViolation {
                contract_id: "RUN_MODEL_SPEC".to_string(),
                element: "created_by".to_string(),
                severity: ViolationSeverity::Error,
                description: "Created by cannot be empty".to_string(),
            });
        }

        // Verify timestamps are reasonable
        if run_model.created_at > run_model.updated_at {
            violations.push(ContractViolation {
                contract_id: "RUN_MODEL_SPEC".to_string(),
                element: "timestamps".to_string(),
                severity: ViolationSeverity::Error,
                description: "Created timestamp is after updated timestamp".to_string(),
            });
        }

        if let Some(completed_at) = run_model.completed_at {
            if completed_at < run_model.created_at {
                violations.push(ContractViolation {
                    contract_id: "RUN_MODEL_SPEC".to_string(),
                    element: "completion_timestamp".to_string(),
                    severity: ViolationSeverity::Error,
                    description: "Completion timestamp is before creation timestamp".to_string(),
                });
            }
        }

        ContractComplianceResult {
            is_compliant: violations.is_empty(),
            violations: violations.clone(),
            confidence: if violations.is_empty() { 1.0 } else { 0.5 }, // Simplified confidence calculation
        }
    }

    /// Verify that a VerifyArtifact complies with the kernel contract specification
    pub fn verify_verify_artifact(
        &self,
        artifact: &a2rchitech_kernel_contracts::VerifyArtifact,
    ) -> ContractComplianceResult {
        let mut violations = Vec::new();

        // Verify required fields are present
        if artifact.verify_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "VERIFY_ARTIFACT_SPEC".to_string(),
                element: "verify_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Verify ID cannot be empty".to_string(),
            });
        }

        if artifact.run_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "VERIFY_ARTIFACT_SPEC".to_string(),
                element: "run_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Run ID cannot be empty".to_string(),
            });
        }

        if artifact.step_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "VERIFY_ARTIFACT_SPEC".to_string(),
                element: "step_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Step ID cannot be empty".to_string(),
            });
        }

        if artifact.outputs_hash.is_empty() {
            violations.push(ContractViolation {
                contract_id: "VERIFY_ARTIFACT_SPEC".to_string(),
                element: "outputs_hash".to_string(),
                severity: ViolationSeverity::Error,
                description: "Outputs hash cannot be empty".to_string(),
            });
        }

        if artifact.verified_by.is_empty() {
            violations.push(ContractViolation {
                contract_id: "VERIFY_ARTIFACT_SPEC".to_string(),
                element: "verified_by".to_string(),
                severity: ViolationSeverity::Error,
                description: "Verified by cannot be empty".to_string(),
            });
        }

        // Verify results are valid
        if artifact.results.confidence < 0.0 || artifact.results.confidence > 1.0 {
            violations.push(ContractViolation {
                contract_id: "VERIFY_ARTIFACT_SPEC".to_string(),
                element: "results.confidence".to_string(),
                severity: ViolationSeverity::Error,
                description: "Confidence must be between 0.0 and 1.0".to_string(),
            });
        }

        ContractComplianceResult {
            is_compliant: violations.is_empty(),
            violations: violations.clone(),
            confidence: if violations.is_empty() { 1.0 } else { 0.5 }, // Simplified confidence calculation
        }
    }

    /// Verify that a ToolABI complies with the kernel contract specification
    pub fn verify_tool_abi(
        &self,
        tool_abi: &a2rchitech_kernel_contracts::ToolABI,
    ) -> ContractComplianceResult {
        let mut violations = Vec::new();

        // Verify required fields are present
        if tool_abi.tool_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "TOOL_ABI_SPEC".to_string(),
                element: "tool_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Tool ID cannot be empty".to_string(),
            });
        }

        if tool_abi.name.is_empty() {
            violations.push(ContractViolation {
                contract_id: "TOOL_ABI_SPEC".to_string(),
                element: "name".to_string(),
                severity: ViolationSeverity::Error,
                description: "Tool name cannot be empty".to_string(),
            });
        }

        if tool_abi.description.is_empty() {
            violations.push(ContractViolation {
                contract_id: "TOOL_ABI_SPEC".to_string(),
                element: "description".to_string(),
                severity: ViolationSeverity::Error,
                description: "Tool description cannot be empty".to_string(),
            });
        }

        // Verify resource requirements are reasonable
        if tool_abi.resource_requirements.cpu_millicores == 0 {
            violations.push(ContractViolation {
                contract_id: "TOOL_ABI_SPEC".to_string(),
                element: "resource_requirements.cpu_millicores".to_string(),
                severity: ViolationSeverity::Warning,
                description: "CPU requirements should be greater than 0".to_string(),
            });
        }

        if tool_abi.resource_requirements.memory_mb == 0 {
            violations.push(ContractViolation {
                contract_id: "TOOL_ABI_SPEC".to_string(),
                element: "resource_requirements.memory_mb".to_string(),
                severity: ViolationSeverity::Warning,
                description: "Memory requirements should be greater than 0".to_string(),
            });
        }

        if tool_abi.resource_requirements.storage_mb == 0 {
            violations.push(ContractViolation {
                contract_id: "TOOL_ABI_SPEC".to_string(),
                element: "resource_requirements.storage_mb".to_string(),
                severity: ViolationSeverity::Warning,
                description: "Storage requirements should be greater than 0".to_string(),
            });
        }

        ContractComplianceResult {
            is_compliant: violations.is_empty(),
            violations: violations.clone(),
            confidence: if violations.is_empty() { 1.0 } else { 0.5 }, // Simplified confidence calculation
        }
    }

    /// Verify that a ToolRequest complies with the kernel contract specification
    pub fn verify_tool_request(
        &self,
        tool_request: &a2rchitech_kernel_contracts::ToolRequest,
        tool_abi: Option<&a2rchitech_kernel_contracts::ToolABI>,
    ) -> ContractComplianceResult {
        let mut violations = Vec::new();

        // Verify required fields are present
        if tool_request.tool_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "TOOL_REQUEST_SPEC".to_string(),
                element: "tool_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Tool ID cannot be empty".to_string(),
            });
        }

        if tool_request.session_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "TOOL_REQUEST_SPEC".to_string(),
                element: "session_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Session ID cannot be empty".to_string(),
            });
        }

        if tool_request.tenant_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "TOOL_REQUEST_SPEC".to_string(),
                element: "tenant_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Tenant ID cannot be empty".to_string(),
            });
        }

        if tool_request.actor_id.is_empty() {
            violations.push(ContractViolation {
                contract_id: "TOOL_REQUEST_SPEC".to_string(),
                element: "actor_id".to_string(),
                severity: ViolationSeverity::Error,
                description: "Actor ID cannot be empty".to_string(),
            });
        }

        // If we have the tool ABI, perform additional validation
        if let Some(abi) = tool_abi {
            // If the tool has side effects, idempotency key is required
            if abi.has_side_effects && tool_request.idempotency_key.is_none() {
                violations.push(ContractViolation {
                    contract_id: "TOOL_REQUEST_SPEC".to_string(),
                    element: "idempotency_key".to_string(),
                    severity: ViolationSeverity::Error,
                    description: "Idempotency key required for side-effect tools".to_string(),
                });
            }

            // Policy decision must allow the tool call
            if !tool_request.policy_decision.is_allowed() {
                violations.push(ContractViolation {
                    contract_id: "TOOL_REQUEST_SPEC".to_string(),
                    element: "policy_decision".to_string(),
                    severity: ViolationSeverity::Error,
                    description: "Policy decision does not allow tool call".to_string(),
                });
            }
        }

        ContractComplianceResult {
            is_compliant: violations.is_empty(),
            violations: violations.clone(),
            confidence: if violations.is_empty() { 1.0 } else { 0.5 }, // Simplified confidence calculation
        }
    }

    /// Run all contract compliance checks on provided kernel contract objects
    pub fn verify_contracts(
        &self,
        context_bundle: Option<&a2rchitech_kernel_contracts::ContextBundle>,
        event_envelope: Option<&a2rchitech_kernel_contracts::EventEnvelope>,
        run_model: Option<&a2rchitech_kernel_contracts::RunModel>,
        verify_artifact: Option<&a2rchitech_kernel_contracts::VerifyArtifact>,
        tool_abi: Option<&a2rchitech_kernel_contracts::ToolABI>,
        tool_request: Option<(
            &a2rchitech_kernel_contracts::ToolRequest,
            Option<&a2rchitech_kernel_contracts::ToolABI>,
        )>,
    ) -> HashMap<String, ContractComplianceResult> {
        let mut results = HashMap::new();

        if let Some(bundle) = context_bundle {
            results.insert(
                "context_bundle".to_string(),
                self.verify_context_bundle(bundle),
            );
        }

        if let Some(envelope) = event_envelope {
            results.insert(
                "event_envelope".to_string(),
                self.verify_event_envelope(envelope),
            );
        }

        if let Some(model) = run_model {
            results.insert("run_model".to_string(), self.verify_run_model(model));
        }

        if let Some(artifact) = verify_artifact {
            results.insert(
                "verify_artifact".to_string(),
                self.verify_verify_artifact(artifact),
            );
        }

        if let Some(abi) = tool_abi {
            results.insert("tool_abi".to_string(), self.verify_tool_abi(abi));
        }

        if let Some((request, maybe_abi)) = tool_request {
            results.insert(
                "tool_request".to_string(),
                self.verify_tool_request(request, maybe_abi),
            );
        }

        results
    }
}
