use crate::error::SwarmResult;
use crate::types::Task;

/// Brainstorm Phase - Generate 2-3 approaches before writing code
#[derive(Debug)]
pub struct BrainstormPhase;

impl BrainstormPhase {
    pub fn new() -> Self {
        Self
    }

    /// Generate 2-3 approaches for the task
    pub async fn generate_approaches(&self, task: &Task) -> SwarmResult<Vec<Approach>> {
        let mut approaches = Vec::new();

        // Approach 1: Direct implementation
        approaches.push(Approach {
            name: "Direct Implementation".to_string(),
            description: format!("Implement {} directly with minimal abstraction", task.description),
            pros: vec![
                "Faster to implement".to_string(),
                "Less complexity".to_string(),
            ],
            cons: vec![
                "May not scale well".to_string(),
                "Less reusable".to_string(),
            ],
            estimated_effort_hours: 2,
            risk_level: RiskLevel::Low,
        });

        // Approach 2: Abstracted solution
        approaches.push(Approach {
            name: "Abstracted Solution".to_string(),
            description: format!(
                "Build abstraction layer for {} with extensibility in mind",
                task.description
            ),
            pros: vec![
                "More maintainable".to_string(),
                "Easier to extend".to_string(),
                "Better testability".to_string(),
            ],
            cons: vec![
                "More initial effort".to_string(),
                "Potential over-engineering".to_string(),
            ],
            estimated_effort_hours: 4,
            risk_level: RiskLevel::Medium,
        });

        // Approach 3: Iterative approach (for complex tasks)
        if task.complexity_score() > 0.5 {
            approaches.push(Approach {
                name: "Iterative Approach".to_string(),
                description: format!(
                    "Build {} in phases: MVP first, then iterate",
                    task.description
                ),
                pros: vec![
                    "Risk mitigation".to_string(),
                    "Early feedback".to_string(),
                    "Easier to course-correct".to_string(),
                ],
                cons: vec![
                    "Longer total timeline".to_string(),
                    "More coordination overhead".to_string(),
                ],
                estimated_effort_hours: 6,
                risk_level: RiskLevel::Low,
            });
        }

        Ok(approaches)
    }
}

impl Default for BrainstormPhase {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct Approach {
    pub name: String,
    pub description: String,
    pub pros: Vec<String>,
    pub cons: Vec<String>,
    pub estimated_effort_hours: u32,
    pub risk_level: RiskLevel,
}

#[derive(Debug, Clone, Copy)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}
