// Agent template loader module
// This module handles loading agent templates from various sources

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTemplateSource {
    pub source_type: SourceType,
    pub identifier: String, // Could be file path, URL, database ID, etc.
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SourceType {
    File,
    Database,
    Registry,
    Remote,
}

pub struct AgentTemplateLoader {
    sources: Arc<RwLock<HashMap<String, AgentTemplateSource>>>,
}

impl Default for AgentTemplateLoader {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentTemplateLoader {
    pub fn new() -> Self {
        AgentTemplateLoader {
            sources: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn load_from_file(
        &self,
        file_path: &str,
    ) -> Result<crate::templates::AgentTemplate, crate::WorkflowError> {
        // Read the file
        let content = tokio::fs::read_to_string(file_path)
            .await
            .map_err(crate::WorkflowError::Io)?;

        // Parse the content as JSON
        let template: crate::templates::AgentTemplate =
            serde_json::from_str(&content).map_err(crate::WorkflowError::Json)?;

        // Store the source information
        let mut sources = self.sources.write().await;
        sources.insert(
            template.template_id.clone(),
            AgentTemplateSource {
                source_type: SourceType::File,
                identifier: file_path.to_string(),
                metadata: HashMap::new(),
            },
        );

        Ok(template)
    }

    pub async fn load_from_json(
        &self,
        json_str: &str,
    ) -> Result<crate::templates::AgentTemplate, crate::WorkflowError> {
        let template: crate::templates::AgentTemplate =
            serde_json::from_str(json_str).map_err(crate::WorkflowError::Json)?;

        // Store the source information
        let mut sources = self.sources.write().await;
        sources.insert(
            template.template_id.clone(),
            AgentTemplateSource {
                source_type: SourceType::Remote, // Consider this as remote since it's passed as string
                identifier: format!("json_{}", template.template_id),
                metadata: HashMap::new(),
            },
        );

        Ok(template)
    }

    pub async fn get_source_info(&self, template_id: &str) -> Option<AgentTemplateSource> {
        let sources = self.sources.read().await;
        sources.get(template_id).cloned()
    }
}
