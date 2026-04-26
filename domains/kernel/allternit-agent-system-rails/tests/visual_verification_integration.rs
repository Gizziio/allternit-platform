//! Integration Tests for Visual Verification
//!
//! Tests the full flow: gate → provider → evidence → validation

use allternit_agent_system_rails::gate::{Gate, GateOptions};
use allternit_agent_system_rails::verification::{
    Evidence, Artifact, ArtifactType, ArtifactData,
    ProviderType, FileBasedProvider, GrpcProvider,
    VisualVerificationPolicy,
};
use std::sync::Arc;
use std::path::PathBuf;
use tempfile::TempDir;

/// Test that gate calls visual verification before autoland
#[tokio::test]
async fn test_autoland_fails_without_visual_evidence() {
    let temp_dir = TempDir::new().unwrap();
    
    // Create gate with visual verification enabled
    let gate = create_test_gate(&temp_dir, true).await;
    
    // Create a WIH with PASS status but NO visual evidence
    let wih_id = create_test_wih_with_pass(&gate).await;
    
    // Attempt autoland should fail
    let result = gate.autoland_wih(&wih_id, false, false).await;
    
    assert!(result.is_err());
    let error = result.unwrap_err().to_string();
    assert!(error.contains("Visual verification"), "Error should mention visual verification: {}", error);
}

/// Test that autoland succeeds with passing visual evidence
#[tokio::test]
async fn test_autoland_succeeds_with_passing_visual() {
    let temp_dir = TempDir::new().unwrap();
    let evidence_dir = temp_dir.path().join(".allternit/evidence");
    std::fs::create_dir_all(&evidence_dir).unwrap();
    
    let gate = create_test_gate(&temp_dir, true).await;
    let wih_id = create_test_wih_with_pass(&gate).await;
    
    // Write passing visual evidence
    write_test_evidence(&evidence_dir, &wih_id, 0.85, true);
    
    // Autoland should succeed
    let result = gate.autoland_wih(&wih_id, false, false).await;
    
    assert!(result.is_ok(), "Autoland should succeed with passing visual: {:?}", result.err());
    
    let autoland_result = result.unwrap();
    assert!(autoland_result.success);
}

/// Test that autoland fails when confidence is below threshold
#[tokio::test]
async fn test_autoland_fails_low_confidence() {
    let temp_dir = TempDir::new().unwrap();
    let evidence_dir = temp_dir.path().join(".allternit/evidence");
    std::fs::create_dir_all(&evidence_dir).unwrap();
    
    let gate = create_test_gate(&temp_dir, true).await;
    let wih_id = create_test_wih_with_pass(&gate).await;
    
    // Write failing visual evidence (confidence 0.5, threshold is 0.7)
    write_test_evidence(&evidence_dir, &wih_id, 0.5, true);
    
    // Autoland should fail
    let result = gate.autoland_wih(&wih_id, false, false).await;
    
    assert!(result.is_err());
    let error = result.unwrap_err().to_string();
    assert!(error.contains("confidence"));
    assert!(error.contains("50.0%"));
    assert!(error.contains("70.0%"));
}

/// Test that autoland succeeds when visual verification is disabled
#[tokio::test]
async fn test_autoland_succeeds_when_visual_disabled() {
    let temp_dir = TempDir::new().unwrap();
    
    // Create gate with visual verification DISABLED
    let gate = create_test_gate(&temp_dir, false).await;
    let wih_id = create_test_wih_with_pass(&gate).await;
    
    // No visual evidence needed
    let result = gate.autoland_wih(&wih_id, false, false).await;
    
    assert!(result.is_ok());
}

/// Test file-based provider polling
#[tokio::test]
async fn test_file_based_provider_polling() {
    let temp_dir = TempDir::new().unwrap();
    let evidence_dir = temp_dir.path().join("evidence");
    std::fs::create_dir_all(&evidence_dir).unwrap();
    
    let provider = FileBasedProvider::new(FileBasedProviderConfig {
        evidence_dir: evidence_dir.clone(),
        poll_interval_ms: 100,
        max_wait_seconds: 2,
        ready_suffix: ".ready".to_string(),
        evidence_suffix: ".json".to_string(),
    });
    
    let wih_id = "test_wih_polling";
    
    // Spawn task to write evidence after delay
    let evidence_dir_clone = evidence_dir.clone();
    let wih_id_clone = wih_id.to_string();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        write_test_evidence(&evidence_dir_clone, &wih_id_clone, 0.9, true);
    });
    
    // Provider should wait and then return evidence
    let start = std::time::Instant::now();
    let evidence = provider.gather_evidence(wih_id).await;
    let elapsed = start.elapsed();
    
    assert!(evidence.is_ok());
    assert!(elapsed.as_millis() >= 300); // Should have waited
    assert_eq!(evidence.unwrap().overall_confidence, 0.9);
}

/// Test file-based provider timeout
#[tokio::test]
async fn test_file_based_provider_timeout() {
    let temp_dir = TempDir::new().unwrap();
    let evidence_dir = temp_dir.path().join("evidence");
    std::fs::create_dir_all(&evidence_dir).unwrap();
    
    let provider = FileBasedProvider::new(FileBasedProviderConfig {
        evidence_dir,
        poll_interval_ms: 100,
        max_wait_seconds: 1, // Short timeout
        ready_suffix: ".ready".to_string(),
        evidence_suffix: ".json".to_string(),
    });
    
    // Don't write any evidence - should timeout
    let result = provider.gather_evidence("test_wih_timeout").await;
    
    assert!(result.is_err());
    match result.unwrap_err() {
        ProviderError::Timeout(secs) => assert_eq!(secs, 1),
        other => panic!("Expected Timeout error, got {:?}", other),
    }
}

/// Test governance policy validation
#[tokio::test]
async fn test_policy_validation_passes() {
    let policy = VisualVerificationPolicy {
        enabled: true,
        min_confidence: 0.7,
        required_types: vec![ArtifactType::ConsoleOutput],
        ..Default::default()
    };
    
    let evidence = create_test_evidence(0.8, vec![ArtifactType::ConsoleOutput]);
    
    match policy.validate_evidence(&evidence) {
        ValidationResult::Pass => (), // Expected
        ValidationResult::Fail(reason) => panic!("Should pass: {}", reason),
    }
}

/// Test governance policy validation fails on low confidence
#[tokio::test]
async fn test_policy_validation_fails_low_confidence() {
    let policy = VisualVerificationPolicy {
        enabled: true,
        min_confidence: 0.7,
        required_types: vec![],
        ..Default::default()
    };
    
    let evidence = create_test_evidence(0.5, vec![]);
    
    match policy.validate_evidence(&evidence) {
        ValidationResult::Pass => panic!("Should fail on low confidence"),
        ValidationResult::Fail(reason) => {
            assert!(reason.contains("50.0%"));
            assert!(reason.contains("70.0%"));
        }
    }
}

/// Test governance policy validation fails on missing type
#[tokio::test]
async fn test_policy_validation_fails_missing_type() {
    let policy = VisualVerificationPolicy {
        enabled: true,
        min_confidence: 0.5,
        required_types: vec![
            ArtifactType::UiState,
            ArtifactType::CoverageMap,
        ],
        ..Default::default()
    };
    
    // Evidence only has console output, not UI state or coverage
    let evidence = create_test_evidence(0.9, vec![ArtifactType::ConsoleOutput]);
    
    match policy.validate_evidence(&evidence) {
        ValidationResult::Pass => panic!("Should fail on missing type"),
        ValidationResult::Fail(reason) => {
            assert!(reason.contains("UiState") || reason.contains("CoverageMap"));
        }
    }
}

/// Test that disabled policy always passes
#[tokio::test]
async fn test_disabled_policy_always_passes() {
    let policy = VisualVerificationPolicy {
        enabled: false, // Disabled!
        min_confidence: 0.99,
        required_types: vec![ArtifactType::UiState],
        ..Default::default()
    };
    
    // Even with terrible evidence, should pass
    let evidence = create_test_evidence(0.1, vec![]);
    
    match policy.validate_evidence(&evidence) {
        ValidationResult::Pass => (), // Expected
        ValidationResult::Fail(_) => panic!("Disabled policy should always pass"),
    }
}

// ============================================================================
// Test Helpers
// ============================================================================

async fn create_test_gate(temp_dir: &TempDir, visual_enabled: bool) -> Gate {
    let root_dir = temp_dir.path().to_path_buf();
    let evidence_dir = root_dir.join(".allternit/evidence");
    std::fs::create_dir_all(&evidence_dir).unwrap();
    
    // Create minimal ledger, leases, receipts
    let ledger = Arc::new(Ledger::new(root_dir.join(".allternit/ledger")));
    let leases = Arc::new(Leases::new(ledger.clone()));
    let receipts = Arc::new(ReceiptStore::new(root_dir.join(".allternit/receipts")));
    
    let provider_factory = Arc::new(ProviderFactory::new());
    
    let visual_config = if visual_enabled {
        Some(VisualConfig {
            provider_type: ProviderType::FileBased,
            min_confidence: 0.7,
            timeout_seconds: 5,
            evidence_dir,
        })
    } else {
        None
    };
    
    Gate::new(GateOptions {
        ledger,
        leases,
        receipts,
        index: None,
        vault: None,
        root_dir,
        actor_id: Some("test".to_string()),
        strict_provenance: false,
        provider_factory,
        visual_config,
    })
}

async fn create_test_wih_with_pass(gate: &Gate) -> String {
    let wih_id = format!("test_wih_{}", rand::random::<u32>());
    
    // Create WIH
    gate.wih_pickup("test_dag", "test_node", "test_agent").await.unwrap();
    
    // Sign open
    gate.wih_sign_open(&wih_id, "test_signature").await.unwrap();
    
    // Close with PASS
    gate.wih_close(&wih_id, "PASS", &["test_evidence".to_string()]).await.unwrap();
    
    wih_id
}

fn write_test_evidence(
    evidence_dir: &PathBuf,
    wih_id: &str,
    confidence: f64,
    success: bool,
) {
    let evidence = serde_json::json!({
        "version": "1.0",
        "wih_id": wih_id,
        "captured_at": chrono::Utc::now().to_rfc3339(),
        "provider_id": "test-provider",
        "success": success,
        "overall_confidence": confidence,
        "artifacts": [
            {
                "artifact_type": "console-output",
                "confidence": confidence,
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "description": "Test artifact",
                "verification_claim": "Test claim",
                "data": {},
                "llm_context": "Test context",
            }
        ],
        "errors": [],
        "metadata": {},
    });
    
    let evidence_path = evidence_dir.join(format!("{}.json", wih_id));
    let ready_path = evidence_dir.join(format!("{}.ready", wih_id));
    
    std::fs::write(&evidence_path, evidence.to_string()).unwrap();
    std::fs::write(&ready_path, "").unwrap();
}

fn create_test_evidence(confidence: f64, types: Vec<ArtifactType>) -> Evidence {
    Evidence {
        evidence_id: format!("ev_{}", rand::random::<u32>()),
        wih_id: "test".to_string(),
        artifacts: types.into_iter().map(|t| Artifact {
            id: format!("art_{}", rand::random::<u32>()),
            artifact_type: t,
            confidence: confidence,
            timestamp: chrono::Utc::now().to_rfc3339(),
            description: "Test".to_string(),
            verification_claim: "Test".to_string(),
            data: None,
            llm_context: "Test".to_string(),
        }).collect(),
        overall_confidence: confidence,
        success: true,
    }
}
