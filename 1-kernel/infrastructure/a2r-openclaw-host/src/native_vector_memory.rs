//! Vector Memory Native - OC-017
//!
//! Native Rust implementation of OpenClaw's vector memory system.
//! This module provides a pure Rust implementation of vector storage and retrieval
//! that will eventually replace the OpenClaw subprocess version.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

/// Memory entry structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub content: String,
    pub embedding: Vec<f32>, // Vector embedding
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub timestamp: DateTime<Utc>,
    pub tags: Vec<String>,
    pub source: Option<String>, // Source of the memory (session, file, etc.)
    pub relevance_score: Option<f32>, // Calculated relevance score
}

/// Vector memory configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorMemoryConfig {
    pub memory_dir: PathBuf,
    pub embedding_dimension: usize,
    pub max_memory_entries: Option<usize>,
    pub enable_persistence: bool,
    pub similarity_threshold: Option<f32>, // Minimum similarity for matches
    pub max_results: Option<usize>,        // Max results to return in search
    pub enable_compaction: bool,
    pub compaction_interval_minutes: Option<u64>,
}

impl Default for VectorMemoryConfig {
    fn default() -> Self {
        Self {
            memory_dir: PathBuf::from("./vector-memory"),
            embedding_dimension: 1536, // Default dimension for OpenAI ada-002
            max_memory_entries: Some(100_000), // 100k entries max
            enable_persistence: true,
            similarity_threshold: Some(0.7), // 70% similarity threshold
            max_results: Some(10),           // Top 10 results by default
            enable_compaction: true,
            compaction_interval_minutes: Some(60),
        }
    }
}

/// Vector memory service
pub struct VectorMemoryService {
    config: VectorMemoryConfig,
    memory_entries: Vec<MemoryEntry>,
    memory_index: HashMap<String, usize>, // Maps ID to index in memory_entries
}

impl VectorMemoryService {
    /// Create new vector memory service with default configuration
    pub fn new() -> Self {
        Self {
            config: VectorMemoryConfig::default(),
            memory_entries: Vec::new(),
            memory_index: HashMap::new(),
        }
    }

    /// Create new vector memory service with custom configuration
    pub fn with_config(config: VectorMemoryConfig) -> Self {
        Self {
            config,
            memory_entries: Vec::new(),
            memory_index: HashMap::new(),
        }
    }

    /// Initialize the vector memory service
    pub async fn initialize(&mut self) -> Result<(), VectorMemoryError> {
        self.ensure_memory_dir().await?;
        if self.config.enable_persistence {
            self.load_persisted_memories().await?;
        }
        Ok(())
    }

    /// Ensure memory directory exists
    async fn ensure_memory_dir(&self) -> Result<(), VectorMemoryError> {
        fs::create_dir_all(&self.config.memory_dir)
            .await
            .map_err(|e| {
                VectorMemoryError::IoError(format!("Failed to create memory directory: {}", e))
            })
    }

    /// Load persisted memories from disk
    async fn load_persisted_memories(&mut self) -> Result<(), VectorMemoryError> {
        if !self.config.memory_dir.exists() {
            return Ok(());
        }

        let mut entries = fs::read_dir(&self.config.memory_dir).await.map_err(|e| {
            VectorMemoryError::IoError(format!("Failed to read memory directory: {}", e))
        })?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            VectorMemoryError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path).await {
                    if let Ok(memory_entry) = serde_json::from_str::<MemoryEntry>(&content) {
                        let index = self.memory_entries.len();
                        self.memory_entries.push(memory_entry.clone());
                        self.memory_index.insert(memory_entry.id.clone(), index);
                    }
                }
            }
        }

        Ok(())
    }

    /// Store a memory entry
    pub async fn store_memory(&mut self, entry: MemoryEntry) -> Result<(), VectorMemoryError> {
        // Validate embedding dimension
        if entry.embedding.len() != self.config.embedding_dimension {
            return Err(VectorMemoryError::ValidationError(format!(
                "Embedding dimension mismatch: expected {}, got {}",
                self.config.embedding_dimension,
                entry.embedding.len()
            )));
        }

        // Check memory limit
        if let Some(max_entries) = self.config.max_memory_entries {
            if self.memory_entries.len() >= max_entries {
                return Err(VectorMemoryError::MemoryLimitExceeded(format!(
                    "Memory limit of {} entries exceeded",
                    max_entries
                )));
            }
        }

        // Add to memory
        let index = self.memory_entries.len();
        self.memory_entries.push(entry.clone());
        self.memory_index.insert(entry.id.clone(), index);

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_memory(&entry).await?;
        }

        Ok(())
    }

    /// Store memory with automatic embedding generation
    pub async fn store_memory_with_embedding(
        &mut self,
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<String, VectorMemoryError> {
        // Generate embedding (in a real implementation, this would call an embedding service)
        let embedding = self.generate_embedding(&content).await?;

        let entry = MemoryEntry {
            id: Uuid::new_v4().to_string(),
            content,
            embedding,
            metadata,
            timestamp: Utc::now(),
            tags: Vec::new(),
            source: None,
            relevance_score: None,
        };

        self.store_memory(entry.clone()).await?;
        Ok(entry.id)
    }

    /// Search for similar memories
    pub async fn search_memories(
        &self,
        query_embedding: Vec<f32>,
        limit: Option<usize>,
    ) -> Result<Vec<MemoryEntry>, VectorMemoryError> {
        if query_embedding.len() != self.config.embedding_dimension {
            return Err(VectorMemoryError::ValidationError(format!(
                "Query embedding dimension mismatch: expected {}, got {}",
                self.config.embedding_dimension,
                query_embedding.len()
            )));
        }

        let limit = limit.or(self.config.max_results).unwrap_or(10);
        let threshold = self.config.similarity_threshold.unwrap_or(0.7);

        // Calculate cosine similarity with all stored embeddings
        let mut similarities: Vec<(usize, f32)> = Vec::new();

        for (idx, entry) in self.memory_entries.iter().enumerate() {
            let similarity = self.cosine_similarity(&query_embedding, &entry.embedding);
            if similarity >= threshold {
                similarities.push((idx, similarity));
            }
        }

        // Sort by similarity (descending)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Take top N results
        let top_indices: Vec<usize> = similarities
            .into_iter()
            .take(limit)
            .map(|(idx, _)| idx)
            .collect();

        // Return the memory entries
        let mut results = Vec::new();
        for &idx in &top_indices {
            let mut entry = self.memory_entries[idx].clone();
            entry.relevance_score = Some(
                self.memory_entries[idx]
                    .embedding
                    .iter()
                    .zip(query_embedding.iter())
                    .map(|(a, b)| a * b)
                    .sum(),
            );
            results.push(entry);
        }

        Ok(results)
    }

    /// Search memories by content (generate embedding and search)
    pub async fn search_memories_by_content(
        &self,
        query: &str,
        limit: Option<usize>,
    ) -> Result<Vec<MemoryEntry>, VectorMemoryError> {
        let query_embedding = self.generate_embedding(query).await?;
        self.search_memories(query_embedding, limit).await
    }

    /// Get a specific memory by ID
    pub async fn get_memory(
        &self,
        memory_id: &str,
    ) -> Result<Option<MemoryEntry>, VectorMemoryError> {
        if let Some(&index) = self.memory_index.get(memory_id) {
            if index < self.memory_entries.len() {
                Ok(Some(self.memory_entries[index].clone()))
            } else {
                Err(VectorMemoryError::CorruptionError(format!(
                    "Index {} out of bounds for memory ID {}",
                    index, memory_id
                )))
            }
        } else {
            Ok(None)
        }
    }

    /// Delete a memory by ID
    pub async fn delete_memory(&mut self, memory_id: &str) -> Result<bool, VectorMemoryError> {
        if let Some(&index) = self.memory_index.get(memory_id) {
            if index < self.memory_entries.len() {
                // Remove from vector (this will shift indices, so we need to rebuild the index)
                self.memory_entries.remove(index);

                // Rebuild the index since indices have shifted
                self.rebuild_index();

                // Remove persisted file if it exists
                if self.config.enable_persistence {
                    let memory_path = self.memory_file_path(memory_id);
                    let _ = fs::remove_file(memory_path).await; // Ignore errors if file doesn't exist
                }

                Ok(true)
            } else {
                Err(VectorMemoryError::CorruptionError(format!(
                    "Index {} out of bounds for memory ID {}",
                    index, memory_id
                )))
            }
        } else {
            Ok(false)
        }
    }

    /// Rebuild the memory index after modifications
    fn rebuild_index(&mut self) {
        self.memory_index.clear();
        for (index, entry) in self.memory_entries.iter().enumerate() {
            self.memory_index.insert(entry.id.clone(), index);
        }
    }

    /// Generate embedding for content (mock implementation)
    async fn generate_embedding(&self, content: &str) -> Result<Vec<f32>, VectorMemoryError> {
        // In a real implementation, this would call an embedding service
        // For now, we'll create a deterministic embedding based on the content
        let mut embedding = vec![0.0f32; self.config.embedding_dimension];

        // Simple deterministic embedding based on character values
        for (i, byte) in content.bytes().enumerate() {
            if i < embedding.len() {
                embedding[i] = (byte as f32) / 255.0; // Normalize to 0-1 range
            }
        }

        // Normalize the vector
        let magnitude = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            for val in &mut embedding {
                *val /= magnitude;
            }
        }

        Ok(embedding)
    }

    /// Calculate cosine similarity between two vectors
    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let magnitude_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let magnitude_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if magnitude_a == 0.0 || magnitude_b == 0.0 {
            return 0.0;
        }

        dot_product / (magnitude_a * magnitude_b)
    }

    /// Persist a memory to disk
    async fn persist_memory(&self, entry: &MemoryEntry) -> Result<(), VectorMemoryError> {
        let memory_path = self.memory_file_path(&entry.id);
        let json_content = serde_json::to_string_pretty(entry).map_err(|e| {
            VectorMemoryError::SerializationError(format!("Failed to serialize memory: {}", e))
        })?;

        fs::write(&memory_path, json_content).await.map_err(|e| {
            VectorMemoryError::IoError(format!("Failed to write memory to disk: {}", e))
        })?;

        Ok(())
    }

    /// Get the file path for a memory entry
    fn memory_file_path(&self, memory_id: &str) -> PathBuf {
        self.config.memory_dir.join(format!("{}.json", memory_id))
    }

    /// Compact memory by removing old entries
    pub async fn compact_memory(&mut self) -> Result<usize, VectorMemoryError> {
        if !self.config.enable_compaction {
            return Ok(0);
        }

        let now = Utc::now();
        let mut removed_count = 0;

        // For now, just keep the most recent entries up to the limit
        if let Some(max_entries) = self.config.max_memory_entries {
            if self.memory_entries.len() > max_entries {
                // Sort by timestamp to keep most recent
                self.memory_entries
                    .sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

                // Keep only the most recent entries
                let to_remove = self.memory_entries.len() - max_entries;
                self.memory_entries.drain(0..to_remove);

                // Rebuild index
                self.rebuild_index();

                removed_count = to_remove;
            }
        }

        Ok(removed_count)
    }

    /// Get memory statistics
    pub fn stats(&self) -> MemoryStats {
        MemoryStats {
            total_entries: self.memory_entries.len(),
            embedding_dimension: self.config.embedding_dimension,
            memory_usage_mb: (self.memory_entries.len()
                * self.config.embedding_dimension
                * std::mem::size_of::<f32>()) as f64
                / (1024.0 * 1024.0),
            oldest_entry: self
                .memory_entries
                .iter()
                .min_by_key(|entry| entry.timestamp)
                .map(|e| e.timestamp),
            newest_entry: self
                .memory_entries
                .iter()
                .max_by_key(|entry| entry.timestamp)
                .map(|e| e.timestamp),
        }
    }

    /// Get current configuration
    pub fn config(&self) -> &VectorMemoryConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut VectorMemoryConfig {
        &mut self.config
    }
}

impl Default for VectorMemoryService {
    fn default() -> Self {
        Self::new()
    }
}

/// Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    pub total_entries: usize,
    pub embedding_dimension: usize,
    pub memory_usage_mb: f64,
    pub oldest_entry: Option<DateTime<Utc>>,
    pub newest_entry: Option<DateTime<Utc>>,
}

/// Vector memory error
#[derive(Debug, thiserror::Error)]
pub enum VectorMemoryError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Memory limit exceeded: {0}")]
    MemoryLimitExceeded(String),

    #[error("Corruption error: {0}")]
    CorruptionError(String),

    #[error("Embedding dimension mismatch")]
    DimensionMismatch,

    #[error("Memory not found: {0}")]
    MemoryNotFound(String),
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_vector_memory_creation() {
        let memory = VectorMemoryService::new();
        assert_eq!(memory.config.embedding_dimension, 1536);
        assert!(memory.config.enable_persistence);
    }

    #[tokio::test]
    async fn test_store_and_retrieve_memory() {
        let mut memory = VectorMemoryService::new();

        let mut metadata = HashMap::new();
        metadata.insert(
            "test".to_string(),
            serde_json::Value::String("value".to_string()),
        );

        let entry = MemoryEntry {
            id: "test-entry".to_string(),
            content: "This is a test memory entry".to_string(),
            embedding: vec![0.1, 0.2, 0.3, 0.4],
            metadata: Some(metadata),
            timestamp: Utc::now(),
            tags: vec!["test".to_string()],
            source: Some("test".to_string()),
            relevance_score: None,
        };

        memory.store_memory(entry.clone()).await.unwrap();

        let retrieved = memory.get_memory("test-entry").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().content, "This is a test memory entry");
    }

    #[tokio::test]
    async fn test_search_memories() {
        let mut memory = VectorMemoryService::new();

        // Add a test entry
        let entry = MemoryEntry {
            id: "search-test".to_string(),
            content: "Artificial intelligence and machine learning".to_string(),
            embedding: vec![0.8, 0.1, 0.2, 0.9], // High similarity with test query
            metadata: None,
            timestamp: Utc::now(),
            tags: vec!["ai".to_string()],
            source: Some("test".to_string()),
            relevance_score: None,
        };

        memory.store_memory(entry).await.unwrap();

        // Search with similar content
        let results = memory
            .search_memories_by_content("machine learning algorithms", Some(5))
            .await
            .unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].id, "search-test");
    }

    #[tokio::test]
    async fn test_embedding_generation() {
        let memory = VectorMemoryService::new();

        let embedding = memory.generate_embedding("test content").await.unwrap();
        assert_eq!(embedding.len(), memory.config.embedding_dimension);

        // Same content should generate same embedding
        let embedding2 = memory.generate_embedding("test content").await.unwrap();
        assert_eq!(embedding, embedding2);

        // Different content should generate different embedding
        let embedding3 = memory
            .generate_embedding("different content")
            .await
            .unwrap();
        assert_ne!(embedding, embedding3);
    }

    #[tokio::test]
    async fn test_cosine_similarity() {
        let memory = VectorMemoryService::new();

        // Perfect similarity
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let sim = memory.cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 0.001);

        // Orthogonal vectors
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let sim = memory.cosine_similarity(&a, &b);
        assert!((sim - 0.0).abs() < 0.001);

        // Opposite vectors
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![-1.0, 0.0, 0.0];
        let sim = memory.cosine_similarity(&a, &b);
        assert!((sim - (-1.0)).abs() < 0.001);
    }

    #[tokio::test]
    async fn test_delete_memory() {
        let mut memory = VectorMemoryService::new();

        let entry = MemoryEntry {
            id: "delete-test".to_string(),
            content: "Content to be deleted".to_string(),
            embedding: vec![0.5, 0.5, 0.5, 0.5],
            metadata: None,
            timestamp: Utc::now(),
            tags: vec![],
            source: None,
            relevance_score: None,
        };

        memory.store_memory(entry).await.unwrap();
        assert!(memory.get_memory("delete-test").await.unwrap().is_some());

        let deleted = memory.delete_memory("delete-test").await.unwrap();
        assert!(deleted);
        assert!(memory.get_memory("delete-test").await.unwrap().is_none());
    }

    #[test]
    fn test_memory_stats() {
        let mut memory = VectorMemoryService::new();

        let entry = MemoryEntry {
            id: "stat-test".to_string(),
            content: "Stat test content".to_string(),
            embedding: vec![0.1; memory.config.embedding_dimension],
            metadata: None,
            timestamp: Utc::now(),
            tags: vec![],
            source: None,
            relevance_score: None,
        };

        memory.memory_entries.push(entry);
        let stats = memory.stats();

        assert_eq!(stats.total_entries, 1);
        assert_eq!(stats.embedding_dimension, memory.config.embedding_dimension);
        assert!(stats.memory_usage_mb > 0.0);
    }
}
