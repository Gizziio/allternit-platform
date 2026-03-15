//! Capability enforcement tests for WASM runtime.

use a2r_capsule::signing::SigningKey;
use a2r_capsule::{
    CapsuleBundle, CapsuleBundler, CapsuleCapabilities, CapsuleStore, CapsuleStoreConfig,
    IdempotencyBehavior, ManifestBuilder, SafetyTier, ToolABISpec,
};
use a2r_policy::{
    Capability, CapabilityGrant, Identity, IdentityType, PolicyEffect, PolicyEngine, PolicyRule,
};
use a2r_wasm_runtime::{ExecutionContext, WasmRuntime, WasmRuntimeConfig};
use a2rchitech_history::HistoryLedger;
use a2rchitech_messaging::MessagingSystem;
use sqlx::AnyPool;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::Mutex;
use uuid::Uuid;

#[tokio::test]
async fn test_filesystem_read_capability_enforcement() -> Result<(), Box<dyn std::error::Error>> {
    let temp_dir = TempDir::new()?;
    let ledger_path = temp_dir.path().join("ledger.jsonl");
    let db_path = temp_dir.path().join("test.db");

    // Initialize components
    let history_ledger = Arc::new(Mutex::new(HistoryLedger::new(&ledger_path)?));
    let pool = AnyPool::connect(&format!("sqlite:{}", db_path.to_string_lossy())).await?;
    let messaging_system =
        Arc::new(MessagingSystem::new_with_storage(history_ledger.clone(), pool).await?);
    let policy_engine = Arc::new(PolicyEngine::new(
        history_ledger.clone(),
        messaging_system.clone(),
    ));

    // Create a test identity
    let identity = Identity {
        id: "test-agent".to_string(),
        identity_type: IdentityType::AgentIdentity,
        name: "Test Agent".to_string(),
        tenant_id: "test-tenant".to_string(),
        created_at: 0,
        active: true,
        roles: vec!["default".to_string()],
        permissions: vec![],
    };
    policy_engine.register_identity(identity.clone()).await?;

    // Create a WASM runtime
    let runtime = WasmRuntime::new(WasmRuntimeConfig::default())?;

    // Create a test capsule bundle with a simple WASM component
    let test_capsule = create_test_capsule()?;
    let wasm_bytes = test_capsule.extract_wasm()?;
    let component = runtime.compile_component(&wasm_bytes)?;

    // Create a capability grant with limited filesystem access
    let grant_without_fs = CapabilityGrant::minimal(
        "test-capsule".to_string(),
        "test-tenant".to_string(),
        "test-system".to_string(),
    );

    let grant_with_fs = CapabilityGrant::minimal(
        "test-capsule".to_string(),
        "test-tenant".to_string(),
        "test-system".to_string(),
    )
    .with_capability(Capability::FilesystemRead {
        paths: vec!["/tmp/test.txt".to_string()],
    });

    let context = ExecutionContext::new("test-tenant".to_string());

    // Test that instantiation succeeds with appropriate capabilities
    let instance = runtime
        .instantiate_tool(
            Arc::new(component),
            grant_with_fs,
            context,
            history_ledger.clone(),
        )
        .await?;

    // The instance should be created successfully with the granted capabilities
    assert!(instance.host_state().check_capability("filesystem:read"));

    Ok(())
}

#[tokio::test]
async fn test_network_capability_enforcement() -> Result<(), Box<dyn std::error::Error>> {
    let temp_dir = TempDir::new()?;
    let ledger_path = temp_dir.path().join("ledger.jsonl");
    let db_path = temp_dir.path().join("test.db");

    // Initialize components
    let history_ledger = Arc::new(Mutex::new(HistoryLedger::new(&ledger_path)?));
    let pool = AnyPool::connect(&format!("sqlite:{}", db_path.to_string_lossy())).await?;
    let messaging_system =
        Arc::new(MessagingSystem::new_with_storage(history_ledger.clone(), pool).await?);
    let policy_engine = Arc::new(PolicyEngine::new(
        history_ledger.clone(),
        messaging_system.clone(),
    ));

    // Create a test identity
    let identity = Identity {
        id: "test-agent".to_string(),
        identity_type: IdentityType::AgentIdentity,
        name: "Test Agent".to_string(),
        tenant_id: "test-tenant".to_string(),
        created_at: 0,
        active: true,
        roles: vec!["default".to_string()],
        permissions: vec![],
    };
    policy_engine.register_identity(identity.clone()).await?;

    // Create a WASM runtime
    let runtime = WasmRuntime::new(WasmRuntimeConfig::default())?;

    // Create a test capsule bundle
    let test_capsule = create_test_capsule()?;
    let wasm_bytes = test_capsule.extract_wasm()?;
    let component = runtime.compile_component(&wasm_bytes)?;

    // Create capability grants with and without network access
    let grant_without_network = CapabilityGrant::minimal(
        "test-capsule".to_string(),
        "test-tenant".to_string(),
        "test-system".to_string(),
    );

    let grant_with_network = CapabilityGrant::minimal(
        "test-capsule".to_string(),
        "test-tenant".to_string(),
        "test-system".to_string(),
    )
    .with_capability(Capability::Network {
        allowed_hosts: vec!["example.com".to_string()],
        allowed_ports: vec![80, 443],
    });

    let context = ExecutionContext::new("test-tenant".to_string());

    // Test that instantiation succeeds with network capability
    let instance = runtime
        .instantiate_tool(
            Arc::new(component),
            grant_with_network,
            context,
            history_ledger.clone(),
        )
        .await?;

    // The instance should have network capability
    assert!(instance.host_state().check_capability("network"));

    Ok(())
}

#[tokio::test]
async fn test_http_client_capability_enforcement() -> Result<(), Box<dyn std::error::Error>> {
    let temp_dir = TempDir::new()?;
    let ledger_path = temp_dir.path().join("ledger.jsonl");
    let db_path = temp_dir.path().join("test.db");

    // Initialize components
    let history_ledger = Arc::new(Mutex::new(HistoryLedger::new(&ledger_path)?));
    let pool = AnyPool::connect(&format!("sqlite:{}", db_path.to_string_lossy())).await?;
    let messaging_system =
        Arc::new(MessagingSystem::new_with_storage(history_ledger.clone(), pool).await?);
    let policy_engine = Arc::new(PolicyEngine::new(
        history_ledger.clone(),
        messaging_system.clone(),
    ));

    // Create a test identity
    let identity = Identity {
        id: "test-agent".to_string(),
        identity_type: IdentityType::AgentIdentity,
        name: "Test Agent".to_string(),
        tenant_id: "test-tenant".to_string(),
        created_at: 0,
        active: true,
        roles: vec!["default".to_string()],
        permissions: vec![],
    };
    policy_engine.register_identity(identity.clone()).await?;

    // Create a WASM runtime
    let runtime = WasmRuntime::new(WasmRuntimeConfig::default())?;

    // Create a test capsule bundle
    let test_capsule = create_test_capsule()?;
    let wasm_bytes = test_capsule.extract_wasm()?;
    let component = runtime.compile_component(&wasm_bytes)?;

    // Create capability grants with and without HTTP client access
    let grant_without_http = CapabilityGrant::minimal(
        "test-capsule".to_string(),
        "test-tenant".to_string(),
        "test-system".to_string(),
    );

    let grant_with_http = CapabilityGrant::minimal(
        "test-capsule".to_string(),
        "test-tenant".to_string(),
        "test-system".to_string(),
    )
    .with_capability(Capability::HttpClient {
        allowed_hosts: vec!["httpbin.org".to_string()],
        max_requests_per_minute: 10,
    });

    let context = ExecutionContext::new("test-tenant".to_string());

    // Test that instantiation succeeds with HTTP client capability
    let instance = runtime
        .instantiate_tool(
            Arc::new(component),
            grant_with_http,
            context,
            history_ledger.clone(),
        )
        .await?;

    // The instance should have HTTP client capability
    assert!(instance.host_state().check_capability("http-client"));

    Ok(())
}

/// Helper function to create a test capsule
fn create_test_capsule() -> Result<CapsuleBundle, Box<dyn std::error::Error>> {
    use semver::Version;

    // Create a dummy WASM component for testing
    let dummy_wasm = create_dummy_wasm_component()?;

    // Create signing key
    let signing_key = SigningKey::generate("test-signer")?;

    // Build tool ABI spec
    let tool_abi = ToolABISpec {
        id: "test-tool".to_string(),
        name: "test-tool".to_string(),
        description: "Test tool for capability enforcement".to_string(),
        version: Version::parse("1.0.0")?,
        input_schema: serde_json::json!({"type": "object", "properties": {}}),
        output_schema: serde_json::json!({"type": "object", "properties": {}}),
        side_effects: vec![],
        safety_tier: SafetyTier::T0,
        idempotency_behavior: IdempotencyBehavior::Idempotent,
        examples: vec![],
        resource_limits: Default::default(),
    };

    // Build manifest
    let manifest = ManifestBuilder::new(
        "com.a2rchitech.test.capability",
        Version::parse("1.0.0")?,
        "Test Capability Capsule",
        "Test capsule for capability enforcement validation",
        tool_abi,
    )
    .capabilities(CapsuleCapabilities {
        needs_clock: true,
        needs_network: false,
        needs_filesystem: false,
        needs_environment: false,
        max_memory_mb: 32,
        max_execution_time_ms: 5000,
    })
    .build()?;

    // Create bundle
    let bundle = CapsuleBundler::new()
        .wasm_component(&dummy_wasm)
        .manifest(manifest)
        .build(&signing_key)?;

    Ok(bundle)
}

/// Helper function to create a dummy WASM component
fn create_dummy_wasm_component() -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Create a minimal WASM module that exports a function
    let wasm_bytes = wat::parse_str(
        r#"
        (module
            (func $main (export "main") (result i32)
                i32.const 42
            )
        )
    "#,
    )?;

    Ok(wasm_bytes)
}
