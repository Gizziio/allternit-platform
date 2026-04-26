//! Skill Templates - Pre-defined skill scaffolding
//!
//! Provides templates for common skill types to accelerate skill creation.
//! Templates include pre-configured structures, examples, and resource suggestions.

use super::CreatorError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// A skill template for quick scaffolding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillTemplate {
    /// Template name
    pub name: String,
    /// Template description
    pub description: String,
    /// Category of skill this template creates
    pub category: SkillCategory,
    /// Default manifest template
    pub manifest_template: String,
    /// Default SKILL.md template
    pub skill_md_template: String,
    /// Pre-defined scripts to include
    pub default_scripts: Vec<ScriptTemplate>,
    /// Pre-defined references to include
    pub default_references: Vec<ReferenceTemplate>,
    /// Pre-defined assets to include
    pub default_assets: Vec<AssetTemplate>,
}

impl Default for SkillTemplate {
    fn default() -> Self {
        Self::minimal()
    }
}

/// Category of skill
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SkillCategory {
    /// Tool integration skill
    ToolIntegration,
    /// Domain expertise skill
    DomainExpertise,
    /// Workflow automation skill
    WorkflowAutomation,
    /// Data processing skill
    DataProcessing,
    /// UI/UX skill
    UserInterface,
    /// General purpose
    General,
}

/// A script template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptTemplate {
    pub filename: String,
    pub content: String,
    pub language: String,
}

/// A reference template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceTemplate {
    pub filename: String,
    pub content: String,
}

/// An asset template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetTemplate {
    pub filename: String,
    pub content: Vec<u8>,
}

impl SkillTemplate {
    /// Create a minimal skill template
    pub fn minimal() -> Self {
        Self {
            name: "minimal".to_string(),
            description: "A minimal skill with just SKILL.md".to_string(),
            category: SkillCategory::General,
            manifest_template: MINIMAL_MANIFEST_TEMPLATE.to_string(),
            skill_md_template: MINIMAL_SKILL_MD_TEMPLATE.to_string(),
            default_scripts: vec![],
            default_references: vec![],
            default_assets: vec![],
        }
    }

    /// Create a tool integration skill template
    pub fn tool_integration() -> Self {
        Self {
            name: "tool-integration".to_string(),
            description: "Skill for integrating with external tools/services".to_string(),
            category: SkillCategory::ToolIntegration,
            manifest_template: TOOL_INTEGRATION_MANIFEST_TEMPLATE.to_string(),
            skill_md_template: TOOL_INTEGRATION_SKILL_MD_TEMPLATE.to_string(),
            default_scripts: vec![ScriptTemplate {
                filename: "api_client.py".to_string(),
                content: API_CLIENT_SCRIPT.to_string(),
                language: "python".to_string(),
            }],
            default_references: vec![ReferenceTemplate {
                filename: "api_reference.md".to_string(),
                content: API_REFERENCE_TEMPLATE.to_string(),
            }],
            default_assets: vec![],
        }
    }

    /// Create a data processing skill template
    pub fn data_processing() -> Self {
        Self {
            name: "data-processing".to_string(),
            description: "Skill for processing and transforming data".to_string(),
            category: SkillCategory::DataProcessing,
            manifest_template: DATA_PROCESSING_MANIFEST_TEMPLATE.to_string(),
            skill_md_template: DATA_PROCESSING_SKILL_MD_TEMPLATE.to_string(),
            default_scripts: vec![ScriptTemplate {
                filename: "transform.py".to_string(),
                content: DATA_TRANSFORM_SCRIPT.to_string(),
                language: "python".to_string(),
            }],
            default_references: vec![ReferenceTemplate {
                filename: "data_schema.md".to_string(),
                content: DATA_SCHEMA_TEMPLATE.to_string(),
            }],
            default_assets: vec![],
        }
    }

    /// Create a workflow automation skill template
    pub fn workflow_automation() -> Self {
        Self {
            name: "workflow-automation".to_string(),
            description: "Skill for automating multi-step workflows".to_string(),
            category: SkillCategory::WorkflowAutomation,
            manifest_template: WORKFLOW_MANIFEST_TEMPLATE.to_string(),
            skill_md_template: WORKFLOW_SKILL_MD_TEMPLATE.to_string(),
            default_scripts: vec![ScriptTemplate {
                filename: "pipeline.py".to_string(),
                content: PIPELINE_SCRIPT.to_string(),
                language: "python".to_string(),
            }],
            default_references: vec![ReferenceTemplate {
                filename: "workflow_patterns.md".to_string(),
                content: WORKFLOW_PATTERNS_TEMPLATE.to_string(),
            }],
            default_assets: vec![],
        }
    }
}

/// Registry of available templates
pub struct SkillTemplateRegistry {
    templates: HashMap<String, SkillTemplate>,
}

impl Default for SkillTemplateRegistry {
    fn default() -> Self {
        let mut registry = Self {
            templates: HashMap::new(),
        };

        // Register built-in templates
        registry.register(SkillTemplate::minimal());
        registry.register(SkillTemplate::tool_integration());
        registry.register(SkillTemplate::data_processing());
        registry.register(SkillTemplate::workflow_automation());

        registry
    }
}

impl SkillTemplateRegistry {
    /// Register a new template
    pub fn register(&mut self, template: SkillTemplate) {
        self.templates.insert(template.name.clone(), template);
    }

    /// Get a template by name
    pub fn get(&self, name: &str) -> Option<&SkillTemplate> {
        self.templates.get(name)
    }

    /// List all available templates
    pub fn list(&self) -> Vec<&SkillTemplate> {
        self.templates.values().collect()
    }

    /// Instantiate a template at the given path
    pub fn instantiate_template(
        &self,
        template: &SkillTemplate,
        skill_dir: &Path,
        skill_name: &str,
    ) -> Result<(), CreatorError> {
        use std::fs;

        // Create directory structure
        fs::create_dir_all(skill_dir).map_err(CreatorError::Io)?;
        fs::create_dir_all(skill_dir.join("scripts")).map_err(CreatorError::Io)?;
        fs::create_dir_all(skill_dir.join("references")).map_err(CreatorError::Io)?;
        fs::create_dir_all(skill_dir.join("assets")).map_err(CreatorError::Io)?;

        // Write SKILL.md
        let skill_md = template
            .skill_md_template
            .replace("{{SKILL_NAME}}", skill_name)
            .replace("{{DESCRIPTION}}", &template.description);
        fs::write(skill_dir.join("SKILL.md"), skill_md).map_err(CreatorError::Io)?;

        // Write default scripts
        for script in &template.default_scripts {
            let script_path = skill_dir.join("scripts").join(&script.filename);
            fs::write(&script_path, &script.content).map_err(CreatorError::Io)?;
        }

        // Write default references
        for reference in &template.default_references {
            let ref_path = skill_dir.join("references").join(&reference.filename);
            fs::write(&ref_path, &reference.content).map_err(CreatorError::Io)?;
        }

        // Write default assets
        for asset in &template.default_assets {
            let asset_path = skill_dir.join("assets").join(&asset.filename);
            fs::write(&asset_path, &asset.content).map_err(CreatorError::Io)?;
        }

        Ok(())
    }
}

/// Generate a SKILL.md file content
pub fn generate_skill_md(
    skill_name: &str,
    examples: &[super::SkillExample],
    template: &SkillTemplate,
) -> String {
    let examples_section = if examples.is_empty() {
        "## Examples\n\nAdd examples of how this skill is used.\n".to_string()
    } else {
        let mut section = "## Examples\n\n".to_string();
        for (i, example) in examples.iter().enumerate() {
            section.push_str(&format!(
                "### Example {}\n\n**User Query:** {}\n\n**Expected Behavior:** {}\n\n",
                i + 1,
                example.user_query,
                example.expected_behavior
            ));
        }
        section
    };

    format!(
        r#"---
name: {}
description: {}
---

# {}

{}

## Quick Start

Provide a quick start guide for using this skill.

## Usage

Describe how to use this skill effectively.

{}

## Resources

### Scripts
- `scripts/` - Executable scripts for this skill

### References
- `references/` - Documentation and reference materials

### Assets
- `assets/` - Templates, icons, and other assets
"#,
        skill_name, template.description, skill_name, template.description, examples_section
    )
}

// Template constants

const MINIMAL_MANIFEST_TEMPLATE: &str = r#"{
    "id": "allternit.skill.{{SKILL_NAME}}",
    "name": "{{SKILL_NAME}}",
    "version": "0.1.0",
    "description": "{{DESCRIPTION}}",
    "author": "Allternit Developer",
    "license": "MIT"
}"#;

const MINIMAL_SKILL_MD_TEMPLATE: &str = r#"---
name: {{SKILL_NAME}}
description: {{DESCRIPTION}}
---

# {{SKILL_NAME}}

{{DESCRIPTION}}

## Usage

Describe how to use this skill.

## Examples

Add examples here.
"#;

const TOOL_INTEGRATION_MANIFEST_TEMPLATE: &str = r#"{
    "id": "allternit.skill.{{SKILL_NAME}}",
    "name": "{{SKILL_NAME}}",
    "version": "0.1.0",
    "description": "{{DESCRIPTION}}",
    "author": "Allternit Developer",
    "license": "MIT",
    "side_effects": ["network"]
}"#;

const TOOL_INTEGRATION_SKILL_MD_TEMPLATE: &str = r#"---
name: {{SKILL_NAME}}
description: {{DESCRIPTION}}
---

# {{SKILL_NAME}}

{{DESCRIPTION}}

## Quick Start

1. Configure API credentials in environment
2. Use the API client script for requests
3. Handle errors appropriately

## Usage

This skill provides integration with external APIs and services.

## Scripts

- `scripts/api_client.py` - HTTP client with retries and error handling

## References

- `references/api_reference.md` - API documentation
"#;

const API_CLIENT_SCRIPT: &str = r#"#!/usr/bin/env python3
\"\"\"API Client with retry logic and error handling.\"\"\""

import requests
import time
from typing import Optional, Dict, Any


def api_request(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    json_data: Optional[Dict[str, Any]] = None,
    max_retries: int = 3,
    timeout: int = 30
) -> Dict[str, Any]:
    \"\"\"Make an API request with retry logic.\"\"\""
    for attempt in range(max_retries):
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=json_data,
                timeout=timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
    
    return {}


if __name__ == "__main__":
    # Example usage
    result = api_request("GET", "https://api.example.com/data")
    print(result)
"#;

const API_REFERENCE_TEMPLATE: &str = r#"# API Reference

## Base URL

https://api.example.com/v1

## Authentication

API requests require authentication via Bearer token.

## Endpoints

### GET /resource

Retrieve a list of resources.

### POST /resource

Create a new resource.

## Error Handling

- 400 - Bad Request
- 401 - Unauthorized
- 404 - Not Found
- 500 - Internal Server Error
"#;

const DATA_PROCESSING_MANIFEST_TEMPLATE: &str = r#"{
    "id": "allternit.skill.{{SKILL_NAME}}",
    "name": "{{SKILL_NAME}}",
    "version": "0.1.0",
    "description": "{{DESCRIPTION}}",
    "author": "Allternit Developer",
    "license": "MIT"
}"#;

const DATA_PROCESSING_SKILL_MD_TEMPLATE: &str = r#"---
name: {{SKILL_NAME}}
description: {{DESCRIPTION}}
---

# {{SKILL_NAME}}

{{DESCRIPTION}}

## Quick Start

1. Place input data in the appropriate format
2. Run the transform script
3. Output will be in the specified format

## Usage

This skill provides data transformation capabilities.

## Scripts

- `scripts/transform.py` - Data transformation utilities

## References

- `references/data_schema.md` - Data schema documentation
"#;

const DATA_TRANSFORM_SCRIPT: &str = r#"#!/usr/bin/env python3
\"\"\"Data transformation utilities.\"\"\""

import json
import csv
from typing import List, Dict, Any


def transform_json(data: Dict[str, Any]) -> Dict[str, Any]:
    \"\"\"Transform JSON data.\"\"\""
    # Add transformation logic here
    return data


def transform_csv(rows: List[List[str]]) -> List[List[str]]:
    \"\"\"Transform CSV data.\"\"\""
    # Add transformation logic here
    return rows


def load_json(filepath: str) -> Dict[str, Any]:
    \"\"\"Load JSON from file.\"\"\""
    with open(filepath, 'r') as f:
        return json.load(f)


def save_json(data: Dict[str, Any], filepath: str) -> None:
    \"\"\"Save JSON to file.\"\"\""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)


if __name__ == "__main__":
    # Example usage
    data = load_json("input.json")
    transformed = transform_json(data)
    save_json(transformed, "output.json")
"#;

const DATA_SCHEMA_TEMPLATE: &str = r#"# Data Schema

## Input Format

Describe the expected input data format.

## Output Format

Describe the output data format.

## Validation Rules

- Field A: required, string
- Field B: optional, number
"#;

const WORKFLOW_MANIFEST_TEMPLATE: &str = r#"{
    "id": "allternit.skill.{{SKILL_NAME}}",
    "name": "{{SKILL_NAME}}",
    "version": "0.1.0",
    "description": "{{DESCRIPTION}}",
    "author": "Allternit Developer",
    "license": "MIT"
}"#;

const WORKFLOW_SKILL_MD_TEMPLATE: &str = r#"---
name: {{SKILL_NAME}}
description: {{DESCRIPTION}}
---

# {{SKILL_NAME}}

{{DESCRIPTION}}

## Quick Start

1. Define your workflow configuration
2. Run the pipeline script
3. Monitor execution progress

## Usage

This skill automates multi-step workflows.

## Scripts

- `scripts/pipeline.py` - Workflow pipeline execution

## References

- `references/workflow_patterns.md` - Common workflow patterns
"#;

const PIPELINE_SCRIPT: &str = r#"#!/usr/bin/env python3
\"\"\"Workflow pipeline execution.\"\"\""

import json
from typing import List, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum


class StepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class PipelineStep:
    name: str
    action: Callable[[], Any]
    depends_on: List[str] = None
    status: StepStatus = StepStatus.PENDING
    result: Any = None


class Pipeline:
    \"\"\"Workflow pipeline executor.\"\"\""
    
    def __init__(self, name: str):
        self.name = name
        self.steps: Dict[str, PipelineStep] = {}
    
    def add_step(self, step: PipelineStep) -> None:
        \"\"\"Add a step to the pipeline.\"\"\""
        self.steps[step.name] = step
    
    def run(self) -> Dict[str, Any]:
        \"\"\"Execute the pipeline.\"\"\""
        results = {}
        
        for name, step in self.steps.items():
            if step.status == StepStatus.PENDING:
                try:
                    step.status = StepStatus.RUNNING
                    step.result = step.action()
                    step.status = StepStatus.COMPLETED
                    results[name] = step.result
                except Exception as e:
                    step.status = StepStatus.FAILED
                    raise RuntimeError(f"Step {name} failed: {e}")
        
        return results


def example_step():
    \"\"\"Example pipeline step.\"\"\""
    return {"status": "success"}


if __name__ == "__main__":
    pipeline = Pipeline("example")
    pipeline.add_step(PipelineStep(
        name="step1",
        action=example_step
    ))
    results = pipeline.run()
    print(json.dumps(results, indent=2))
"#;

const WORKFLOW_PATTERNS_TEMPLATE: &str = r#"# Workflow Patterns

## Sequential Execution

Steps execute one after another in order.

## Parallel Execution

Independent steps execute concurrently.

## Conditional Branching

Steps execute based on conditions.

## Error Handling

- Retry with backoff
- Circuit breaker
- Dead letter queue
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_template_registry() {
        let registry = SkillTemplateRegistry::default();

        assert!(registry.get("minimal").is_some());
        assert!(registry.get("tool-integration").is_some());
        assert!(registry.get("data-processing").is_some());
        assert!(registry.get("workflow-automation").is_some());

        assert_eq!(registry.list().len(), 4);
    }

    #[test]
    fn test_instantiate_template() {
        let registry = SkillTemplateRegistry::default();
        let template = SkillTemplate::tool_integration();
        let temp_dir = TempDir::new().unwrap();
        let skill_dir = temp_dir.path().join("test-skill");

        registry
            .instantiate_template(&template, &skill_dir, "test-skill")
            .unwrap();

        assert!(skill_dir.exists());
        assert!(skill_dir.join("SKILL.md").exists());
        assert!(skill_dir.join("scripts").join("api_client.py").exists());
        assert!(skill_dir
            .join("references")
            .join("api_reference.md")
            .exists());
    }
}
