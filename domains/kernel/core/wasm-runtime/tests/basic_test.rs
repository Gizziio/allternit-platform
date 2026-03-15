//! Basic tests for the WASM runtime functionality.

use a2r_wasm_runtime::host::ExecutionContext;
use a2r_wasm_runtime::{CapabilityGrant, SandboxConfig, WasmRuntime, WasmRuntimeConfig};
use std::sync::Arc;
use uuid::Uuid;

#[tokio::test]
async fn test_wasm_runtime_creation() {
    let config = WasmRuntimeConfig::default();
    let runtime = WasmRuntime::new(config);

    assert!(
        runtime.is_ok(),
        "WASM runtime should be created successfully"
    );
}

#[tokio::test]
async fn test_wasm_runtime_with_minimal_sandbox() {
    let config = WasmRuntimeConfig {
        sandbox: SandboxConfig::minimal(),
        ..Default::default()
    };

    let runtime = WasmRuntime::new(config);
    assert!(
        runtime.is_ok(),
        "WASM runtime with minimal sandbox should be created successfully"
    );
}

#[tokio::test]
async fn test_capability_grant_creation() {
    let grant = CapabilityGrant::minimal(
        "test-capsule".to_string(),
        "test-tenant".to_string(),
        "test-system".to_string(),
    );

    assert_eq!(grant.capsule_id, "test-capsule");
    assert_eq!(grant.tenant_id, "test-tenant");
    assert!(grant.granted_capabilities.is_empty());
}

#[tokio::test]
async fn test_execution_context_creation() {
    let context = ExecutionContext::new("test-tenant".to_string());

    assert!(!context.execution_id.is_nil());
    assert_eq!(context.tenant_id, "test-tenant");
    assert!(context.started_at.timestamp() > 0);
}
