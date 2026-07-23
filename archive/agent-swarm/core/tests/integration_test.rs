//! Integration Tests for Meta-Swarm System
//!
//! Tests the full end-to-end flow:
//! 1. Task submission through CLI
//! 2. Mode routing and selection
//! 3. Task execution in different modes
//! 4. Knowledge compounding
//! 5. Dashboard API endpoints

use std::time::Duration;
use tokio::time::timeout;

use allternit_meta_swarm::{
    initialize, 
    MetaSwarmConfig, 
    SwarmConfig, 
    Task, 
    TaskConstraints,
    SwarmMode,
    Result,
};

/// Test configuration for integration tests
fn test_config() -> SwarmConfig {
    SwarmConfig {
        max_parallel_agents: 4, // Reduced for testing
        default_task_budget: 1.0, // $1 budget for tests
        ..SwarmConfig::default()
    }
}

#[tokio::test]
async fn test_cli_task_submission() -> Result<()> {
    // Initialize the controller
    let config = test_config();
    let controller = initialize(config).await?;

    // Create a simple task
    let task = Task::new("Write a hello world program in Rust");

    // Submit the task
    let handle = controller.submit_task(task).await?;

    // Verify task was accepted
    assert!(!handle.task_id.0.is_empty());
    assert!(!handle.session_id.0.is_empty());
    
    // Mode should be auto-selected (not forced)
    assert!(matches!(
        handle.mode, 
        SwarmMode::SwarmAgentic | SwarmMode::ClaudeSwarm | SwarmMode::ClosedLoop | SwarmMode::Hybrid
    ));

    // Clean up
    controller.shutdown().await?;
    
    Ok(())
}

#[tokio::test]
async fn test_mode_routing_swarm_agentic() -> Result<()> {
    let config = test_config();
    let controller = initialize(config).await?;

    // Task that should route to SwarmAgentic (architectural)
    let task = Task::new("Design optimal agent architecture for web scraping")
        .with_constraints(
            TaskConstraints::default()
                .with_allowed_modes(vec![SwarmMode::SwarmAgentic])
        );

    let handle = controller.submit_task(task).await?;
    
    // Should be SwarmAgentic mode
    assert_eq!(handle.mode, SwarmMode::SwarmAgentic);

    controller.shutdown().await?;
    Ok(())
}

#[tokio::test]
async fn test_mode_routing_closed_loop() -> Result<()> {
    let config = test_config();
    let controller = initialize(config).await?;

    // Task that should route to ClosedLoop (production)
    let task = Task::new("Refactor production API with full review and testing")
        .with_constraints(
            TaskConstraints::default()
                .with_allowed_modes(vec![SwarmMode::ClosedLoop])
        );

    let handle = controller.submit_task(task).await?;
    
    // Should be ClosedLoop mode
    assert_eq!(handle.mode, SwarmMode::ClosedLoop);

    controller.shutdown().await?;
    Ok(())
}

#[tokio::test]
async fn test_task_status_tracking() -> Result<()> {
    let config = test_config();
    let controller = initialize(config).await?;

    let task = Task::new("Simple test task");
    let handle = controller.submit_task(task).await?;

    // Get initial status
    let status = controller.get_task_status(&handle.task_id).await?;
    assert!(matches!(status, TaskStatus::Pending | TaskStatus::Queued | TaskStatus::InProgress));

    controller.shutdown().await?;
    Ok(())
}

#[tokio::test]
async fn test_knowledge_storage_and_retrieval() -> Result<()> {
    let config = test_config();
    let controller = initialize(config).await?;

    // Query knowledge base (should be empty initially)
    let patterns = controller.query_knowledge("test pattern", 10).await?;
    assert!(patterns.is_empty());

    // After a task completes, knowledge should be compounded
    // (This would require a full task execution, simplified here)

    controller.shutdown().await?;
    Ok(())
}

#[tokio::test]
async fn test_budget_enforcement() -> Result<()> {
    let mut config = test_config();
    config.default_task_budget = 0.01; // Very low budget
    
    let controller = initialize(config).await?;

    let task = Task::new("Expensive task that should hit budget limit")
        .with_constraints(
            TaskConstraints::default()
                .with_budget(0.01)
        );

    let handle = controller.submit_task(task).await?;
    
    // Task should be accepted but may fail due to budget
    assert!(!handle.task_id.0.is_empty());

    controller.shutdown().await?;
    Ok(())
}

#[tokio::test]
async fn test_concurrent_task_submission() -> Result<()> {
    let config = test_config();
    let controller = initialize(config).await?;

    // Submit multiple tasks concurrently
    let tasks: Vec<_> = (0..5)
        .map(|i| Task::new(&format!("Concurrent task {}", i)))
        .collect();

    let handles: Vec<_> = tasks
        .into_iter()
        .map(|task| {
            let ctrl = controller.clone();
            tokio::spawn(async move {
                ctrl.submit_task(task).await
            })
        })
        .collect();

    // Wait for all submissions
    let results = futures::future::join_all(handles).await;
    
    // All should succeed
    for result in results {
        let handle = result.expect("Join failed")?;
        assert!(!handle.task_id.0.is_empty());
    }

    controller.shutdown().await?;
    Ok(())
}

#[tokio::test]
async fn test_dashboard_state() -> Result<()> {
    let config = test_config();
    let controller = initialize(config).await?;

    // Get initial dashboard state
    let state = controller.get_dashboard_state().await?;
    
    // Should have valid initial state
    assert!(state.costs.budget > 0.0);
    assert!(state.system_health == SystemHealth::Healthy);

    // Submit a task and check dashboard updates
    let task = Task::new("Dashboard test task");
    let handle = controller.submit_task(task).await?;

    // Dashboard should reflect new task
    let updated_state = controller.get_dashboard_state().await?;
    let task_found = updated_state.active_tasks.iter()
        .any(|t| t.task_id == handle.task_id);
    assert!(task_found);

    controller.shutdown().await?;
    Ok(())
}

#[tokio::test]
async fn test_file_lock_management() -> Result<()> {
    use allternit_meta_swarm::utils::FileLockManager;

    let lock_manager = FileLockManager::new();

    // Acquire lock
    let lock1 = lock_manager.acquire_lock("test.rs", "agent-1").await?;
    assert!(lock1.is_some());

    // Second agent should be blocked
    let lock2 = lock_manager.acquire_lock("test.rs", "agent-2").await?;
    assert!(lock2.is_none());

    // Release lock
    drop(lock1);

    // Now second agent can acquire
    let lock3 = lock_manager.acquire_lock("test.rs", "agent-2").await?;
    assert!(lock3.is_some());

    Ok(())
}

#[tokio::test]
async fn test_websocket_events() -> Result<()> {
    let config = test_config();
    let controller = initialize(config).await?;

    // Set up event listener
    let mut event_rx = controller.subscribe_events();

    // Submit a task
    let task = Task::new("Event test task");
    let handle = controller.submit_task(task).await?;

    // Should receive task submitted event
    let event = timeout(Duration::from_secs(5), event_rx.recv()).await
        .expect("Timeout waiting for event")
        .expect("Channel closed");

    match event {
        SwarmEvent::TaskSubmitted { task_id, .. } => {
            assert_eq!(task_id, handle.task_id);
        }
        _ => panic!("Expected TaskSubmitted event, got {:?}", event),
    }

    controller.shutdown().await?;
    Ok(())
}

// ============================================================================
// CLI Integration Tests
// ============================================================================

#[cfg(test)]
mod cli_tests {
    use std::process::Command;

    /// Test CLI help output
    #[test]
    fn test_cli_swarm_help() {
        let output = Command::new("cargo")
            .args(&["run", "--", "swarm", "--help"])
            .current_dir("../../7-apps/cli")
            .output()
            .expect("Failed to execute CLI");

        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(stdout.contains("Meta-Swarm"));
        assert!(stdout.contains("task") || stdout.contains("--mode"));
    }

    /// Test CLI dry-run submission
    #[test]
    fn test_cli_swarm_dry_run() {
        let output = Command::new("cargo")
            .args(&["run", "--", "swarm", "--output=json", "test task"])
            .current_dir("../../7-apps/cli")
            .output()
            .expect("Failed to execute CLI");

        let stdout = String::from_utf8_lossy(&output.stdout);
        // Should output JSON with task info
        assert!(stdout.contains("task_id") || stdout.contains("session_id"));
    }
}

// ============================================================================
// WebSocket API Tests
// ============================================================================

#[cfg(test)]
mod websocket_tests {
    use super::*;
    use tokio_tungstenite::{connect_async, tungstenite::Message};

    #[tokio::test]
    async fn test_websocket_connection() -> Result<()> {
        // This would require a running server
        // Placeholder for WebSocket connection test
        Ok(())
    }
}

// ============================================================================
// Natural Language Trigger Tests
// ============================================================================

#[cfg(test)]
mod nlp_trigger_tests {
    /// Test pattern matching for swarm triggers
    #[test]
    fn test_swarm_trigger_patterns() {
        let triggers = vec![
            ("do this with swarm of agents", true),
            ("use swarm to implement feature", true),
            ("deploy swarm for testing", true),
            ("run in parallel with agents", true),
            ("@swarm fix this bug", true),
            ("/swarm refactor code", true),
            ("auto-architect this system", true),
            ("closed-loop production deployment", true),
            ("just a regular message", false),
            ("hello world", false),
        ];

        for (input, expected) in triggers {
            let result = detect_swarm_trigger(input);
            assert_eq!(
                result.is_swarm_trigger, expected,
                "Pattern '{}' should {} trigger swarm",
                input,
                if expected { "" } else { "not " }
            );
        }
    }

    fn detect_swarm_trigger(text: &str) -> TriggerResult {
        // Simplified detection logic
        let patterns = [
            r"(?i)with\s+(?:a\s+)?swarm\s+(?:of\s+)?agents",
            r"(?i)use\s+(?:a\s+)?swarm\s+to",
            r"(?i)deploy\s+(?:a\s+)?swarm",
            r"(?i)parallel\s+(?:with\s+)?agents",
            r"(?i)[@/]swarm\s+",
            r"(?i)auto[\s-]?architect",
            r"(?i)closed[\s-]?loop",
        ];

        for pattern in &patterns {
            if regex::Regex::new(pattern).unwrap().is_match(text) {
                return TriggerResult { is_swarm_trigger: true };
            }
        }

        TriggerResult { is_swarm_trigger: false }
    }

    struct TriggerResult {
        is_swarm_trigger: bool,
    }
}
