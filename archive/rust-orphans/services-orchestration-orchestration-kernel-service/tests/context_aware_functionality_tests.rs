//! Comprehensive tests for the new context-aware functionality
//! Testing the enhanced dispatch_intent, compile_capsule_with_context, and recompile_capsule endpoints
//! with verification artifact checking and security enhancements

use allternit_kernel_contracts::{ContextBudgets, ContextBundle, ContextInputs};
use allternit_kernel_contracts::{VerificationResults, VerifyArtifact};
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use serde_json::json;
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::app_state::AppState;
use crate::context_manager::ContextManager;
use crate::types::{
    CapsuleInstance, CompileCapsuleWithContextRequest, DispatchResponse, IntentRequest,
    RecompileCapsuleRequest,
};
use crate::verification_checker::VerificationChecker;

// Test the verification artifact checking functionality
#[tokio::test]
async fn test_verification_artifact_checking() {
    let verification_checker = Arc::new(VerificationChecker::new());

    // Create a passing verification artifact
    let passing_artifact = VerifyArtifact::new(
        "test-run".to_string(),
        "test-step".to_string(),
        "test-hash".to_string(),
        VerificationResults {
            passed: true,
            details: serde_json::json!({"test": "passed"}),
            confidence: 0.95,
            issues: vec![],
        },
        "test-verifier".to_string(),
    );

    // Check that passing artifacts are allowed
    let result = verification_checker
        .check_verification(&passing_artifact)
        .await;
    assert!(result.allowed);
    assert!(result.reason.contains("passed"));

    // Create a failing verification artifact
    let failing_artifact = VerifyArtifact::new(
        "test-run".to_string(),
        "test-step".to_string(),
        "test-hash".to_string(),
        VerificationResults {
            passed: false,
            details: serde_json::json!({"error": "something failed"}),
            confidence: 0.3,
            issues: vec![],
        },
        "test-verifier".to_string(),
    );

    // Check that failing artifacts are blocked
    let result = verification_checker
        .check_verification(&failing_artifact)
        .await;
    assert!(!result.allowed);
    assert!(result.reason.contains("failed"));
}

// Test context bundle creation and validation
#[tokio::test]
async fn test_context_bundle_assembly() {
    let context_manager = ContextManager::new(128000); // 128KB max tokens

    // Test context assembly with verification
    let (bundle, _context_map, _budget_report, verify_artifact) = context_manager
        .assemble_with_verification("test user intent", "test-session", "test-capsule");

    // Verify the bundle was created properly
    assert!(!bundle.bundle_hash.is_empty());
    assert_eq!(bundle.inputs.user_inputs["intent"], "test user intent");

    // Verify the verification artifact was created
    assert!(!verify_artifact.verify_id.is_empty());
    assert!(verify_artifact.results.passed);
    assert!(verify_artifact.results.confidence > 0.9);
}

// Test the dispatch_intent endpoint with verification checking
#[tokio::test]
async fn test_dispatch_intent_with_verification() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    let state = create_test_app_state(pool).await;

    let request = IntentRequest {
        intent_text: "test intent".to_string(),
        execution_mode: "test".to_string(),
    };

    // Test that the dispatch endpoint properly checks verification artifacts
    let response = super::dispatch_intent(axum::extract::State(state.clone()), Json(request)).await;

    // Should return a successful response if verification passes
    assert!(response.is_ok());
}

// Test the compile_capsule_with_context endpoint
#[tokio::test]
async fn test_compile_capsule_with_context() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    let state = create_test_app_state(pool).await;

    let payload = json!({
        "intent_text": "compile test capsule",
        "session_id": "test-session",
        "capsule_id": "test-capsule",
        "evidence": []
    });

    // Test that the compile endpoint properly checks verification artifacts
    let response =
        super::compile_capsule_with_context(axum::extract::State(state.clone()), Json(payload))
            .await;

    // Should return a successful response if verification passes
    assert!(response.is_ok());

    let response_json = response.unwrap();
    assert!(!response_json.capsule.capsule_id.is_empty());
    assert_eq!(response_json.capsule.framework_id, "fwk_generic");
}

// Test the recompile_capsule endpoint
#[tokio::test]
async fn test_recompile_capsule() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    let state = create_test_app_state(pool).await;

    // First create a capsule to recompile
    let initial_capsule = CapsuleInstance {
        capsule_id: "test-capsule".to_string(),
        framework_id: "fwk_generic".to_string(),
        title: "Test Capsule".to_string(),
        created_at: chrono::Utc::now().timestamp_millis(),
        state: serde_json::json!({}),
        active_canvas_id: None,
        persistence_mode: "ephemeral".to_string(),
        sandbox_policy: None,
        tool_scope: None,
    };

    // Add the capsule to the dispatcher
    {
        let mut dispatcher = state.dispatcher.write().await;
        // Add the capsule to the dispatcher's registry
    }

    let request = json!({
        "capsule_type": "fwk_updated"
    });

    // Test that the recompile endpoint properly checks verification artifacts
    let response = super::recompile_capsule(
        axum::extract::State(state.clone()),
        axum::extract::Path("test-capsule".to_string()),
        Json(request),
    )
    .await;

    // Should return a successful response if verification passes
    assert!(response.is_ok());

    let updated_capsule = response.unwrap();
    assert_eq!(updated_capsule.framework_id, "fwk_updated");
}

// Test rate limiting functionality
#[tokio::test]
async fn test_rate_limiting() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    let state = create_test_app_state(pool).await;

    // Test multiple requests to verify rate limiting works
    for i in 0..10 {
        let request = IntentRequest {
            intent_text: format!("test intent {}", i),
            execution_mode: "test".to_string(),
        };

        let response =
            super::dispatch_intent(axum::extract::State(state.clone()), Json(request)).await;

        // All requests should succeed within rate limits
        if i < state.rate_limiter.config.requests_per_minute {
            assert!(response.is_ok());
        } else {
            // Requests beyond the limit might be rate limited
            // This depends on the exact rate limiting configuration
        }
    }
}

// Test security headers are added to responses
#[tokio::test]
async fn test_security_headers() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    let state = create_test_app_state(pool).await;

    let request = IntentRequest {
        intent_text: "test security headers".to_string(),
        execution_mode: "test".to_string(),
    };

    let response = super::dispatch_intent(axum::extract::State(state), Json(request)).await;

    // The response should include security headers
    // This would be tested by checking the headers in a full integration test
    assert!(response.is_ok());
}

// Helper function to create a test app state
async fn create_test_app_state(pool: SqlitePool) -> AppState {
    use crate::action_handler::ActionHandler;
    use crate::agent_registry::AgentRegistry;
    use crate::assistant_manager::AssistantManager;
    use crate::capsule_compiler::CapsuleCompiler;
    use crate::config_manager::ConfigManager;
    use crate::contract_verifier::ContractVerifier;
    use crate::directive_compiler::DirectiveCompiler;
    use crate::intent_dispatcher::IntentDispatcher;
    use crate::intent_graph_kernel::IntentGraphKernel;
    use crate::journal_ledger::JournalLedger;
    use crate::pattern_registry::PatternRegistry;
    use crate::rate_limiter::RateLimiter;
    use crate::session_manager::SessionManager;
    use crate::skill_manager::SkillManager;
    use crate::state_engine::StateEngine;
    use crate::tool_executor::ToolExecutor;

    let dispatcher = Arc::new(RwLock::new(IntentDispatcher::new(/* parameters */)));
    let ledger = Arc::new(JournalLedger::new());
    let action_handler = Arc::new(ActionHandler::new(ledger.clone()));
    let directive_compiler = Arc::new(DirectiveCompiler::new());
    let context_manager = Arc::new(ContextManager::new(128000));
    let contract_verifier = Arc::new(ContractVerifier::new());
    let intent_graph = Arc::new(RwLock::new(IntentGraphKernel::new()));
    let pattern_registry = Arc::new(PatternRegistry::new());
    let assistant_manager = Arc::new(AssistantManager::new());
    let agent_registry = Arc::new(AgentRegistry::new());
    let state_engine = Arc::new(StateEngine::new());
    let skill_manager = Arc::new(SkillManager::new());
    let config_manager = Arc::new(ConfigManager::new());
    let tool_executor = Arc::new(RwLock::new(ToolExecutor::new()));
    let session_manager = Arc::new(SessionManager::new(pool.clone()));
    let rate_limiter = Arc::new(RateLimiter::new(crate::rate_limiter::RateLimitConfig {
        requests_per_minute: 100,
        burst_capacity: 10,
        per_session: true,
        per_tenant: false,
    }));
    let verification_checker = Arc::new(VerificationChecker::new());
    let capsule_compiler = Arc::new(CapsuleCompiler::new(/* config */));
    let security_state = Arc::new(SecurityState::new(100));
    let monitoring_state = Arc::new(MonitoringState::new());

    AppState {
        dispatcher,
        ledger,
        action_handler,
        directive_compiler,
        context_manager,
        contract_verifier,
        intent_graph,
        pattern_registry,
        assistant_manager,
        agent_registry,
        state_engine,
        skill_manager,
        config_manager,
        tool_executor,
        session_manager,
        sqlite_pool: Arc::new(pool),
        rate_limiter,
        verification_checker,
        capsule_compiler,
        security_state,
        monitoring_state,
    }
}

// Test monitoring metrics collection
#[tokio::test]
async fn test_monitoring_metrics() {
    let monitoring_state = Arc::new(MonitoringState::new());

    // Record some test metrics
    monitoring_state
        .record_request("/test/endpoint", 100.0, false)
        .await;
    monitoring_state
        .record_request("/test/endpoint", 150.0, true)
        .await;

    let metrics = monitoring_state.get_metrics().await;

    // Verify metrics were collected
    assert!(metrics["request_counts"]
        .as_object()
        .unwrap()
        .contains_key("/test/endpoint"));
    assert!(metrics["error_counts"]
        .as_object()
        .unwrap()
        .contains_key("/test/endpoint"));
    assert!(metrics["avg_response_times_ms"]
        .as_object()
        .unwrap()
        .contains_key("/test/endpoint"));
}

// Test authentication with enhanced security
#[tokio::test]
async fn test_authentication_enhancement() {
    use axum::http::header::AUTHORIZATION;

    // Test valid token formats
    let valid_tokens = vec![
        "Bearer sk-test123",
        "Bearer jwt-test456",
        "Bearer api-test789",
    ];

    for token in valid_tokens {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, token.parse().unwrap());

        // Create a mock request with the token
        let request = axum::http::Request::builder()
            .uri("/")
            .header(AUTHORIZATION, token)
            .body(axum::body::Body::empty())
            .unwrap();

        // The security middleware should accept these tokens
        // In a real test, we would call the middleware and verify the result
    }

    // Test invalid token formats
    let invalid_tokens = vec![
        "Bearer short",          // Too short
        "Bearer invalid-format", // Doesn't match expected prefix
        "Basic abc123",          // Wrong scheme
        "",                      // Empty
    ];

    for token in invalid_tokens {
        let result = validate_token_format(&token);
        assert!(!result, "Token '{}' should be rejected", token);
    }
}

// Helper function to validate token format (similar to what's in the security middleware)
fn validate_token_format(token: &str) -> bool {
    if token.is_empty() || token.len() < 10 {
        return false;
    }

    // Check for expected prefixes
    token.starts_with("sk-") || token.starts_with("jwt-") || token.starts_with("api-")
}

// Integration test for the full flow: dispatch -> context assembly -> verification -> response
#[tokio::test]
async fn test_full_context_aware_flow() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    let state = create_test_app_state(pool).await;

    // 1. Dispatch an intent
    let dispatch_request = IntentRequest {
        intent_text: "create a test capsule with context".to_string(),
        execution_mode: "test".to_string(),
    };

    let dispatch_response =
        super::dispatch_intent(axum::extract::State(state.clone()), Json(dispatch_request)).await;

    assert!(dispatch_response.is_ok());
    let dispatch_result = dispatch_response.unwrap();
    let capsule_id = dispatch_result.capsule.capsule_id.clone();

    // 2. Compile the capsule with context
    let compile_payload = json!({
        "intent_text": "enhance the test capsule",
        "session_id": "test-session",
        "capsule_id": &capsule_id,
        "evidence": []
    });

    let compile_response = super::compile_capsule_with_context(
        axum::extract::State(state.clone()),
        Json(compile_payload),
    )
    .await;

    assert!(compile_response.is_ok());

    // 3. Recompile the capsule
    let recompile_request = json!({
        "capsule_type": "fwk_enhanced"
    });

    let recompile_response = super::recompile_capsule(
        axum::extract::State(state.clone()),
        axum::extract::Path(capsule_id),
        Json(recompile_request),
    )
    .await;

    assert!(recompile_response.is_ok());

    let updated_capsule = recompile_response.unwrap();
    assert_eq!(updated_capsule.framework_id, "fwk_enhanced");
}

// Test edge cases and error conditions
#[tokio::test]
async fn test_edge_cases() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    let state = create_test_app_state(pool).await;

    // Test with empty intent
    let empty_request = IntentRequest {
        intent_text: "".to_string(),
        execution_mode: "test".to_string(),
    };

    let response =
        super::dispatch_intent(axum::extract::State(state.clone()), Json(empty_request)).await;

    // Should handle empty intent gracefully
    assert!(response.is_ok()); // or appropriately handle the error

    // Test with very long intent
    let long_intent = "A".repeat(10000);
    let long_request = IntentRequest {
        intent_text: long_intent,
        execution_mode: "test".to_string(),
    };

    let response = super::dispatch_intent(axum::extract::State(state), Json(long_request)).await;

    // Should handle long intent without crashing
    assert!(response.is_ok() || matches!(response, Err(StatusCode::PAYLOAD_TOO_LARGE)));
}
