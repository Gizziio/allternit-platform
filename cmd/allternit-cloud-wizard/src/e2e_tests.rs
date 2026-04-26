//! End-to-End Integration Tests
//!
//! These tests actually provision real servers on Hetzner/DigitalOcean.
//! They require API tokens and should be run with --ignored flag.
//!
//! Usage:
//! ```bash
//! export Allternit_HETZNER_TOKEN=your_token
//! export Allternit_DO_TOKEN=your_token
//! cargo test e2e -- --ignored --nocapture
//! ```

use crate::provider::{ProviderDriver, HetznerDriver, DigitalOceanDriver, CreateServerRequest};
use crate::preflight::PreflightChecker;
use crate::bootstrap::BootstrapContract;
use crate::verifier::PostInstallVerifier;
use std::time::Duration;

/// Test Hetzner provisioning end-to-end
#[tokio::test]
#[ignore]  // Requires real API token
async fn e2e_hetzner_provisioning() {
    let api_token = std::env::var("Allternit_HETZNER_TOKEN")
        .expect("Allternit_HETZNER_TOKEN must be set for e2e tests");

    println!("Starting Hetzner e2e test...");

    // 1. Validate token
    println!("Step 1: Validating token...");
    let checker = PreflightChecker::new();
    let result = checker.validate_api_token(
        Some(crate::SupportedProvider::Hetzner),
        &api_token
    ).await;
    
    assert!(result.is_ok(), "Token validation failed: {:?}", result);
    println!("✓ Token validated");

    // 2. Create server
    println!("Step 2: Creating server...");
    let driver = HetznerDriver::new(api_token.clone());
    
    let request = CreateServerRequest {
        name: format!("allternit-e2e-test-{}", uuid::Uuid::new_v4()),
        region: "fsn1".to_string(),
        instance_type: "cx11".to_string(),  // Cheapest option
        image: "ubuntu-22.04".to_string(),
        ssh_keys: vec![],  // Will create key
        storage_gb: 40,
        api_token: api_token.clone(),
    };

    let create_result = driver.create_server(&request).await;
    assert!(create_result.is_ok(), "Server creation failed: {:?}", create_result);
    let server = create_result.unwrap();
    let server_id = server.server_id.clone();
    println!("✓ Server created: {}", server_id);

    // 3. Wait for SSH-ready
    println!("Step 3: Waiting for SSH-ready...");
    let wait_result = driver.wait_for_ready(&server_id, Duration::from_secs(300)).await;
    assert!(wait_result.is_ok(), "Wait for ready failed: {:?}", wait_result);
    println!("✓ Server is SSH-ready");

    // 4. Get server status
    println!("Step 4: Getting server status...");
    let status = driver.get_server_status(&server_id).await;
    assert!(status.is_ok(), "Get status failed: {:?}", status);
    assert!(status.unwrap().is_ready(), "Server not ready");
    println!("✓ Server status confirmed");

    // 5. Destroy server
    println!("Step 5: Destroying server...");
    let destroy_result = driver.destroy_server(&server_id).await;
    assert!(destroy_result.is_ok(), "Server destruction failed: {:?}", destroy_result);
    println!("✓ Server destroyed");

    println!("Hetzner e2e test PASSED");
}

/// Test DigitalOcean provisioning end-to-end
#[tokio::test]
#[ignore]  // Requires real API token
async fn e2e_digitalocean_provisioning() {
    let api_token = std::env::var("Allternit_DO_TOKEN")
        .expect("Allternit_DO_TOKEN must be set for e2e tests");

    println!("Starting DigitalOcean e2e test...");

    // 1. Validate token
    println!("Step 1: Validating token...");
    let checker = PreflightChecker::new();
    let result = checker.validate_api_token(
        Some(crate::SupportedProvider::DigitalOcean),
        &api_token
    ).await;
    
    assert!(result.is_ok(), "Token validation failed: {:?}", result);
    println!("✓ Token validated");

    // 2. Create droplet
    println!("Step 2: Creating droplet...");
    let driver = DigitalOceanDriver::new(api_token.clone());
    
    let request = CreateServerRequest {
        name: format!("allternit-e2e-test-{}", uuid::Uuid::new_v4()),
        region: "nyc3".to_string(),
        instance_type: "s-1vcpu-1gb".to_string(),  // Cheapest option
        image: "ubuntu-22-04-x64".to_string(),
        ssh_keys: vec![],
        storage_gb: 25,
        api_token: api_token.clone(),
    };

    let create_result = driver.create_server(&request).await;
    assert!(create_result.is_ok(), "Droplet creation failed: {:?}", create_result);
    let droplet = create_result.unwrap();
    let droplet_id = droplet.server_id.clone();
    println!("✓ Droplet created: {}", droplet_id);

    // 3. Wait for SSH-ready
    println!("Step 3: Waiting for SSH-ready...");
    let wait_result = driver.wait_for_ready(&droplet_id, Duration::from_secs(300)).await;
    assert!(wait_result.is_ok(), "Wait for ready failed: {:?}", wait_result);
    println!("✓ Droplet is SSH-ready");

    // 4. Get droplet status
    println!("Step 4: Getting droplet status...");
    let status = driver.get_server_status(&droplet_id).await;
    assert!(status.is_ok(), "Get status failed: {:?}", status);
    assert!(status.unwrap().is_ready(), "Droplet not ready");
    println!("✓ Droplet status confirmed");

    // 5. Destroy droplet
    println!("Step 5: Destroying droplet...");
    let destroy_result = driver.destroy_server(&droplet_id).await;
    assert!(destroy_result.is_ok(), "Droplet destruction failed: {:?}", destroy_result);
    println!("✓ Droplet destroyed");

    println!("DigitalOcean e2e test PASSED");
}

/// Test checkpoint store persistence
#[tokio::test]
async fn e2e_checkpoint_persistence() {
    use crate::checkpoint_store::{CheckpointStore, InMemoryCheckpointStore};
    use crate::state_machine::WizardState;

    println!("Testing checkpoint persistence...");

    let store = InMemoryCheckpointStore::new();
    let mut wizard = WizardState::new();
    wizard.deployment_id = "test-persistence-123".to_string();

    // Save
    println!("Step 1: Saving checkpoint...");
    store.save(&wizard).await.expect("Failed to save");
    println!("✓ Checkpoint saved");

    // Load
    println!("Step 2: Loading checkpoint...");
    let loaded = store.load("test-persistence-123").await
        .expect("Failed to load")
        .expect("Checkpoint not found");
    assert_eq!(loaded.deployment_id, wizard.deployment_id);
    println!("✓ Checkpoint loaded");

    // List
    println!("Step 3: Listing checkpoints...");
    let list = store.list().await.expect("Failed to list");
    assert!(list.contains(&"test-persistence-123".to_string()));
    println!("✓ Checkpoints listed: {:?}", list);

    // Delete
    println!("Step 4: Deleting checkpoint...");
    store.delete("test-persistence-123").await.expect("Failed to delete");
    println!("✓ Checkpoint deleted");

    // Verify deleted
    let loaded = store.load("test-persistence-123").await.expect("Failed to load");
    assert!(loaded.is_none(), "Checkpoint should be deleted");
    println!("✓ Deletion confirmed");

    println!("Checkpoint persistence test PASSED");
}

/// Test idempotency store
#[tokio::test]
async fn e2e_idempotency() {
    use crate::checkpoint_store::IdempotencyStore;

    println!("Testing idempotency...");

    let store = IdempotencyStore::new();

    // First mark should succeed
    println!("Step 1: First mark...");
    assert!(store.mark_started("op-1").await, "First mark should succeed");
    println!("✓ First mark succeeded");

    // Second mark should fail (duplicate)
    println!("Step 2: Second mark (should fail)...");
    assert!(!store.mark_started("op-1").await, "Second mark should fail");
    println!("✓ Duplicate prevented");

    // Check is_duplicate
    println!("Step 3: Check duplicate...");
    assert!(store.is_duplicate("op-1").await, "Should be duplicate");
    println!("✓ Duplicate detected");

    // Mark completed
    println!("Step 4: Mark completed...");
    store.mark_completed("op-1").await;
    println!("✓ Marked completed");

    // Should not be duplicate anymore
    println!("Step 5: Check not duplicate...");
    assert!(!store.is_duplicate("op-1").await, "Should not be duplicate after completion");
    println!("✓ No longer duplicate");

    println!("Idempotency test PASSED");
}

/// Test preflight validation with invalid token
#[tokio::test]
async fn e2e_preflight_invalid_token() {
    use crate::preflight::PreflightChecker;

    println!("Testing preflight with invalid token...");

    let checker = PreflightChecker::new();
    let result = checker.validate_api_token(
        Some(crate::SupportedProvider::Hetzner),
        "invalid_token_12345"
    ).await;

    assert!(result.is_err(), "Invalid token should fail validation");
    println!("✓ Invalid token correctly rejected");

    println!("Preflight invalid token test PASSED");
}
