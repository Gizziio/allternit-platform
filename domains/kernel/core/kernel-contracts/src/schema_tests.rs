use allternit_kernel_contracts::*;
use schemars::schema_for;
use serde_json;

#[test]
fn test_event_envelope_schema() {
    let schema = schema_for!(EventEnvelope);
    let schema_json = serde_json::to_string_pretty(&schema).unwrap();
    
    // This serves as our golden test - if the schema changes, this test will catch it
    assert!(!schema_json.is_empty());
    assert!(schema_json.contains("event_id"));
    assert!(schema_json.contains("event_type"));
    assert!(schema_json.contains("session_id"));
    assert!(schema_json.contains("tenant_id"));
    assert!(schema_json.contains("correlation_id"));
    assert!(schema_json.contains("causation_id"));
    assert!(schema_json.contains("idempotency_key"));
    assert!(schema_json.contains("trace_id"));
}

#[test]
fn test_run_model_schema() {
    let schema = schema_for!(RunModel);
    let schema_json = serde_json::to_string_pretty(&schema).unwrap();
    
    assert!(!schema_json.is_empty());
    assert!(schema_json.contains("run_id"));
    assert!(schema_json.contains("state"));
    assert!(schema_json.contains("Created"));
    assert!(schema_json.contains("Running"));
    assert!(schema_json.contains("Verifying"));
    assert!(schema_json.contains("Completed"));
    assert!(schema_json.contains("Failed"));
    assert!(schema_json.contains("Cancelled"));
}

#[test]
fn test_tool_abi_schema() {
    let schema = schema_for!(ToolABI);
    let schema_json = serde_json::to_string_pretty(&schema).unwrap();
    
    assert!(!schema_json.is_empty());
    assert!(schema_json.contains("tool_id"));
    assert!(schema_json.contains("name"));
    assert!(schema_json.contains("has_side_effects"));
    assert!(schema_json.contains("requires_policy_approval"));
}

#[test]
fn test_policy_decision_schema() {
    let schema = schema_for!(PolicyDecision);
    let schema_json = serde_json::to_string_pretty(&schema).unwrap();
    
    assert!(!schema_json.is_empty());
    assert!(schema_json.contains("identity_id"));
    assert!(schema_json.contains("resource"));
    assert!(schema_json.contains("action"));
    assert!(schema_json.contains("Allow"));
    assert!(schema_json.contains("Deny"));
}

#[test]
fn test_verify_artifact_schema() {
    let schema = schema_for!(VerifyArtifact);
    let schema_json = serde_json::to_string_pretty(&schema).unwrap();
    
    assert!(!schema_json.is_empty());
    assert!(schema_json.contains("verify_id"));
    assert!(schema_json.contains("run_id"));
    assert!(schema_json.contains("outputs_hash"));
    assert!(schema_json.contains("passed"));
}

#[test]
fn test_context_bundle_schema() {
    let schema = schema_for!(ContextBundle);
    let schema_json = serde_json::to_string_pretty(&schema).unwrap();
    
    assert!(!schema_json.is_empty());
    assert!(schema_json.contains("bundle_hash"));
    assert!(schema_json.contains("inputs"));
    assert!(schema_json.contains("memory_refs"));
}

#[test]
fn test_context_bundle_deterministic_hashing() {
    let inputs = ContextInputs {
        user_inputs: serde_json::json!({"query": "test"}),
        system_inputs: serde_json::json!({"role": "assistant"}),
        previous_outputs: vec![],
    };
    
    let memory_refs = vec![];
    let budgets = ContextBudgets {
        max_tokens: Some(1000),
        max_execution_time_ms: Some(5000),
        max_tool_calls: Some(10),
        max_memory_refs: Some(5),
    };
    let redactions = vec![];
    
    // Create two bundles with identical inputs
    let bundle1 = ContextBundle::new(inputs.clone(), memory_refs.clone(), budgets.clone(), redactions.clone()).unwrap();
    let bundle2 = ContextBundle::new(inputs, memory_refs, budgets, redactions).unwrap();
    
    // They should have the same hash
    assert_eq!(bundle1.bundle_hash, bundle2.bundle_hash);
}

#[test]
fn test_run_state_transitions() {
    let mut run = RunModel::new("tenant-123".to_string(), "session-123".to_string(), "actor-123".to_string());
    
    // Valid transitions
    assert!(run.transition_to(RunState::Running).is_ok());
    assert!(run.transition_to(RunState::Verifying).is_ok());
    assert!(run.transition_to(RunState::Completed).is_ok());
    
    // Invalid transition from terminal state
    assert!(run.transition_to(RunState::Running).is_err());
}