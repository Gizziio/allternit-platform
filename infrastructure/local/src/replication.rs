//! Multi-Region Replication
//! GAP-78/GAP-79: Knowledge Graph Replication
//!
//! Handles replication of Ars Contexta knowledge graphs
//! across multiple regions for availability and performance.
//!
//! WIH: GAP-78/GAP-79, Agent: T3-A5

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

// ============================================================================
// Core Types
// ============================================================================

/// Unique identifier for a region
pub type RegionId = String;

/// Unique identifier for a node in the cluster
pub type NodeId = String;

/// Version vector for conflict resolution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct VersionVector {
    /// Map of region -> logical clock
    pub clocks: HashMap<RegionId, u64>,
}

impl VersionVector {
    /// Create new empty version vector
    pub fn new() -> Self {
        Self {
            clocks: HashMap::new(),
        }
    }

    /// Increment clock for a region
    pub fn increment(&mut self, region: &RegionId) -> u64 {
        let clock = self.clocks.entry(region.clone()).or_insert(0);
        *clock += 1;
        *clock
    }

    /// Get clock for a region
    pub fn get(&self, region: &RegionId) -> u64 {
        self.clocks.get(region).copied().unwrap_or(0)
    }

    /// Merge two version vectors (takes maximum)
    pub fn merge(&mut self, other: &VersionVector) {
        for (region, clock) in &other.clocks {
            let entry = self.clocks.entry(region.clone()).or_insert(0);
            *entry = (*entry).max(*clock);
        }
    }

    /// Compare two version vectors
    pub fn compare(&self, other: &VersionVector) -> Ordering {
        let mut has_greater = false;
        let mut has_less = false;

        let all_regions: std::collections::HashSet<_> = self
            .clocks
            .keys()
            .chain(other.clocks.keys())
            .collect();

        for region in all_regions {
            let s = self.get(region);
            let o = other.get(region);

            if s > o {
                has_greater = true;
            } else if s < o {
                has_less = true;
            }
        }

        match (has_greater, has_less) {
            (true, false) => Ordering::Greater,
            (false, true) => Ordering::Less,
            (false, false) => Ordering::Equal,
            (true, true) => Ordering::Concurrent,
        }
    }
}

/// Ordering result for version vectors
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ordering {
    /// This vector is greater (happened after)
    Greater,
    /// This vector is less (happened before)
    Less,
    /// Vectors are equal
    Equal,
    /// Concurrent (conflict)
    Concurrent,
}

// ============================================================================
// Replication Types
// ============================================================================

/// A replicated knowledge graph node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicatedNote {
    /// Unique ID
    pub id: String,
    /// Note content
    pub content: String,
    /// Version vector for conflict resolution
    pub version: VersionVector,
    /// Timestamp of last modification
    pub timestamp: u64,
    /// Region that last modified this note
    pub last_modified_by: RegionId,
    /// Tombstone flag (for deletion)
    pub deleted: bool,
    /// Conflict resolution metadata
    pub conflict_metadata: Option<ConflictMetadata>,
}

/// Metadata for conflict resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictMetadata {
    /// List of conflicting versions
    pub conflicts: Vec<ReplicatedNote>,
    /// Resolution strategy used
    pub resolution: ConflictResolution,
    /// Timestamp of resolution
    pub resolved_at: u64,
}

/// Conflict resolution strategies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolution {
    /// Last writer wins (by timestamp)
    LastWriterWins,
    /// Merge contents
    Merged,
    /// Manual resolution required
    Manual,
    /// Vector clock priority
    VectorClock,
}

/// Replication message between regions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReplicationMessage {
    /// Push updates to another region
    Push {
        from: RegionId,
        notes: Vec<ReplicatedNote>,
    },
    /// Pull request for updates
    Pull {
        from: RegionId,
        since: u64,
    },
    /// Pull response
    PullResponse {
        from: RegionId,
        notes: Vec<ReplicatedNote>,
    },
    /// Anti-entropy synchronization
    AntiEntropy {
        from: RegionId,
        digests: Vec<NoteDigest>,
    },
    /// Anti-entropy response (missing notes)
    AntiEntropyResponse {
        from: RegionId,
        notes: Vec<ReplicatedNote>,
    },
}

/// Digest of a note for anti-entropy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteDigest {
    pub id: String,
    pub version_hash: String,
    pub timestamp: u64,
}

// ============================================================================
// Region Configuration
// ============================================================================

/// Configuration for a region
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionConfig {
    /// Unique region identifier
    pub id: RegionId,
    /// Human-readable name
    pub name: String,
    /// Geographic location
    pub location: String,
    /// Replication endpoint
    pub endpoint: String,
    /// Priority (for conflict resolution)
    pub priority: u32,
    /// Replication strategy
    pub strategy: ReplicationStrategy,
}

/// Replication strategies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReplicationStrategy {
    /// Active-active (all regions writable)
    ActiveActive,
    /// Active-passive (primary + replicas)
    ActivePassive { primary: RegionId },
    /// Multi-master (selective)
    MultiMaster { masters: Vec<RegionId> },
}

/// Multi-region cluster configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterConfig {
    /// This region's ID
    pub local_region: RegionId,
    /// All regions in cluster
    pub regions: Vec<RegionConfig>,
    /// Conflict resolution policy
    pub conflict_policy: ConflictPolicy,
    /// Replication interval (seconds)
    pub replication_interval: u64,
    /// Maximum replication lag (seconds)
    pub max_lag: u64,
}

/// Conflict resolution policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictPolicy {
    /// Default resolution strategy
    pub default_strategy: ConflictResolution,
    /// Whether to auto-resolve simple conflicts
    pub auto_resolve: bool,
    /// Timestamp resolution threshold (ms)
    pub timestamp_threshold: u64,
}

impl Default for ConflictPolicy {
    fn default() -> Self {
        Self {
            default_strategy: ConflictResolution::VectorClock,
            auto_resolve: true,
            timestamp_threshold: 1000,
        }
    }
}

// ============================================================================
// Replication Engine
// ============================================================================

/// Replication engine for multi-region knowledge graph
pub struct ReplicationEngine {
    /// Cluster configuration
    config: ClusterConfig,
    /// Local storage of notes
    notes: Arc<Mutex<HashMap<String, ReplicatedNote>>>,
    /// Local version vector
    local_version: Arc<Mutex<VersionVector>>,
    /// Replication log
    log: Arc<Mutex<Vec<ReplicationEvent>>>,
}

/// Replication event for audit log
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicationEvent {
    pub timestamp: u64,
    pub region: RegionId,
    pub event_type: EventType,
    pub note_id: String,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    LocalWrite,
    RemoteWrite,
    ConflictDetected,
    ConflictResolved,
    SyncCompleted,
}

impl ReplicationEngine {
    /// Create new replication engine
    pub fn new(config: ClusterConfig) -> Self {
        let local_region = config.local_region.clone();
        
        let mut local_version = VersionVector::new();
        local_version.increment(&local_region);

        Self {
            config,
            notes: Arc::new(Mutex::new(HashMap::new())),
            local_version: Arc::new(Mutex::new(local_version)),
            log: Arc::new(Mutex::new(Vec::new())),
        }
    }

    // -------------------------------------------------------------------------
    // Write Operations
    // -------------------------------------------------------------------------

    /// Write a note locally
    pub fn write(&self, id: String, content: String) -> Result<ReplicatedNote, ReplicationError> {
        let mut notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        let mut version = self.local_version.lock().map_err(|_| ReplicationError::LockError)?;

        // Increment local version
        version.increment(&self.config.local_region);

        let timestamp = current_timestamp();

        let note = ReplicatedNote {
            id: id.clone(),
            content,
            version: version.clone(),
            timestamp,
            last_modified_by: self.config.local_region.clone(),
            deleted: false,
            conflict_metadata: None,
        };

        notes.insert(id.clone(), note.clone());

        // Log event
        self.log_event(EventType::LocalWrite, id, "Local write".to_string())?;

        Ok(note)
    }

    /// Delete a note (tombstone)
    pub fn delete(&self, id: &str) -> Result<Option<ReplicatedNote>, ReplicationError> {
        let mut notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        let mut version = self.local_version.lock().map_err(|_| ReplicationError::LockError)?;

        if let Some(note) = notes.get_mut(id) {
            version.increment(&self.config.local_region);
            note.deleted = true;
            note.version = version.clone();
            note.timestamp = current_timestamp();
            note.last_modified_by = self.config.local_region.clone();

            self.log_event(EventType::LocalWrite, id.to_string(), "Delete (tombstone)".to_string())?;

            Ok(Some(note.clone()))
        } else {
            Ok(None)
        }
    }

    // -------------------------------------------------------------------------
    // Read Operations
    // -------------------------------------------------------------------------

    /// Get a note by ID
    pub fn get(&self, id: &str) -> Result<Option<ReplicatedNote>, ReplicationError> {
        let notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        Ok(notes.get(id).cloned())
    }

    /// Get all notes
    pub fn get_all(&self) -> Result<Vec<ReplicatedNote>, ReplicationError> {
        let notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        Ok(notes.values().cloned().collect())
    }

    /// Get notes modified since timestamp
    pub fn get_since(&self, since: u64) -> Result<Vec<ReplicatedNote>, ReplicationError> {
        let notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        Ok(notes
            .values()
            .filter(|n| n.timestamp >= since)
            .cloned()
            .collect())
    }

    // -------------------------------------------------------------------------
    // Replication Operations
    // -------------------------------------------------------------------------

    /// Apply remote note (from replication)
    pub fn apply_remote(&self, note: ReplicatedNote) -> Result<ReplicatedNote, ReplicationError> {
        let mut notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        let mut local_version = self.local_version.lock().map_err(|_| ReplicationError::LockError)?;

        let result = if let Some(existing) = notes.get(&note.id) {
            // Conflict detection
            match existing.version.compare(&note.version) {
                Ordering::Greater => {
                    // Local is newer, keep local
                    self.log_event(
                        EventType::RemoteWrite,
                        note.id.clone(),
                        "Remote note rejected (local newer)".to_string(),
                    )?;
                    existing.clone()
                }
                Ordering::Less => {
                    // Remote is newer, apply
                    notes.insert(note.id.clone(), note.clone());
                    local_version.merge(&note.version);
                    self.log_event(
                        EventType::RemoteWrite,
                        note.id.clone(),
                        "Remote note applied".to_string(),
                    )?;
                    note
                }
                Ordering::Equal => {
                    // Same version, ignore
                    existing.clone()
                }
                Ordering::Concurrent => {
                    // Conflict! Resolve
                    let resolved = self.resolve_conflict(existing, &note)?;
                    notes.insert(resolved.id.clone(), resolved.clone());
                    local_version.merge(&resolved.version);
                    self.log_event(
                        EventType::ConflictResolved,
                        note.id.clone(),
                        format!("Conflict resolved using {:?}", resolved.conflict_metadata.as_ref().map(|m| &m.resolution)),
                    )?;
                    resolved
                }
            }
        } else {
            // New note, just insert
            notes.insert(note.id.clone(), note.clone());
            local_version.merge(&note.version);
            self.log_event(
                EventType::RemoteWrite,
                note.id.clone(),
                "New remote note inserted".to_string(),
            )?;
            note
        };

        Ok(result)
    }

    /// Generate replication message for push
    pub fn generate_push(&self, target: &RegionId) -> Result<ReplicationMessage, ReplicationError> {
        let notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        
        // Get all non-deleted notes
        let notes_to_push: Vec<_> = notes
            .values()
            .filter(|n| !n.deleted)
            .cloned()
            .collect();

        Ok(ReplicationMessage::Push {
            from: self.config.local_region.clone(),
            notes: notes_to_push,
        })
    }

    /// Generate anti-entropy digests
    pub fn generate_digests(&self) -> Result<Vec<NoteDigest>, ReplicationError> {
        let notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        
        Ok(notes
            .values()
            .map(|n| NoteDigest {
                id: n.id.clone(),
                version_hash: hash_version(&n.version),
                timestamp: n.timestamp,
            })
            .collect())
    }

    /// Handle anti-entropy request
    pub fn handle_anti_entropy(
        &self,
        remote_digests: Vec<NoteDigest>,
    ) -> Result<Vec<ReplicatedNote>, ReplicationError> {
        let notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        
        let remote_ids: std::collections::HashSet<_> = 
            remote_digests.iter().map(|d| d.id.clone()).collect();

        // Find notes we have that remote doesn't
        let missing_for_remote: Vec<_> = notes
            .values()
            .filter(|n| !remote_ids.contains(&n.id))
            .cloned()
            .collect();

        // Find differences
        let mut differences = missing_for_remote;
        
        for digest in remote_digests {
            if let Some(local) = notes.get(&digest.id) {
                let local_hash = hash_version(&local.version);
                if local_hash != digest.version_hash {
                    // Different versions
                    differences.push(local.clone());
                }
            }
        }

        Ok(differences)
    }

    // -------------------------------------------------------------------------
    // Conflict Resolution
    // -------------------------------------------------------------------------

    /// Resolve conflict between two versions
    fn resolve_conflict(
        &self,
        local: &ReplicatedNote,
        remote: &ReplicatedNote,
    ) -> Result<ReplicatedNote, ReplicationError> {
        let policy = &self.config.conflict_policy;

        match policy.default_strategy {
            ConflictResolution::LastWriterWins => {
                // Use timestamp
                let use_remote = remote.timestamp > local.timestamp + policy.timestamp_threshold;
                
                let mut result = if use_remote { remote.clone() } else { local.clone() };
                
                result.conflict_metadata = Some(ConflictMetadata {
                    conflicts: vec![local.clone(), remote.clone()],
                    resolution: ConflictResolution::LastWriterWins,
                    resolved_at: current_timestamp(),
                });

                Ok(result)
            }
            ConflictResolution::VectorClock => {
                // Use region priority
                let local_priority = self.get_region_priority(&local.last_modified_by);
                let remote_priority = self.get_region_priority(&remote.last_modified_by);

                let mut result = if remote_priority > local_priority {
                    remote.clone()
                } else {
                    local.clone()
                };

                result.conflict_metadata = Some(ConflictMetadata {
                    conflicts: vec![local.clone(), remote.clone()],
                    resolution: ConflictResolution::VectorClock,
                    resolved_at: current_timestamp(),
                });

                Ok(result)
            }
            ConflictResolution::Merged => {
                // Merge content (simple concatenation for now)
                let mut result = local.clone();
                result.content = format!("{}\n\n--- Merged ---\n\n{}", local.content, remote.content);
                result.timestamp = current_timestamp();

                result.conflict_metadata = Some(ConflictMetadata {
                    conflicts: vec![local.clone(), remote.clone()],
                    resolution: ConflictResolution::Merged,
                    resolved_at: current_timestamp(),
                });

                Ok(result)
            }
            ConflictResolution::Manual => {
                // Keep both, mark for manual resolution
                let mut result = local.clone();
                result.conflict_metadata = Some(ConflictMetadata {
                    conflicts: vec![local.clone(), remote.clone()],
                    resolution: ConflictResolution::Manual,
                    resolved_at: current_timestamp(),
                });

                Ok(result)
            }
        }
    }

    /// Get priority for a region
    fn get_region_priority(&self, region: &RegionId) -> u32 {
        self.config
            .regions
            .iter()
            .find(|r| &r.id == region)
            .map(|r| r.priority)
            .unwrap_or(0)
    }

    // -------------------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------------------

    fn log_event(&self, event_type: EventType, note_id: String, details: String) -> Result<(), ReplicationError> {
        let mut log = self.log.lock().map_err(|_| ReplicationError::LockError)?;
        
        log.push(ReplicationEvent {
            timestamp: current_timestamp(),
            region: self.config.local_region.clone(),
            event_type,
            note_id,
            details,
        });

        Ok(())
    }

    /// Get replication log
    pub fn get_log(&self) -> Result<Vec<ReplicationEvent>, ReplicationError> {
        let log = self.log.lock().map_err(|_| ReplicationError::LockError)?;
        Ok(log.clone())
    }

    /// Get statistics
    pub fn get_stats(&self) -> Result<ReplicationStats, ReplicationError> {
        let notes = self.notes.lock().map_err(|_| ReplicationError::LockError)?;
        let log = self.log.lock().map_err(|_| ReplicationError::LockError)?;

        let total_notes = notes.len();
        let deleted_notes = notes.values().filter(|n| n.deleted).count();
        let conflicted_notes = notes.values().filter(|n| n.conflict_metadata.is_some()).count();

        Ok(ReplicationStats {
            total_notes,
            active_notes: total_notes - deleted_notes,
            deleted_notes,
            conflicted_notes,
            events_logged: log.len(),
        })
    }
}

/// Replication statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicationStats {
    pub total_notes: usize,
    pub active_notes: usize,
    pub deleted_notes: usize,
    pub conflicted_notes: usize,
    pub events_logged: usize,
}

// ============================================================================
// Errors
// ============================================================================

#[derive(Debug, Error)]
pub enum ReplicationError {
    #[error("Lock acquisition failed")]
    LockError,
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

// ============================================================================
// Utilities
// ============================================================================

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn hash_version(version: &VersionVector) -> String {
    // Simple hash for anti-entropy
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    version.clocks.iter().for_each(|(k, v)| {
        k.hash(&mut hasher);
        v.hash(&mut hasher);
    });
    format!("{:x}", hasher.finish())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_vector() {
        let mut v1 = VersionVector::new();
        v1.increment(&"region1".to_string());
        v1.increment(&"region1".to_string());
        
        let mut v2 = VersionVector::new();
        v2.increment(&"region2".to_string());
        
        assert_eq!(v1.get(&"region1".to_string()), 2);
        assert_eq!(v1.get(&"region2".to_string()), 0);
        
        v1.merge(&v2);
        assert_eq!(v1.get(&"region2".to_string()), 1);
    }

    #[test]
    fn test_version_vector_compare() {
        let mut v1 = VersionVector::new();
        v1.increment(&"r1".to_string());
        
        let mut v2 = VersionVector::new();
        v2.increment(&"r1".to_string());
        v2.increment(&"r1".to_string());
        
        assert_eq!(v1.compare(&v2), Ordering::Less);
        assert_eq!(v2.compare(&v1), Ordering::Greater);
        
        let mut v3 = VersionVector::new();
        v3.increment(&"r2".to_string());
        
        assert_eq!(v1.compare(&v3), Ordering::Concurrent);
    }
}
