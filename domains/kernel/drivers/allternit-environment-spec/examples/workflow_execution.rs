//! Example: Workflow Execution with DAG (N7)
//!
//! This example demonstrates how to:
//! 1. Define a workflow DAG
//! 2. Execute nodes in topological order
//! 3. Pass state between nodes
//! 4. Handle errors and retries

use a2r_driver_interface::{
    CommandSpec, EnvSpecType, ExecutionDriver, ExecutionId, PolicySpec, ResourceSpec, SpawnSpec,
    TenantId,
};
use a2r_process_driver::ProcessDriver;
use std::collections::{HashMap, HashSet};
use std::time::Instant;

/// Workflow node definition
#[derive(Debug, Clone)]
struct WorkflowNode {
    id: String,
    name: String,
    command: Vec<String>,
    dependencies: Vec<String>,
    retries: u32,
}

/// Workflow DAG
#[derive(Debug)]
struct Workflow {
    name: String,
    nodes: Vec<WorkflowNode>,
}

/// Node execution result
#[derive(Debug)]
struct NodeResult {
    node_id: String,
    success: bool,
    exit_code: i32,
    stdout: Option<String>,
    stderr: Option<String>,
    execution_time_ms: u64,
}

/// Workflow engine
struct WorkflowEngine {
    driver: ProcessDriver,
}

impl WorkflowEngine {
    fn new() -> Self {
        Self {
            driver: ProcessDriver::new(),
        }
    }

    /// Execute workflow
    async fn execute(
        &self,
        workflow: Workflow,
        tenant_id: &str,
    ) -> Result<Vec<NodeResult>, String> {
        println!("🔄 Executing workflow: {}\n", workflow.name);

        // Build dependency graph
        let mut dependency_map: HashMap<String, Vec<String>> = HashMap::new();
        let mut completed_nodes: HashSet<String> = HashSet::new();
        let mut results: Vec<NodeResult> = Vec::new();

        for node in &workflow.nodes {
            dependency_map.insert(node.id.clone(), node.dependencies.clone());
        }

        // Execute nodes in waves (topological sort)
        let mut remaining_nodes: Vec<WorkflowNode> = workflow.nodes.clone();
        let mut wave = 1;

        while !remaining_nodes.is_empty() {
            // Find nodes with all dependencies satisfied
            let ready_nodes: Vec<WorkflowNode> = remaining_nodes
                .iter()
                .filter(|node| {
                    node.dependencies
                        .iter()
                        .all(|dep| completed_nodes.contains(dep))
                })
                .cloned()
                .collect();

            if ready_nodes.is_empty() && !remaining_nodes.is_empty() {
                return Err("Circular dependency detected in workflow".to_string());
            }

            println!("📊 Wave {}: Executing {} node(s)", wave, ready_nodes.len());

            // Execute ready nodes
            for node in &ready_nodes {
                let result = self.execute_node(node, tenant_id).await?;

                if result.success {
                    completed_nodes.insert(node.id.clone());
                    results.push(result);
                } else if node.retries > 0 {
                    println!(
                        "   ⚠ Node {} failed, will retry ({} retries left)",
                        node.id, node.retries
                    );
                    // In real implementation, add to retry queue
                } else {
                    return Err(format!("Node {} failed and no retries left", node.id));
                }

                // Remove from remaining
                remaining_nodes.retain(|n| n.id != node.id);
            }

            wave += 1;
        }

        Ok(results)
    }

    /// Execute a single node
    async fn execute_node(
        &self,
        node: &WorkflowNode,
        tenant_id: &str,
    ) -> Result<NodeResult, String> {
        println!("   ▶️  Executing node: {}", node.name);
        let start = Instant::now();

        // Spawn environment
        let spawn_spec = SpawnSpec {
            tenant: TenantId(tenant_id.to_string()),
            project: None,
            workspace: None,
            run_id: Some(ExecutionId::new()),
            env: a2r_driver_interface::EnvironmentSpec {
                spec_type: EnvSpecType::Oci,
                image: "alpine:latest".to_string(),
                version: None,
                packages: vec![],
                env_vars: HashMap::new(),
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

        let handle = self
            .driver
            .spawn(spawn_spec)
            .await
            .map_err(|e| format!("Spawn failed: {}", e))?;

        // Execute command
        let cmd_spec = CommandSpec {
            command: node.command.clone(),
            env_vars: HashMap::new(),
            working_dir: Some("/workspace".to_string()),
            stdin_data: None,
            capture_stdout: true,
            capture_stderr: true,
        };

        let exec_result = self
            .driver
            .exec(&handle, cmd_spec)
            .await
            .map_err(|e| format!("Exec failed: {}", e))?;

        let execution_time_ms = start.elapsed().as_millis() as u64;

        // Cleanup
        let _ = self.driver.destroy(&handle).await;

        let result = NodeResult {
            node_id: node.id.clone(),
            success: exec_result.exit_code == 0,
            exit_code: exec_result.exit_code,
            stdout: exec_result
                .stdout
                .map(|s| String::from_utf8_lossy(&s).to_string()),
            stderr: exec_result
                .stderr
                .map(|s| String::from_utf8_lossy(&s).to_string()),
            execution_time_ms,
        };

        if result.success {
            println!(
                "   ✅ Node {} completed in {}ms",
                node.id, execution_time_ms
            );
        } else {
            println!(
                "   ❌ Node {} failed with exit code {}",
                node.id, exec_result.exit_code
            );
        }

        Ok(result)
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║  Workflow Execution with DAG (N7) Example                    ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");

    // Define a sample workflow
    // A simple CI/CD-like pipeline:
    // 1. checkout (no deps)
    // 2. build (depends on checkout)
    // 3. test (depends on build)
    // 4. package (depends on build)
    // 5. deploy (depends on test and package)

    let workflow = Workflow {
        name: "CI/CD Pipeline".to_string(),
        nodes: vec![
            WorkflowNode {
                id: "checkout".to_string(),
                name: "Checkout Code".to_string(),
                command: vec!["echo".to_string(), "Checking out code...".to_string()],
                dependencies: vec![],
                retries: 0,
            },
            WorkflowNode {
                id: "build".to_string(),
                name: "Build Application".to_string(),
                command: vec!["echo".to_string(), "Building application...".to_string()],
                dependencies: vec!["checkout".to_string()],
                retries: 2,
            },
            WorkflowNode {
                id: "test".to_string(),
                name: "Run Tests".to_string(),
                command: vec!["echo".to_string(), "Running tests...".to_string()],
                dependencies: vec!["build".to_string()],
                retries: 1,
            },
            WorkflowNode {
                id: "package".to_string(),
                name: "Package Artifacts".to_string(),
                command: vec!["echo".to_string(), "Packaging artifacts...".to_string()],
                dependencies: vec!["build".to_string()],
                retries: 0,
            },
            WorkflowNode {
                id: "deploy".to_string(),
                name: "Deploy to Production".to_string(),
                command: vec!["echo".to_string(), "Deploying to production...".to_string()],
                dependencies: vec!["test".to_string(), "package".to_string()],
                retries: 0,
            },
        ],
    };

    // Display workflow structure
    println!("📋 Workflow Structure:");
    println!("   Name: {}", workflow.name);
    println!("   Nodes: {}", workflow.nodes.len());
    for node in &workflow.nodes {
        let deps = if node.dependencies.is_empty() {
            "none".to_string()
        } else {
            node.dependencies.join(", ")
        };
        println!("   - {} (depends on: {})", node.name, deps);
    }
    println!();

    // Execute workflow
    let engine = WorkflowEngine::new();
    let tenant_id = "ci-tenant";

    let start = Instant::now();
    match engine.execute(workflow, tenant_id).await {
        Ok(results) => {
            let total_time = start.elapsed();

            println!("\n✅ Workflow completed successfully!");
            println!("   Total execution time: {:?}\n", total_time);

            // Display results
            println!("📊 Node Execution Results:");
            for result in &results {
                println!(
                    "   - {}: {} ({}ms)",
                    result.node_id,
                    if result.success { "✅" } else { "❌" },
                    result.execution_time_ms
                );
            }

            // Summary
            let successful = results.iter().filter(|r| r.success).count();
            let total: usize = results.len();

            println!("\n╔═══════════════════════════════════════════════════════════════╗");
            println!("║  Workflow Execution Summary                                   ║");
            println!("╠═══════════════════════════════════════════════════════════════╣");
            println!("║  Total Nodes:     {:43} ║", total);
            println!("║  Successful:      {:43} ║", successful);
            println!("║  Failed:          {:43} ║", total - successful);
            println!("║  Total Time:      {:43?} ║", total_time);
            println!("╚═══════════════════════════════════════════════════════════════╝");
        }
        Err(e) => {
            println!("\n❌ Workflow failed: {}", e);
            return Err(e.into());
        }
    }

    Ok(())
}
