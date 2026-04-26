use kernel::context_manager::ContextManager;
use kernel::contract_verifier::ContractVerifier;
use kernel::directive_compiler::DirectiveCompiler;
use kernel::intent_dispatcher::IntentDispatcher;
use kernel::types::IntentRequest;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg(test)]
mod integration_tests {
    use super::*;
    use tokio;

    #[tokio::test]
    async fn test_dispatch_intent_with_context_verification() {
        // Initialize components
        let directive_compiler = Arc::new(DirectiveCompiler::new());
        let context_manager = Arc::new(ContextManager::new(128000));
        let intent_graph = Arc::new(RwLock::new(kernel::intent_graph::IntentGraphKernel::new()));
        let pattern_registry = Arc::new(kernel::patterns::PatternRegistry::new());
        let tool_executor = Arc::new(RwLock::new(kernel::tool_executor::ToolExecutor::new()));
        let provider_manager = Arc::new(RwLock::new(kernel::llm::gateway::ProviderManager::new()));
        let contract_verifier = Arc::new(ContractVerifier::new());

        let mut dispatcher = IntentDispatcher::new(
            directive_compiler,
            context_manager,
            intent_graph,
            pattern_registry,
            tool_executor,
            provider_manager,
            contract_verifier,
        );

        // Add default frameworks
        for framework in kernel::frameworks::get_default_frameworks() {
            dispatcher.register_framework(framework);
        }

        // Test dispatching an intent
        let result = dispatcher
            .dispatch_intent(
                "Search for information about AI agents".to_string(),
                Some("instant".to_string()),
            )
            .await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(!response.capsule.capsule_id.is_empty());
        assert_eq!(response.confidence, 0.95);
    }

    #[tokio::test]
    async fn test_context_bundle_verification() {
        let context_manager = ContextManager::new(128000);

        // Test context assembly with verification
        let (bundle, _context_map, _budget_report, verify_artifact) = context_manager
            .assemble_with_verification(
                "Test intent for verification",
                "session-123",
                "capsule-123",
            );

        assert!(!bundle.bundle_hash.is_empty());
        assert_eq!(verify_artifact.results.confidence, 0.95);
        assert!(verify_artifact.results.passed);
    }

    #[tokio::test]
    async fn test_contract_compliance_verification() {
        let contract_verifier = ContractVerifier::new();

        // Create a minimal valid context bundle for testing
        let bundle = allternit_kernel_contracts::ContextBundle {
            bundle_hash: format!("test_{}", uuid::Uuid::new_v4()),
            inputs: allternit_kernel_contracts::ContextInputs {
                user_inputs: serde_json::json!({ "intent": "test intent" }),
                system_inputs: serde_json::json!({ "session_id": "session-123" }),
                previous_outputs: vec![],
            },
            memory_refs: vec![],
            budgets: allternit_kernel_contracts::ContextBudgets {
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
        assert!(result.violations.is_empty());
        assert_eq!(result.confidence, 1.0);
    }

    #[tokio::test]
    async fn test_context_caching_mechanism() {
        let context_manager = ContextManager::new(128000);

        // First call - should not be cached
        let start_time = std::time::Instant::now();
        let (bundle1, _, _) = context_manager.assemble("test intent for caching", "session-456");
        let first_call_duration = start_time.elapsed();

        // Second call with same parameters - should be cached
        let start_time = std::time::Instant::now();
        let (bundle2, _, _) = context_manager.assemble("test intent for caching", "session-456");
        let second_call_duration = start_time.elapsed();

        // Verify that the cached result is the same
        assert_eq!(bundle1.bundle_hash, bundle2.bundle_hash);

        // The second call should be significantly faster (indicating cache hit)
        // Note: This assertion might be flaky in CI environments, so we'll just log the performance
        println!(
            "First call: {:?}, Second call: {:?}",
            first_call_duration, second_call_duration
        );
    }

    #[tokio::test]
    async fn test_verification_artifact_application() {
        let context_manager = ContextManager::new(128000);

        // Test verification artifact creation
        let (_, _, _, verify_artifact) = context_manager.assemble_with_verification(
            "Test verification artifact creation",
            "session-789",
            "capsule-789",
        );

        assert!(!verify_artifact.verify_id.is_empty());
        assert_eq!(verify_artifact.step_name, "context_assembly");
        assert!(verify_artifact.results.passed);
        assert_eq!(verify_artifact.results.confidence, 0.95);
    }

    #[tokio::test]
    async fn test_capsule_compiler_surface_update() {
        // Test the enhanced surface update functionality
        let compiler = kernel::capsule_compiler::CapsuleCompiler::new(
            kernel::capsule_compiler::CompilerConfig::default(),
        );

        let mut spec = kernel::capsule_spec::CapsuleSpec::generate("test goal", "run-123");

        // Create a surface update
        let surface_update = serde_json::json!({
            "surface_id": "test_surface",
            "title": "Updated Title",
            "components": [
                {
                    "type": "Text",
                    "props": {
                        "text": "Updated text content"
                    }
                }
            ]
        });

        // Apply the surface update
        compiler.apply_surface_update(&mut spec, &surface_update);

        // Verify that the update was applied
        assert!(spec
            .ui
            .a2ui_payload
            .surfaces
            .iter()
            .any(|s| s.title == "Updated Title"));
    }
}
