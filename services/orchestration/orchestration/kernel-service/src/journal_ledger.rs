use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct JournalLedger {
    events: Arc<RwLock<Vec<crate::types::JournalEvent>>>,
    artifacts: Arc<RwLock<HashMap<String, crate::types::Artifact>>>,
}

impl JournalLedger {
    pub fn new() -> Self {
        Self {
            events: Arc::new(RwLock::new(Vec::new())),
            artifacts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_event(&self, event: crate::types::JournalEvent) {
        let mut events = self.events.write().await;
        events.push(event);
    }

    pub async fn add_events(&self, new_events: Vec<crate::types::JournalEvent>) {
        let mut events = self.events.write().await;
        events.extend(new_events);
    }

    pub async fn get_events(&self, capsule_id: Option<&str>) -> Vec<crate::types::JournalEvent> {
        let events = self.events.read().await;
        match capsule_id {
            Some(id) => events
                .iter()
                .filter(|e| e.capsule_id.as_deref() == Some(id))
                .cloned()
                .collect(),
            None => events.clone(),
        }
    }

    pub async fn add_artifact(&self, artifact: crate::types::Artifact) {
        let mut artifacts = self.artifacts.write().await;
        artifacts.insert(artifact.artifact_id.clone(), artifact);
    }

    pub async fn add_artifacts(&self, new_artifacts: Vec<crate::types::Artifact>) {
        let mut artifacts = self.artifacts.write().await;
        for artifact in new_artifacts {
            artifacts.insert(artifact.artifact_id.clone(), artifact);
        }
    }

    pub async fn get_artifact(&self, artifact_id: &str) -> Option<crate::types::Artifact> {
        let artifacts = self.artifacts.read().await;
        artifacts.get(artifact_id).cloned()
    }

    pub async fn get_artifacts(&self, capsule_id: Option<&str>) -> Vec<crate::types::Artifact> {
        let artifacts = self.artifacts.read().await;
        match capsule_id {
            Some(id) => artifacts
                .values()
                .filter(|a| a.capsule_id == id)
                .cloned()
                .collect(),
            None => artifacts.values().cloned().collect(),
        }
    }

    pub async fn filter_events(
        &self,
        capsule_id: Option<&str>,
        kind: Option<&str>,
        after: Option<i64>,
    ) -> Vec<crate::types::JournalEvent> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| {
                let matches_capsule =
                    capsule_id.map_or(true, |id| e.capsule_id.as_deref() == Some(id));
                let matches_kind = kind.map_or(true, |k| e.kind == k);
                let matches_after = after.map_or(true, |ts| e.timestamp > ts);
                matches_capsule && matches_kind && matches_after
            })
            .cloned()
            .collect()
    }
}
