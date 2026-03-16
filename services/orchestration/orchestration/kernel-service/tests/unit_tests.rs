#[cfg(test)]
mod context_manager_tests {
    use super::*;
    use crate::context_manager::{ContextManager, ContextManagerMetricsSnapshot};

    #[test]
    fn test_context_manager_creation() {
        let context_manager = ContextManager::new(1024);
        assert_eq!(context_manager.max_tokens, 1024);
    }

    #[test]
    fn test_context_assembly_basic() {
        let context_manager = ContextManager::new(128000);
        let (bundle, _context_map, _budget_report) =
            context_manager.assemble("test intent", "session-123");

        assert!(!bundle.bundle_hash.is_empty());
        assert_eq!(bundle.inputs.user_inputs["intent"], "test intent");
    }

    #[test]
    fn test_context_assembly_with_verification() {
        let context_manager = ContextManager::new(128000);
        let (bundle, _context_map, _budget_report, verify_artifact) =
            context_manager.assemble_with_verification("test intent", "session-123", "capsule-123");

        assert!(!bundle.bundle_hash.is_empty());
        assert!(!verify_artifact.verify_id.is_empty());
        assert!(verify_artifact.results.passed);
    }

    #[test]
    fn test_context_bundle_validation() {
        let context_manager = ContextManager::new(128000);
        let (bundle, _context_map, _budget_report) =
            context_manager.assemble("test intent", "session-123");

        let validation_result = context_manager.validate_bundle_integrity(&bundle);
        assert!(validation_result.is_valid);
    }

    #[test]
    fn test_context_redaction() {
        let context_manager = ContextManager::new(128000);

        let test_content = "Contact John Doe at john.doe@example.com or call 555-123-4567";
        let redactions = vec![a2rchitech_kernel_contracts::Redaction {
            redaction_type: "PII".to_string(),
            target: "email".to_string(),
            reason: "Privacy protection".to_string(),
        }];

        let redacted_content = context_manager.apply_redactions(test_content, &redactions);
        assert!(redacted_content.contains("[EMAIL_REDACTED]"));
    }
}

#[cfg(test)]
mod contract_verifier_tests {
    use super::*;
    use crate::contract_verifier::{ContractComplianceResult, ContractVerifier, ViolationSeverity};

    #[test]
    fn test_contract_verifier_creation() {
        let contract_verifier = ContractVerifier::new();
        // Just verify it can be created
        assert!(true); // Placeholder assertion
    }

    #[test]
    fn test_context_bundle_verification() {
        let contract_verifier = ContractVerifier::new();

        // Create a valid context bundle
        let bundle = a2rchitech_kernel_contracts::ContextBundle {
            bundle_hash: format!("test_{}", uuid::Uuid::new_v4()),
            inputs: a2rchitech_kernel_contracts::ContextInputs {
                user_inputs: serde_json::json!({ "intent": "test intent" }),
                system_inputs: serde_json::json!({ "session_id": "session-123" }),
                previous_outputs: vec![],
            },
            memory_refs: vec![],
            budgets: a2rchitech_kernel_contracts::ContextBudgets {
                max_tokens: Some(1000),
                max_execution_time_ms: Some(5000),
                max_tool_calls: Some(10),
                max_memory_refs: Some(5),
            },
            redactions: vec![],
            timestamp: chrono::Utc::now().timestamp() as u64,
            metadata: std::collections::HashMap::new(),
        };

        let result = contract_verifier.verify_context_bundle(&bundle);
        assert!(result.is_compliant);
        assert_eq!(result.confidence, 1.0);
    }

    #[test]
    fn test_context_bundle_verification_invalid() {
        let contract_verifier = ContractVerifier::new();

        // Create an invalid context bundle (empty hash)
        let bundle = a2rchitech_kernel_contracts::ContextBundle {
            bundle_hash: "".to_string(), // Invalid - empty hash
            inputs: a2rchitech_kernel_contracts::ContextInputs {
                user_inputs: serde_json::json!({ "intent": "test intent" }),
                system_inputs: serde_json::json!({ "session_id": "session-123" }),
                previous_outputs: vec![],
            },
            memory_refs: vec![],
            budgets: a2rchitech_kernel_contracts::ContextBudgets {
                max_tokens: Some(1000),
                max_execution_time_ms: Some(5000),
                max_tool_calls: Some(10),
                max_memory_refs: Some(5),
            },
            redactions: vec![],
            timestamp: chrono::Utc::now().timestamp() as u64,
            metadata: std::collections::HashMap::new(),
        };

        let result = contract_verifier.verify_context_bundle(&bundle);
        assert!(!result.is_compliant);
        assert!(!result.violations.is_empty());
        assert_eq!(result.confidence, 0.5);
    }

    #[test]
    fn test_event_envelope_verification() {
        let contract_verifier = ContractVerifier::new();

        // Create a valid event envelope
        let envelope = a2rchitech_kernel_contracts::EventEnvelope {
            event_id: uuid::Uuid::new_v4().to_string(),
            event_type: "test_event".to_string(),
            session_id: "session-123".to_string(),
            tenant_id: "tenant-123".to_string(),
            actor_id: "actor-123".to_string(),
            role: "user".to_string(),
            timestamp: chrono::Utc::now().timestamp() as u64,
            payload: serde_json::json!({ "test": "data" }),
            parent_ids: vec![],
            root_id: None,
        };

        let result = contract_verifier.verify_event_envelope(&envelope);
        assert!(result.is_compliant);
        assert_eq!(result.confidence, 1.0);
    }

    #[test]
    fn test_run_model_verification() {
        let contract_verifier = ContractVerifier::new();

        // Create a valid run model
        let run_model = a2rchitech_kernel_contracts::RunModel {
            run_id: uuid::Uuid::new_v4().to_string(),
            tenant_id: "tenant-123".to_string(),
            session_id: "session-123".to_string(),
            created_by: "user-123".to_string(),
            created_at: chrono::Utc::now().timestamp() as u64,
            updated_at: chrono::Utc::now().timestamp() as u64,
            completed_at: None,
            status: a2rchitech_kernel_contracts::RunState::Created,
            error_message: None,
            metadata: std::collections::HashMap::new(),
        };

        let result = contract_verifier.verify_run_model(&run_model);
        assert!(result.is_compliant);
        assert_eq!(result.confidence, 1.0);
    }

    #[test]
    fn test_verify_artifact_verification() {
        let contract_verifier = ContractVerifier::new();

        // Create a valid verify artifact
        let verify_artifact = a2rchitech_kernel_contracts::VerifyArtifact::new(
            uuid::Uuid::new_v4().to_string(),
            "test_step".to_string(),
            format!("hash_{}", uuid::Uuid::new_v4()),
            a2rchitech_kernel_contracts::VerificationResults {
                passed: true,
                details: serde_json::json!({ "test": "result" }),
                confidence: 0.95,
                issues: vec![],
            },
            "test_verifier".to_string(),
        );

        let result = contract_verifier.verify_verify_artifact(&verify_artifact);
        assert!(result.is_compliant);
        assert_eq!(result.confidence, 1.0);
    }
}

#[cfg(test)]
mod capsule_compiler_tests {
    use super::*;
    use crate::capsule_compiler::CapsuleCompiler;

    #[test]
    fn test_capsule_compiler_creation() {
        let config = kernel::capsule_compiler::CompilerConfig::default();
        let compiler = CapsuleCompiler::new(config);
        // Just verify it can be created
        assert!(true); // Placeholder assertion
    }

    #[test]
    fn test_surface_update_with_merge() {
        let config = kernel::capsule_compiler::CompilerConfig::default();
        let compiler = CapsuleCompiler::new(config);

        // Create a basic capsule spec
        let mut spec = kernel::capsule_spec::CapsuleSpec::generate("test goal", "run-123");

        // Create a surface update
        let update = serde_json::json!({
            "surface_id": &spec.ui.a2ui_payload.surfaces.first().map(|s| s.surface_id.clone()).unwrap_or("default".to_string()),
            "title": "Updated Title",
            "components": [
                {
                    "type": "Text",
                    "props": {
                        "text": "New component"
                    }
                }
            ]
        });

        // Apply the surface update
        compiler.apply_surface_update(&mut spec, &update);

        // Verify that the update was applied
        if let Some(surface) = spec.ui.a2ui_payload.surfaces.first() {
            assert_eq!(surface.title, "Updated Title");
        }
    }

    #[test]
    fn test_json_merge_functionality() {
        let config = kernel::capsule_compiler::CompilerConfig::default();
        let compiler = CapsuleCompiler::new(config);

        let mut target = serde_json::json!({
            "existing": "value",
            "nested": {
                "keep": "this",
                "update": "old"
            }
        });

        let source = serde_json::json!({
            "nested": {
                "update": "new",
                "add": "value"
            },
            "new": "value"
        });

        // Use the internal merge function indirectly by testing surface updates
        let update = serde_json::json!({
            "data_model": source
        });

        // Create a temporary spec to test the merge
        let mut spec = kernel::capsule_spec::CapsuleSpec::generate("test", "run");
        spec.ui.a2ui_payload.data_model = target;

        compiler.apply_surface_update(&mut spec, &update);

        // The data model should now contain merged values
        assert_eq!(spec.ui.a2ui_payload.data_model["existing"], "value");
        assert_eq!(spec.ui.a2ui_payload.data_model["new"], "value");
        assert_eq!(spec.ui.a2ui_payload.data_model["nested"]["update"], "new");
    }
}
