use allternit_capsule::bundle::{CapsuleBundler, ManifestBuilder};
use allternit_capsule::manifest::{
    Capabilities as CapsuleCapabilities, IdempotencyBehavior, SafetyTier as CapsuleSafetyTier,
    ToolABISpec,
};
use allternit_capsule::signing::SigningKey;
use allternit_capsule::{CapsuleStore, CapsuleStoreConfig};
use allternit_policy::{
    CapsuleLoadRequest, Identity, IdentityType, PolicyEffect, PolicyEngine, PolicyRule,
    WasmCapability, WasmCapabilityGrant,
};
use allternit_wasm_runtime::host::ExecutionContext;
use allternit_wasm_runtime::instance::ToolInput;
use allternit_wasm_runtime::{
    Capability, CapabilityGrant, WasmRuntime, WasmRuntimeConfig, WasmRuntimeError,
};
use allternit_history::HistoryLedger;
use allternit_messaging::MessagingSystem;
use anyhow::Result;
use semver::Version;
use sqlx::AnyPool;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use wit_component::{dummy_module, embed_component_metadata, ComponentEncoder, StringEncoding};
use wit_parser::{Mangling, Resolve};

#[tokio::test]
async fn policy_capsule_execution_flow() -> Result<()> {
    let temp_dir = tempfile::tempdir()?;
    let (history_ledger, messaging_system) = build_policy_dependencies(temp_dir.path()).await?;
    let policy_engine = PolicyEngine::new(history_ledger.clone(), messaging_system);

    let identity = Identity {
        id: "test-agent".to_string(),
        identity_type: IdentityType::AgentIdentity,
        name: "Test Agent".to_string(),
        tenant_id: "tenant-1".to_string(),
        created_at: 0,
        active: true,
        roles: vec!["tester".to_string()],
        permissions: vec![],
    };
    policy_engine.register_identity(identity.clone()).await?;

    policy_engine
        .add_rule(PolicyRule {
            id: "allow_clock".to_string(),
            name: "Allow clock capability".to_string(),
            description: "Allow clock access for test capsules".to_string(),
            condition: "true".to_string(),
            effect: PolicyEffect::Allow,
            resource: "*".to_string(),
            actions: vec!["clock".to_string()],
            priority: 100,
            enabled: true,
        })
        .await?;

    let component_bytes = build_dummy_component()?;
    let capsule_id = "com.allternit.test.echo";
    let version = Version::parse("0.1.0")?;

    let bundle = build_capsule_bundle(
        temp_dir.path().to_path_buf(),
        capsule_id,
        version.clone(),
        &component_bytes,
    )?;

    let store = CapsuleStore::new(CapsuleStoreConfig {
        storage_path: temp_dir.path().to_path_buf(),
        ..CapsuleStoreConfig::default()
    })?;
    store.add(bundle)?;

    let stored_bundle = store.get(capsule_id, Some(&version))?;
    let wasm_bytes = stored_bundle.extract_wasm()?;

    let allowed_request = CapsuleLoadRequest {
        capsule_id: capsule_id.to_string(),
        requested_capabilities: vec![WasmCapability::Clock],
        requester_identity_id: identity.id.clone(),
        tenant_id: identity.tenant_id.clone(),
    };

    let allowed_decision = policy_engine.evaluate_capsule_load(allowed_request).await?;
    assert!(allowed_decision.allowed);
    let allowed_grant = allowed_decision
        .grant
        .expect("policy should return a capability grant");

    let denied_request = CapsuleLoadRequest {
        capsule_id: capsule_id.to_string(),
        requested_capabilities: vec![WasmCapability::FilesystemWrite {
            paths: vec!["/tmp".to_string()],
        }],
        requester_identity_id: identity.id.clone(),
        tenant_id: identity.tenant_id.clone(),
    };

    let denied_decision = policy_engine.evaluate_capsule_load(denied_request).await?;
    assert!(!denied_decision.allowed);
    assert!(denied_decision.grant.is_none());

    let runtime = WasmRuntime::new(WasmRuntimeConfig::default())?;
    let component = runtime.compile_and_cache(&stored_bundle.manifest.full_id(), &wasm_bytes)?;

    let runtime_grant = map_grant(&allowed_grant);
    let context =
        ExecutionContext::new(identity.tenant_id.clone()).with_session("session-1".to_string());
    let mut instance = runtime
        .instantiate_tool(component, runtime_grant, context)
        .await?;

    let input = ToolInput::new(
        serde_json::json!({"ping": "pong"}).to_string(),
        "session-1",
        identity.tenant_id.as_str(),
    );

    let exec_result = instance.execute(input).await;
    assert!(
        matches!(exec_result, Err(WasmRuntimeError::ExecutionError(_))),
        "dummy component should trap during execution"
    );

    let entries = history_ledger.lock().unwrap().get_entries()?;
    let mut allowed_seen = false;
    let mut denied_seen = false;
    for entry in entries {
        if entry.content.get("event")
            != Some(&serde_json::Value::String(
                "CapsuleLoadDecision".to_string(),
            ))
        {
            continue;
        }

        let allowed = entry
            .content
            .get("decision")
            .and_then(|decision| decision.get("allowed"))
            .and_then(|value| value.as_bool());

        if allowed == Some(true) {
            allowed_seen = true;
        }
        if allowed == Some(false) {
            denied_seen = true;
        }
    }

    assert!(allowed_seen && denied_seen);

    Ok(())
}

async fn build_policy_dependencies(
    base_dir: &Path,
) -> Result<(Arc<Mutex<HistoryLedger>>, Arc<MessagingSystem>)> {
    sqlx::any::install_default_drivers();

    let ledger_path = base_dir.join("history.jsonl");
    let history_ledger = Arc::new(Mutex::new(HistoryLedger::new(&ledger_path)?));

    let db_path = base_dir.join("messaging.db");
    std::fs::File::create(&db_path)?;
    let db_url = format!(
        "sqlite:///{}",
        db_path.to_string_lossy().trim_start_matches('/')
    );
    let pool = AnyPool::connect(&db_url).await?;

    let messaging = MessagingSystem::new_with_storage(history_ledger.clone(), pool).await?;

    Ok((history_ledger, Arc::new(messaging)))
}

fn build_dummy_component() -> Result<Vec<u8>> {
    let wit_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("wit");
    let mut resolve = Resolve::default();
    let (package, _) = resolve.push_dir(&wit_dir)?;
    let world = resolve.select_world(package, Some("tool-component"))?;

    let mut module = dummy_module(&resolve, world, Mangling::Standard32);
    embed_component_metadata(&mut module, &resolve, world, StringEncoding::UTF8)?;

    let mut encoder = ComponentEncoder::default().module(&module)?.validate(true);
    Ok(encoder.encode()?)
}

fn build_capsule_bundle(
    dir: PathBuf,
    capsule_id: &str,
    version: Version,
    component_bytes: &[u8],
) -> Result<allternit_capsule::bundle::CapsuleBundle> {
    let wasm_path = dir.join("component.wasm");
    std::fs::write(&wasm_path, component_bytes)?;

    let tool_abi = ToolABISpec {
        name: capsule_id.to_string(),
        description: "Test capsule for policy execution flow".to_string(),
        input_schema: serde_json::json!({}),
        output_schema: serde_json::json!({}),
        side_effects: vec![],
        safety_tier: CapsuleSafetyTier::Safe,
        idempotency: IdempotencyBehavior::Idempotent,
        examples: vec![],
    };

    let manifest_builder = ManifestBuilder::new(
        capsule_id,
        version,
        "Test Capsule",
        "E2E policy -> capsule -> execution test",
        tool_abi,
    )
    .capabilities(CapsuleCapabilities {
        needs_clock: true,
        ..CapsuleCapabilities::default()
    });

    let signing_key = SigningKey::generate("test-publisher");
    let bundle = CapsuleBundler::new()
        .wasm_component(&wasm_path)
        .manifest(manifest_builder)
        .build(&signing_key)?;

    Ok(bundle)
}

fn map_grant(grant: &WasmCapabilityGrant) -> CapabilityGrant {
    let mut runtime_grant = CapabilityGrant::minimal(
        grant.capsule_id.clone(),
        grant.tenant_id.clone(),
        grant.granted_by.clone(),
    );

    for capability in &grant.granted_capabilities {
        runtime_grant = runtime_grant.with_capability(map_capability(capability));
    }

    runtime_grant
}

fn map_capability(capability: &WasmCapability) -> Capability {
    match capability {
        WasmCapability::FilesystemRead { paths } => Capability::FilesystemRead {
            paths: paths.clone(),
        },
        WasmCapability::FilesystemWrite { paths } => Capability::FilesystemWrite {
            paths: paths.clone(),
        },
        WasmCapability::Network {
            allowed_hosts,
            allowed_ports,
        } => Capability::Network {
            allowed_hosts: allowed_hosts.clone(),
            allowed_ports: allowed_ports.clone(),
        },
        WasmCapability::Environment { allowed_vars } => Capability::Environment {
            allowed_vars: allowed_vars.clone(),
        },
        WasmCapability::Clock => Capability::Clock,
        WasmCapability::Random => Capability::Random,
        WasmCapability::Stdio => Capability::Stdio,
        WasmCapability::HttpClient {
            allowed_hosts,
            max_requests_per_minute,
        } => Capability::HttpClient {
            allowed_hosts: allowed_hosts.clone(),
            max_requests_per_minute: *max_requests_per_minute,
        },
    }
}
