//! In-process team skills registry.
//!
//! Tracks skills available in each workspace. The gizzi `registerWorkspaceSkills`
//! loader fetches from the Next.js platform API (which uses Prisma/SQLite), but
//! the Rust registry here is the authoritative runtime registry used when agents
//! need to discover available skills without a DB round-trip.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRecord {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
    /// JSON-encoded manifest (prompt template, allowed tools, etc.)
    pub manifest: Option<String>,
    pub source_repo: Option<String>,
    pub version: String,
    pub installed_by: String,
    pub installed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterSkillRequest {
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
    pub manifest: Option<String>,
    pub source_repo: Option<String>,
    pub version: Option<String>,
    pub installed_by: String,
}

pub struct SkillRegistry {
    // Key: skill id → SkillRecord
    skills: RwLock<HashMap<String, SkillRecord>>,
}

impl SkillRegistry {
    pub fn new() -> Self {
        Self {
            skills: RwLock::new(HashMap::new()),
        }
    }

    pub fn register(&self, req: RegisterSkillRequest) -> SkillRecord {
        let skill = SkillRecord {
            id: Uuid::new_v4().to_string(),
            workspace_id: req.workspace_id,
            name: req.name,
            description: req.description,
            manifest: req.manifest,
            source_repo: req.source_repo,
            version: req.version.unwrap_or_else(|| "0.0.1".to_string()),
            installed_by: req.installed_by,
            installed_at: Utc::now(),
        };
        self.skills.write().unwrap().insert(skill.id.clone(), skill.clone());
        skill
    }

    pub fn get(&self, id: &str) -> Option<SkillRecord> {
        self.skills.read().unwrap().get(id).cloned()
    }

    pub fn list_by_workspace(&self, workspace_id: &str) -> Vec<SkillRecord> {
        self.skills
            .read()
            .unwrap()
            .values()
            .filter(|s| s.workspace_id == workspace_id)
            .cloned()
            .collect()
    }

    pub fn delete(&self, id: &str) -> bool {
        self.skills.write().unwrap().remove(id).is_some()
    }

    pub fn count(&self) -> usize {
        self.skills.read().unwrap().len()
    }
}

impl Default for SkillRegistry {
    fn default() -> Self {
        Self::new()
    }
}
