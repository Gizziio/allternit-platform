# Skill Creator - Rust Primitive

Core skill creation primitive for the A2R skills system.

## Overview

This module provides the foundational capability for creating skills with a structured 6-step process:

1. **Understanding** - Gather concrete examples
2. **Planning** - Identify reusable resources
3. **Initializing** - Create directory structure
4. **Editing** - Implement skill content
5. **Packaging** - Create distributable `.skill` files
6. **Iteration** - Improve based on usage

## Usage

```rust
use a2rchitech_skills::creator::*;

// Create a skill creator
let config = SkillCreationConfig {
    skills_dir: PathBuf::from("./skills"),
    default_author: "MyOrg".to_string(),
    ..Default::default()
};
let mut creator = SkillCreator::new(config);

// Start a session
let session_id = creator.start_session("pdf-processor");

// Add examples
creator.add_example(
    &session_id,
    "Extract text from this PDF",
    "Parse PDF and return plain text",
    ExampleCategory::Primary,
)?;

// Plan resources
let planned = creator.start_planning(&session_id)?;

// Initialize skill directory
let skill_path = creator.initialize_skill(&session_id, None)?;

// Generate and save manifest
let manifest = creator.generate_manifest(&session_id, "A PDF processing skill")?;
creator.save_manifest(&session_id, "A PDF processing skill")?;

// Package skill
let package_path = creator.package_skill(&session_id, None)?;
```

## Modules

### `mod.rs`
- `SkillCreator` - Main primitive struct
- `SkillCreationSession` - Tracks creation progress
- `SkillCreationConfig` - Configuration
- Core types: `SkillExample`, `PlannedResources`, etc.

### `templates.rs`
- `SkillTemplate` - Template definitions
- `SkillTemplateRegistry` - Template registry
- 4 built-in templates with pre-built scripts

### `validator.rs`
- `SkillValidator` - Validates skill structure
- Checks SKILL.md format, frontmatter, forbidden files

### `packager.rs`
- `SkillPackager` - Creates `.skill` ZIP files
- Extraction and verification
- Package info and integrity checking

## Templates

### Minimal
Basic structure with just SKILL.md.

### Tool Integration
For API/service integrations:
- `scripts/api_client.py` - HTTP client with retries
- `references/api_reference.md` - API documentation

### Data Processing
For data transformation:
- `scripts/transform.py` - Data processing utilities
- `references/data_schema.md` - Schema documentation

### Workflow Automation
For multi-step workflows:
- `scripts/pipeline.py` - Pipeline execution framework
- `references/workflow_patterns.md` - Pattern documentation

## Validation Rules

- SKILL.md must exist
- Must have YAML frontmatter with `name` and `description`
- No forbidden files (README.md, CHANGELOG.md, etc.)
- Scripts must use supported languages
- Maximum nesting depth in assets/

## Error Handling

All functions return `Result<T, CreatorError>`:

```rust
pub enum CreatorError {
    Io(std::io::Error),
    Json(serde_json::Error),
    Validation(String),
    Package(String),
}
```

## Integration

This primitive integrates with:
- `SkillRegistry` - For skill registration
- `HistoryLedger` - For audit logging
- `PolicyEngine` - For safety tier enforcement
- `ToolGateway` - For tool registration

See TypeScript implementation in `cmd/gizzi-code/src/runtime/skills/` for Gizzi integration.
