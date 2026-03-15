use super::KnowledgeStore;
use crate::error::SwarmResult;
use crate::types::{
    EntityId, KnowledgeQueryResult, Pattern, ParticleArchive, PatternType, ScoredPattern,
    ScoredSolution, Solution, SwarmMode, TransferType,
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// In-memory implementation of KnowledgeStore
#[derive(Debug)]
pub struct InMemoryKnowledgeStore {
    patterns: Arc<RwLock<HashMap<EntityId, Pattern>>>,
    solutions: Arc<RwLock<HashMap<EntityId, Solution>>>,
    particle_archives: Arc<RwLock<HashMap<EntityId, ParticleArchive>>>,
    cross_mode_learnings: Arc<RwLock<Vec<CrossModeLearningRecord>>>,
}

#[derive(Debug, Clone)]
struct CrossModeLearningRecord {
    from: SwarmMode,
    to: SwarmMode,
    transfer_type: TransferType,
    timestamp: chrono::DateTime<chrono::Utc>,
    effectiveness: f64,
}

impl InMemoryKnowledgeStore {
    pub fn new() -> Self {
        Self {
            patterns: Arc::new(RwLock::new(HashMap::new())),
            solutions: Arc::new(RwLock::new(HashMap::new())),
            particle_archives: Arc::new(RwLock::new(HashMap::new())),
            cross_mode_learnings: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Simple similarity calculation based on keyword overlap
    fn calculate_similarity(query: &str, text: &str) -> f64 {
        let query_words: std::collections::HashSet<String> = query
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();
        let text_words: std::collections::HashSet<String> = text
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        if query_words.is_empty() {
            return 0.0;
        }

        let intersection: std::collections::HashSet<_> = query_words
            .intersection(&text_words)
            .cloned()
            .collect();

        intersection.len() as f64 / query_words.len() as f64
    }
}

impl Default for InMemoryKnowledgeStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl KnowledgeStore for InMemoryKnowledgeStore {
    async fn store_pattern(&self, pattern: Pattern) -> SwarmResult<EntityId> {
        let id = pattern.metadata.id;
        let mut patterns = self.patterns.write().await;
        patterns.insert(id, pattern);
        Ok(id)
    }

    async fn get_pattern(&self, id: EntityId) -> SwarmResult<Option<Pattern>> {
        let patterns = self.patterns.read().await;
        Ok(patterns.get(&id).cloned())
    }

    async fn query_patterns(
        &self,
        query: &str,
        limit: usize,
    ) -> SwarmResult<Vec<(Pattern, f64)>> {
        let patterns = self.patterns.read().await;
        let mut scored: Vec<(Pattern, f64)> = patterns
            .values()
            .map(|p| {
                let score = Self::calculate_similarity(query, &p.description);
                (p.clone(), score)
            })
            .filter(|(_, score)| *score > 0.1)
            .collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        scored.truncate(limit);
        Ok(scored)
    }

    async fn store_solution(&self, solution: Solution) -> SwarmResult<EntityId> {
        let id = solution.metadata.id;
        let mut solutions = self.solutions.write().await;
        solutions.insert(id, solution);
        Ok(id)
    }

    async fn query_similar_tasks(
        &self,
        query: &str,
        limit: usize,
    ) -> SwarmResult<KnowledgeQueryResult> {
        let patterns = self.patterns.read().await;
        let solutions = self.solutions.read().await;

        let mut scored_patterns: Vec<ScoredPattern> = patterns
            .values()
            .map(|p| {
                let similarity = Self::calculate_similarity(query, &p.description);
                let relevance = p.effectiveness.success_rate();
                ScoredPattern {
                    pattern: p.clone(),
                    similarity_score: similarity,
                    relevance_score: relevance,
                }
            })
            .filter(|sp| sp.similarity_score > 0.1)
            .collect();

        scored_patterns.sort_by(|a, b| {
            let a_score = a.similarity_score * 0.5 + a.relevance_score * 0.5;
            let b_score = b.similarity_score * 0.5 + b.relevance_score * 0.5;
            b_score.partial_cmp(&a_score).unwrap()
        });
        scored_patterns.truncate(limit);

        let mut scored_solutions: Vec<ScoredSolution> = solutions
            .values()
            .map(|s| {
                let similarity = Self::calculate_similarity(query, &s.problem_summary);
                ScoredSolution {
                    solution: s.clone(),
                    similarity_score: similarity,
                }
            })
            .filter(|ss| ss.similarity_score > 0.1)
            .collect();

        scored_solutions.sort_by(|a, b| {
            b.similarity_score.partial_cmp(&a.similarity_score).unwrap()
        });
        scored_solutions.truncate(limit);

        let total_matches = scored_patterns.len() + scored_solutions.len();

        Ok(KnowledgeQueryResult {
            query: query.to_string(),
            patterns: scored_patterns,
            solutions: scored_solutions,
            total_matches,
        })
    }

    async fn store_particle_archive(&self, archive: ParticleArchive) -> SwarmResult<EntityId> {
        let id = archive.metadata.id;
        let mut archives = self.particle_archives.write().await;
        archives.insert(id, archive);
        Ok(id)
    }

    async fn record_cross_mode_learning(
        &self,
        from: SwarmMode,
        to: SwarmMode,
        transfer_type: TransferType,
        effectiveness: f64,
    ) -> SwarmResult<()> {
        let mut learnings = self.cross_mode_learnings.write().await;
        learnings.push(CrossModeLearningRecord {
            from,
            to,
            transfer_type,
            timestamp: chrono::Utc::now(),
            effectiveness,
        });
        Ok(())
    }

    async fn get_patterns_by_domain(&self, domain: &str) -> SwarmResult<Vec<Pattern>> {
        let patterns = self.patterns.read().await;
        Ok(patterns
            .values()
            .filter(|p| p.domain == domain)
            .cloned()
            .collect())
    }
}
