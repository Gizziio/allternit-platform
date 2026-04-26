//! Unit tests for PSO engine

use allternit_meta_swarm::modes::swarmagentic::PSOEngine;
use allternit_meta_swarm::types::{AgentTeam, EntityId, Particle};

#[tokio::test]
async fn test_pso_convergence() {
    let mut engine = PSOEngine::new(
        5,    // population size
        20,   // max iterations
        0.7,  // inertia
        1.5,  // cognitive
        1.5,  // social
        0.001, // convergence threshold
    );

    let mut particles: Vec<Particle> = (0..5)
        .map(|i| {
            let team = AgentTeam::new(format!("team_{}", i), EntityId::new());
            Particle::new(team, 10)
        })
        .collect();

    let result = engine
        .optimize(&mut particles, |particle| {
            // Simple fitness: sum of position values
            particle.position.iter().sum::<f64>() / particle.position.len() as f64
        })
        .await;

    assert!(result.is_ok());
    let best = result.unwrap();
    assert!(best.score > 0.0);
}

#[test]
fn test_particle_update() {
    let team = AgentTeam::new("Test", EntityId::new());
    let mut particle = Particle::new(team, 5);
    
    // Set initial position
    particle.position = vec![0.1, 0.2, 0.3, 0.4, 0.5];
    particle.personal_best = particle.position.clone();
    particle.personal_best_score = 0.5;
    
    let global_best = vec![0.8, 0.8, 0.8, 0.8, 0.8];
    let mut rng = rand::thread_rng();
    
    // Update velocity
    particle.update_velocity(&global_best, 0.7, 1.5, 1.5, &mut rng);
    
    // Update position
    let old_position = particle.position.clone();
    particle.update_position();
    
    // Position should have changed
    assert_ne!(particle.position, old_position);
    
    // Position should be clamped to [0, 1]
    for &pos in &particle.position {
        assert!(pos >= 0.0 && pos <= 1.0);
    }
}

#[test]
fn test_personal_best_update() {
    let team = AgentTeam::new("Test", EntityId::new());
    let mut particle = Particle::new(team, 5);
    
    particle.score = 0.8;
    particle.update_personal_best();
    
    assert_eq!(particle.personal_best_score, 0.8);
    assert_eq!(particle.personal_best, particle.position);
    
    // Lower score should not update
    particle.score = 0.5;
    particle.update_personal_best();
    
    assert_eq!(particle.personal_best_score, 0.8); // Should remain 0.8
}

#[test]
fn test_variance_calculation() {
    let engine = PSOEngine::new(5, 10, 0.7, 1.5, 1.5, 0.01);
    
    let particles: Vec<Particle> = (0..5)
        .map(|i| {
            let team = AgentTeam::new(format!("team_{}", i), EntityId::new());
            let mut particle = Particle::new(team, 5);
            // Set specific positions for testing
            particle.position = vec![i as f64 * 0.1; 5];
            particle
        })
        .collect();
    
    let variance = engine.calculate_variance(&particles);
    assert!(variance > 0.0);
}
