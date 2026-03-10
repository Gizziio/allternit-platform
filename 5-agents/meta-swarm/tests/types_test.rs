//! Unit tests for types module

use a2r_meta_swarm::types::*;

#[test]
fn test_entity_id_creation() {
    let id1 = EntityId::new();
    let id2 = EntityId::new();
    assert_ne!(id1, id2);
}

#[test]
fn test_progress_calculation() {
    let mut progress = Progress::new(10);
    assert_eq!(progress.percent_complete(), 0.0);
    assert!(!progress.is_complete());

    progress.complete_one();
    assert_eq!(progress.percent_complete(), 10.0);

    for _ in 0..9 {
        progress.complete_one();
    }
    assert!(progress.is_complete());
}

#[test]
fn test_cost_addition() {
    let mut cost1 = Cost {
        input_tokens: 100,
        output_tokens: 50,
        estimated_usd: 0.5,
    };
    let cost2 = Cost {
        input_tokens: 200,
        output_tokens: 100,
        estimated_usd: 1.0,
    };

    cost1.add(&cost2);
    assert_eq!(cost1.input_tokens, 300);
    assert_eq!(cost1.output_tokens, 150);
    assert_eq!(cost1.estimated_usd, 1.5);
}

#[test]
fn test_swarm_mode_properties() {
    assert!(SwarmMode::SwarmAgentic.supports_discovery());
    assert!(SwarmMode::ClaudeSwarm.supports_quality_gate());
    assert!(SwarmMode::ClosedLoop.compounds_knowledge());
    assert!(SwarmMode::Hybrid.supports_discovery());
    assert!(SwarmMode::Hybrid.supports_quality_gate());
    assert!(SwarmMode::Hybrid.compounds_knowledge());
}

#[test]
fn test_complexity_score() {
    assert_eq!(Complexity::Trivial.score(), 0.1);
    assert_eq!(Complexity::Extreme.score(), 0.95);
}

#[test]
fn test_novelty_score() {
    assert_eq!(Novelty::Known.score(), 0.0);
    assert!(Novelty::Breakthrough.should_discover());
}

#[test]
fn test_task_creation() {
    let task = Task::new("Test task");
    assert_eq!(task.description, "Test task");
    assert_eq!(task.objective, "Test task");
    assert_eq!(task.status, Status::Pending);
}

#[test]
fn test_confidence_creation() {
    let valid = Confidence::new(0.5);
    assert!(valid.is_ok());
    
    let invalid = Confidence::new(1.5);
    assert!(invalid.is_err());
}

#[test]
fn test_agent_role_builder() {
    let role = AgentRole::new("Tester")
        .with_description("Tests code")
        .with_model("claude-haiku");
    
    assert_eq!(role.name, "Tester");
    assert_eq!(role.description, "Tests code");
    assert_eq!(role.model, "claude-haiku");
}

#[test]
fn test_collaboration_topology_waves() {
    use std::collections::HashSet;
    
    let mut team = AgentTeam::new("Test Team", EntityId::new());
    let id1 = EntityId::new();
    let id2 = EntityId::new();
    let id3 = EntityId::new();
    
    team.add_agent(id1);
    team.add_agent(id2);
    team.add_agent(id3);
    
    // Test sequential topology
    let seq_topology = CollaborationTopology::sequential();
    let seq_waves = seq_topology.execution_waves(&team.agents);
    assert_eq!(seq_waves.len(), 3); // Each agent in its own wave
    
    // Test parallel topology
    let par_topology = CollaborationTopology::parallel();
    let par_waves = par_topology.execution_waves(&team.agents);
    assert_eq!(par_waves.len(), 1); // All agents in one wave
    assert_eq!(par_waves[0].len(), 3);
}

#[test]
fn test_particle_velocity_update() {
    use rand::Rng;
    
    let team = AgentTeam::new("Test", EntityId::new());
    let mut particle = Particle::new(team, 5);
    
    let global_best = vec![0.5; 5];
    let mut rng = rand::thread_rng();
    
    particle.update_velocity(&global_best, 0.7, 1.5, 1.5, &mut rng);
    
    // Velocity should have changed
    assert!(particle.velocity.iter().any(|&v| v != 0.0));
}

#[test]
fn test_execution_result_success() {
    let task_id = EntityId::new();
    let result = ExecutionResult::success(task_id, "Test output");
    
    assert!(result.is_success());
    assert_eq!(result.status, Status::Completed);
}

#[test]
fn test_triage_result_p1_blocking() {
    let task_id = EntityId::new();
    let mut triage = TriageResult::new(task_id);
    
    assert!(triage.can_ship);
    
    triage.add_item(TriageItem::p1("Critical issue"));
    assert!(!triage.can_ship);
    assert_eq!(triage.p1_count, 1);
}

#[test]
fn test_quality_gate_result_calculation() {
    let task_id = EntityId::new();
    let checks = vec![
        QualityCheck {
            name: "Test 1".to_string(),
            description: "Desc".to_string(),
            passed: true,
            score: 0.9,
            critical: true,
            findings: vec![],
        },
        QualityCheck {
            name: "Test 2".to_string(),
            description: "Desc".to_string(),
            passed: true,
            score: 0.8,
            critical: false,
            findings: vec![],
        },
    ];
    
    let result = QualityGateResult::new(task_id).with_checks(checks);
    assert!(result.passed);
    assert_eq!(result.score, 0.85); // Average of 0.9 and 0.8
}
