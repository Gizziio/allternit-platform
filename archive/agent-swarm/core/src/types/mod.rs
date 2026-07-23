pub mod agent;
pub mod execution;
pub mod knowledge;
pub mod mode;
pub mod policy;
pub mod task;

pub use agent::*;
pub use execution::*;
pub use knowledge::*;
pub use mode::*;
pub use policy::*;
pub use task::*;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Unique identifier for any entity in the meta-swarm system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct EntityId(pub Uuid);

impl EntityId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for EntityId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for EntityId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Timestamped entity base trait
pub trait Timestamped {
    fn created_at(&self) -> DateTime<Utc>;
    fn updated_at(&self) -> DateTime<Utc>;
}

/// Metadata attached to entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub id: EntityId,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: u32,
    pub tags: Vec<String>,
    pub properties: HashMap<String, serde_json::Value>,
}

impl Metadata {
    pub fn new() -> Self {
        let now = Utc::now();
        Self {
            id: EntityId::new(),
            created_at: now,
            updated_at: now,
            version: 1,
            tags: Vec::new(),
            properties: HashMap::new(),
        }
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    pub fn with_property(mut self, key: String, value: serde_json::Value) -> Self {
        self.properties.insert(key, value);
        self
    }

    pub fn bump_version(&mut self) {
        self.version += 1;
        self.updated_at = Utc::now();
    }
}

impl Default for Metadata {
    fn default() -> Self {
        Self::new()
    }
}

impl Timestamped for Metadata {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }
}

/// Progress tracking for long-running operations
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Progress {
    pub total: u32,
    pub completed: u32,
    pub failed: u32,
    pub in_progress: u32,
}

impl Progress {
    pub fn new(total: u32) -> Self {
        Self {
            total,
            completed: 0,
            failed: 0,
            in_progress: 0,
        }
    }

    pub fn percent_complete(&self) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        (self.completed as f64 / self.total as f64) * 100.0
    }

    pub fn is_complete(&self) -> bool {
        self.completed + self.failed >= self.total
    }

    pub fn complete_one(&mut self) {
        if self.in_progress > 0 {
            self.in_progress -= 1;
        }
        self.completed += 1;
    }

    pub fn fail_one(&mut self) {
        if self.in_progress > 0 {
            self.in_progress -= 1;
        }
        self.failed += 1;
    }

    pub fn start_one(&mut self) {
        self.in_progress += 1;
    }
}

/// Cost tracking for budget management
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Cost {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub estimated_usd: f64,
}

impl Cost {
    pub fn new() -> Self {
        Self {
            input_tokens: 0,
            output_tokens: 0,
            estimated_usd: 0.0,
        }
    }

    pub fn add(&mut self, other: &Cost) {
        self.input_tokens += other.input_tokens;
        self.output_tokens += other.output_tokens;
        self.estimated_usd += other.estimated_usd;
    }

    pub fn total_tokens(&self) -> u64 {
        self.input_tokens + self.output_tokens
    }
}

impl Default for Cost {
    fn default() -> Self {
        Self::new()
    }
}

/// Priority levels for triage
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Priority {
    P1, // Critical - blocks shipping
    P2, // Important - should fix
    P3, // Minor - nice to have
}

impl std::fmt::Display for Priority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Priority::P1 => write!(f, "P1"),
            Priority::P2 => write!(f, "P2"),
            Priority::P3 => write!(f, "P3"),
        }
    }
}

/// Status of an operation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

impl Status {
    pub fn is_terminal(&self) -> bool {
        matches!(self, Status::Completed | Status::Failed | Status::Cancelled)
    }

    pub fn is_active(&self) -> bool {
        matches!(self, Status::InProgress)
    }
}

/// Confidence score (0.0 to 1.0)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Confidence(f64);

impl Confidence {
    pub fn new(value: f64) -> Result<Self, String> {
        if value < 0.0 || value > 1.0 {
            Err(format!("Confidence must be between 0.0 and 1.0, got {}", value))
        } else {
            Ok(Self(value))
        }
    }

    pub fn value(&self) -> f64 {
        self.0
    }

    pub fn is_high(&self) -> bool {
        self.0 >= 0.8
    }

    pub fn is_medium(&self) -> bool {
        self.0 >= 0.5 && self.0 < 0.8
    }

    pub fn is_low(&self) -> bool {
        self.0 < 0.5
    }
}

impl Default for Confidence {
    fn default() -> Self {
        Self(0.5)
    }
}
