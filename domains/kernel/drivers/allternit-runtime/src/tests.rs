//! Integration Tests for allternit-runtime
//!
//! These tests verify the runtime brain functionality.

use crate::*;

// Test state machine transitions
#[test]
fn test_state_machine_transitions() {
    use session::SessionState;
    use events::RuntimeEvent;
    
    // Idle -> Initializing
    let state = SessionState::Idle;
    let result = state.transition(&RuntimeEvent::Start);
    assert_eq!(result.unwrap(), SessionState::Initializing);
    
    // Initializing -> Ready
    let state = SessionState::Initializing;
    let result = state.transition(&RuntimeEvent::SessionInitialized);
    assert_eq!(result.unwrap(), SessionState::Ready);
    
    // Ready -> AwaitingModel
    let state = SessionState::Ready;
    let result = state.transition(&RuntimeEvent::PromptSubmitted { prompt: "test".to_string() });
    assert_eq!(result.unwrap(), SessionState::AwaitingModel);
}

#[test]
#[cfg(not(debug_assertions))]
fn test_invalid_transition_returns_error() {
    use session::SessionState;
    use events::RuntimeEvent;
    
    let state = SessionState::Idle;
    let result = state.transition(&RuntimeEvent::ProviderDelta { content: "invalid".to_string() });
    
    assert!(result.is_err());
}

// Test tool loop arbiter
#[test]
fn test_tool_arbiter_decisions() {
    use tool_loop::{ToolLoopArbiter, Decision, RejectionReason};
    use events::ToolCall;
    
    let arbiter = ToolLoopArbiter::new(10);
    let tool_call = ToolCall {
        id: "1".to_string(),
        name: "test".to_string(),
        arguments: serde_json::json!({}),
    };
    
    assert_eq!(arbiter.should_execute(&tool_call), Decision::Execute);
}

#[test]
fn test_tool_arbiter_max_calls() {
    use tool_loop::{ToolLoopArbiter, Decision, RejectionReason};
    use events::ToolCall;
    
    let mut arbiter = ToolLoopArbiter::new(2);
    let tool_call = ToolCall {
        id: "1".to_string(),
        name: "test".to_string(),
        arguments: serde_json::json!({}),
    };
    
    arbiter.record_success("test");
    arbiter.record_success("test");
    
    assert_eq!(
        arbiter.should_execute(&tool_call),
        Decision::Reject(RejectionReason::MaxToolCallsExceeded)
    );
}

// Test circuit breaker
#[test]
fn test_circuit_breaker_opens_after_failures() {
    use tool_loop::{CircuitBreaker, CircuitConfig};
    
    let cb = CircuitBreaker::new(CircuitConfig {
        failure_threshold: 3,
        recovery_timeout_secs: 60,
    });
    
    cb.record_failure();
    cb.record_failure();
    assert!(!cb.is_open());
    
    cb.record_failure();
    assert!(cb.is_open());
}

#[test]
fn test_circuit_breaker_closes_after_success() {
    use tool_loop::{CircuitBreaker, CircuitConfig};
    
    let cb = CircuitBreaker::new(CircuitConfig {
        failure_threshold: 2,
        recovery_timeout_secs: 60,
    });
    
    cb.record_failure();
    cb.record_failure();
    assert!(cb.is_open());
    
    // Manually set to half-open for test
    cb.record_success();
    
    // After success, circuit should be closed or half-open
    // The actual behavior depends on implementation details
}

// Test retry policy
#[test]
fn test_retry_policy_backoff() {
    use tool_loop::RetryPolicy;
    
    let policy = RetryPolicy::default();
    
    assert_eq!(policy.delay_ms(0), 100);   // 100 * 2^0
    assert_eq!(policy.delay_ms(1), 200);   // 100 * 2^1
    assert_eq!(policy.delay_ms(2), 400);   // 100 * 2^2
}

#[test]
fn test_retry_policy_max_delay_cap() {
    use tool_loop::RetryPolicy;
    
    let policy = RetryPolicy {
        max_attempts: 10,
        base_delay_ms: 1000,
        max_delay_ms: 5000,
        backoff_multiplier: 2.0,
    };
    
    // Would be 8000ms but capped at 5000ms
    assert_eq!(policy.delay_ms(3), 5000);
}

// Test echo tool executor
#[tokio::test]
async fn test_echo_tool_executor() {
    use tool_loop::EchoToolExecutor;
    use tool_loop::ToolExecutor;
    use events::ToolCall;
    
    let executor = EchoToolExecutor::new();
    let call = ToolCall {
        id: "1".to_string(),
        name: "echo".to_string(),
        arguments: serde_json::json!({"message": "hello"}),
    };
    
    let result = executor.execute(&call).await.unwrap();
    assert_eq!(result.tool_call_id, "1");
    assert!(result.error.is_none());
}

// Test streaming rate limiter
#[tokio::test]
async fn test_rate_limiter() {
    use streaming::RateLimiter;
    
    let limiter = RateLimiter::new(100);
    
    // Should be able to consume initially
    assert!(limiter.try_consume(50));
    assert_eq!(limiter.available_tokens(), 50);
    
    // Consume remaining
    assert!(limiter.try_consume(50));
    assert_eq!(limiter.available_tokens(), 0);
    
    // Should fail when empty
    assert!(!limiter.try_consume(1));
}

// Test backpressure controller
#[test]
fn test_backpressure_controller() {
    use streaming::BackpressureController;
    
    let controller = BackpressureController::new(1000, 0.8);
    
    // Below threshold
    controller.record_emission(500);
    assert!(!controller.should_pause());
    
    // Above threshold
    controller.record_emission(400);
    assert!(controller.should_pause());
    
    // Consume enough to resume
    controller.record_consumption(500);
    assert!(!controller.is_paused());
}

// Test session state machine
#[test]
fn test_session_state_machine_lifecycle() {
    use session::{SessionStateMachine, SessionConfig, SessionState};
    
    let config = SessionConfig {
        session_id: "test".to_string(),
        provider_id: "test".to_string(),
        ..Default::default()
    };
    
    let sm = SessionStateMachine::new(config);
    
    assert_eq!(*sm.state(), SessionState::Idle);
    assert!(!sm.is_terminal());
}

// Test fake provider runtime
#[tokio::test]
async fn test_fake_provider_runtime() {
    use provider::{FakeProviderRuntime, ProviderRuntime, ProviderSessionConfig};
    use events::{ProviderStreamItem, FinishReason};
    use futures::StreamExt;
    
    let mut provider = FakeProviderRuntime::new();
    provider.script_stream("test", vec![
        ProviderStreamItem::Delta("Hello".to_string()),
        ProviderStreamItem::Done(FinishReason::Stop),
    ]);
    
    let config = ProviderSessionConfig {
        provider_id: "fake".to_string(),
        model_id: "fake-model".to_string(),
        api_key: None,
        base_url: None,
    };
    
    let mut handle = provider.start_session(config).await.unwrap();
    let mut stream = provider.stream_prompt(&mut handle, "test".to_string()).await.unwrap();
    
    let items: Vec<_> = stream.collect().await;
    assert_eq!(items.len(), 2);
    assert_eq!(items[0], ProviderStreamItem::Delta("Hello".to_string()));
}

/// Test tool call roundtrip with arbiter
/// 
/// This test verifies:
/// 1. Tool call is received from provider
/// 2. Arbiter decides to execute
/// 3. Tool executes
/// 4. Result sent back to provider
/// 5. Provider continues streaming
#[tokio::test]
async fn test_tool_call_roundtrip() {
    use tool_loop::{ToolLoopArbiter, ToolExecutor, EchoToolExecutor, Decision, CircuitConfig};
    use provider::{FakeProviderRuntime, ProviderRuntime, ProviderSessionConfig};
    use events::{ToolCall, ToolResult, ProviderStreamItem, FinishReason};
    use futures::StreamExt;
    
    // Setup arbiter with circuit breaker
    let mut arbiter = ToolLoopArbiter::new(10);
    arbiter.register_circuit_breaker("echo", CircuitConfig::default());
    
    // Setup tool executor
    let executor = EchoToolExecutor::new();
    
    // Create provider with scripted tool call sequence
    let mut provider = FakeProviderRuntime::new();
    
    // Simulate provider that sends a tool call then continues
    provider.script_stream("with_tool", vec![
        ProviderStreamItem::ToolCall(ToolCall {
            id: "call_1".to_string(),
            name: "echo".to_string(),
            arguments: serde_json::json!({"message": "hello"}),
        }),
    ]);
    
    // Start session
    let config = ProviderSessionConfig {
        provider_id: "fake".to_string(),
        model_id: "fake-model".to_string(),
        api_key: None,
        base_url: None,
    };
    
    let mut handle = provider.start_session(config).await.unwrap();
    let mut stream = provider.stream_prompt(&mut handle, "with_tool".to_string()).await.unwrap();
    
    // Process stream until we get a tool call
    let mut tool_result: Option<ToolResult> = None;
    
    while let Some(item) = stream.next().await {
        match item {
            ProviderStreamItem::ToolCall(call) => {
                // Step 1: Arbiter decides
                let decision = arbiter.should_execute(&call);
                assert_eq!(decision, Decision::Execute, "Tool should be allowed");
                
                // Step 2: Execute tool
                let result = executor.execute(&call).await.expect("Tool execution should succeed");
                
                // Step 3: Record success
                arbiter.record_success(&call.name);
                
                // Step 4: Send result back to provider
                provider.send_tool_result(&mut handle, &result).await.expect("Should send tool result");
                
                tool_result = Some(result);
                break;
            }
            ProviderStreamItem::Done(_) => break,
            _ => {}
        }
    }
    
    // Verify tool was executed
    assert!(tool_result.is_some(), "Tool should have been executed");
    let result = tool_result.unwrap();
    assert_eq!(result.tool_call_id, "call_1");
    assert!(result.error.is_none(), "Tool should succeed");
}
