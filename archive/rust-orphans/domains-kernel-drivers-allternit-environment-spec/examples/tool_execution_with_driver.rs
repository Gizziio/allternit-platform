//! Example: Tool Execution with Driver Integration
//!
//! This example demonstrates how to:
//! 1. Load an environment specification
//! 2. Spawn a driver with the environment
//! 3. Execute a command in the spawned environment
//! 4. Clean up resources

use allternit_driver_interface::{
    CommandSpec, EnvSpecType, ExecutionDriver, PolicySpec, ResourceSpec, SpawnSpec,
};
use allternit_environment_spec::{EnvironmentSource, EnvironmentSpecLoader};
use allternit_process_driver::ProcessDriver;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║  Tool Execution with Driver Integration Example              ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");

    // Step 1: Create environment loader with caching
    println!("📦 Step 1: Initializing environment loader...");
    let env_loader = EnvironmentSpecLoader::new()?;
    println!("   ✓ Environment loader initialized\n");

    // Step 2: Load environment specification
    println!("📦 Step 2: Loading environment specification...");
    let env_source = "docker.io/library/alpine:latest";
    let env_spec = match env_loader.load(env_source).await {
        Ok(spec) => {
            println!("   ✓ Environment loaded: {}", spec.image);
            println!("   ✓ Source type: {:?}", spec.source);
            println!("   ✓ Workspace: {}\n", spec.workspace_folder);
            spec
        }
        Err(e) => {
            println!("   ⚠ Could not load environment (expected in tests): {}", e);
            println!("   Using default environment instead\n");
            // Create default environment
            allternit_environment_spec::EnvironmentSpec {
                source: EnvironmentSource::Oci,
                source_uri: env_source.to_string(),
                image: env_source.to_string(),
                image_digest: None,
                workspace_folder: "/workspace".to_string(),
                env_vars: std::collections::HashMap::new(),
                packages: vec![],
                features: vec![],
                mounts: vec![],
                post_create_commands: vec![],
                resources: allternit_environment_spec::ResourceRequirements::default(),
                allternit_config: Default::default(),
            }
        }
    };

    // Step 3: Create driver directly
    println!("📦 Step 3: Creating process driver...");
    let driver = ProcessDriver::new();
    println!("   ✓ Process driver created\n");

    // Step 4: Spawn execution environment
    println!("📦 Step 4: Spawning execution environment...");
    let run_id = allternit_driver_interface::ExecutionId::new();
    let tenant_id = "example-tenant";

    let spawn_spec = SpawnSpec {
        tenant: allternit_driver_interface::TenantId(tenant_id.to_string()),
        project: None,
        workspace: None,
        run_id: Some(run_id),
        env: allternit_driver_interface::EnvironmentSpec {
            spec_type: EnvSpecType::Oci,
            image: env_spec.image.clone(),
            version: env_spec.image_digest.clone(),
            packages: env_spec.packages.clone(),
            env_vars: env_spec.env_vars.clone(),
            working_dir: Some(env_spec.workspace_folder.clone()),
            mounts: vec![], // Mounts would be converted here
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

    let handle = match driver.spawn(spawn_spec).await {
        Ok(h) => {
            println!("   ✓ Environment spawned successfully");
            println!("   ✓ Run ID: {}", h.id.0);
            println!("   ✓ Tenant: {}\n", h.tenant.0);
            h
        }
        Err(e) => {
            println!("   ✗ Failed to spawn environment: {}", e);
            return Err(e.to_string().into());
        }
    };

    // Step 5: Execute command in spawned environment
    println!("📦 Step 5: Executing command in environment...");
    let cmd_spec = CommandSpec {
        command: vec![
            "echo".to_string(),
            "Hello from spawned environment!".to_string(),
        ],
        env_vars: std::collections::HashMap::new(),
        working_dir: Some(env_spec.workspace_folder.clone()),
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    let exec_result = match driver.exec(&handle, cmd_spec).await {
        Ok(result) => {
            println!("   ✓ Command executed successfully");
            println!("   ✓ Exit code: {}", result.exit_code);
            if let Some(ref stdout) = result.stdout {
                if !stdout.is_empty() {
                    println!(
                        "   ✓ Stdout: {}",
                        String::from_utf8_lossy(stdout.as_slice())
                    );
                }
            }
            if let Some(ref stderr) = result.stderr {
                if !stderr.is_empty() {
                    println!(
                        "   ✓ Stderr: {}",
                        String::from_utf8_lossy(stderr.as_slice())
                    );
                }
            }
            result
        }
        Err(e) => {
            println!("   ✗ Command execution failed: {}", e);
            return Err(e.to_string().into());
        }
    };

    // Step 6: Cleanup
    println!("\n📦 Step 6: Cleaning up resources...");
    match driver.destroy(&handle).await {
        Ok(_) => println!("   ✓ Environment destroyed successfully"),
        Err(e) => println!("   ⚠ Failed to destroy environment: {}", e),
    }

    // Summary
    println!("\n╔═══════════════════════════════════════════════════════════════╗");
    println!("║  Execution Summary                                            ║");
    println!("╠═══════════════════════════════════════════════════════════════╣");
    println!("║  Environment: {:47} ║", env_spec.image);
    println!("║  Driver:      {:47} ║", "process");
    println!("║  Run ID:      {:47} ║", handle.id.0);
    println!("║  Exit Code:   {:47} ║", exec_result.exit_code);
    println!("║  Success:     {:47} ║", exec_result.exit_code == 0);
    println!("╚═══════════════════════════════════════════════════════════════╝");

    Ok(())
}
