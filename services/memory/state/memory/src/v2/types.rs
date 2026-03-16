use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MemoryStatus {
    Active,
    Superseded,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MemoryAuthority {
    User,
    Agent,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryTimeline {
    pub status: MemoryStatus,
    pub valid_from: u64,
    pub valid_to: Option<u64>,
    pub confidence: f64,
    pub authority: MemoryAuthority,
    pub supersedes_memory_id: Option<String>,
}

impl MemoryTimeline {
    pub fn new_active(now: u64, authority: MemoryAuthority, confidence: f64) -> Self {
        Self {
            status: MemoryStatus::Active,
            valid_from: now,
            valid_to: None,
            confidence,
            authority,
            supersedes_memory_id: None,
        }
    }
}
