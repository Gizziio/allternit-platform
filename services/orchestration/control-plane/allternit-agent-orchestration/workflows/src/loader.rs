// Loader module for workflow definitions
// This module handles loading workflow definitions from various sources (files, databases, etc.)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowSource {
    pub source_type: SourceType,
    pub identifier: String, // Could be file path, URL, database ID, etc.
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SourceType {
    File,
    Database,
    Remote,
    Template,
}

pub struct WorkflowLoader {
    sources: Arc<RwLock<HashMap<String, WorkflowSource>>>,
}

impl Default for WorkflowLoader {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkflowLoader {
    pub fn new() -> Self {
        WorkflowLoader {
            sources: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn load_from_file(
        &self,
        file_path: &str,
    ) -> Result<crate::WorkflowDefinition, crate::WorkflowError> {
        // Read the file
        let content = tokio::fs::read_to_string(file_path)
            .await
            .map_err(crate::WorkflowError::Io)?;

        // Parse the content as JSON
        let workflow: crate::WorkflowDefinition =
            serde_json::from_str(&content).map_err(crate::WorkflowError::Json)?;

        // Store the source information
        let mut sources = self.sources.write().await;
        sources.insert(
            workflow.workflow_id.clone(),
            WorkflowSource {
                source_type: SourceType::File,
                identifier: file_path.to_string(),
                metadata: HashMap::new(),
            },
        );

        Ok(workflow)
    }

    pub async fn load_from_json(
        &self,
        json_str: &str,
    ) -> Result<crate::WorkflowDefinition, crate::WorkflowError> {
        let workflow: crate::WorkflowDefinition =
            serde_json::from_str(json_str).map_err(crate::WorkflowError::Json)?;

        // Store the source information
        let mut sources = self.sources.write().await;
        sources.insert(
            workflow.workflow_id.clone(),
            WorkflowSource {
                source_type: SourceType::Remote, // Consider this as remote since it's passed as string
                identifier: format!("json_{}", workflow.workflow_id),
                metadata: HashMap::new(),
            },
        );

        Ok(workflow)
    }

    pub async fn get_source_info(&self, workflow_id: &str) -> Option<WorkflowSource> {
        let sources = self.sources.read().await;
        sources.get(workflow_id).cloned()
    }

    /// Load a workflow definition from a YAML string
    pub async fn load_from_yaml(
        &self,
        yaml_str: &str,
    ) -> Result<crate::WorkflowDefinition, crate::WorkflowError> {
        // Parse YAML to serde_yaml::Value first for validation
        let yaml_value: serde_yaml::Value = serde_yaml::from_str(yaml_str).map_err(|e| {
            crate::WorkflowError::ExecutionFailed(format!("YAML parse error: {}", e))
        })?;

        // Convert YAML to JSON for deserialization
        let json_value = serde_json::to_value(&yaml_value).map_err(crate::WorkflowError::Json)?;

        // Deserialize to WorkflowDefinition
        let workflow: crate::WorkflowDefinition =
            serde_json::from_value(json_value).map_err(crate::WorkflowError::Json)?;

        // Store the source information
        let mut sources = self.sources.write().await;
        sources.insert(
            workflow.workflow_id.clone(),
            WorkflowSource {
                source_type: SourceType::Remote,
                identifier: format!("yaml_{}", workflow.workflow_id),
                metadata: HashMap::new(),
            },
        );

        Ok(workflow)
    }

    /// Load a workflow definition from a YAML file
    pub async fn load_from_yaml_file(
        &self,
        file_path: &str,
    ) -> Result<crate::WorkflowDefinition, crate::WorkflowError> {
        // Read the file
        let content = tokio::fs::read_to_string(file_path)
            .await
            .map_err(crate::WorkflowError::Io)?;

        self.load_from_yaml(&content).await
    }
}
