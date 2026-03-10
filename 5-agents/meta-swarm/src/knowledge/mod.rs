use crate::error::SwarmResult;
use crate::types::{
    CrossModeLearning, EntityId, KnowledgeQueryResult, Pattern, ParticleArchive, Solution,
    SwarmMode, TransferType,
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub mod store;

pub use store::InMemoryKnowledgeStore;

/// Trait for knowledge storage backends
#[async_trait]
pub trait KnowledgeStore: Send + Sync {
    /// Store a pattern
    async fn store_pattern(&self, pattern: Pattern) -> SwarmResult<EntityId>;

    /// Retrieve a pattern by ID
    async fn get_pattern(&self, id: EntityId) -> SwarmResult<Option<Pattern>>;

    /// Query for similar patterns
    async fn query_patterns(
        &self,
        query: &str,
        limit: usize,
    ) -> SwarmResult<Vec<(Pattern, f64)>>;

    /// Store a solution
    async fn store_solution(&self, solution: Solution) -> SwarmResult<EntityId>;

    /// Query for similar solutions
    async fn query_similar_tasks(
        &self,
        query: &str,
        limit: usize,
    ) -> SwarmResult<KnowledgeQueryResult>;

    /// Store a particle archive
    async fn store_particle_archive(&self, archive: ParticleArchive) -> SwarmResult<EntityId>;

    /// Record cross-mode learning
    async fn record_cross_mode_learning(
        &self,
        from: SwarmMode,
        to: SwarmMode,
        transfer_type: TransferType,
        effectiveness: f64,
    ) -> SwarmResult<()>;

    /// Get patterns for a specific domain
    async fn get_patterns_by_domain(&self, domain: &str) -> SwarmResult<Vec<Pattern>>;
}

/// Cross-mode learning coordinator
pub struct CrossModeLearning {
    store: Arc<dyn KnowledgeStore>,
    transfers: RwLock<Vec<TransferRecord>>,
}

#[derive(Debug, Clone)]
pub struct TransferRecord {
    pub from_mode: SwarmMode,
    pub to_mode: SwarmMode,
    pub transfer_type: TransferType,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub effectiveness: f64,
}

impl CrossModeLearning {
    pub fn new(store: Arc<dyn KnowledgeStore>) -> Self {
        Self {
            store,
            transfers: RwLock::new(Vec::new()),
        }
    }

    /// Transfer a pattern from SwarmAgentic to Claude Swarm
    pub async fn export_architecture(
        &self,
        pattern: &Pattern,
    ) -> SwarmResult<()> {
        self.store
            .record_cross_mode_learning(
                SwarmMode::SwarmAgentic,
                SwarmMode::ClaudeSwarm,
                TransferType::ArchitectureExport,
                pattern.effectiveness.success_rate(),
            )
            .await?;

        let mut transfers = self.transfers.write().await;
        transfers.push(TransferRecord {
            from_mode: SwarmMode::SwarmAgentic,
            to_mode: SwarmMode::ClaudeSwarm,
            transfer_type: TransferType::ArchitectureExport,
            timestamp: chrono::Utc::now(),
            effectiveness: pattern.effectiveness.success_rate(),
        });

        Ok(())
    }

    /// Share a pattern from ClosedLoop to all modes
    pub async fn share_pattern(
        &self,
        pattern: &Pattern,
    ) -> SwarmResult<()> {
        self.store
            .record_cross_mode_learning(
                SwarmMode::ClosedLoop,
                SwarmMode::ClaudeSwarm,
                TransferType::PatternSharing,
                pattern.effectiveness.success_rate(),
            )
            .await?;

        Ok(())
    }
}
