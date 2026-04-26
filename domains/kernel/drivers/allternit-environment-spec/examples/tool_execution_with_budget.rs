//! Example: Tool Execution with Budget Metering (N11)
//!
//! This example demonstrates how to:
//! 1. Set up a budget quota for a tenant
//! 2. Check budget before execution
//! 3. Record resource consumption during execution
//! 4. Enforce budget limits

use allternit_driver_interface::{
    CommandSpec, EnvSpecType, ExecutionDriver, PolicySpec, ResourceSpec, SpawnSpec,
};
use allternit_environment_spec::{EnvironmentSource, EnvironmentSpecLoader};
use allternit_process_driver::ProcessDriver;
use allternit_budget_metering::{BudgetMeteringEngine, BudgetQuota, ResourceMeasurement};
use chrono::Utc;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║  Tool Execution with Budget Metering (N11) Example           ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");

    // Step 1: Initialize components
    println!("📦 Step 1: Initializing components...");
    let env_loader = EnvironmentSpecLoader::new()?;
    let budget_engine = BudgetMeteringEngine::new();
    let driver = ProcessDriver::new();
    let tenant_id = "example-tenant";
    let run_id = Uuid::new_v4().to_string();
    println!("   ✓ Environment loader initialized");
    println!("   ✓ Budget engine initialized");
    println!("   ✓ Process driver created");
    println!("   ✓ Tenant: {}", tenant_id);
    println!("   ✓ Run ID: {}\n", run_id);

    // Step 2: Register budget quota
    println!("📦 Step 2: Registering budget quota...");
    let quota = BudgetQuota {
        quota_id: format!("quota-{}", tenant_id),
        tenant_id: tenant_id.to_string(),
        run_id: Some(run_id.clone()),
        cpu_seconds_limit: 60,          // 1 CPU minute
        memory_mb_seconds_limit: 30720, // 512 MB for 60 seconds
        network_bytes_limit: 104857600, // 100 MB
        max_concurrent_workers: 5,
        valid_from: Utc::now(),
        valid_until: None,
        priority: 1,
    };

    budget_engine.register_quota(quota).await?;
    println!("   ✓ Budget quota registered");
    println!("     - CPU limit: 60 seconds");
    println!("     - Memory limit: 30720 MB-seconds");
    println!("     - Network limit: 100 MB\n");

    // Step 3: Check budget before execution
    println!("📦 Step 3: Checking budget availability...");
    let budget_check = budget_engine.check_budget(tenant_id, Some(&run_id)).await?;

    match &budget_check.admission {
        allternit_budget_metering::AdmissionDecision::Allow => {
            println!("   ✓ Budget check passed - execution allowed");
            println!("     - CPU used: {}%", budget_check.cpu_percent);
            println!("     - Memory used: {}%", budget_check.memory_percent);
        }
        allternit_budget_metering::AdmissionDecision::Deny { reason } => {
            println!("   ✗ Budget check failed: {}", reason);
            return Err(format!("Budget exceeded: {}", reason).into());
        }
        allternit_budget_metering::AdmissionDecision::AllowWithWarning { warning } => {
            println!("   ⚠ Budget check passed with warning: {}", warning);
        }
    }
    println!();

    // Step 4: Load environment and spawn
    println!("📦 Step 4: Loading environment and spawning...");
    let env_spec = allternit_environment_spec::EnvironmentSpec {
        source: EnvironmentSource::Oci,
        source_uri: "docker.io/library/alpine:latest".to_string(),
        image: "docker.io/library/alpine:latest".to_string(),
        image_digest: None,
        workspace_folder: "/workspace".to_string(),
        env_vars: std::collections::HashMap::new(),
        packages: vec![],
        features: vec![],
        mounts: vec![],
        post_create_commands: vec![],
        resources: allternit_environment_spec::ResourceRequirements::default(),
        allternit_config: Default::default(),
    };

    let spawn_spec = SpawnSpec {
        tenant: allternit_driver_interface::TenantId(tenant_id.to_string()),
        project: None,
        workspace: None,
        run_id: Some(allternit_driver_interface::ExecutionId::new()),
        env: allternit_driver_interface::EnvironmentSpec {
            spec_type: EnvSpecType::Oci,
            image: env_spec.image.clone(),
            version: env_spec.image_digest.clone(),
            packages: env_spec.packages.clone(),
            env_vars: env_spec.env_vars.clone(),
            working_dir: Some(env_spec.workspace_folder.clone()),
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

    let start_time = std::time::Instant::now();
    let handle = driver.spawn(spawn_spec).await?;
    println!("   ✓ Environment spawned (ID: {})\n", handle.id.0);

    // Step 5: Execute command with budget tracking
    println!("📦 Step 5: Executing command with budget tracking...");
    let cmd_spec = CommandSpec {
        command: vec![
            "echo".to_string(),
            "Hello with budget tracking!".to_string(),
        ],
        env_vars: std::collections::HashMap::new(),
        working_dir: Some(env_spec.workspace_folder.clone()),
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    let exec_result = driver.exec(&handle, cmd_spec).await?;
    let elapsed_seconds = start_time.elapsed().as_secs();
    println!("   ✓ Command executed");
    println!("     - Exit code: {}", exec_result.exit_code);
    println!("     - Duration: {} seconds\n", elapsed_seconds);

    // Step 6: Record resource consumption
    println!("📦 Step 6: Recording resource consumption...");
    let measurement = ResourceMeasurement {
        measurement_id: Uuid::new_v4().to_string(),
        run_id: run_id.clone(),
        worker_id: handle.id.0.to_string(),
        timestamp: Utc::now(),
        cpu_seconds_delta: elapsed_seconds,
        memory_mb_current: 256,
        memory_mb_peak: 256,
        network_bytes_sent: 0,
        network_bytes_received: 0,
    };

    budget_engine.record_measurement(measurement).await?;
    println!("   ✓ Resource consumption recorded");
    println!("     - CPU seconds: {}", elapsed_seconds);
    println!("     - Memory MB: 256\n");

    // Step 7: Get updated budget usage
    println!("📦 Step 7: Checking updated budget usage...");
    let usage = budget_engine.get_usage(tenant_id, Some(&run_id)).await?;
    println!("   ✓ Budget usage summary");
    println!("     - CPU used: {:.1}%", usage.cpu_percent);
    println!("     - Memory used: {:.1}%", usage.memory_percent);
    println!("     - Over budget: {}", usage.is_over_budget);
    println!(
        "     - Estimated remaining: {} seconds\n",
        usage.estimated_remaining_seconds
    );

    // Step 8: Cleanup
    println!("📦 Step 8: Cleaning up...");
    driver.destroy(&handle).await?;
    println!("   ✓ Resources cleaned up\n");

    // Summary
    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║  Budget-Aware Execution Summary                               ║");
    println!("╠═══════════════════════════════════════════════════════════════╣");
    println!("║  Run ID:          {:43} ║", run_id);
    println!("║  CPU Used:         {:42.1}% ║", usage.cpu_percent);
    println!("║  Memory Used:      {:42.1}% ║", usage.memory_percent);
    println!(
        "║  Status:           {:43} ║",
        if usage.is_over_budget {
            "OVER BUDGET"
        } else {
            "WITHIN BUDGET"
        }
    );
    println!("╚═══════════════════════════════════════════════════════════════╝");

    Ok(())
}
