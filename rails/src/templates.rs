//! Workflow templates for the Rails CLI.
//!
//! Templates are the Rails equivalent of Beads molecules/formulas: reusable
//! plans that can be instantiated into a set of tickets with dependencies.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use chrono::Utc;
use rand::RngCore;
use serde::{Deserialize, Serialize};

use crate::core::io::{ensure_dir, read_json, write_json_atomic};
use crate::dependencies::{DependencyEdge, DependencyGraph, DependencyKind};
use crate::rails_id::{HierarchicalId, TicketId};
use crate::tickets::{Ticket, TicketKind, TicketPriority, TicketStatus, TicketStore};

/// Default directory for templates, relative to workspace root.
pub const TEMPLATE_DIR: &str = ".allternit/rails/templates";

/// A step inside a template.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TemplateStep {
    pub id: String,
    pub title: String,
    pub description: String,
    pub kind: TicketKind,
    pub priority: TicketPriority,
    pub blocked_by: Vec<String>,
}

/// A reusable workflow template.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Template {
    pub id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<TemplateStep>,
    pub created_at: chrono::DateTime<Utc>,
}

/// Result of instantiating a template.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstantiationResult {
    pub template_id: String,
    pub root_id: TicketId,
    pub tickets: Vec<Ticket>,
}

/// Store for workflow templates.
pub struct TemplateStore {
    templates_dir: PathBuf,
}

impl TemplateStore {
    pub fn new(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref();
        let templates_dir = root.join(TEMPLATE_DIR);
        ensure_dir(&templates_dir)?;
        Ok(Self { templates_dir })
    }

    /// Create a new template.
    pub fn create(
        &self,
        name: impl Into<String>,
        description: impl Into<String>,
        steps: Vec<TemplateStep>,
    ) -> Result<Template> {
        let id = generate_template_id();
        let template = Template {
            id: id.clone(),
            name: name.into(),
            description: description.into(),
            steps,
            created_at: Utc::now(),
        };
        self.write(&template)?;
        Ok(template)
    }

    /// Load a template by ID.
    pub fn get(&self, id: &str) -> Result<Option<Template>> {
        read_json(&self.path(id)).with_context(|| format!("failed to read template {id}"))
    }

    /// List all templates.
    pub fn list(&self) -> Result<Vec<Template>> {
        let mut templates = Vec::new();
        for entry in std::fs::read_dir(&self.templates_dir)? {
            let entry = entry?;
            if entry.file_type()?.is_file() {
                if let Some(template) = read_json::<Template>(&entry.path())? {
                    templates.push(template);
                }
            }
        }
        templates.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(templates)
    }

    /// Delete a template.
    pub fn delete(&self, id: &str) -> Result<bool> {
        let path = self.path(id);
        if path.exists() {
            std::fs::remove_file(&path)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Instantiate a template into concrete tickets.
    pub fn instantiate(
        &self,
        id: &str,
        ticket_store: &TicketStore,
        dep_graph: &mut DependencyGraph,
    ) -> Result<InstantiationResult> {
        let template = self
            .get(id)?
            .with_context(|| format!("template {id} not found"))?;

        let root_id = TicketId::mint(template.name.as_bytes());

        // Create a mapping from template step id to generated ticket id.
        let mut step_to_ticket: HashMap<String, TicketId> = HashMap::new();
        let mut tickets = Vec::new();

        for step in &template.steps {
            let ticket_id = TicketId::mint(format!("{}.{}", root_id, step.id).as_bytes());
            step_to_ticket.insert(step.id.clone(), ticket_id.clone());

            let hierarchical_id = HierarchicalId::root(root_id.clone()).child(tickets.len() as u32 + 1);
            let ticket = Ticket {
                id: ticket_id,
                hierarchical_id,
                title: step.title.clone(),
                description: step.description.clone(),
                design: None,
                acceptance: None,
                notes: Vec::new(),
                status: TicketStatus::Open,
                kind: step.kind,
                priority: step.priority,
                assignee: None,
                estimate_minutes: None,
                due_at: None,
                defer_until: None,
                labels: vec![format!("template:{}", template.id)],
                external_ref: None,
                metadata: {
                    let mut m = HashMap::new();
                    m.insert("template_id".to_string(), serde_json::json!(template.id));
                    m.insert("template_step_id".to_string(), serde_json::json!(step.id));
                    m
                },
                created_at: Utc::now(),
                updated_at: Utc::now(),
                closed_at: None,
                close_reason: None,
            };
            tickets.push(ticket_store.create(ticket)?);
        }

        // Add dependencies between instantiated tickets.
        for step in &template.steps {
            let to_id = step_to_ticket
                .get(&step.id)
                .cloned()
                .context("missing ticket for step")?;
            for blocker_step_id in &step.blocked_by {
                let from_id = step_to_ticket
                    .get(blocker_step_id)
                    .cloned()
                    .with_context(|| format!("template step {blocker_step_id} not found"))?;
                let edge = DependencyEdge::new(from_id, to_id.clone(), DependencyKind::Blocks);
                if dep_graph.would_cycle(&edge) {
                    anyhow::bail!("template instantiation would create a cycle");
                }
                dep_graph.add(edge);
            }
        }

        Ok(InstantiationResult {
            template_id: template.id,
            root_id,
            tickets,
        })
    }

    fn path(&self, id: &str) -> PathBuf {
        self.templates_dir.join(format!("{}.json", id))
    }

    fn write(&self, template: &Template) -> Result<()> {
        let path = self.path(&template.id);
        write_json_atomic(&path, template)
            .with_context(|| format!("failed to write template {path:?}"))
    }
}

fn generate_template_id() -> String {
    let mut nonce = [0u8; 4];
    rand::thread_rng().fill_bytes(&mut nonce);
    format!("tmpl-{}-{}", Utc::now().timestamp_millis(), hex::encode(nonce))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn create_and_instantiate() {
        let tmp = TempDir::new().unwrap();
        let template_store = TemplateStore::new(tmp.path()).unwrap();
        let ticket_store = TicketStore::new(tmp.path()).unwrap();

        let template = template_store
            .create(
                "OAuth flow",
                "Add OAuth authentication",
                vec![
                    TemplateStep {
                        id: "setup".to_string(),
                        title: "Set up OAuth provider".to_string(),
                        description: "...".to_string(),
                        kind: TicketKind::Task,
                        priority: TicketPriority::P1,
                        blocked_by: vec![],
                    },
                    TemplateStep {
                        id: "ui".to_string(),
                        title: "Build login UI".to_string(),
                        description: "...".to_string(),
                        kind: TicketKind::Task,
                        priority: TicketPriority::P2,
                        blocked_by: vec!["setup".to_string()],
                    },
                ],
            )
            .unwrap();

        let mut graph = DependencyGraph::new();
        let result = template_store
            .instantiate(&template.id, &ticket_store, &mut graph)
            .unwrap();

        assert_eq!(result.tickets.len(), 2);
        assert!(graph.has_cycle() == false);
        assert_eq!(graph.edges().count(), 1);
    }
}
