//! Schema Validator for Tambo UI Generation
//!
//! Provides schema-driven validation for UI specifications and generated outputs.
//! Ensures determinism through strict schema validation.
//!
//! Inspired by Tambo's Zod schema validation approach:
//! https://github.com/tambo-ai/tambo

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Schema validator for UI generation
#[derive(Clone)]
pub struct SchemaValidator {
    schemas: HashMap<String, Schema>,
}

/// Schema definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schema {
    pub schema_id: String,
    pub schema_type: SchemaType,
    pub fields: Vec<FieldSchema>,
    pub required: Vec<String>,
}

/// Schema type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SchemaType {
    UISpec,
    ComponentSpec,
    LayoutSpec,
    StyleSpec,
    GeneratedUI,
}

/// Field schema definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldSchema {
    pub name: String,
    pub field_type: FieldType,
    pub required: bool,
    pub validation: Option<ValidationRule>,
}

/// Field type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FieldType {
    String,
    Integer,
    Float,
    Boolean,
    Array(Box<FieldType>),
    Object(HashMap<String, FieldType>),
    Enum(Vec<String>),
}

/// Validation rules
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationRule {
    MinLength(usize),
    MaxLength(usize),
    MinValue(i64),
    MaxValue(i64),
    Pattern(String),
    OneOf(Vec<String>),
    Custom(String),
}

/// Validation error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
    pub rule: Option<String>,
}

impl SchemaValidator {
    /// Create a new schema validator with default schemas
    pub fn new() -> Self {
        let mut validator = Self {
            schemas: HashMap::new(),
        };

        // Register default schemas
        validator.register_default_schemas();

        validator
    }

    /// Register default schemas for UI generation
    fn register_default_schemas(&mut self) {
        // UISpec schema
        self.schemas.insert(
            "uispec".to_string(),
            Schema {
                schema_id: "uispec".to_string(),
                schema_type: SchemaType::UISpec,
                fields: vec![
                    FieldSchema {
                        name: "spec_id".to_string(),
                        field_type: FieldType::String,
                        required: true,
                        validation: Some(ValidationRule::MinLength(1)),
                    },
                    FieldSchema {
                        name: "title".to_string(),
                        field_type: FieldType::String,
                        required: true,
                        validation: Some(ValidationRule::MinLength(1)),
                    },
                    FieldSchema {
                        name: "components".to_string(),
                        field_type: FieldType::Array(Box::new(FieldType::Object(HashMap::new()))),
                        required: true,
                        validation: None,
                    },
                ],
                required: vec![
                    "spec_id".to_string(),
                    "title".to_string(),
                    "components".to_string(),
                ],
            },
        );

        // GeneratedUI schema
        self.schemas.insert(
            "generated_ui".to_string(),
            Schema {
                schema_id: "generated_ui".to_string(),
                schema_type: SchemaType::GeneratedUI,
                fields: vec![
                    FieldSchema {
                        name: "generation_id".to_string(),
                        field_type: FieldType::String,
                        required: true,
                        validation: Some(ValidationRule::MinLength(1)),
                    },
                    FieldSchema {
                        name: "ui_code".to_string(),
                        field_type: FieldType::String,
                        required: true,
                        validation: Some(ValidationRule::MinLength(1)),
                    },
                    FieldSchema {
                        name: "components_generated".to_string(),
                        field_type: FieldType::Integer,
                        required: true,
                        validation: Some(ValidationRule::MinValue(0)),
                    },
                ],
                required: vec![
                    "generation_id".to_string(),
                    "ui_code".to_string(),
                    "components_generated".to_string(),
                ],
            },
        );
    }

    /// Register a custom schema
    pub fn register_schema(&mut self, schema: Schema) {
        self.schemas.insert(schema.schema_id.clone(), schema);
    }

    /// Validate a UI specification
    pub fn validate_spec(&self, spec: &crate::UISpec) -> Result<(), ValidationError> {
        let schema = self.schemas.get("uispec").ok_or_else(|| ValidationError {
            field: "schema".to_string(),
            message: "UISpec schema not found".to_string(),
            rule: None,
        })?;

        // Validate spec_id
        if spec.spec_id.is_empty() {
            return Err(ValidationError {
                field: "spec_id".to_string(),
                message: "spec_id cannot be empty".to_string(),
                rule: Some("min_length(1)".to_string()),
            });
        }

        // Validate title
        if spec.title.is_empty() {
            return Err(ValidationError {
                field: "title".to_string(),
                message: "title cannot be empty".to_string(),
                rule: Some("min_length(1)".to_string()),
            });
        }

        // Validate components (must have at least one)
        if spec.components.is_empty() {
            return Err(ValidationError {
                field: "components".to_string(),
                message: "At least one component is required".to_string(),
                rule: Some("min_items(1)".to_string()),
            });
        }

        // Validate each component
        for (i, component) in spec.components.iter().enumerate() {
            if component.component_id.is_empty() {
                return Err(ValidationError {
                    field: format!("components[{}].component_id", i),
                    message: "component_id cannot be empty".to_string(),
                    rule: Some("min_length(1)".to_string()),
                });
            }

            if component.component_type.is_empty() {
                return Err(ValidationError {
                    field: format!("components[{}].component_type", i),
                    message: "component_type cannot be empty".to_string(),
                    rule: Some("min_length(1)".to_string()),
                });
            }
        }

        Ok(())
    }

    /// Validate generated UI output
    pub fn validate_output(&self, ui: &crate::GeneratedUI) -> Result<(), ValidationError> {
        let schema = self
            .schemas
            .get("generated_ui")
            .ok_or_else(|| ValidationError {
                field: "schema".to_string(),
                message: "GeneratedUI schema not found".to_string(),
                rule: None,
            })?;

        // Validate generation_id
        if ui.generation_id.is_empty() {
            return Err(ValidationError {
                field: "generation_id".to_string(),
                message: "generation_id cannot be empty".to_string(),
                rule: Some("min_length(1)".to_string()),
            });
        }

        // Validate ui_code
        if ui.ui_code.is_empty() {
            return Err(ValidationError {
                field: "ui_code".to_string(),
                message: "ui_code cannot be empty".to_string(),
                rule: Some("min_length(1)".to_string()),
            });
        }

        // Validate components_generated
        if ui.components_generated == 0 {
            return Err(ValidationError {
                field: "components_generated".to_string(),
                message: "At least one component must be generated".to_string(),
                rule: Some("min_value(1)".to_string()),
            });
        }

        // Validate confidence (should be between 0 and 1)
        if ui.confidence < 0.0 || ui.confidence > 1.0 {
            return Err(ValidationError {
                field: "confidence".to_string(),
                message: "confidence must be between 0.0 and 1.0".to_string(),
                rule: Some("range(0.0, 1.0)".to_string()),
            });
        }

        Ok(())
    }

    /// Validate against a custom schema
    pub fn validate_custom(
        &self,
        schema_id: &str,
        data: &serde_json::Value,
    ) -> Result<(), ValidationError> {
        let schema = self.schemas.get(schema_id).ok_or_else(|| ValidationError {
            field: "schema".to_string(),
            message: format!("Schema '{}' not found", schema_id),
            rule: None,
        })?;

        // Validate required fields
        if let Some(obj) = data.as_object() {
            for required_field in &schema.required {
                if !obj.contains_key(required_field) {
                    return Err(ValidationError {
                        field: required_field.clone(),
                        message: format!("Required field '{}' is missing", required_field),
                        rule: Some("required".to_string()),
                    });
                }
            }

            // Validate each field
            for field_schema in &schema.fields {
                if let Some(value) = obj.get(&field_schema.name) {
                    self.validate_field(value, field_schema)?;
                } else if field_schema.required {
                    return Err(ValidationError {
                        field: field_schema.name.clone(),
                        message: format!("Required field '{}' is missing", field_schema.name),
                        rule: Some("required".to_string()),
                    });
                }
            }
        }

        Ok(())
    }

    /// Validate a single field
    fn validate_field(
        &self,
        value: &serde_json::Value,
        field: &FieldSchema,
    ) -> Result<(), ValidationError> {
        // Type validation
        match &field.field_type {
            FieldType::String => {
                if !value.is_string() {
                    return Err(ValidationError {
                        field: field.name.clone(),
                        message: format!("Expected string, got {:?}", value),
                        rule: Some("type(string)".to_string()),
                    });
                }

                if let Some(s) = value.as_str() {
                    if let Some(rule) = &field.validation {
                        match rule {
                            ValidationRule::MinLength(min) => {
                                if s.len() < *min {
                                    return Err(ValidationError {
                                        field: field.name.clone(),
                                        message: format!(
                                            "String length {} is less than minimum {}",
                                            s.len(),
                                            min
                                        ),
                                        rule: Some(format!("min_length({})", min)),
                                    });
                                }
                            }
                            ValidationRule::MaxLength(max) => {
                                if s.len() > *max {
                                    return Err(ValidationError {
                                        field: field.name.clone(),
                                        message: format!(
                                            "String length {} is greater than maximum {}",
                                            s.len(),
                                            max
                                        ),
                                        rule: Some(format!("max_length({})", max)),
                                    });
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            FieldType::Integer => {
                if !value.is_i64() && !value.is_u64() {
                    return Err(ValidationError {
                        field: field.name.clone(),
                        message: format!("Expected integer, got {:?}", value),
                        rule: Some("type(integer)".to_string()),
                    });
                }

                if let Some(i) = value.as_i64() {
                    if let Some(rule) = &field.validation {
                        match rule {
                            ValidationRule::MinValue(min) => {
                                if i < *min {
                                    return Err(ValidationError {
                                        field: field.name.clone(),
                                        message: format!(
                                            "Value {} is less than minimum {}",
                                            i, min
                                        ),
                                        rule: Some(format!("min_value({})", min)),
                                    });
                                }
                            }
                            ValidationRule::MaxValue(max) => {
                                if i > *max {
                                    return Err(ValidationError {
                                        field: field.name.clone(),
                                        message: format!(
                                            "Value {} is greater than maximum {}",
                                            i, max
                                        ),
                                        rule: Some(format!("max_value({})", max)),
                                    });
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            FieldType::Boolean => {
                if !value.is_boolean() {
                    return Err(ValidationError {
                        field: field.name.clone(),
                        message: format!("Expected boolean, got {:?}", value),
                        rule: Some("type(boolean)".to_string()),
                    });
                }
            }
            FieldType::Enum(allowed) => {
                if let Some(s) = value.as_str() {
                    if !allowed.contains(&s.to_string()) {
                        return Err(ValidationError {
                            field: field.name.clone(),
                            message: format!(
                                "Value '{}' is not one of allowed values: {:?}",
                                s, allowed
                            ),
                            rule: Some("enum".to_string()),
                        });
                    }
                }
            }
            _ => {
                // Other types not fully implemented yet
            }
        }

        Ok(())
    }
}

impl Default for SchemaValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_valid_spec() {
        let validator = SchemaValidator::new();

        let spec = crate::UISpec {
            spec_id: "test-123".to_string(),
            title: "Test UI".to_string(),
            description: "A test UI".to_string(),
            components: vec![crate::ComponentSpec {
                component_id: "comp-1".to_string(),
                component_type: "button".to_string(),
                properties: std::collections::HashMap::new(),
                children: vec![],
                bindings: vec![],
            }],
            layout: crate::LayoutSpec {
                layout_type: "flex".to_string(),
                constraints: crate::LayoutConstraints::default(),
                regions: vec![],
            },
            style: crate::StyleSpec {
                theme: "default".to_string(),
                colors: std::collections::HashMap::new(),
                typography: crate::TypographySpec {
                    font_family: "Arial".to_string(),
                    font_sizes: std::collections::HashMap::new(),
                    line_heights: std::collections::HashMap::new(),
                },
                spacing: crate::SpacingSpec {
                    scale: vec![4, 8, 16, 32],
                    unit: "px".to_string(),
                },
            },
            interactions: vec![],
            created_at: chrono::Utc::now(),
        };

        let result = validator.validate_spec(&spec);
        assert!(result.is_ok());
    }

    #[test]
    fn test_invalid_spec_empty_id() {
        let validator = SchemaValidator::new();

        let spec = crate::UISpec {
            spec_id: "".to_string(),
            title: "Test UI".to_string(),
            description: "A test UI".to_string(),
            components: vec![],
            layout: crate::LayoutSpec {
                layout_type: "flex".to_string(),
                constraints: crate::LayoutConstraints::default(),
                regions: vec![],
            },
            style: crate::StyleSpec {
                theme: "default".to_string(),
                colors: std::collections::HashMap::new(),
                typography: crate::TypographySpec {
                    font_family: "Arial".to_string(),
                    font_sizes: std::collections::HashMap::new(),
                    line_heights: std::collections::HashMap::new(),
                },
                spacing: crate::SpacingSpec {
                    scale: vec![4, 8, 16, 32],
                    unit: "px".to_string(),
                },
            },
            interactions: vec![],
            created_at: chrono::Utc::now(),
        };

        let result = validator.validate_spec(&spec);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.field, "spec_id");
    }

    #[test]
    fn test_valid_generated_ui() {
        let validator = SchemaValidator::new();

        let ui = crate::GeneratedUI {
            generation_id: "gen-123".to_string(),
            spec_id: "spec-123".to_string(),
            ui_code: "<div>Hello</div>".to_string(),
            ui_type: crate::UIType::React,
            components_generated: 5,
            confidence: 0.9,
            created_at: chrono::Utc::now(),
            generation_hash: None,
        };

        let result = validator.validate_output(&ui);
        assert!(result.is_ok());
    }

    #[test]
    fn test_invalid_generated_ui_empty_code() {
        let validator = SchemaValidator::new();

        let ui = crate::GeneratedUI {
            generation_id: "gen-123".to_string(),
            spec_id: "spec-123".to_string(),
            ui_code: "".to_string(),
            ui_type: crate::UIType::React,
            components_generated: 5,
            confidence: 0.9,
            created_at: chrono::Utc::now(),
            generation_hash: None,
        };

        let result = validator.validate_output(&ui);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.field, "ui_code");
    }

    #[test]
    fn test_custom_schema_validation() {
        let validator = SchemaValidator::new();

        let data = serde_json::json!({
            "name": "test",
            "value": 42
        });

        let result = validator.validate_custom("uispec", &data);
        // Should fail because required fields are missing
        assert!(result.is_err());
    }
}
