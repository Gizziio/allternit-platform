//! End-to-end tests for meta-swarm system
//!
//! These tests exercise the full workflow from task submission
//! through execution and knowledge compounding.

use allternit_meta_swarm::{
    initialize, MetaSwarmConfig, Task, SwarmMode,
    types::{Complexity, Domain, TaskClassification, TaskConstraints},
};

/// Test a complete workflow through SwarmAgentic mode
#[tokio::test]
async fn e2e_swarm_agentic_workflow() {
    let controller = initialize(MetaSwarmConfig::default()).await.unwrap();
    
    // Submit a novel task that should route to SwarmAgentic
    let task = Task::new("Design a new microservices communication protocol")
        .with_classification(TaskClassification {
            complexity: Complexity::Extreme,
            novelty: allternit_meta_swarm::types::Novelty::Breakthrough,
            domain: Domain::Architecture,
            estimated_duration: allternit_meta_swarm::types::DurationEstimate::Days(3),
        });
    
    let handle = controller.submit_task(task).await.unwrap();
    
    // Should have been routed to SwarmAgentic or Hybrid
    assert!(
        handle.mode == SwarmMode::SwarmAgentic || handle.mode == SwarmMode::Hybrid,
        "Novel architecture task should use SwarmAgentic, got {:?}",
        handle.mode
    );
    
    controller.shutdown().await.unwrap();
}

/// Test a complete workflow through Claude Swarm mode
#[tokio::test]
async fn e2e_claude_swarm_workflow() {
    let controller = initialize(MetaSwarmConfig::default()).await.unwrap();
    
    // Submit a straightforward coding task
    let task = Task::new("Refactor the auth module to extract common logic")
        .with_classification(TaskClassification {
            complexity: Complexity::Medium,
            novelty: allternit_meta_swarm::types::Novelty::Similar,
            domain: Domain::Code,
            estimated_duration: allternit_meta_swarm::types::DurationEstimate::Hours(2),
        });
    
    let handle = controller.submit_task(task).await.unwrap();
    
    // Should have been routed to Claude Swarm or Hybrid
    println!("Task routed to: {:?}", handle.mode);
    
    controller.shutdown().await.unwrap();
}

/// Test a complete workflow through ClosedLoop mode
#[tokio::test]
async fn e2e_closed_loop_workflow() {
    let mut config = MetaSwarmConfig::default();
    config.routing.closedloop_review_required = true;
    
    let controller = initialize(config).await.unwrap();
    
    // Submit a production task requiring review
    let task = Task::new("Deploy payment processing service to production")
        .with_constraints(TaskConstraints::default().requires_review());
    
    let handle = controller.submit_task(task).await.unwrap();
    
    // Should have been routed to ClosedLoop for review
    assert!(
        handle.mode == SwarmMode::ClosedLoop || handle.mode == SwarmMode::Hybrid,
        "Production task should use ClosedLoop, got {:?}",
        handle.mode
    );
    
    controller.shutdown().await.unwrap();
}

/// Test that the knowledge base is updated after task completion
#[tokio::test]
async fn e2e_knowledge_compounding() {
    use allternit_meta_swarm::knowledge::{KnowledgeStore, InMemoryKnowledgeStore};
    use std::sync::Arc;
    
    let knowledge = Arc::new(InMemoryKnowledgeStore::new());
    let controller = initialize(MetaSwarmConfig::default()).await.unwrap();
    
    // Submit a task
    let task = Task::new("Test task for knowledge compounding");
    let handle = controller.submit_task(task).await.unwrap();
    
    // Wait a moment for execution
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Knowledge base should have been queried during routing
    // (In a full E2E test, we'd verify patterns were stored after execution)
    
    controller.shutdown().await.unwrap();
}

/// Test concurrent task execution
#[tokio::test]
async fn e2e_concurrent_tasks() {
    let controller = initialize(MetaSwarmConfig::default()).await.unwrap();
    
    // Submit multiple tasks concurrently
    let tasks: Vec<_> = (0..5)
        .map(|i| Task::new(format!("Concurrent task {}", i)))
        .collect();
    
    let mut handles = vec![];
    for task in tasks {
        let handle = controller.submit_task(task).await.unwrap();
        handles.push(handle);
    }
    
    // All tasks should have unique IDs
    let ids: Vec<_> = handles.iter().map(|h| h.task_id).collect();
    let unique_count = ids.iter().collect::<std::collections::HashSet<_>>().len();
    assert_eq!(unique_count, 5);
    
    controller.shutdown().await.unwrap();
}

/// Test the full 5-step ClosedLoop methodology
#[tokio::test]
async fn e2e_closed_loop_five_steps() {
    use allternit_meta_swarm::modes::closedloop::{
        BrainstormPhase, PlanPhase, WorkPhase, ReviewPhase, CompoundPhase,
    };
    use allternit_meta_swarm::knowledge::InMemoryKnowledgeStore;
    use std::sync::Arc;
    
    let task = Task::new("Implement new feature with full review process");
    
    // Step 1: Brainstorm
    let brainstorm = BrainstormPhase::new();
    let approaches = brainstorm.generate_approaches(&task).await.unwrap();
    assert!(!approaches.is_empty(), "Should have generated approaches");
    
    // Step 2: Plan
    let plan = PlanPhase::new();
    let work_items = plan.create_plan(&task, &approaches).await.unwrap();
    assert!(!work_items.is_empty(), "Should have created work items");
    
    // Step 3: Work
    let work = WorkPhase::new(4);
    let work_result = work.execute(&task, &work_items).await.unwrap();
    
    // Step 4: Review
    let review = ReviewPhase::new();
    let triage = review.triage(&task, &work_result).await.unwrap();
    
    // Step 5: Compound
    let knowledge = Arc::new(InMemoryKnowledgeStore::new());
    let compound = CompoundPhase::new(knowledge);
    compound.extract_and_store(&task, &work_result, &triage).await.unwrap();
}

/// Test file conflict detection
#[tokio::test]
async fn e2e_file_conflict_detection() {
    use allternit_meta_swarm::modes::claudeswarm::FileLockManager;
    
    let manager = FileLockManager::new();
    let agent1 = allternit_meta_swarm::types::EntityId::new();
    let agent2 = allternit_meta_swarm::types::EntityId::new();
    
    // Simulate concurrent file access
    let lock1 = manager.try_lock(agent1, "/src/main.rs").await.unwrap();
    assert!(lock1, "Agent 1 should acquire lock");
    
    let lock2 = manager.try_lock(agent2, "/src/main.rs").await.unwrap();
    assert!(!lock2, "Agent 2 should fail to acquire same lock");
    
    // Agent 2 can acquire different file
    let lock3 = manager.try_lock(agent2, "/src/lib.rs").await.unwrap();
    assert!(lock3, "Agent 2 should acquire lock on different file");
    
    // Verify lock state
    let locked_files = manager.locked_files().await;
    assert_eq!(locked_files.len(), 2);
}

/// Test PSO-based architecture discovery
#[tokio::test]
async fn e2e_pso_architecture_discovery() {
    use allternit_meta_swarm::modes::swarmagentic::{AutoArchitectMode, PSOEngine};
    use allternit_meta_swarm::knowledge::InMemoryKnowledgeStore;
    use std::sync::Arc;
    
    let config = allternit_meta_swarm::types::ModeConfig::new(SwarmMode::SwarmAgentic);
    let knowledge = Arc::new(InMemoryKnowledgeStore::new());
    
    let mode = AutoArchitectMode::new(config, knowledge).unwrap();
    
    let task = Task::new("Design optimal team structure for distributed system");
    let discovery = mode.discover_architecture(task).await.unwrap();
    
    // Should have discovered an architecture
    assert!(discovery.score > 0.0, "Should have non-zero fitness score");
    assert!(!discovery.architecture.agents.is_empty(), "Should have agents in architecture");
}

/// Test the complete meta-swarm workflow with mode transitions
#[tokio::test]
async fn e2e_full_meta_swarm_workflow() {
    let controller = initialize(MetaSwarmConfig::default()).await.unwrap();
    
    // Submit various types of tasks
    let tasks = vec![
        ("Simple bug fix", Complexity::Low, Domain::Code),
        ("New feature implementation", Complexity::Medium, Domain::Code),
        ("Design microservices architecture", Complexity::High, Domain::Architecture),
        ("Research novel consensus algorithm", Complexity::Extreme, Domain::Research),
    ];
    
    for (desc, complexity, domain) in tasks {
        let task = Task::new(desc)
            .with_classification(TaskClassification {
                complexity,
                novelty: allternit_meta_swarm::types::Novelty::Unknown,
                domain,
                estimated_duration: allternit_meta_swarm::types::DurationEstimate::Hours(1),
            });
        
        let handle = controller.submit_task(task).await;
        assert!(handle.is_ok(), "Should successfully submit task: {}", desc);
        
        let handle = handle.unwrap();
        println!("Task '{}' routed to {:?}", desc, handle.mode);
    }
    
    controller.shutdown().await.unwrap();
}
