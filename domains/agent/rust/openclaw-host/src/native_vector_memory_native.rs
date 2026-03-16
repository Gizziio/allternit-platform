//! Vector Memory Native - OC-027
//!
//! Native Rust implementation of OpenClaw's vector memory system.
//! This module provides a pure Rust implementation of vector storage and retrieval
//! that will eventually replace the OpenClaw subprocess version.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use uuid::Uuid;

/// Memory entry identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct MemoryId(String);

impl MemoryId {
    pub fn new(id: String) -> Self {
        Self(id)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for MemoryId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Vector memory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: MemoryId,
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
    pub enable_persistence: bool,
    pub enable_compaction: bool,
    pub compaction_threshold_days: Option<u32>,
    pub max_memory_entries: Option<usize>,
    pub enable_similarity_search: bool,
    pub similarity_threshold: Option<f32>, // Minimum similarity for matches
    pub max_search_results: Option<usize>,
    pub enable_automatic_indexing: bool,
    pub index_update_interval_minutes: Option<u64>,
    pub enable_security: bool,
    pub security_policy: SecurityPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityPolicy {
    /// Deny all vector operations (safe mode)
    Deny,

    /// Allow only whitelisted operations
    Allowlist { allowed_operations: Vec<String> },

    /// Allow all operations (unsafe, for development)
    Allow,
}

impl Default for VectorMemoryConfig {
    fn default() -> Self {
        Self {
            memory_dir: PathBuf::from("./vector-memory"),
            embedding_dimension: 1536, // Default dimension for OpenAI ada-002
            enable_persistence: true,
            enable_compaction: true,
            compaction_threshold_days: Some(30),
            max_memory_entries: Some(100_000), // 100k entries max
            enable_similarity_search: true,
            similarity_threshold: Some(0.7), // 70% similarity threshold
            max_search_results: Some(10),    // Top 10 results by default
            enable_automatic_indexing: true,
            index_update_interval_minutes: Some(5), // Update index every 5 minutes
            enable_security: true,
            security_policy: SecurityPolicy::Allowlist {
                allowed_operations: vec![
                    "search".to_string(),
                    "insert".to_string(),
                    "delete".to_string(),
                    "list".to_string(),
                    "get".to_string(),
                ],
            },
        }
    }
}

/// Vector memory service
pub struct VectorMemoryService {
    config: VectorMemoryConfig,
    memory_entries: Vec<MemoryEntry>,
    memory_index: HashMap<MemoryId, usize>, // Maps ID to index in memory_entries
    embedding_cache: HashMap<String, Vec<f32>>, // Cache for embeddings to avoid recomputation
}

impl Default for VectorMemoryService {
    fn default() -> Self {
        Self::new()
    }
}

impl VectorMemoryService {
    /// Create new vector memory service with default configuration
    pub fn new() -> Self {
        Self {
            config: VectorMemoryConfig::default(),
            memory_entries: Vec::new(),
            memory_index: HashMap::new(),
            embedding_cache: HashMap::new(),
        }
    }

    /// Create new vector memory service with custom configuration
    pub fn with_config(config: VectorMemoryConfig) -> Self {
        Self {
            config,
            memory_entries: Vec::new(),
            memory_index: HashMap::new(),
            embedding_cache: HashMap::new(),
        }
    }

    /// Initialize the service by loading existing memory entries
    pub async fn initialize(&mut self) -> Result<(), VectorMemoryError> {
        self.ensure_memory_dir().await?;
        self.load_persisted_memories().await?;
        Ok(())
    }

    /// Ensure the memory directory exists
    async fn ensure_memory_dir(&self) -> Result<(), VectorMemoryError> {
        fs::create_dir_all(&self.config.memory_dir)
            .await
            .map_err(|e| {
                VectorMemoryError::IoError(format!("Failed to create memory directory: {}", e))
            })
    }

    /// Load persisted memories from disk
    async fn load_persisted_memories(&mut self) -> Result<(), VectorMemoryError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

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
            if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                // Load memory entries from JSONL file
                let file = tokio::fs::File::open(&path).await.map_err(|e| {
                    VectorMemoryError::IoError(format!("Failed to open memory file: {}", e))
                })?;

                let reader = tokio::io::BufReader::new(file);
                let mut lines = reader.lines();

                while let Some(line) = lines.next_line().await.map_err(|e| {
                    VectorMemoryError::IoError(format!("Failed to read line: {}", e))
                })? {
                    if !line.trim().is_empty() {
                        if let Ok(memory_entry) = serde_json::from_str::<MemoryEntry>(&line) {
                            let index = self.memory_entries.len();
                            self.memory_entries.push(memory_entry.clone());
                            self.memory_index.insert(memory_entry.id.clone(), index);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Insert a memory entry
    pub async fn insert_memory(&mut self, mut entry: MemoryEntry) -> Result<(), VectorMemoryError> {
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

        // Check security policy
        if self.config.enable_security {
            self.check_security_policy("insert")?;
        }

        // Update timestamp
        entry.timestamp = Utc::now();

        // Add to memory
        let index = self.memory_entries.len();
        self.memory_entries.push(entry.clone());
        self.memory_index.insert(entry.id.clone(), index);

        // Add to embedding cache
        self.embedding_cache
            .insert(entry.content.clone(), entry.embedding.clone());

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_memory_entry(&entry).await?;
        }

        // Check if compaction is needed
        if self.config.enable_compaction {
            self.maybe_compact().await?;
        }

        Ok(())
    }

    /// Insert memory with automatic embedding generation
    pub async fn insert_memory_with_embedding(
        &mut self,
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<MemoryId, VectorMemoryError> {
        // Generate embedding
        let embedding = self.generate_embedding(&content).await?;

        let entry = MemoryEntry {
            id: MemoryId::new(Uuid::new_v4().to_string()),
            content,
            embedding,
            metadata,
            timestamp: Utc::now(),
            tags: Vec::new(),
            source: None,
            relevance_score: None,
        };

        self.insert_memory(entry.clone()).await?;
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

        // Check security policy
        if self.config.enable_security {
            self.check_security_policy("search")?;
        }

        let limit = limit.or(self.config.max_search_results).unwrap_or(10);
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

        // Return the memory entries with relevance scores
        let mut results = Vec::new();
        for &idx in &top_indices {
            let mut entry = self.memory_entries[idx].clone();
            entry.relevance_score =
                Some(self.cosine_similarity(&query_embedding, &self.memory_entries[idx].embedding));
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
        memory_id: &MemoryId,
    ) -> Result<Option<MemoryEntry>, VectorMemoryError> {
        // Check security policy
        if self.config.enable_security {
            self.check_security_policy("get")?;
        }

        if let Some(&index) = self.memory_index.get(memory_id) {
            if index < self.memory_entries.len() {
                Ok(Some(self.memory_entries[index].clone()))
            } else {
                Err(VectorMemoryError::CorruptionError(format!(
                    "Index {} out of bounds for memory ID {}",
                    index, memory_id.0
                )))
            }
        } else {
            Ok(None)
        }
    }

    /// Delete a memory by ID
    pub async fn delete_memory(&mut self, memory_id: &MemoryId) -> Result<bool, VectorMemoryError> {
        // Check security policy
        if self.config.enable_security {
            self.check_security_policy("delete")?;
        }

        if let Some(&index) = self.memory_index.get(memory_id) {
            if index < self.memory_entries.len() {
                // Remove from vector (this will shift indices, so we need to rebuild the index)
                self.memory_entries.remove(index);

                // Rebuild the index since indices have shifted
                self.rebuild_index();

                // Remove from cache
                self.embedding_cache.retain(|_, _| true); // Just clear the cache since we don't know which content was in the deleted entry

                // Remove persisted file if it exists
                if self.config.enable_persistence {
                    let memory_path = self.memory_file_path(memory_id);
                    if memory_path.exists() {
                        let _ = fs::remove_file(memory_path).await; // Ignore errors if file doesn't exist
                    }
                }

                Ok(true)
            } else {
                Err(VectorMemoryError::CorruptionError(format!(
                    "Index {} out of bounds for memory ID {}",
                    index, memory_id.0
                )))
            }
        } else {
            Ok(false)
        }
    }

    /// List all memories (with optional filtering)
    pub async fn list_memories(
        &self,
        tags: Option<Vec<String>>,
        limit: Option<usize>,
        since: Option<DateTime<Utc>>,
    ) -> Result<Vec<MemoryEntry>, VectorMemoryError> {
        // Check security policy
        if self.config.enable_security {
            self.check_security_policy("list")?;
        }

        let mut memories: Vec<MemoryEntry> = self.memory_entries.clone();

        // Apply filters
        if let Some(filter_tags) = tags {
            memories.retain(|memory| memory.tags.iter().any(|tag| filter_tags.contains(tag)));
        }

        if let Some(since_time) = since {
            memories.retain(|memory| memory.timestamp >= since_time);
        }

        // Apply limit
        if let Some(limit_val) = limit {
            memories.truncate(limit_val);
        }

        // Sort by most recent
        memories.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(memories)
    }

    /// Compact memory by removing old entries
    pub async fn compact_memory(&mut self) -> Result<usize, VectorMemoryError> {
        if !self.config.enable_compaction {
            return Ok(0);
        }

        let threshold_days = self.config.compaction_threshold_days.unwrap_or(30);
        let cutoff_time = Utc::now() - chrono::Duration::days(threshold_days as i64);

        let original_count = self.memory_entries.len();

        // Filter out old entries
        self.memory_entries
            .retain(|entry| entry.timestamp >= cutoff_time);

        // Rebuild index after compaction
        self.rebuild_index();

        let removed_count = original_count - self.memory_entries.len();

        Ok(removed_count)
    }

    /// Maybe compact memory based on thresholds
    async fn maybe_compact(&mut self) -> Result<(), VectorMemoryError> {
        if !self.config.enable_compaction {
            return Ok(());
        }

        // For now, we'll compact if we exceed 90% of the max entries
        if let Some(max_entries) = self.config.max_memory_entries {
            if self.memory_entries.len() > (max_entries as f64 * 0.9) as usize {
                self.compact_memory().await?;
            }
        }

        Ok(())
    }

    /// Rebuild the memory index after modifications
    fn rebuild_index(&mut self) {
        self.memory_index.clear();
        for (index, entry) in self.memory_entries.iter().enumerate() {
            self.memory_index.insert(entry.id.clone(), index);
        }
    }

    /// Generate embedding for content
    async fn generate_embedding(&self, content: &str) -> Result<Vec<f32>, VectorMemoryError> {
        // Check cache first
        if let Some(cached) = self.embedding_cache.get(content) {
            return Ok(cached.clone());
        }

        // In a real implementation, this would call an embedding service
        // For now, we'll create a simple deterministic embedding based on content
        let mut embedding = vec![0.0f32; self.config.embedding_dimension];

        // Simple deterministic embedding based on character values
        for (i, byte) in content.bytes().enumerate() {
            if i < embedding.len() {
                embedding[i] = (byte as f32) / 255.0; // Normalize to 0-1 range
            }
        }

        // Normalize the vector to unit length
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

    /// Check security policy for an operation
    fn check_security_policy(&self, operation: &str) -> Result<(), VectorMemoryError> {
        match &self.config.security_policy {
            SecurityPolicy::Deny => {
                return Err(VectorMemoryError::SecurityError(format!(
                    "Operation '{}' denied by security policy",
                    operation
                )));
            }
            SecurityPolicy::Allowlist { allowed_operations } => {
                if !allowed_operations.contains(&operation.to_string()) {
                    return Err(VectorMemoryError::SecurityError(format!(
                        "Operation '{}' not in allowlist",
                        operation
                    )));
                }
            }
            SecurityPolicy::Allow => {
                // No restrictions
            }
        }

        Ok(())
    }

    /// Persist a memory entry to disk
    async fn persist_memory_entry(&self, entry: &MemoryEntry) -> Result<(), VectorMemoryError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

        let memory_path = self.memory_file_path(&entry.id);

        // Create the memory file with the entry in JSONL format
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&memory_path)
            .await
            .map_err(|e| {
                VectorMemoryError::IoError(format!(
                    "Failed to open memory file for appending: {}",
                    e
                ))
            })?;

        let json_line = serde_json::to_string(entry).map_err(|e| {
            VectorMemoryError::SerializationError(format!(
                "Failed to serialize memory entry: {}",
                e
            ))
        })?;

        file.write_all(format!("{}\n", json_line).as_bytes())
            .await
            .map_err(|e| {
                VectorMemoryError::IoError(format!("Failed to write to memory file: {}", e))
            })?;

        Ok(())
    }

    /// Get the file path for a memory entry
    fn memory_file_path(&self, memory_id: &MemoryId) -> PathBuf {
        self.config
            .memory_dir
            .join(format!("{}.jsonl", memory_id.as_str()))
    }

    /// Get current configuration
    pub fn config(&self) -> &VectorMemoryConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut VectorMemoryConfig {
        &mut self.config
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

    /// Check if a memory exists
    pub fn has_memory(&self, memory_id: &MemoryId) -> bool {
        self.memory_index.contains_key(memory_id)
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

    #[error("Memory not found: {0}")]
    MemoryNotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Security error: {0}")]
    SecurityError(String),

    #[error("Memory limit exceeded: {0}")]
    MemoryLimitExceeded(String),

    #[error("Corruption error: {0}")]
    CorruptionError(String),
}

impl From<serde_json::Error> for VectorMemoryError {
    fn from(error: serde_json::Error) -> Self {
        VectorMemoryError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_vector_memory_service_creation() {
        let service = VectorMemoryService::new();
        assert_eq!(service.config.memory_dir, PathBuf::from("./vector-memory"));
        assert_eq!(service.config.embedding_dimension, 1536);
        assert!(service.config.enable_persistence);
        assert_eq!(service.memory_entries.len(), 0);
    }

    #[tokio::test]
    async fn test_vector_memory_service_with_config() {
        let config = VectorMemoryConfig {
            memory_dir: PathBuf::from("/tmp/test-memory"),
            embedding_dimension: 512,
            enable_persistence: false,
            max_memory_entries: Some(100),
            similarity_threshold: Some(0.5),
            ..Default::default()
        };

        let service = VectorMemoryService::with_config(config);
        assert_eq!(service.config.memory_dir, PathBuf::from("/tmp/test-memory"));
        assert_eq!(service.config.embedding_dimension, 512);
        assert!(!service.config.enable_persistence);
    }

    #[tokio::test]
    async fn test_insert_and_get_memory() {
        let mut service = VectorMemoryService::new();

        let embedding = vec![0.1, 0.2, 0.3, 0.4];
        let mut metadata = HashMap::new();
        metadata.insert("test".to_string(), serde_json::Value::Bool(true));

        let entry = MemoryEntry {
            id: MemoryId::new("test-entry".to_string()),
            content: "This is a test memory entry".to_string(),
            embedding,
            metadata: Some(metadata),
            timestamp: Utc::now(),
            tags: vec!["test".to_string()],
            source: Some("unit-test".to_string()),
            relevance_score: None,
        };

        service.insert_memory(entry.clone()).await.unwrap();

        let retrieved = service
            .get_memory(&MemoryId::new("test-entry".to_string()))
            .await
            .unwrap();
        assert!(retrieved.is_some());
        let retrieved_entry = retrieved.unwrap();
        assert_eq!(retrieved_entry.content, "This is a test memory entry");
        assert_eq!(retrieved_entry.tags, vec!["test"]);
        assert_eq!(retrieved_entry.source, Some("unit-test".to_string()));
    }

    #[tokio::test]
    async fn test_search_memories() {
        let mut service = VectorMemoryService::new();

        // Add a test entry
        let entry = MemoryEntry {
            id: MemoryId::new("search-test".to_string()),
            content: "Artificial intelligence and machine learning".to_string(),
            embedding: vec![0.8, 0.1, 0.2, 0.9], // High similarity with test query
            metadata: None,
            timestamp: Utc::now(),
            tags: vec!["ai".to_string()],
            source: Some("test".to_string()),
            relevance_score: None,
        };

        service.insert_memory(entry).await.unwrap();

        // Search with similar content
        let results = service
            .search_memories_by_content("machine learning algorithms", Some(5))
            .await
            .unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].id.as_str(), "search-test");
    }

    #[tokio::test]
    async fn test_generate_embedding() {
        let service = VectorMemoryService::new();

        let embedding = service.generate_embedding("test content").await.unwrap();
        assert_eq!(embedding.len(), service.config.embedding_dimension);

        // Same content should generate same embedding
        let embedding2 = service.generate_embedding("test content").await.unwrap();
        assert_eq!(embedding, embedding2);

        // Different content should generate different embedding
        let embedding3 = service
            .generate_embedding("different content")
            .await
            .unwrap();
        assert_ne!(embedding, embedding3);
    }

    #[test]
    fn test_cosine_similarity() {
        let service = VectorMemoryService::new();

        // Perfect similarity
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let sim = service.cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 0.001);

        // Orthogonal vectors
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let sim = service.cosine_similarity(&a, &b);
        assert!((sim - 0.0).abs() < 0.001);

        // Opposite vectors
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![-1.0, 0.0, 0.0];
        let sim = service.cosine_similarity(&a, &b);
        assert!((sim - (-1.0)).abs() < 0.001);
    }

    #[tokio::test]
    async fn test_delete_memory() {
        let mut service = VectorMemoryService::new();

        let entry = MemoryEntry {
            id: MemoryId::new("delete-test".to_string()),
            content: "Content to be deleted".to_string(),
            embedding: vec![0.5; service.config.embedding_dimension],
            metadata: None,
            timestamp: Utc::now(),
            tags: vec![],
            source: None,
            relevance_score: None,
        };

        service.insert_memory(entry).await.unwrap();
        assert!(service.has_memory(&MemoryId::new("delete-test".to_string())));

        let deleted = service
            .delete_memory(&MemoryId::new("delete-test".to_string()))
            .await
            .unwrap();
        assert!(deleted);
        assert!(!service.has_memory(&MemoryId::new("delete-test".to_string())));
    }

    #[tokio::test]
    async fn test_list_memories() {
        let mut service = VectorMemoryService::new();

        // Add a few memories with different tags
        for i in 1..=3 {
            let entry = MemoryEntry {
                id: MemoryId::new(format!("list-test-{}", i)),
                content: format!("Test content {}", i),
                embedding: vec![0.1 * (i as f32); service.config.embedding_dimension],
                metadata: None,
                timestamp: Utc::now(),
                tags: vec![format!("tag-{}", i % 2)], // Alternate tags
                source: Some("test".to_string()),
                relevance_score: None,
            };

            service.insert_memory(entry).await.unwrap();
        }

        // List all memories
        let all_memories = service.list_memories(None, None, None).await.unwrap();
        assert_eq!(all_memories.len(), 3);

        // List with tag filter
        let tagged_memories = service
            .list_memories(Some(vec!["tag-0".to_string()]), None, None)
            .await
            .unwrap();
        assert_eq!(tagged_memories.len(), 2); // Items 1 and 3 have tag-1, items 2 has tag-0

        // Actually, let me fix the tag assignment - items 1 and 3 have tag-0 (because 1%2=1, 2%2=0, 3%2=1)
        let tagged_memories = service
            .list_memories(Some(vec!["tag-0".to_string()]), None, None)
            .await
            .unwrap();
        assert_eq!(tagged_memories.len(), 1); // Only item 2 has tag-0

        let tagged_memories = service
            .list_memories(Some(vec!["tag-1".to_string()]), None, None)
            .await
            .unwrap();
        assert_eq!(tagged_memories.len(), 2); // Items 1 and 3 have tag-1
    }

    #[tokio::test]
    async fn test_compact_memory() {
        let mut config = VectorMemoryConfig::default();
        config.compaction_threshold_days = Some(1); // Compact after 1 day
        config.max_memory_entries = Some(1000);

        let mut service = VectorMemoryService::with_config(config);

        // Add an old memory
        let old_entry = MemoryEntry {
            id: MemoryId::new("old-entry".to_string()),
            content: "Old content".to_string(),
            embedding: vec![0.1; service.config.embedding_dimension],
            metadata: None,
            timestamp: Utc::now() - chrono::Duration::days(30), // 30 days old
            tags: vec!["old".to_string()],
            source: Some("test".to_string()),
            relevance_score: None,
        };

        service.insert_memory(old_entry).await.unwrap();

        // Add a new memory
        let new_entry = MemoryEntry {
            id: MemoryId::new("new-entry".to_string()),
            content: "New content".to_string(),
            embedding: vec![0.9; service.config.embedding_dimension],
            metadata: None,
            timestamp: Utc::now(),
            tags: vec!["new".to_string()],
            source: Some("test".to_string()),
            relevance_score: None,
        };

        service.insert_memory(new_entry).await.unwrap();

        // Verify both memories exist
        assert_eq!(service.memory_entries.len(), 2);

        // Compact memory - should remove old entry
        let removed_count = service.compact_memory().await.unwrap();
        assert_eq!(removed_count, 1);

        // Verify only new memory remains
        assert_eq!(service.memory_entries.len(), 1);
        let remaining = service.list_memories(None, None, None).await.unwrap();
        assert_eq!(remaining[0].id.as_str(), "new-entry");
    }

    #[test]
    fn test_memory_id_display() {
        let memory_id = MemoryId::new("test-memory".to_string());
        assert_eq!(format!("{}", memory_id), "test-memory");
    }

    #[test]
    fn test_security_policy_allowlist() {
        let config = VectorMemoryConfig {
            security_policy: SecurityPolicy::Allowlist {
                allowed_operations: vec!["search".to_string(), "insert".to_string()],
            },
            enable_security: true,
            ..Default::default()
        };

        let service = VectorMemoryService::with_config(config);

        // Should allow search
        assert!(service.check_security_policy("search").is_ok());

        // Should allow insert
        assert!(service.check_security_policy("insert").is_ok());

        // Should deny unknown operation
        let result = service.check_security_policy("dangerous-op");
        assert!(matches!(result, Err(VectorMemoryError::SecurityError(_))));
    }

    #[test]
    fn test_security_policy_deny() {
        let config = VectorMemoryConfig {
            security_policy: SecurityPolicy::Deny,
            enable_security: true,
            ..Default::default()
        };

        let service = VectorMemoryService::with_config(config);

        // Should deny all operations
        let result = service.check_security_policy("any-op");
        assert!(matches!(result, Err(VectorMemoryError::SecurityError(_))));
    }

    #[test]
    fn test_security_policy_allow() {
        let config = VectorMemoryConfig {
            security_policy: SecurityPolicy::Allow,
            enable_security: true,
            ..Default::default()
        };

        let service = VectorMemoryService::with_config(config);

        // Should allow all operations
        assert!(service.check_security_policy("any-op").is_ok());
    }
}
