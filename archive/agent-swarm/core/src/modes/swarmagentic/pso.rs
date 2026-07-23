use crate::error::{SwarmError, SwarmResult};
use crate::types::Particle;
use rand::Rng;
use tracing::{debug, info};

/// Particle Swarm Optimization Engine
#[derive(Debug)]
pub struct PSOEngine {
    population_size: usize,
    max_iterations: usize,
    inertia_weight: f64,
    cognitive_coefficient: f64,
    social_coefficient: f64,
    convergence_threshold: f64,
}

impl PSOEngine {
    pub fn new(
        population_size: usize,
        max_iterations: usize,
        inertia_weight: f64,
        cognitive_coefficient: f64,
        social_coefficient: f64,
        convergence_threshold: f64,
    ) -> Self {
        Self {
            population_size,
            max_iterations,
            inertia_weight,
            cognitive_coefficient,
            social_coefficient,
            convergence_threshold,
        }
    }

    /// Run PSO optimization
    pub async fn optimize<F>(
        &mut self,
        particles: &mut Vec<Particle>,
        fitness_fn: F,
    ) -> SwarmResult<Particle>
    where
        F: Fn(&Particle) -> f64,
    {
        info!(
            "Starting PSO optimization with {} particles, {} max iterations",
            self.population_size, self.max_iterations
        );

        let mut rng = rand::thread_rng();
        let mut global_best_position: Option<Vec<f64>> = None;
        let mut global_best_score = f64::NEG_INFINITY;

        // Initialize scores
        for particle in particles.iter_mut() {
            particle.score = fitness_fn(particle);
            particle.update_personal_best();

            if particle.score > global_best_score {
                global_best_score = particle.score;
                global_best_position = Some(particle.position.clone());
            }
        }

        // Main optimization loop
        for iteration in 0..self.max_iterations {
            debug!("PSO iteration {}/{}", iteration + 1, self.max_iterations);

            let mut improved = false;

            for particle in particles.iter_mut() {
                // Update velocity and position
                if let Some(ref gbest) = global_best_position {
                    particle.update_velocity(
                        gbest,
                        self.inertia_weight,
                        self.cognitive_coefficient,
                        self.social_coefficient,
                        &mut rng,
                    );
                }
                particle.update_position();

                // Evaluate new position
                particle.score = fitness_fn(particle);
                particle.update_personal_best();

                // Update global best
                if particle.score > global_best_score {
                    global_best_score = particle.score;
                    global_best_position = Some(particle.position.clone());
                    improved = true;
                }
            }

            // Check convergence
            if !improved && iteration > self.max_iterations / 4 {
                let variance = self.calculate_variance(particles);
                if variance < self.convergence_threshold {
                    info!("PSO converged at iteration {}", iteration + 1);
                    break;
                }
            }
        }

        // Return best particle
        let best_particle = particles
            .iter()
            .max_by(|a, b| a.score.partial_cmp(&b.score).unwrap())
            .cloned()
            .ok_or_else(|| SwarmError::Pso("No particles available".to_string()))?;

        info!("PSO optimization complete. Best score: {:.4}", best_particle.score);

        Ok(best_particle)
    }

    /// Calculate position variance (for convergence detection)
    fn calculate_variance(&self, particles: &[Particle]) -> f64 {
        if particles.is_empty() || particles[0].position.is_empty() {
            return 0.0;
        }

        let dimensions = particles[0].position.len();
        let mut total_variance = 0.0;

        for dim in 0..dimensions {
            let mean: f64 = particles.iter().map(|p| p.position[dim]).sum::<f64>()
                / particles.len() as f64;
            let variance: f64 = particles
                .iter()
                .map(|p| (p.position[dim] - mean).powi(2))
                .sum::<f64>()
                / particles.len() as f64;
            total_variance += variance;
        }

        total_variance / dimensions as f64
    }
}
