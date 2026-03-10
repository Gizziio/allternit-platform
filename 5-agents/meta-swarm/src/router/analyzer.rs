use crate::config::RoutingConfig;
use crate::error::{SwarmError, SwarmResult};
use crate::types::{
    Complexity, ComplexityAssessment, Domain, DomainAssessment, Novelty, NoveltyAssessment,
    Task, TaskAnalysis, SwarmMode,
};
use regex::Regex;

/// Analyzes tasks to determine their characteristics
#[derive(Debug, Clone)]
pub struct TaskAnalyzer {
    config: RoutingConfig,
}

impl TaskAnalyzer {
    pub fn new(config: RoutingConfig) -> Self {
        Self { config }
    }

    /// Analyze a task and return classification
    pub async fn analyze(&self, task: &Task) -> SwarmResult<TaskAnalysis> {
        let mut analysis = TaskAnalysis::new(task.id());

        // Analyze complexity
        analysis.complexity_assessment = self.analyze_complexity(task);

        // Analyze novelty
        analysis.novelty_assessment = self.analyze_novelty(task);

        // Analyze domain
        analysis.domain_assessment = self.analyze_domain(task);

        // Set recommended mode based on analysis
        analysis.recommended_mode = self.recommend_mode(&analysis);

        // Calculate overall confidence
        analysis.confidence = crate::types::Confidence::new(0.75)
            .map_err(|e| SwarmError::Unknown(e))?;

        analysis.reasoning = self.generate_reasoning(&analysis);

        Ok(analysis)
    }

    /// Analyze task complexity
    fn analyze_complexity(&self, task: &Task) -> ComplexityAssessment {
        let description = &task.description;
        let mut score = 0.5; // Start at medium
        let mut factors = Vec::new();

        // Factor 1: Description length (longer = more complex)
        let word_count = description.split_whitespace().count();
        if word_count > 100 {
            score += 0.15;
            factors.push("Long description (many requirements)".to_string());
        } else if word_count < 20 {
            score -= 0.1;
            factors.push("Short description (simple task)".to_string());
        }

        // Factor 2: Keywords indicating complexity
        let complexity_keywords = [
            "architecture", "design", "refactor", "migrate", "integrate",
            "distributed", "concurrent", "optimize", "scale",
        ];
        let keyword_count = complexity_keywords
            .iter()
            .filter(|kw| description.to_lowercase().contains(*kw))
            .count();
        if keyword_count > 2 {
            score += 0.1 * keyword_count.min(3) as f64;
            factors.push(format!("Found {} complexity keywords", keyword_count));
        }

        // Factor 3: Number of components mentioned
        let component_pattern = Regex::new(r"\b(module|service|component|system|api|database)\b").unwrap();
        let component_count = component_pattern.find_iter(description).count();
        if component_count > 3 {
            score += 0.1;
            factors.push(format!("Multiple components mentioned ({)", component_count));
        }

        // Clamp score to valid range
        score = score.clamp(0.0, 1.0);

        let complexity = if score < 0.2 {
            Complexity::Trivial
        } else if score < 0.4 {
            Complexity::Low
        } else if score < 0.6 {
            Complexity::Medium
        } else if score < 0.8 {
            Complexity::High
        } else {
            Complexity::Extreme
        };

        ComplexityAssessment {
            score,
            factors,
            explanation: complexity.description().to_string(),
        }
    }

    /// Analyze task novelty
    fn analyze_novelty(&self, task: &Task) -> NoveltyAssessment {
        let mut score = 0.5; // Start at unknown
        let mut similar_found = 0;

        // Check for keywords indicating novelty
        let novel_keywords = ["new", "novel", "innovative", "unique", "unprecedented", "from scratch"];
        let known_keywords = ["update", "fix", "improve", "refactor", "existing", "current"];

        let desc_lower = task.description.to_lowercase();

        let novel_count = novel_keywords.iter().filter(|k| desc_lower.contains(*k)).count();
        let known_count = known_keywords.iter().filter(|k| desc_lower.contains(*k)).count();

        if novel_count > 0 {
            score += 0.2 * novel_count.min(2) as f64;
        }
        if known_count > 0 {
            score -= 0.15 * known_count.min(2) as f64;
        }

        // Check if similar patterns exist in context
        if !task.context.similar_patterns.is_empty() {
            similar_found = task.context.similar_patterns.len();
            score -= 0.1 * similar_found.min(3) as f64;
        }

        // Clamp score
        score = score.clamp(0.0, 1.0);

        let novelty = if score < 0.25 {
            Novelty::Known
        } else if score < 0.5 {
            Novelty::Similar
        } else if score < 0.75 {
            Novelty::Unknown
        } else if score < 0.9 {
            Novelty::Novel
        } else {
            Novelty::Breakthrough
        };

        NoveltyAssessment {
            score,
            similar_tasks_found: similar_found,
            explanation: format!("Task novelty assessed as {:?}", novelty),
        }
    }

    /// Analyze task domain
    fn analyze_domain(&self, task: &Task) -> DomainAssessment {
        let desc_lower = task.description.to_lowercase();

        // Domain keywords
        let domain_keywords: Vec<(Domain, Vec<&str>)> = vec![
            (Domain::Code, vec!["code", "implement", "function", "class", "module", "refactor", "bug", "fix"]),
            (Domain::Design, vec!["design", "ui", "ux", "interface", "visual", "layout"]),
            (Domain::Architecture, vec!["architecture", "system", "structure", "component", "service"]),
            (Domain::Planning, vec!["plan", "roadmap", "strategy", "schedule", "milestone"]),
            (Domain::Research, vec!["research", "investigate", "analyze", "study", "explore"]),
            (Domain::Writing, vec!["write", "document", "content", "text", "article"]),
            (Domain::Analysis, vec!["analyze", "data", "metric", "performance", "report"]),
        ];

        let mut domain_scores: Vec<(Domain, f64)> = domain_keywords
            .iter()
            .map(|(domain, keywords)| {
                let score = keywords
                    .iter()
                    .filter(|k| desc_lower.contains(**k))
                    .count() as f64 / keywords.len() as f64;
                (*domain, score)
            })
            .collect();

        // Sort by score descending
        domain_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        let primary_domain = domain_scores[0].0;
        let confidence = domain_scores[0].1;

        // Secondary domains (score > 0.2)
        let secondary_domains: Vec<Domain> = domain_scores
            .iter()
            .skip(1)
            .filter(|(_, score)| *score > 0.2)
            .map(|(d, _)| *d)
            .collect();

        DomainAssessment {
            primary_domain,
            secondary_domains,
            confidence,
        }
    }

    /// Recommend mode based on analysis
    fn recommend_mode(&self, analysis: &TaskAnalysis) -> SwarmMode {
        if analysis.novelty_assessment.score > self.config.swarm_agentic_novelty_threshold {
            SwarmMode::SwarmAgentic
        } else if analysis.complexity_assessment.score > 0.6 {
            SwarmMode::ClosedLoop
        } else {
            SwarmMode::ClaudeSwarm
        }
    }

    /// Generate reasoning string
    fn generate_reasoning(&self, analysis: &TaskAnalysis) -> String {
        format!(
            "Complexity: {:.0}% ({}), Novelty: {:.0}% ({}), Domain: {:?}",
            analysis.complexity_assessment.score * 100.0,
            analysis.complexity_assessment.explanation,
            analysis.novelty_assessment.score * 100.0,
            analysis.novelty_assessment.explanation,
            analysis.domain_assessment.primary_domain
        )
    }
}
