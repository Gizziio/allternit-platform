//! Example: Tool Execution with Replay Capture (N12)
//!
//! This example demonstrates how to:
//! 1. Start a replay capture session
//! 2. Execute commands with deterministic tracking
//! 3. Save the execution trace for replay
//! 4. Replay the execution later

use allternit_driver_interface::{
    CommandSpec, DeterminismEnvelope, EnvSpecType, ExecutionDriver, ExecutionId, PolicySpec,
    ResourceSpec, SpawnSpec,
};
use allternit_process_driver::ProcessDriver;
use allternit_replay::{CaptureLevel, ReplayEngine};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║  Tool Execution with Replay Capture (N12) Example            ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");

    // Step 1: Initialize components
    println!("📦 Step 1: Initializing components...");
    let mut replay_engine = ReplayEngine::with_capture_level(CaptureLevel::Full);
    let driver = ProcessDriver::new();
    let run_id = ExecutionId::new();
    println!("   ✓ Replay engine initialized");
    println!("   ✓ Process driver created");
    println!("   ✓ Run ID: {}\n", run_id.0);

    // Step 2: Start replay capture
    println!("📦 Step 2: Starting replay capture session...");
    let envelope = DeterminismEnvelope {
        env_spec_hash: "abc123".to_string(),
        tool_versions: HashMap::new(),
        policy_hash: "def456".to_string(),
        inputs_hash: "ghi789".to_string(),
        time_frozen: true,
        seed: Some(12345),
    };

    let time_frozen = envelope.time_frozen;
    let seed = envelope.seed;
    replay_engine.start_capture(run_id, envelope);
    println!("   ✓ Capture session started");
    println!("     - Level: Full");
    println!("     - Deterministic mode: enabled");
    println!("     - Time frozen: {}", time_frozen);
    println!("     - Seed: {:?}\n", seed);

    // Step 3: Spawn execution environment
    println!("📦 Step 3: Spawning execution environment...");
    let spawn_spec = SpawnSpec {
        tenant: allternit_driver_interface::TenantId("example-tenant".to_string()),
        project: None,
        workspace: None,
        run_id: Some(ExecutionId::new()),
        env: allternit_driver_interface::EnvironmentSpec {
            spec_type: EnvSpecType::Oci,
            image: "alpine:latest".to_string(),
            version: None,
            packages: vec![],
            env_vars: std::collections::HashMap::new(),
            working_dir: Some("/workspace".to_string()),
            mounts: vec![],
        },
        policy: PolicySpec::default_permissive(),
        resources: ResourceSpec {
            cpu_millis: 100,
            memory_mib: 256,
            disk_mib: Some(1024),
            gpu_count: Some(0),
            network_egress_kib: Some(1024),
        },
        envelope: None,
        prewarm_pool: None,
    };

    let handle = driver.spawn(spawn_spec).await?;
    println!("   ✓ Environment spawned (ID: {})\n", handle.id.0);

    // Step 4: Execute command with capture
    println!("📦 Step 4: Executing command with capture...");
    let cmd_spec = CommandSpec {
        command: vec!["echo".to_string(), "Hello with replay!".to_string()],
        env_vars: std::collections::HashMap::new(),
        working_dir: Some("/workspace".to_string()),
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    // Record timestamp before execution
    replay_engine.record_timestamp(run_id, "command_start");

    let exec_result = driver.exec(&handle, cmd_spec.clone()).await?;

    // Record timestamp after execution
    replay_engine.record_timestamp(run_id, "command_complete");

    // Capture output
    let output = exec_result
        .stdout
        .as_ref()
        .map(|s| String::from_utf8_lossy(s).to_string())
        .unwrap_or_default();
    replay_engine.capture_output(run_id, "command_output", &output, "output_hash_123");

    println!("   ✓ Command executed");
    println!("     - Exit code: {}", exec_result.exit_code);
    println!("   ✓ Execution captured for replay\n");

    // Step 5: Complete capture
    println!("📦 Step 5: Completing capture session...");
    let manifest = replay_engine
        .complete_capture(run_id)
        .expect("Capture should complete successfully");
    println!("   ✓ Capture completed");
    println!("     - Manifest ID: {}", manifest.run_id.0);
    println!(
        "     - Captured outputs: {}",
        manifest.captured_outputs.len()
    );
    println!("     - Timestamps: {}\n", manifest.timestamps.len());

    // Step 6: List available manifests
    println!("📦 Step 6: Listing available replay manifests...");
    let manifests = replay_engine.list_manifests();
    println!("   ✓ Found {} manifest(s)", manifests.len());
    for m in &manifests {
        println!("     - Run ID: {}", m.run_id.0);
        println!("       Outputs: {}", m.captured_outputs.len());
        println!("       Timestamps: {}", m.timestamps.len());
    }
    println!();

    // Step 7: Demonstrate replay capability
    println!("📦 Step 7: Demonstrating replay capability...");
    match replay_engine.replay(run_id) {
        Ok(result) => {
            println!("   ✓ Replay executed successfully");
            println!("     - Run ID: {}", result.run_id.0);
            println!("     - Can replay: {}", result.can_replay);
            println!("     - Time frozen: {}", result.envelope.time_frozen);
        }
        Err(e) => {
            println!("   ⚠ Replay demonstration: {:?}", e);
        }
    }
    println!();

    // Step 8: Cleanup
    println!("📦 Step 8: Cleaning up...");
    driver.destroy(&handle).await?;
    println!("   ✓ Resources cleaned up\n");

    // Summary
    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║  Replay Capture Summary                                       ║");
    println!("╠═══════════════════════════════════════════════════════════════╣");
    println!("║  Run ID:          {:43} ║", run_id.0);
    println!(
        "║  Outputs:         {:43} ║",
        manifest.captured_outputs.len()
    );
    println!("║  Timestamps:      {:43} ║", manifest.timestamps.len());
    println!("║  Deterministic:   {:43} ║", "YES");
    println!(
        "║  Capture Level:   {:43} ║",
        format!("{:?}", replay_engine.capture_level())
    );
    println!("╚═══════════════════════════════════════════════════════════════╝");

    Ok(())
}
