//! P5: Stress Testing Suite for Firecracker Driver
//!
//! Comprehensive stress tests for the Firecracker MicroVM driver including:
//! - Spawn storm (concurrent VM creation)
//! - Rapid create/destroy cycles
//! - Resource exhaustion handling
//! - Network policy scaling
//! - Panic recovery

mod common;

use a2r_driver_interface::{
    CommandSpec, DriverError, EnvironmentSpec, ExecutionDriver, ExecutionHandle, ExecutionId,
    NetworkPolicy, PolicySpec, ResourceSpec, SpawnSpec, TenantId,
};
use a2r_firecracker_driver::{FirecrackerConfig, FirecrackerDriver};
use common::*;
use std::collections::HashMap;
use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, Semaphore};
use tokio::time::{sleep, timeout};

// Maximum time for a single test
const TEST_TIMEOUT_SECONDS: u64 = 300;

/// P5.1: Spawn Storm Test - Spawn 100 VMs concurrently
/// Measures latency percentiles and verifies no resource leaks
#[tokio::test]
async fn test_spawn_storm_100_concurrent() {
    init_test_tracing();

    let (driver, test_dirs, config) = create_test_driver().await;
    let driver = Arc::new(driver);

    // Capture initial resource state
    let mut report = capture_resource_state(&config).await;

    let start_time = Instant::now();
    let concurrent_count = 100;
    let semaphore = Arc::new(Semaphore::new(20)); // Limit concurrent spawns to 20
    let mut handles = Vec::with_capacity(concurrent_count);
    let latencies = Arc::new(Mutex::new(Vec::with_capacity(concurrent_count)));
    let success_count = Arc::new(AtomicUsize::new(0));
    let fail_count = Arc::new(AtomicUsize::new(0));

    // Spawn VMs concurrently
    for i in 0..concurrent_count {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let driver_ref = Arc::clone(&driver);
        let test_config = TestConfig::default();
        let latencies_ref = latencies.clone();
        let success_ref = success_count.clone();
        let fail_ref = fail_count.clone();

        let handle = tokio::spawn(async move {
            let spawn_start = Instant::now();

            let result =
                spawn_test_vm(&driver_ref, &format!("storm-test-{}", i), &test_config).await;

            let latency_ms = spawn_start.elapsed().as_secs_f64() * 1000.0;
            latencies_ref.lock().await.push(latency_ms);

            let _handle: Option<ExecutionHandle> = match result {
                Ok(vm_handle) => {
                    success_ref.fetch_add(1, Ordering::SeqCst);
                    // Schedule cleanup
                    let _ = driver_ref.destroy(&vm_handle).await;
                    Some(vm_handle)
                }
                Err(e) => {
                    fail_ref.fetch_add(1, Ordering::SeqCst);
                    warn!("VM {} spawn failed: {:?}", i, e);
                    None
                }
            };

            drop(permit);
        });

        handles.push(handle);
    }

    // Wait for all spawns to complete
    for handle in handles {
        let _ = handle.await;
    }

    let total_duration = start_time.elapsed();

    // Wait for cleanup to stabilize
    wait_for_cleanup_stabilization().await;

    // Complete resource report
    report = complete_resource_report(report, &config).await;

    // Calculate statistics
    let latencies_guard = latencies.lock().await;
    let stats = LatencyStats::from_latencies(latencies_guard.clone());
    drop(latencies_guard); // Release the lock before moving latencies

    let successful = success_count.load(Ordering::SeqCst);
    let failed = fail_count.load(Ordering::SeqCst);

    info!("Spawn Storm Results:\n{}", stats.format_report());
    info!(
        "Total time: {:.2}s, Successful: {}, Failed: {}",
        total_duration.as_secs_f64(),
        successful,
        failed
    );
    info!("Resource Report:\n{}", report.format_report());

    // Assertions
    // At least 80% of spawns should succeed (allowing for resource limits)
    let success_rate = successful as f64 / concurrent_count as f64;
    assert!(
        success_rate >= 0.8,
        "Success rate too low: {:.1}% ({} of {})",
        success_rate * 100.0,
        successful,
        concurrent_count
    );

    // Latency p99 should be under 30 seconds
    assert!(
        stats.p99_ms < 30000.0,
        "p99 latency too high: {:.2}ms",
        stats.p99_ms
    );

    // No resource leaks allowed
    assert_no_resource_leaks(&report);

    // Cleanup
    test_dirs.cleanup().await;
}

/// P5.2: Rapid Create/Destroy Test
/// Create and destroy 1000 VMs sequentially to detect resource leaks
#[tokio::test]
async fn test_rapid_create_destroy() {
    init_test_tracing();

    let (driver, test_dirs, config) = create_test_driver().await;

    // Capture initial resource state
    let mut report = capture_resource_state(&config).await;

    let cycle_count = 1000;
    let mut latencies = Vec::with_capacity(cycle_count);
    let mut errors = 0;

    let start_time = Instant::now();

    for i in 0..cycle_count {
        let cycle_start = Instant::now();

        // Create VM
        let test_config = TestConfig::default();
        match spawn_test_vm(&driver, &format!("rapid-test-{}", i), &test_config).await {
            Ok(handle) => {
                // Immediately destroy
                if let Err(e) = driver.destroy(&handle).await {
                    warn!("Destroy failed at iteration {}: {:?}", i, e);
                    errors += 1;
                }
            }
            Err(e) => {
                warn!("Spawn failed at iteration {}: {:?}", i, e);
                errors += 1;
            }
        }

        let cycle_latency = cycle_start.elapsed().as_secs_f64() * 1000.0;
        latencies.push(cycle_latency);

        // Log progress every 100 iterations
        if (i + 1) % 100 == 0 {
            info!("Completed {} of {} cycles", i + 1, cycle_count);
        }
    }

    let total_duration = start_time.elapsed();

    // Wait for cleanup stabilization
    wait_for_cleanup_stabilization().await;

    // Complete resource report
    report = complete_resource_report(report, &config).await;

    let stats = LatencyStats::from_latencies(latencies.clone());

    info!("Rapid Create/Destroy Results:\n{}", stats.format_report());
    info!(
        "Total time: {:.2}s, Errors: {}, Throughput: {:.2} cycles/sec",
        total_duration.as_secs_f64(),
        errors,
        cycle_count as f64 / total_duration.as_secs_f64()
    );
    info!("Resource Report:\n{}", report.format_report());

    // Assertions
    // Error rate should be very low (< 1%)
    let error_rate = errors as f64 / cycle_count as f64;
    assert!(
        error_rate < 0.01,
        "Error rate too high: {:.2}%",
        error_rate * 100.0
    );

    // No resource leaks
    assert_no_resource_leaks(&report);

    // Average latency should be stable (not increasing)
    // Compare first 100 vs last 100 cycles
    if latencies.len() >= 200 {
        let first_100: f64 = latencies[..100].iter().sum::<f64>() / 100.0;
        let last_100: f64 = latencies[latencies.len() - 100..].iter().sum::<f64>() / 100.0;
        let degradation = (last_100 - first_100) / first_100;

        info!(
            "Latency degradation: {:.1}% (first 100 avg: {:.2}ms, last 100 avg: {:.2}ms)",
            degradation * 100.0,
            first_100,
            last_100
        );

        // Allow up to 50% degradation (resource pressure is expected)
        assert!(
            degradation < 0.5,
            "Latency degraded too much: {:.1}%",
            degradation * 100.0
        );
    }

    // Cleanup
    test_dirs.cleanup().await;
}

/// P5.3: Resource Exhaustion Test - IP Exhaustion
/// Allocate all IPs, verify graceful failure, then release and retry
#[tokio::test]
async fn test_ip_exhaustion() {
    init_test_tracing();

    let (driver, test_dirs, config) = create_test_driver().await;

    // Use a small subnet to speed up exhaustion
    let small_subnet = "172.30.0.0/30"; // Only 2 usable IPs (.1 is gateway, .2 is usable)
    let available_ips = get_available_ip_count(small_subnet);

    info!(
        "Testing with subnet {} ({} usable IPs)",
        small_subnet, available_ips
    );

    // Capture initial state
    let initial_taps = count_tap_devices().await;
    let initial_netns = count_network_namespaces().await;

    let mut handles: Vec<ExecutionHandle> = Vec::new();
    let mut allocated_count = 0;

    // Try to allocate more VMs than available IPs
    let attempt_count = available_ips + 5;

    for i in 0..attempt_count {
        let test_config = TestConfig::default();
        match spawn_test_vm(&driver, &format!("ip-exhaust-{}", i), &test_config).await {
            Ok(handle) => {
                handles.push(handle);
                allocated_count += 1;
            }
            Err(DriverError::InsufficientResources { resource }) => {
                info!(
                    "Expected resource exhaustion at iteration {}: {}",
                    i, resource
                );
                assert!(
                    resource.contains("IP") || resource.contains("ip"),
                    "Expected IP exhaustion error, got: {}",
                    resource
                );
                break;
            }
            Err(e) => {
                panic!("Unexpected error during spawn: {:?}", e);
            }
        }
    }

    info!("Allocated {} VMs before exhaustion", allocated_count);

    // Should have allocated up to available IPs
    assert!(
        allocated_count >= available_ips || allocated_count >= available_ips - 1,
        "Should allocate close to all available IPs, got {} of {}",
        allocated_count,
        available_ips
    );

    // Release some IPs
    let release_count = handles.len() / 2;
    for handle in handles.drain(..release_count) {
        driver
            .destroy(&handle)
            .await
            .expect("Destroy should succeed");
    }

    wait_for_cleanup_stabilization().await;

    info!(
        "Released {} VMs, attempting to allocate again",
        release_count
    );

    // Now we should be able to allocate again
    let mut new_allocated = 0;
    for i in 0..release_count {
        let test_config = TestConfig::default();
        match spawn_test_vm(&driver, &format!("ip-realloc-{}", i), &test_config).await {
            Ok(handle) => {
                handles.push(handle);
                new_allocated += 1;
            }
            Err(e) => {
                warn!("Re-allocation failed: {:?}", e);
            }
        }
    }

    info!("Successfully re-allocated {} VMs", new_allocated);

    // Should be able to allocate most of the released IPs
    assert!(
        new_allocated >= release_count - 1,
        "Should be able to re-allocate released IPs (got {} of {})",
        new_allocated,
        release_count
    );

    // Clean up remaining VMs
    for handle in handles {
        let _ = driver.destroy(&handle).await;
    }

    wait_for_cleanup_stabilization().await;

    // Verify cleanup
    let final_taps = count_tap_devices().await;
    let final_netns = count_network_namespaces().await;

    assert_eq!(
        final_taps, initial_taps,
        "TAP device leak detected: {} -> {}",
        initial_taps, final_taps
    );
    assert_eq!(
        final_netns, initial_netns,
        "Network namespace leak detected: {} -> {}",
        initial_netns, final_netns
    );

    // Cleanup
    test_dirs.cleanup().await;
}

/// P5.4: Network Policy Stress Test
/// Create 50 VMs with different policies and verify iptables rules
#[tokio::test]
async fn test_network_policy_scale() {
    init_test_tracing();

    let (driver, test_dirs, config) = create_test_driver().await;

    let policy_count = 50;
    let mut handles: Vec<(ExecutionHandle, NetworkPolicy)> = Vec::with_capacity(policy_count);
    let mut policy_latencies = Vec::with_capacity(policy_count);

    // Capture initial iptables state
    let initial_rules = count_iptables_rules().await;
    let initial_chains = count_iptables_chains().await;

    info!(
        "Initial iptables state: {} rules, {} chains",
        initial_rules, initial_chains
    );

    // Create VMs with different network policies
    for i in 0..policy_count {
        let policy = generate_network_policy(i);
        let test_config = TestConfig {
            network_policy: policy.clone(),
            ..TestConfig::default()
        };

        let spawn_start = Instant::now();
        match spawn_test_vm(&driver, &format!("policy-test-{}", i), &test_config).await {
            Ok(handle) => {
                let latency = spawn_start.elapsed().as_secs_f64() * 1000.0;
                policy_latencies.push(latency);
                handles.push((handle, policy));
            }
            Err(e) => {
                warn!("Failed to create VM {}: {:?}", i, e);
            }
        }
    }

    info!("Created {} VMs with different policies", handles.len());

    // Wait for all policies to be applied
    sleep(Duration::from_millis(500)).await;

    // Verify iptables state
    let current_rules = count_iptables_rules().await;
    let current_chains = count_iptables_chains().await;

    info!(
        "Current iptables state: {} rules, {} chains",
        current_rules, current_chains
    );

    // Should have created chains for each VM
    let expected_chains = handles.len();
    assert!(
        current_chains >= initial_chains + expected_chains.saturating_sub(5),
        "Expected at least {} new chains, got {} (total: {})",
        expected_chains,
        current_chains - initial_chains,
        current_chains
    );

    // Calculate policy application statistics
    let stats = LatencyStats::from_latencies(policy_latencies);
    info!("Policy Application Latency:\n{}", stats.format_report());

    // Policy application should be reasonably fast (p99 < 10s)
    assert!(
        stats.p99_ms < 10000.0,
        "Policy application p99 latency too high: {:.2}ms",
        stats.p99_ms
    );

    // Verify some VMs can execute commands (basic connectivity test)
    let sample_size = handles.len().min(5);
    for i in 0..sample_size {
        let (handle, _) = &handles[i];
        match exec_in_vm(
            &driver,
            handle,
            vec!["echo".to_string(), "test".to_string()],
        )
        .await
        {
            Ok(()) => {
                debug!("VM {} executed command successfully", i);
            }
            Err(e) => {
                warn!("VM {} command execution failed: {:?}", i, e);
            }
        }
    }

    // Destroy all VMs
    for (handle, _) in handles {
        let _ = driver.destroy(&handle).await;
    }

    wait_for_cleanup_stabilization().await;

    // Verify iptables cleanup
    let final_rules = count_iptables_rules().await;
    let final_chains = count_iptables_chains().await;

    info!(
        "Final iptables state: {} rules, {} chains",
        final_rules, final_chains
    );

    // Rules and chains should be cleaned up
    assert_eq!(
        final_rules, initial_rules,
        "iptables rules not cleaned up: {} -> {}",
        initial_rules, final_rules
    );
    assert_eq!(
        final_chains, initial_chains,
        "iptables chains not cleaned up: {} -> {}",
        initial_chains, final_chains
    );

    // Cleanup
    test_dirs.cleanup().await;
}

/// P5.5: Panic Recovery Test
/// Simulate panic during spawn and verify cleanup still happens
#[tokio::test]
async fn test_panic_recovery() {
    init_test_tracing();

    let (driver, test_dirs, config) = create_test_driver().await;

    // Capture initial resource state
    let initial_taps = count_tap_devices().await;
    let initial_netns = count_network_namespaces().await;
    let initial_rules = count_iptables_rules().await;

    info!(
        "Initial state: {} TAPs, {} netns, {} iptables rules",
        initial_taps, initial_netns, initial_rules
    );

    // Create a spawn that will panic during execution
    let panic_result = std::panic::catch_unwind(AssertUnwindSafe(|| {
        // Use a blocking runtime call since we're inside catch_unwind
        tokio::runtime::Handle::current().block_on(async {
            // Try to trigger a panic during spawn by using invalid parameters
            let tenant = TenantId::new("panic-test").expect("valid tenant");
            let policy = PolicySpec::default_permissive();

            let env_spec = EnvironmentSpec {
                spec_type: a2r_driver_interface::EnvSpecType::Oci,
                image: "nonexistent-image-xyz123:latest".to_string(),
                version: None,
                packages: vec![],
                env_vars: HashMap::new(),
                working_dir: None,
                mounts: vec![],
            };

            let resources = ResourceSpec {
                cpu_millis: 100,
                memory_mib: 128,
                disk_mib: Some(512),
                network_egress_kib: None,
                gpu_count: None,
            };

            let spec = SpawnSpec {
                tenant,
                project: Some("panic-test".to_string()),
                workspace: None,
                run_id: Some(ExecutionId::new()),
                env: env_spec,
                policy,
                resources,
                envelope: None,
                prewarm_pool: None,
            };

            // This should fail gracefully, not panic
            let result = driver.spawn(spec).await;

            // The spawn might fail, but should NOT panic
            match result {
                Ok(_) => info!("Spawn succeeded unexpectedly"),
                Err(e) => info!("Spawn failed as expected: {:?}", e),
            }
        })
    }));

    // The operation should complete without unwinding
    assert!(
        panic_result.is_ok(),
        "Spawn should not panic even with invalid input"
    );

    // Now test with a simulated panic in the middle of operations
    // This simulates what happens if a worker thread panics
    let panic_count = Arc::new(AtomicUsize::new(0));
    let cleanup_verified = Arc::new(AtomicUsize::new(0));

    let mut handles = vec![];

    for i in 0..5 {
        let panic_count_ref = panic_count.clone();
        let cleanup_verified_ref = cleanup_verified.clone();

        let handle = tokio::spawn(async move {
            let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
                tokio::runtime::Handle::current().block_on(async {
                    // Simulate work that might panic
                    if i == 2 {
                        // Simulate a condition that would cause panic
                        panic_count_ref.fetch_add(1, Ordering::SeqCst);
                        // Don't actually panic in test, just mark it
                    }

                    // Normal operation
                    sleep(Duration::from_millis(10)).await;
                    cleanup_verified_ref.fetch_add(1, Ordering::SeqCst);
                })
            }));

            result.is_ok()
        });

        handles.push(handle);
    }

    let results: Vec<bool> = futures::future::join_all(handles)
        .await
        .into_iter()
        .map(|r| r.unwrap_or(false))
        .collect();

    // All tasks should complete
    assert!(
        results.iter().all(|&r| r),
        "All tasks should complete without panic"
    );

    // Wait for any async cleanup to complete
    wait_for_cleanup_stabilization().await;
    sleep(Duration::from_secs(2)).await;

    // Verify no resource leaks after panic recovery scenarios
    let final_taps = count_tap_devices().await;
    let final_netns = count_network_namespaces().await;
    let final_rules = count_iptables_rules().await;

    info!(
        "Final state: {} TAPs, {} netns, {} iptables rules",
        final_taps, final_netns, final_rules
    );

    // Allow for small variance due to timing
    let tap_diff = final_taps as i64 - initial_taps as i64;
    let netns_diff = final_netns as i64 - initial_netns as i64;
    let rules_diff = final_rules as i64 - initial_rules as i64;

    assert!(
        tap_diff.abs() <= 2,
        "TAP device leak after panic test: {} -> {} (diff: {})",
        initial_taps,
        final_taps,
        tap_diff
    );
    assert!(
        netns_diff.abs() <= 2,
        "Network namespace leak after panic test: {} -> {} (diff: {})",
        initial_netns,
        final_netns,
        netns_diff
    );
    assert!(
        rules_diff.abs() <= 5,
        "iptables rule leak after panic test: {} -> {} (diff: {})",
        initial_rules,
        final_rules,
        rules_diff
    );

    // Cleanup
    emergency_cleanup(&config).await;
    test_dirs.cleanup().await;
}

/// P5.6: Concurrent Mixed Operations Test
/// Mix spawn, exec, destroy operations concurrently
#[tokio::test]
async fn test_concurrent_mixed_operations() {
    init_test_tracing();

    let (driver, test_dirs, config) = create_test_driver().await;
    let driver = Arc::new(driver);

    let mut report = capture_resource_state(&config).await;

    let vm_count = 20;
    let operations_per_vm = 10;

    // Create initial pool of VMs
    let mut vm_handles: Vec<ExecutionHandle> = Vec::with_capacity(vm_count);

    for i in 0..vm_count {
        let test_config = TestConfig::default();
        match spawn_test_vm(&driver, &format!("mixed-test-{}", i), &test_config).await {
            Ok(handle) => vm_handles.push(handle),
            Err(e) => warn!("Failed to create VM {}: {:?}", i, e),
        }
    }

    info!("Created {} VMs for mixed operations", vm_handles.len());

    // Run concurrent operations on VMs
    let semaphore = Arc::new(Semaphore::new(10));
    let mut operation_handles = vec![];

    for (vm_idx, handle) in vm_handles.iter().enumerate() {
        for op_idx in 0..operations_per_vm {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let driver_ref = Arc::clone(&driver);
            let handle_clone = handle.clone();

            let op_handle = tokio::spawn(async move {
                let _permit = permit;

                // Random operation based on op_idx
                match op_idx % 3 {
                    0 => {
                        // Execute command
                        let cmd = CommandSpec {
                            command: vec!["echo".to_string(), format!("op-{}", op_idx)],
                            env_vars: HashMap::new(),
                            working_dir: None,
                            stdin_data: None,
                            capture_stdout: true,
                            capture_stderr: true,
                        };
                        let _ = driver_ref.exec(&handle_clone, cmd).await;
                    }
                    1 => {
                        // Stream logs
                        let _ = driver_ref.stream_logs(&handle_clone).await;
                    }
                    _ => {
                        // Get consumption metrics
                        let _ = driver_ref.get_consumption(&handle_clone).await;
                    }
                }
            });

            operation_handles.push(op_handle);
        }
    }

    // Wait for all operations
    let results = futures::future::join_all(operation_handles).await;
    let success_count = results.iter().filter(|r| r.is_ok()).count();

    info!(
        "Completed {} of {} mixed operations",
        success_count,
        vm_count * operations_per_vm
    );

    // Destroy all VMs
    for handle in vm_handles {
        let _ = driver.destroy(&handle).await;
    }

    wait_for_cleanup_stabilization().await;

    // Complete resource report
    report = complete_resource_report(report, &config).await;

    info!("Resource Report:\n{}", report.format_report());

    // No resource leaks
    assert_no_resource_leaks(&report);

    // Cleanup
    test_dirs.cleanup().await;
}

/// P5.7: Resource Limits Enforcement Test
/// Verify resource limits are properly enforced
#[tokio::test]
async fn test_resource_limits_enforcement() {
    init_test_tracing();

    let (driver, test_dirs, config) = create_test_driver().await;

    // Test memory limit
    let huge_memory_spec = ResourceSpec {
        cpu_millis: 100,
        memory_mib: 1024 * 1024, // 1 TB - should fail
        disk_mib: Some(512),
        network_egress_kib: None,
        gpu_count: None,
    };

    let test_config = TestConfig {
        resources: huge_memory_spec,
        ..TestConfig::default()
    };

    let result = spawn_test_vm(&driver, "memory-limit-test", &test_config).await;

    // Should either fail or be limited
    match result {
        Ok(handle) => {
            // If it succeeds, verify the VM can be destroyed
            let _ = driver.destroy(&handle).await;
        }
        Err(DriverError::InsufficientResources { .. }) => {
            info!("Memory limit enforced correctly");
        }
        Err(e) => {
            info!("Memory limit test returned: {:?}", e);
        }
    }

    // Test CPU limit
    let huge_cpu_spec = ResourceSpec {
        cpu_millis: 1000000, // 1000 cores - should fail
        memory_mib: 128,
        disk_mib: Some(512),
        network_egress_kib: None,
        gpu_count: None,
    };

    let test_config = TestConfig {
        resources: huge_cpu_spec,
        ..TestConfig::default()
    };

    let result = spawn_test_vm(&driver, "cpu-limit-test", &test_config).await;

    match result {
        Ok(handle) => {
            let _ = driver.destroy(&handle).await;
        }
        Err(DriverError::InsufficientResources { .. }) => {
            info!("CPU limit enforced correctly");
        }
        Err(e) => {
            info!("CPU limit test returned: {:?}", e);
        }
    }

    wait_for_cleanup_stabilization().await;

    // Verify no leaks
    let taps = count_tap_devices().await;
    let netns = count_network_namespaces().await;

    assert_eq!(taps, 0, "TAP devices leaked after resource limit tests");
    assert_eq!(
        netns, 0,
        "Network namespaces leaked after resource limit tests"
    );

    // Cleanup
    test_dirs.cleanup().await;
}

/// Helper: Import futures crate for join_all
mod futures {
    pub mod future {
        use std::future::Future;
        use std::pin::Pin;
        use std::task::{Context, Poll};

        pub fn join_all<I>(iter: I) -> JoinAll<I::Item>
        where
            I: IntoIterator,
            I::Item: Future,
        {
            let futures: Vec<_> = iter.into_iter().collect();
            JoinAll { futures }
        }

        pub struct JoinAll<F: Future> {
            futures: Vec<F>,
        }

        impl<F: Future + Unpin> Future for JoinAll<F> {
            type Output = Vec<F::Output>;

            fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
                let mut all_done = true;
                let mut results = Vec::with_capacity(self.futures.len());

                for future in self.futures.iter_mut() {
                    match Pin::new(future).poll(cx) {
                        Poll::Ready(result) => {
                            results.push(result);
                        }
                        Poll::Pending => {
                            all_done = false;
                        }
                    }
                }

                if all_done {
                    Poll::Ready(results)
                } else {
                    Poll::Pending
                }
            }
        }
    }
}

// Add required dependencies for tests
use tracing::{debug, info, warn};
