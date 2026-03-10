//! Unit tests for router module

use a2r_meta_swarm::config::RoutingConfig;
use a2r_meta_swarm::knowledge::InMemoryKnowledgeStore;
use a2r_meta_swarm::router::{ModeRouter, TaskAnalyzer};
use a2r_meta_swarm::types::{Domain, SwarmMode, Task};
use std::sync::Arc;

#[tokio::test]
async fn test_task_analyzer_complexity() {
    let config = RoutingConfig::default();
    let analyzer = TaskAnalyzer::new(config);
    
    // Simple task
    let simple_task = Task::new("Fix typo");
    let analysis = analyzer.analyze(&simple_task).await.unwrap();
    assert!(analysis.complexity_assessment.score < 0.5);
    
    // Complex task
    let complex_task = Task::new(
        "Refactor the entire authentication system to use JWT tokens with refresh token rotation, \
         implement distributed session management across multiple microservices, \
         and add support for OAuth2 and SAML integration"
    );
    let analysis = analyzer.analyze(&complex_task).await.unwrap();
    assert!(analysis.complexity_assessment.score > 0.5);
}

#[tokio::test]
async fn test_task_analyzer_novelty() {
    let config = RoutingConfig::default();
    let analyzer = TaskAnalyzer::new(config);
    
    // Known pattern task
    let known_task = Task::new("Update existing function to handle null values");
    let analysis = analyzer.analyze(&known_task).await.unwrap();
    assert!(analysis.novelty_assessment.score < 0.5);
    
    // Novel task
    let novel_task = Task::new("Design a novel distributed consensus algorithm from scratch");
    let analysis = analyzer.analyze(&novel_task).await.unwrap();
    assert!(analysis.novelty_assessment.score > 0.5);
}

#[tokio::test]
async fn test_router_routing() {
    let config = RoutingConfig::default();
    let router = ModeRouter::new(&config);
    let knowledge = Arc::new(InMemoryKnowledgeStore::new());
    
    // Novel task should route to SwarmAgentic
    let novel_task = Task::new("Design new architecture for distributed system");
    let decision = router.route(&novel_task, &*knowledge).await.unwrap();
    
    // Check that a mode was selected
    assert!(
        decision.mode == SwarmMode::SwarmAgentic || 
        decision.mode == SwarmMode::Hybrid
    );
    
    // Decision should have reasoning
    assert!(!decision.reasoning.is_empty());
}

#[tokio::test]
async fn test_router_constrained_mode() {
    let config = RoutingConfig::default();
    let router = ModeRouter::new(&config);
    let knowledge = Arc::new(InMemoryKnowledgeStore::new());
    
    // Task with allowed modes constraint
    let mut constrained_task = Task::new("Test task");
    constrained_task.constraints.allowed_modes = vec![SwarmMode::ClaudeSwarm];
    
    let decision = router.route(&constrained_task, &*knowledge).await.unwrap();
    assert_eq!(decision.mode, SwarmMode::ClaudeSwarm);
    assert_eq!(decision.confidence, 1.0);
}

#[tokio::test]
async fn test_router_production_workflow() {
    let config = RoutingConfig::default();
    let router = ModeRouter::new(&config);
    let knowledge = Arc::new(InMemoryKnowledgeStore::new());
    
    // Production workflow should route to ClosedLoop
    let mut prod_task = Task::new("Deploy to production");
    prod_task.constraints.requires_review = true;
    
    let decision = router.route(&prod_task, &*knowledge).await.unwrap();
    
    // Should prefer ClosedLoop for production
    assert!(
        decision.mode == SwarmMode::ClosedLoop ||
        decision.mode == SwarmMode::Hybrid
    );
}
