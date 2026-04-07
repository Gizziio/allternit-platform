//! A2R Memory Kernel
//!
//! Three-layer memory system:
//! 1. Events Layer - Append-only event log (traces.ndjson)
//! 2. Entities Layer - Entity/relationship graph with items.json + summary.md
//! 3. Summaries Layer - Weekly regenerated snapshots
//!
//! Based on memora.md and MemoryKernel specification

use allternit_evolution_layer::MemoryEvolutionEngine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Event Layer (Append-only log)
// ============================================================================

/// Memory event (append-only)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEvent {
    pub event_id: String,
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub content: serde_json::Value,
    pub tags: Vec<String>,
}

impl MemoryEvent {
    pub fn new(event_type: &str, content: serde_json::Value) -> Self {
        Self {
            event_id: format!("evt_{}", Uuid::new_v4().simple()),
            event_type: event_type.to_string(),
            timestamp: Utc::now(),
            session_id: None,
            agent_id: None,
            content,
            tags: vec![],
        }
    }
}

// ============================================================================
// Entity Layer (Knowledge Graph)
// ============================================================================

/// Entity type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EntityType {
    Person,
    Company,
    Project,
    Concept,
    Document,
    Code,
    Other,
}

/// Entity fact (atomic, timestamped)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityFact {
    pub fact_id: String,
    pub entity_id: String,
    pub predicate: String,
    pub object: String,
    pub timestamp: DateTime<Utc>,
    pub status: FactStatus,
    pub superseded_by: Option<String>,
    pub confidence: f32,
    pub source: String,
}

/// Fact status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FactStatus {
    Active,
    Superseded,
    Deprecated,
}

/// Entity relationship
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRelationship {
    pub rel_id: String,
    pub from_entity: String,
    pub to_entity: String,
    pub relation_type: String,
    pub timestamp: DateTime<Utc>,
}

/// Entity summary (regenerated weekly)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitySummary {
    pub entity_id: String,
    pub name: String,
    pub entity_type: EntityType,
    pub summary_text: String,
    pub active_facts_count: usize,
    pub relationships_count: usize,
    pub last_updated: DateTime<Utc>,
    pub generated_at: DateTime<Utc>,
}

/// Entity with facts and relationships
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub entity_id: String,
    pub name: String,
    pub entity_type: EntityType,
    pub facts: Vec<EntityFact>,
    pub relationships: Vec<EntityRelationship>,
    pub summary: Option<EntitySummary>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Memory Kernel
// ============================================================================

/// Three-layer Memory Kernel
pub struct MemoryKernel {
    events: Arc<RwLock<Vec<MemoryEvent>>>,
    entities: Arc<RwLock<HashMap<String, Entity>>>,
    relationships: Arc<RwLock<Vec<EntityRelationship>>>,
    summaries: Arc<RwLock<HashMap<String, EntitySummary>>>,
    memory_engine: Arc<MemoryEvolutionEngine>,
}

impl MemoryKernel {
    pub fn new(memory_engine: Arc<MemoryEvolutionEngine>) -> Self {
        Self {
            events: Arc::new(RwLock::new(Vec::new())),
            entities: Arc::new(RwLock::new(HashMap::new())),
            relationships: Arc::new(RwLock::new(Vec::new())),
            summaries: Arc::new(RwLock::new(HashMap::new())),
            memory_engine,
        }
    }

    // ========================================================================
    // Event Layer Operations
    // ========================================================================

    /// Append event to log
    pub async fn append_event(&self, mut event: MemoryEvent) -> String {
        event.event_id = format!("evt_{}", Uuid::new_v4().simple());
        let event_id = event.event_id.clone();

        let mut events = self.events.write().await;
        events.push(event);

        event_id
    }

    /// Query events by type
    pub async fn query_events_by_type(&self, event_type: &str) -> Vec<MemoryEvent> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| e.event_type == event_type)
            .cloned()
            .collect()
    }

    /// Query events by session
    pub async fn query_events_by_session(&self, session_id: &str) -> Vec<MemoryEvent> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| e.session_id.as_deref() == Some(session_id))
            .cloned()
            .collect()
    }

    /// Get recent events
    pub async fn get_recent_events(&self, limit: usize) -> Vec<MemoryEvent> {
        let events = self.events.read().await;
        events.iter().rev().take(limit).cloned().collect()
    }

    // ========================================================================
    // Entity Layer Operations
    // ========================================================================

    /// Create or get entity
    pub async fn get_or_create_entity(
        &self,
        name: &str,
        entity_type: EntityType,
    ) -> String {
        let mut entities = self.entities.write().await;

        // Check if entity exists
        if let Some((id, _)) = entities.iter().find(|(_, e)| e.name == name) {
            return id.clone();
        }

        // Create new entity
        let entity_id = format!("ent_{}", Uuid::new_v4().simple());
        let now = Utc::now();

        let entity = Entity {
            entity_id: entity_id.clone(),
            name: name.to_string(),
            entity_type,
            facts: vec![],
            relationships: vec![],
            summary: None,
            created_at: now,
            updated_at: now,
        };

        entities.insert(entity_id.clone(), entity);
        entity_id
    }

    /// Add fact to entity
    pub async fn add_fact(
        &self,
        entity_id: &str,
        predicate: &str,
        object: &str,
        source: &str,
        confidence: f32,
    ) -> Result<String, MemoryError> {
        let mut entities = self.entities.write().await;
        let entity = entities
            .get_mut(entity_id)
            .ok_or_else(|| MemoryError::NotFound(format!("Entity {}", entity_id)))?;

        let fact_id = format!("fact_{}", Uuid::new_v4().simple());
        let fact = EntityFact {
            fact_id: fact_id.clone(),
            entity_id: entity_id.to_string(),
            predicate: predicate.to_string(),
            object: object.to_string(),
            timestamp: Utc::now(),
            status: FactStatus::Active,
            superseded_by: None,
            confidence,
            source: source.to_string(),
        };

        entity.facts.push(fact.clone());
        entity.updated_at = Utc::now();

        Ok(fact_id)
    }

    /// Supersede fact (mark as outdated)
    pub async fn supersede_fact(
        &self,
        fact_id: &str,
        new_fact_id: &str,
    ) -> Result<(), MemoryError> {
        let mut entities = self.entities.write().await;

        for entity in entities.values_mut() {
            for fact in &mut entity.facts {
                if fact.fact_id == fact_id {
                    fact.status = FactStatus::Superseded;
                    fact.superseded_by = Some(new_fact_id.to_string());
                    return Ok(());
                }
            }
        }

        Err(MemoryError::NotFound(format!("Fact {}", fact_id)))
    }

    /// Add relationship between entities
    pub async fn add_relationship(
        &self,
        from_entity: &str,
        to_entity: &str,
        relation_type: &str,
    ) -> Result<String, MemoryError> {
        // Verify entities exist
        {
            let entities = self.entities.read().await;
            if !entities.contains_key(from_entity) {
                return Err(MemoryError::NotFound(format!("Entity {}", from_entity)));
            }
            if !entities.contains_key(to_entity) {
                return Err(MemoryError::NotFound(format!("Entity {}", to_entity)));
            }
        }

        let rel_id = format!("rel_{}", Uuid::new_v4().simple());
        let rel = EntityRelationship {
            rel_id: rel_id.clone(),
            from_entity: from_entity.to_string(),
            to_entity: to_entity.to_string(),
            relation_type: relation_type.to_string(),
            timestamp: Utc::now(),
        };

        // Add to entity relationship lists
        {
            let mut entities = self.entities.write().await;
            if let Some(entity) = entities.get_mut(from_entity) {
                entity.relationships.push(rel.clone());
            }
            if let Some(entity) = entities.get_mut(to_entity) {
                entity.relationships.push(rel.clone());
            }
        }

        // Add to global relationship list
        {
            let mut relationships = self.relationships.write().await;
            relationships.push(rel);
        }

        Ok(rel_id)
    }

    /// Get entity by ID
    pub async fn get_entity(&self, entity_id: &str) -> Option<Entity> {
        let entities = self.entities.read().await;
        entities.get(entity_id).cloned()
    }

    /// Query entities by type
    pub async fn query_entities_by_type(&self, entity_type: EntityType) -> Vec<Entity> {
        let entities = self.entities.read().await;
        entities
            .values()
            .filter(|e| e.entity_type == entity_type)
            .cloned()
            .collect()
    }

    /// Search entities by name
    pub async fn search_entities(&self, query: &str) -> Vec<Entity> {
        let entities = self.entities.read().await;
        entities
            .values()
            .filter(|e| e.name.to_lowercase().contains(&query.to_lowercase()))
            .cloned()
            .collect()
    }

    // ========================================================================
    // Summary Layer Operations
    // ========================================================================

    /// Generate summary for entity
    pub async fn generate_summary(&self, entity_id: &str) -> Result<EntitySummary, MemoryError> {
        let mut entities = self.entities.write().await;
        let entity = entities
            .get_mut(entity_id)
            .ok_or_else(|| MemoryError::NotFound(format!("Entity {}", entity_id)))?;

        // Generate summary from active facts
        let active_facts: Vec<&EntityFact> = entity
            .facts
            .iter()
            .filter(|f| f.status == FactStatus::Active)
            .collect();

        let summary_text = active_facts
            .iter()
            .map(|f| format!("{}: {}", f.predicate, f.object))
            .collect::<Vec<_>>()
            .join("; ");

        let summary = EntitySummary {
            entity_id: entity_id.to_string(),
            name: entity.name.clone(),
            entity_type: entity.entity_type,
            summary_text,
            active_facts_count: active_facts.len(),
            relationships_count: entity.relationships.len(),
            last_updated: entity.updated_at,
            generated_at: Utc::now(),
        };

        entity.summary = Some(summary.clone());
        entity.updated_at = Utc::now();

        // Store in summaries cache
        {
            let mut summaries = self.summaries.write().await;
            summaries.insert(entity_id.to_string(), summary.clone());
        }

        Ok(summary)
    }

    /// Get summary for entity
    pub async fn get_summary(&self, entity_id: &str) -> Option<EntitySummary> {
        // Check cache first
        {
            let summaries = self.summaries.read().await;
            if let Some(summary) = summaries.get(entity_id) {
                return Some(summary.clone());
            }
        }

        // Check entity
        let entities = self.entities.read().await;
        entities.get(entity_id).and_then(|e| e.summary.clone())
    }

    /// Get all summaries
    pub async fn get_all_summaries(&self) -> Vec<EntitySummary> {
        let summaries = self.summaries.read().await;
        summaries.values().cloned().collect()
    }

    // ========================================================================
    // Memory Engine Integration
    // ========================================================================

    /// Get memory evolution engine
    pub fn get_memory_engine(&self) -> Arc<MemoryEvolutionEngine> {
        self.memory_engine.clone()
    }

    // ========================================================================
    // Utility Operations
    // ========================================================================

    /// Get memory statistics
    pub async fn get_stats(&self) -> MemoryStats {
        let events = self.events.read().await;
        let entities = self.entities.read().await;
        let summaries = self.summaries.read().await;

        MemoryStats {
            event_count: events.len(),
            entity_count: entities.len(),
            summary_count: summaries.len(),
        }
    }

    /// Compute memory hash (for determinism)
    pub async fn compute_hash(&self) -> String {
        let mut hasher = Sha256::new();

        let events = self.events.read().await;
        for event in events.iter() {
            hasher.update(event.event_id.as_bytes());
        }

        let entities = self.entities.read().await;
        for entity in entities.values() {
            hasher.update(entity.entity_id.as_bytes());
        }

        format!("{:x}", hasher.finalize())
    }
}

/// Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    pub event_count: usize,
    pub entity_count: usize,
    pub summary_count: usize,
}

/// Memory error types
#[derive(Debug, thiserror::Error)]
pub enum MemoryError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

impl Default for MemoryKernel {
    fn default() -> Self {
        Self::new(Arc::new(MemoryEvolutionEngine::new()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_append_event() {
        let kernel = MemoryKernel::default();

        let event = MemoryEvent::new("test_event", serde_json::json!({"key": "value"}));
        let event_id = kernel.append_event(event).await;

        assert!(event_id.starts_with("evt_"));

        let events = kernel.get_recent_events(1).await;
        assert_eq!(events.len(), 1);
    }

    #[tokio::test]
    async fn test_entity_operations() {
        let kernel = MemoryKernel::default();

        // Create entity
        let entity_id = kernel
            .get_or_create_entity("John Doe", EntityType::Person)
            .await;
        assert!(entity_id.starts_with("ent_"));

        // Add fact
        let fact_id = kernel
            .add_fact(&entity_id, "works_at", "Acme Corp", "test", 0.9)
            .await
            .unwrap();
        assert!(fact_id.starts_with("fact_"));

        // Get entity
        let entity = kernel.get_entity(&entity_id).await;
        assert!(entity.is_some());
        assert_eq!(entity.unwrap().facts.len(), 1);
    }

    #[tokio::test]
    async fn test_relationships() {
        let kernel = MemoryKernel::default();

        // Create entities
        let person_id = kernel
            .get_or_create_entity("John", EntityType::Person)
            .await;
        let company_id = kernel
            .get_or_create_entity("Acme", EntityType::Company)
            .await;

        // Add relationship
        let rel_id = kernel
            .add_relationship(&person_id, &company_id, "works_at")
            .await
            .unwrap();
        assert!(rel_id.starts_with("rel_"));

        // Verify relationship
        let person = kernel.get_entity(&person_id).await.unwrap();
        assert_eq!(person.relationships.len(), 1);
    }

    #[tokio::test]
    async fn test_summary_generation() {
        let kernel = MemoryKernel::default();

        // Create entity with facts
        let entity_id = kernel
            .get_or_create_entity("Jane", EntityType::Person)
            .await;

        kernel.add_fact(&entity_id, "role", "Engineer", "test", 0.9).await.unwrap();
        kernel.add_fact(&entity_id, "location", "NYC", "test", 0.8).await.unwrap();

        // Generate summary
        let summary = kernel.generate_summary(&entity_id).await.unwrap();
        assert!(summary.summary_text.contains("role"));
        assert!(summary.summary_text.contains("location"));
        assert_eq!(summary.active_facts_count, 2);
    }

    #[tokio::test]
    async fn test_fact_supersession() {
        let kernel = MemoryKernel::default();

        // Create entity with fact
        let entity_id = kernel
            .get_or_create_entity("Bob", EntityType::Person)
            .await;

        let fact1_id = kernel
            .add_fact(&entity_id, "role", "Junior", "test", 0.9)
            .await
            .unwrap();

        // Supersede with new fact
        let fact2_id = kernel
            .add_fact(&entity_id, "role", "Senior", "test", 0.9)
            .await
            .unwrap();

        kernel.supersede_fact(&fact1_id, &fact2_id).await.unwrap();

        // Verify supersession
        let entity = kernel.get_entity(&entity_id).await.unwrap();
        let fact1 = entity.facts.iter().find(|f| f.fact_id == fact1_id).unwrap();
        assert_eq!(fact1.status, FactStatus::Superseded);
        assert_eq!(fact1.superseded_by, Some(fact2_id.clone()));
    }

    #[tokio::test]
    async fn test_memory_stats() {
        let kernel = MemoryKernel::default();

        // Add some data
        kernel.append_event(MemoryEvent::new("test", serde_json::json!({}))).await;
        kernel.get_or_create_entity("Test", EntityType::Other).await;

        let stats = kernel.get_stats().await;
        assert!(stats.event_count >= 1);
        assert!(stats.entity_count >= 1);
    }
}
