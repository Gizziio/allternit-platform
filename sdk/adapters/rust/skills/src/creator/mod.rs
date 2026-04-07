//! Skill Creator - Primitive for creating effective skills
//!
//! This module provides the foundational capability for skill creation in the A2R system.
//! It implements a 6-step process for creating skills:
//! 1. Understand - Gather concrete examples of skill usage
//! 2. Plan - Identify reusable resources (scripts, references, assets)
//! 3. Initialize - Create skill directory structure
//! 4. Edit - Implement skill resources and write SKILL.md
//! 5. Package - Validate and package skill into distributable format
//! 6. Iterate - Improve based on real usage

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;

pub mod packager;
pub mod templates;
pub mod validator;

pub use packager::{PackageInfo, SkillPackager};
pub use templates::{SkillCategory, SkillTemplate, SkillTemplateRegistry};
pub use validator::SkillValidator;

/// Errors that can occur during skill creation
#[derive(Debug, Error)]
pub enum CreatorError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Package error: {0}")]
    Package(String),
}

/// Configuration for skill creation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillCreationConfig {
    /// Default author for new skills
    pub default_author: String,
    /// Default license for new skills
    pub default_license: String,
    /// Skills directory path
    pub skills_dir: PathBuf,
    /// Whether to auto-validate on create
    pub auto_validate: bool,
    /// Whether to auto-package on create
    pub auto_package: bool,
}

impl Default for SkillCreationConfig {
    fn default() -> Self {
        Self {
            default_author: "A2R Developer".to_string(),
            default_license: "MIT".to_string(),
            skills_dir: PathBuf::from("./skills"),
            auto_validate: true,
            auto_package: false,
        }
    }
}

/// Represents a skill creation session
#[derive(Debug, Clone)]
pub struct SkillCreationSession {
    /// Session ID
    pub id: String,
    /// Skill being created
    pub skill_name: String,
    /// Current step in the creation process
    pub current_step: CreationStep,
    /// Gathered examples
    pub examples: Vec<SkillExample>,
    /// Planned resources
    pub planned_resources: PlannedResources,
    /// Skill path (once initialized)
    pub skill_path: Option<PathBuf>,
    /// Created at timestamp
    pub created_at: u64,
}

/// Steps in the skill creation process
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CreationStep {
    Understanding,
    Planning,
    Initializing,
    Editing,
    Packaging,
    Completed,
}

/// An example of how a skill would be used
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillExample {
    /// User query that would trigger this skill
    pub user_query: String,
    /// Expected behavior/output
    pub expected_behavior: String,
    /// Category of this example
    pub category: ExampleCategory,
}

/// Categories for skill examples
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExampleCategory {
    Primary,
    Secondary,
    EdgeCase,
}

/// Planned resources for a skill
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlannedResources {
    /// Scripts to include
    pub scripts: Vec<ScriptResource>,
    /// References to include
    pub references: Vec<ReferenceResource>,
    /// Assets to include
    pub assets: Vec<AssetResource>,
}

/// A script resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptResource {
    pub name: String,
    pub language: ScriptLanguage,
    pub purpose: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ScriptLanguage {
    Python,
    Bash,
    Rust,
    JavaScript,
    TypeScript,
}

/// A reference resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceResource {
    pub name: String,
    pub content_type: ContentType,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ContentType {
    Documentation,
    Schema,
    Policy,
    ApiSpec,
}

/// An asset resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetResource {
    pub name: String,
    pub asset_type: AssetType,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AssetType {
    Template,
    Icon,
    Font,
    Image,
    Boilerplate,
}

/// The main SkillCreator primitive
pub struct SkillCreator {
    config: SkillCreationConfig,
    template_registry: SkillTemplateRegistry,
    validator: SkillValidator,
    packager: SkillPackager,
    sessions: HashMap<String, SkillCreationSession>,
}

impl SkillCreator {
    /// Create a new SkillCreator with the given configuration
    pub fn new(config: SkillCreationConfig) -> Self {
        let template_registry = SkillTemplateRegistry::default();
        let validator = SkillValidator::new();
        let packager = SkillPackager::new();

        Self {
            config,
            template_registry,
            validator,
            packager,
            sessions: HashMap::new(),
        }
    }

    /// Start a new skill creation session (Step 1: Understanding)
    pub fn start_session(&mut self, skill_name: &str) -> String {
        let session_id = uuid::Uuid::new_v4().to_string();
        let session = SkillCreationSession {
            id: session_id.clone(),
            skill_name: skill_name.to_string(),
            current_step: CreationStep::Understanding,
            examples: Vec::new(),
            planned_resources: PlannedResources::default(),
            skill_path: None,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };
        self.sessions.insert(session_id.clone(), session);
        session_id
    }

    /// Add an example to the current session
    pub fn add_example(
        &mut self,
        session_id: &str,
        user_query: &str,
        expected_behavior: &str,
        category: ExampleCategory,
    ) -> Result<(), CreatorError> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        session.examples.push(SkillExample {
            user_query: user_query.to_string(),
            expected_behavior: expected_behavior.to_string(),
            category,
        });

        Ok(())
    }

    /// Move to planning phase (Step 2: Planning)
    pub fn start_planning(&mut self, session_id: &str) -> Result<PlannedResources, CreatorError> {
        let examples = {
            let session = self
                .sessions
                .get(session_id)
                .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;
            session.examples.clone()
        };

        // Analyze examples and suggest resources
        let planned = self.analyze_examples(&examples);

        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        session.current_step = CreationStep::Planning;
        session.planned_resources = planned.clone();

        Ok(planned)
    }

    /// Add a planned resource
    pub fn add_planned_resource(
        &mut self,
        session_id: &str,
        resource: ResourcePlan,
    ) -> Result<(), CreatorError> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        match resource {
            ResourcePlan::Script(script) => session.planned_resources.scripts.push(script),
            ResourcePlan::Reference(reference) => {
                session.planned_resources.references.push(reference)
            }
            ResourcePlan::Asset(asset) => session.planned_resources.assets.push(asset),
        }

        Ok(())
    }

    /// Initialize the skill directory structure (Step 3: Initializing)
    pub fn initialize_skill(
        &mut self,
        session_id: &str,
        template: Option<SkillTemplate>,
    ) -> Result<PathBuf, CreatorError> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        let skill_dir = self.config.skills_dir.join(&session.skill_name);
        std::fs::create_dir_all(&skill_dir).map_err(CreatorError::Io)?;

        // Create directory structure
        std::fs::create_dir_all(skill_dir.join("scripts")).map_err(CreatorError::Io)?;
        std::fs::create_dir_all(skill_dir.join("references")).map_err(CreatorError::Io)?;
        std::fs::create_dir_all(skill_dir.join("assets")).map_err(CreatorError::Io)?;

        // Generate initial SKILL.md based on template
        let template = template.unwrap_or_default();
        let skill_md =
            templates::generate_skill_md(&session.skill_name, &session.examples, &template);
        std::fs::write(skill_dir.join("SKILL.md"), skill_md).map_err(CreatorError::Io)?;

        session.skill_path = Some(skill_dir.clone());
        session.current_step = CreationStep::Initializing;

        Ok(skill_dir)
    }

    /// Mark editing as complete (Step 4: Editing)
    pub fn complete_editing(&mut self, session_id: &str) -> Result<(), CreatorError> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        if session.skill_path.is_none() {
            return Err(CreatorError::Validation(
                "Skill must be initialized before completing editing".to_string(),
            ));
        }

        session.current_step = CreationStep::Editing;
        Ok(())
    }

    /// Package the skill (Step 5: Packaging)
    pub fn package_skill(
        &self,
        session_id: &str,
        output_path: Option<PathBuf>,
    ) -> Result<PathBuf, CreatorError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        let skill_path = session.skill_path.as_ref().ok_or_else(|| {
            CreatorError::Validation("Skill must be initialized before packaging".to_string())
        })?;

        // Validate before packaging
        if self.config.auto_validate {
            self.validator.validate_skill_directory(skill_path)?;
        }

        let output = output_path.unwrap_or_else(|| {
            self.config
                .skills_dir
                .join(format!("{}.skill", session.skill_name))
        });

        self.packager.package_skill(skill_path, &output)?;

        Ok(output)
    }

    /// Get the current state of a session
    pub fn get_session(&self, session_id: &str) -> Option<&SkillCreationSession> {
        self.sessions.get(session_id)
    }

    /// Complete the session and remove it
    pub fn complete_session(
        &mut self,
        session_id: &str,
    ) -> Result<SkillCreationSession, CreatorError> {
        let mut session = self
            .sessions
            .remove(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        session.current_step = CreationStep::Completed;
        Ok(session)
    }

    /// Analyze examples to suggest resources
    fn analyze_examples(&self, examples: &[SkillExample]) -> PlannedResources {
        let mut resources = PlannedResources::default();

        // Simple heuristic-based analysis
        for example in examples {
            let query_lower = example.user_query.to_lowercase();

            // Suggest scripts based on keywords
            if query_lower.contains("pdf") || query_lower.contains("document") {
                resources.scripts.push(ScriptResource {
                    name: "process_document.py".to_string(),
                    language: ScriptLanguage::Python,
                    purpose: "Document processing utilities".to_string(),
                });
            }

            if query_lower.contains("image") || query_lower.contains("photo") {
                resources.scripts.push(ScriptResource {
                    name: "process_image.py".to_string(),
                    language: ScriptLanguage::Python,
                    purpose: "Image processing utilities".to_string(),
                });
            }

            // Suggest references for domain-specific skills
            if query_lower.contains("api") || query_lower.contains("http") {
                resources.references.push(ReferenceResource {
                    name: "api_reference.md".to_string(),
                    content_type: ContentType::ApiSpec,
                    description: "API specifications and endpoints".to_string(),
                });
            }

            // Suggest assets for output-generating skills
            if query_lower.contains("generate") || query_lower.contains("create") {
                resources.assets.push(AssetResource {
                    name: "template".to_string(),
                    asset_type: AssetType::Template,
                    description: "Output template".to_string(),
                });
            }
        }

        resources
    }

    /// Create a skill from a template (one-shot creation)
    pub fn create_from_template(
        &self,
        name: &str,
        template: SkillTemplate,
    ) -> Result<PathBuf, CreatorError> {
        let skill_dir = self.config.skills_dir.join(name);

        // Don't overwrite existing skills
        if skill_dir.exists() {
            return Err(CreatorError::Validation(format!(
                "Skill directory already exists: {}",
                skill_dir.display()
            )));
        }

        self.template_registry
            .instantiate_template(&template, &skill_dir, name)?;

        if self.config.auto_validate {
            self.validator.validate_skill_directory(&skill_dir)?;
        }

        Ok(skill_dir)
    }

    /// Generate a skill manifest JSON from a creation session
    pub fn generate_manifest(
        &self,
        session_id: &str,
        description: &str,
    ) -> Result<serde_json::Value, CreatorError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        let has_scripts = !session.planned_resources.scripts.is_empty();
        let has_references = !session.planned_resources.references.is_empty();

        // Determine risk tier based on resources
        let risk_tier = if has_scripts {
            "Medium"
        } else if has_references {
            "Low"
        } else {
            "Minimal"
        };

        Ok(serde_json::json!({
            "id": format!("a2r.skill.{}", session.skill_name.replace("-", ".")),
            "name": session.skill_name,
            "version": "0.1.0",
            "description": description,
            "author": self.config.default_author,
            "license": self.config.default_license,
            "tags": ["skill"],
            "inputs": {
                "schema": serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" }
                    }
                }),
                "examples": null
            },
            "outputs": {
                "schema": serde_json::json!({
                    "type": "object",
                    "properties": {
                        "result": { "type": "string" }
                    }
                }),
                "examples": null
            },
            "runtime": {
                "mode": "Sandbox",
                "timeouts": {
                    "per_step": 30,
                    "total": 300
                },
                "resources": null
            },
            "environment": {
                "allowed_envs": ["Dev", "Stage"],
                "network": { "DomainAllowlist": [] },
                "filesystem": { "Allowlist": ["./"] }
            },
            "side_effects": [],
            "risk_tier": risk_tier,
            "required_permissions": [],
            "requires_policy_gate": false,
            "publisher": {
                "publisher_id": self.config.default_author,
                "public_key_id": "default"
            },
            "signature": {
                "manifest_sig": "",
                "bundle_hash": ""
            }
        }))
    }

    /// Save the generated manifest to the skill directory
    pub fn save_manifest(
        &self,
        session_id: &str,
        description: &str,
    ) -> Result<PathBuf, CreatorError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| CreatorError::Validation(format!("Session {} not found", session_id)))?;

        let skill_path = session.skill_path.as_ref().ok_or_else(|| {
            CreatorError::Validation("Skill must be initialized before saving manifest".to_string())
        })?;

        let manifest = self.generate_manifest(session_id, description)?;
        let manifest_path = skill_path.join("manifest.json");

        let manifest_json = serde_json::to_string_pretty(&manifest)?;
        std::fs::write(&manifest_path, manifest_json).map_err(CreatorError::Io)?;

        Ok(manifest_path)
    }
}

/// Resource plan for adding to a skill
#[derive(Debug, Clone)]
pub enum ResourcePlan {
    Script(ScriptResource),
    Reference(ReferenceResource),
    Asset(AssetResource),
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_skill_creator_session() {
        let temp_dir = TempDir::new().unwrap();
        let config = SkillCreationConfig {
            skills_dir: temp_dir.path().to_path_buf(),
            ..Default::default()
        };

        let mut creator = SkillCreator::new(config);
        let session_id = creator.start_session("test-skill");

        // Add examples
        creator
            .add_example(
                &session_id,
                "How do I process a PDF?",
                "Extract text from the PDF and return it",
                ExampleCategory::Primary,
            )
            .unwrap();

        // Start planning
        let planned = creator.start_planning(&session_id).unwrap();
        assert!(!planned.scripts.is_empty()); // Should suggest PDF processing script

        // Initialize skill
        let skill_path = creator.initialize_skill(&session_id, None).unwrap();
        assert!(skill_path.exists());
        assert!(skill_path.join("SKILL.md").exists());
    }

    #[test]
    fn test_create_from_template() {
        let temp_dir = TempDir::new().unwrap();
        let config = SkillCreationConfig {
            skills_dir: temp_dir.path().to_path_buf(),
            ..Default::default()
        };

        let creator = SkillCreator::new(config);
        let template = SkillTemplate::tool_integration();

        let skill_path = creator.create_from_template("api-skill", template).unwrap();

        assert!(skill_path.exists());
        assert!(skill_path.join("SKILL.md").exists());
        assert!(skill_path.join("scripts").join("api_client.py").exists());
    }

    #[test]
    fn test_generate_and_save_manifest() {
        let temp_dir = TempDir::new().unwrap();
        let config = SkillCreationConfig {
            skills_dir: temp_dir.path().to_path_buf(),
            ..Default::default()
        };

        let mut creator = SkillCreator::new(config);
        let session_id = creator.start_session("test-skill");

        // Initialize skill
        creator.initialize_skill(&session_id, None).unwrap();

        // Save manifest
        let manifest_path = creator.save_manifest(&session_id, "A test skill").unwrap();
        assert!(manifest_path.exists());

        // Verify content
        let content = std::fs::read_to_string(&manifest_path).unwrap();
        assert!(content.contains("test-skill"));
        assert!(content.contains("A test skill"));
    }
}
