//! A2R Ontology Runtime Binding
//!
//! Implements a typed object graph for domain-constrained reasoning.
//!
//! # Core Concepts
//!
//! ## Domain Objects
//! Every entity in the system is typed and registered in the domain registry.
//! Types constrain what operations can be performed on the entity.
//!
//! ## Relationships
//! Objects can have typed relationships with other objects.
//! Relationships are constrained by the types of the objects involved.
//!
//! ## Tool Binding
//! Tools are bound to ontology types. A tool can only operate on objects
//! of the types it's registered for.
//!
//! ## Reasoning Constraints
//! Agent reasoning is constrained by the ontology. Agents cannot make
//! assumptions or perform operations that violate the ontology.

use a2rchitech_system_law::SystemLawEngine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Domain Types
// ============================================================================

/// Domain object type definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainType {
    pub type_id: String,
    pub name: String,
    pub description: String,
    pub properties: Vec<Property>,
    pub allowed_relationships: Vec<RelationshipType>,
    pub allowed_tools: Vec<String>,
    pub created_at: DateTime<Utc>,
}

/// Property definition for a domain type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Property {
    pub name: String,
    pub prop_type: PropertyType,
    pub required: bool,
    pub description: String,
}

/// Property types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PropertyType {
    String,
    Number,
    Boolean,
    DateTime,
    Object,
    Array,
}

/// Relationship type definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipType {
    pub name: String,
    pub target_type: String,
    pub cardinality: Cardinality,
    pub description: String,
}

/// Relationship cardinality
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Cardinality {
    One,
    Many,
    Optional,
}

// ============================================================================
// Domain Objects
// ============================================================================

/// Instance of a domain object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainObject {
    pub object_id: String,
    pub type_id: String,
    pub properties: HashMap<String, serde_json::Value>,
    pub relationships: HashMap<String, Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Domain Registry
// ============================================================================

/// Domain registry - stores all domain types and objects
#[derive(Clone)]
pub struct DomainRegistry {
    types: Arc<RwLock<HashMap<String, DomainType>>>,
    objects: Arc<RwLock<HashMap<String, DomainObject>>>,
    system_law: Arc<SystemLawEngine>,
}

impl DomainRegistry {
    pub fn new(system_law: Arc<SystemLawEngine>) -> Self {
        Self {
            types: Arc::new(RwLock::new(HashMap::new())),
            objects: Arc::new(RwLock::new(HashMap::new())),
            system_law,
        }
    }

    /// Register a domain type
    pub async fn register_type(&self, domain_type: DomainType) -> Result<String, OntologyError> {
        // Validate type
        self.validate_type(&domain_type)?;

        let type_id = domain_type.type_id.clone();
        let mut types = self.types.write().await;
        types.insert(type_id.clone(), domain_type);

        Ok(type_id)
    }

    /// Validate domain type
    fn validate_type(&self, domain_type: &DomainType) -> Result<(), OntologyError> {
        // Check required fields
        if domain_type.type_id.is_empty() {
            return Err(OntologyError::ValidationError(
                "type_id is required".to_string(),
            ));
        }

        if domain_type.name.is_empty() {
            return Err(OntologyError::ValidationError(
                "name is required".to_string(),
            ));
        }

        // Check for duplicate property names
        let mut seen_props = std::collections::HashSet::new();
        for prop in &domain_type.properties {
            if !seen_props.insert(&prop.name) {
                return Err(OntologyError::ValidationError(format!(
                    "Duplicate property: {}",
                    prop.name
                )));
            }
        }

        Ok(())
    }

    /// Create a domain object
    pub async fn create_object(
        &self,
        type_id: &str,
        properties: HashMap<String, serde_json::Value>,
    ) -> Result<String, OntologyError> {
        // Verify type exists and get the properties we need
        let type_properties = {
            let types = self.types.read().await;
            let domain_type = types
                .get(type_id)
                .ok_or_else(|| OntologyError::TypeNotFound(type_id.to_string()))?;
            domain_type.properties.clone()
        };

        // Validate properties against type
        self.validate_properties(&type_properties, &properties)?;

        let object_id = format!("obj_{}", Uuid::new_v4().simple());
        let now = Utc::now();

        let object = DomainObject {
            object_id: object_id.clone(),
            type_id: type_id.to_string(),
            properties,
            relationships: HashMap::new(),
            created_at: now,
            updated_at: now,
        };

        let mut objects = self.objects.write().await;
        objects.insert(object_id.clone(), object);

        Ok(object_id)
    }

    /// Validate properties against type definition
    fn validate_properties(
        &self,
        type_properties: &[Property],
        provided: &HashMap<String, serde_json::Value>,
    ) -> Result<(), OntologyError> {
        // Check required properties
        for prop in type_properties {
            if prop.required && !provided.contains_key(&prop.name) {
                return Err(OntologyError::ValidationError(format!(
                    "Required property missing: {}",
                    prop.name
                )));
            }
        }

        // Check property types
        for (name, value) in provided {
            let prop_def = type_properties.iter().find(|p| &p.name == name);
            if let Some(prop_def) = prop_def {
                if !self.check_property_type(value, &prop_def.prop_type) {
                    return Err(OntologyError::ValidationError(format!(
                        "Property {} has wrong type",
                        name
                    )));
                }
            }
        }

        Ok(())
    }

    /// Check if value matches property type
    fn check_property_type(&self, value: &serde_json::Value, prop_type: &PropertyType) -> bool {
        match prop_type {
            PropertyType::String => value.is_string(),
            PropertyType::Number => value.is_number(),
            PropertyType::Boolean => value.is_boolean(),
            PropertyType::DateTime => value.is_string(), // ISO 8601 string
            PropertyType::Object => value.is_object(),
            PropertyType::Array => value.is_array(),
        }
    }

    /// Get domain object
    pub async fn get_object(&self, object_id: &str) -> Option<DomainObject> {
        let objects = self.objects.read().await;
        objects.get(object_id).cloned()
    }

    /// Update domain object
    pub async fn update_object(
        &self,
        object_id: &str,
        properties: HashMap<String, serde_json::Value>,
    ) -> Result<(), OntologyError> {
        let mut objects = self.objects.write().await;
        let object = objects
            .get_mut(object_id)
            .ok_or_else(|| OntologyError::ObjectNotFound(object_id.to_string()))?;

        // Update properties
        for (key, value) in properties {
            object.properties.insert(key, value);
        }

        object.updated_at = Utc::now();

        Ok(())
    }

    /// Create relationship between objects
    pub async fn create_relationship(
        &self,
        from_object_id: &str,
        relationship_name: &str,
        to_object_id: &str,
    ) -> Result<(), OntologyError> {
        // First verify both objects exist (read-only check)
        {
            let objects = self.objects.read().await;
            if !objects.contains_key(from_object_id) {
                return Err(OntologyError::ObjectNotFound(from_object_id.to_string()));
            }
            if !objects.contains_key(to_object_id) {
                return Err(OntologyError::ObjectNotFound(to_object_id.to_string()));
            }
        }

        // Now get mutable reference and add relationship
        let mut objects = self.objects.write().await;
        let from_object = objects
            .get_mut(from_object_id)
            .ok_or_else(|| OntologyError::ObjectNotFound(from_object_id.to_string()))?;

        // Add relationship
        let relationships = from_object
            .relationships
            .entry(relationship_name.to_string())
            .or_insert_with(Vec::new);

        if !relationships.contains(&to_object_id.to_string()) {
            relationships.push(to_object_id.to_string());
        }

        from_object.updated_at = Utc::now();

        Ok(())
    }

    /// Get related objects
    pub async fn get_related(
        &self,
        object_id: &str,
        relationship_name: &str,
    ) -> Result<Vec<DomainObject>, OntologyError> {
        let objects = self.objects.read().await;
        let object = objects
            .get(object_id)
            .ok_or_else(|| OntologyError::ObjectNotFound(object_id.to_string()))?;

        let related_ids = object
            .relationships
            .get(relationship_name)
            .cloned()
            .unwrap_or_default();

        let related: Vec<DomainObject> = related_ids
            .iter()
            .filter_map(|id| objects.get(id).cloned())
            .collect();

        Ok(related)
    }

    /// Get all domain types
    pub async fn get_types(&self) -> Vec<DomainType> {
        let types = self.types.read().await;
        types.values().cloned().collect()
    }

    /// Get a specific domain type
    pub async fn get_type(&self, type_id: &str) -> Option<DomainType> {
        let types = self.types.read().await;
        types.get(type_id).cloned()
    }

    /// Get all domain objects
    pub async fn get_objects(&self) -> Vec<DomainObject> {
        let objects = self.objects.read().await;
        objects.values().cloned().collect()
    }

    /// Query objects by type
    pub async fn query_by_type(&self, type_id: &str) -> Result<Vec<DomainObject>, OntologyError> {
        let objects = self.objects.read().await;
        let matching: Vec<DomainObject> = objects
            .values()
            .filter(|obj| obj.type_id == type_id)
            .cloned()
            .collect();

        Ok(matching)
    }

    /// Alias for query_by_type for reasoning engine compatibility
    pub async fn get_objects_by_type(
        &self,
        type_id: &str,
    ) -> Result<Vec<DomainObject>, OntologyError> {
        self.query_by_type(type_id).await
    }

    /// Get related objects graph up to a certain depth
    pub async fn get_related_graph(
        &self,
        object_id: &str,
        relationship: &str,
        depth: usize,
    ) -> Result<Vec<(String, String, String)>, OntologyError> {
        if depth == 0 {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();
        let mut to_visit = vec![(object_id.to_string(), 0)];
        let mut visited = std::collections::HashSet::new();

        while let Some((current_id, current_depth)) = to_visit.pop() {
            if current_depth >= depth || visited.contains(&current_id) {
                continue;
            }
            visited.insert(current_id.clone());

            let objects = self.objects.read().await;
            if let Some(obj) = objects.get(&current_id) {
                if let Some(related_ids) = obj.relationships.get(relationship) {
                    for related_id in related_ids {
                        results.push((
                            current_id.clone(),
                            relationship.to_string(),
                            related_id.clone(),
                        ));
                        if current_depth + 1 < depth {
                            to_visit.push((related_id.clone(), current_depth + 1));
                        }
                    }
                }
            }
        }

        Ok(results)
    }
}

// ============================================================================
// Tool Binding
// ============================================================================

/// Tool binding to ontology types
pub struct ToolBinding {
    tool_id: String,
    allowed_types: Vec<String>,
}

/// Tool registry with ontology bindings
pub struct OntologyToolRegistry {
    bindings: Arc<RwLock<HashMap<String, ToolBinding>>>,
    domain_registry: Arc<DomainRegistry>,
}

impl OntologyToolRegistry {
    pub fn new(domain_registry: Arc<DomainRegistry>) -> Self {
        Self {
            bindings: Arc::new(RwLock::new(HashMap::new())),
            domain_registry,
        }
    }

    /// Bind tool to ontology types
    pub async fn bind_tool(
        &self,
        tool_id: &str,
        allowed_types: Vec<String>,
    ) -> Result<(), OntologyError> {
        // Verify all types exist
        let types = self.domain_registry.get_types().await;
        let type_ids: std::collections::HashSet<_> = types.iter().map(|t| &t.type_id).collect();

        for type_id in &allowed_types {
            if !type_ids.contains(type_id) {
                return Err(OntologyError::TypeNotFound(type_id.clone()));
            }
        }

        let binding = ToolBinding {
            tool_id: tool_id.to_string(),
            allowed_types,
        };

        let mut bindings = self.bindings.write().await;
        bindings.insert(tool_id.to_string(), binding);

        Ok(())
    }

    /// Check if tool can operate on object
    pub async fn can_operate(&self, tool_id: &str, object_id: &str) -> Result<bool, OntologyError> {
        let bindings = self.bindings.read().await;
        let binding = bindings
            .get(tool_id)
            .ok_or_else(|| OntologyError::ToolNotBound(tool_id.to_string()))?;

        let objects = self.domain_registry.get_objects().await;
        let object = objects
            .iter()
            .find(|obj| obj.object_id == object_id)
            .ok_or_else(|| OntologyError::ObjectNotFound(object_id.to_string()))?;

        Ok(binding.allowed_types.contains(&object.type_id))
    }
}

// ============================================================================
// Ontology Errors
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum OntologyError {
    #[error("Type not found: {0}")]
    TypeNotFound(String),

    #[error("Object not found: {0}")]
    ObjectNotFound(String),

    #[error("Tool not bound: {0}")]
    ToolNotBound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Relationship constraint violated: {0}")]
    RelationshipConstraint(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn create_test_system_law() -> Arc<SystemLawEngine> {
        Arc::new(SystemLawEngine::new())
    }

    #[tokio::test]
    async fn test_register_type() {
        let registry = DomainRegistry::new(create_test_system_law());

        let domain_type = DomainType {
            type_id: "user".to_string(),
            name: "User".to_string(),
            description: "A user in the system".to_string(),
            properties: vec![
                Property {
                    name: "username".to_string(),
                    prop_type: PropertyType::String,
                    required: true,
                    description: "User's username".to_string(),
                },
                Property {
                    name: "email".to_string(),
                    prop_type: PropertyType::String,
                    required: true,
                    description: "User's email".to_string(),
                },
            ],
            allowed_relationships: vec![],
            allowed_tools: vec![],
            created_at: Utc::now(),
        };

        let result = registry.register_type(domain_type).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "user");
    }

    #[tokio::test]
    async fn test_create_object() {
        let registry = DomainRegistry::new(create_test_system_law());

        // Register type first
        let domain_type = DomainType {
            type_id: "user".to_string(),
            name: "User".to_string(),
            description: "A user".to_string(),
            properties: vec![Property {
                name: "username".to_string(),
                prop_type: PropertyType::String,
                required: true,
                description: "Username".to_string(),
            }],
            allowed_relationships: vec![],
            allowed_tools: vec![],
            created_at: Utc::now(),
        };
        registry.register_type(domain_type).await.unwrap();

        // Create object
        let mut properties = HashMap::new();
        properties.insert("username".to_string(), serde_json::json!("john_doe"));

        let result = registry.create_object("user", properties).await;
        assert!(result.is_ok());

        let object_id = result.unwrap();
        let object = registry.get_object(&object_id).await;
        assert!(object.is_some());
        assert_eq!(object.unwrap().type_id, "user");
    }

    #[tokio::test]
    async fn test_create_relationship() {
        let registry = DomainRegistry::new(create_test_system_law());

        // Register types
        registry
            .register_type(DomainType {
                type_id: "user".to_string(),
                name: "User".to_string(),
                description: "User".to_string(),
                properties: vec![],
                allowed_relationships: vec![RelationshipType {
                    name: "friends".to_string(),
                    target_type: "user".to_string(),
                    cardinality: Cardinality::Many,
                    description: "Friends".to_string(),
                }],
                allowed_tools: vec![],
                created_at: Utc::now(),
            })
            .await
            .unwrap();

        // Create objects
        let user1 = registry
            .create_object("user", HashMap::new())
            .await
            .unwrap();
        let user2 = registry
            .create_object("user", HashMap::new())
            .await
            .unwrap();

        // Create relationship
        let result = registry
            .create_relationship(&user1, "friends", &user2)
            .await;
        assert!(result.is_ok());

        // Verify relationship
        let related = registry.get_related(&user1, "friends").await.unwrap();
        assert_eq!(related.len(), 1);
        assert_eq!(related[0].object_id, user2);
    }

    #[tokio::test]
    async fn test_tool_binding() {
        let registry = DomainRegistry::new(create_test_system_law());
        let tool_registry = OntologyToolRegistry::new(Arc::new(registry.clone()));

        // Register type
        registry
            .register_type(DomainType {
                type_id: "user".to_string(),
                name: "User".to_string(),
                description: "User".to_string(),
                properties: vec![],
                allowed_relationships: vec![],
                allowed_tools: vec!["user_tool".to_string()],
                created_at: Utc::now(),
            })
            .await
            .unwrap();

        // Bind tool
        let result = tool_registry
            .bind_tool("user_tool", vec!["user".to_string()])
            .await;
        assert!(result.is_ok());

        // Create object
        let user_id = registry
            .create_object("user", HashMap::new())
            .await
            .unwrap();

        // Check tool can operate
        let can_operate = tool_registry
            .can_operate("user_tool", &user_id)
            .await
            .unwrap();
        assert!(can_operate);
    }
}

// ============================================================================
// Reasoning Constraints
// ============================================================================

/// Constraint for domain reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningConstraint {
    /// Unique identifier for the constraint
    pub constraint_id: String,
    /// Human-readable name
    pub name: String,
    /// Description of what this constraint enforces
    pub description: String,
    /// Type of constraint
    pub constraint_type: ConstraintType,
    /// Domain types this applies to
    pub applies_to_types: Vec<String>,
    /// The condition that must be met
    pub condition: ConstraintCondition,
    /// Action to take if constraint is violated
    pub on_violation: ViolationAction,
    /// Whether this constraint is active
    pub active: bool,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Types of reasoning constraints
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstraintType {
    /// Cardinality constraint on relationships
    Cardinality,
    /// Property value constraint
    PropertyValue,
    /// Existence constraint
    Existence,
    /// Uniqueness constraint
    Uniqueness,
    /// Referential integrity
    ReferentialIntegrity,
    /// Custom constraint with predicate
    Custom,
}

/// Condition for a constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstraintCondition {
    /// Minimum number of relationships
    MinCardinality { relationship: String, count: usize },
    /// Maximum number of relationships
    MaxCardinality { relationship: String, count: usize },
    /// Property must equal value
    PropertyEquals {
        property: String,
        value: serde_json::Value,
    },
    /// Property must be in range
    PropertyInRange {
        property: String,
        min: serde_json::Value,
        max: serde_json::Value,
    },
    /// Property must match pattern
    PropertyMatches { property: String, pattern: String },
    /// Object must exist
    MustExist,
    /// Property must be unique across type
    MustBeUnique { property: String },
    /// Target object must exist
    TargetMustExist { relationship: String },
    /// Custom condition as expression
    CustomExpression { expression: String },
}

/// Action to take when constraint is violated
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViolationAction {
    /// Reject the operation
    Reject,
    /// Warn but allow
    Warn,
    /// Auto-correct if possible
    AutoCorrect,
    /// Log for review
    LogOnly,
}

/// Engine for checking reasoning constraints
pub struct ReasoningEngine {
    constraints: Arc<RwLock<HashMap<String, ReasoningConstraint>>>,
    domain_registry: DomainRegistry,
}

impl ReasoningEngine {
    pub fn new(domain_registry: DomainRegistry) -> Self {
        Self {
            constraints: Arc::new(RwLock::new(HashMap::new())),
            domain_registry,
        }
    }

    /// Register a new constraint
    pub async fn register_constraint(
        &self,
        constraint: ReasoningConstraint,
    ) -> Result<String, OntologyError> {
        let constraint_id = constraint.constraint_id.clone();
        let mut constraints = self.constraints.write().await;
        constraints.insert(constraint_id.clone(), constraint);
        Ok(constraint_id)
    }

    /// Get a constraint by ID
    pub async fn get_constraint(&self, constraint_id: &str) -> Option<ReasoningConstraint> {
        let constraints = self.constraints.read().await;
        constraints.get(constraint_id).cloned()
    }

    /// Get all constraints for a type
    pub async fn get_constraints_for_type(&self, type_id: &str) -> Vec<ReasoningConstraint> {
        let constraints = self.constraints.read().await;
        constraints
            .values()
            .filter(|c| c.applies_to_types.contains(&type_id.to_string()) && c.active)
            .cloned()
            .collect()
    }

    /// Check all constraints for an object
    pub async fn check_constraints(
        &self,
        object_id: &str,
    ) -> Result<Vec<ConstraintViolation>, OntologyError> {
        let object = self
            .domain_registry
            .get_object(object_id)
            .await
            .ok_or_else(|| OntologyError::ObjectNotFound(object_id.to_string()))?;

        let constraints = self.get_constraints_for_type(&object.type_id).await;
        let mut violations = Vec::new();

        for constraint in constraints {
            if let Some(violation) = self.check_single_constraint(&object, &constraint).await {
                violations.push(violation);
            }
        }

        Ok(violations)
    }

    /// Check a single constraint
    async fn check_single_constraint(
        &self,
        object: &DomainObject,
        constraint: &ReasoningConstraint,
    ) -> Option<ConstraintViolation> {
        let is_violated = match &constraint.condition {
            ConstraintCondition::MinCardinality {
                relationship,
                count,
            } => {
                let count_actual = object
                    .relationships
                    .get(relationship)
                    .map(|r| r.len())
                    .unwrap_or(0);
                count_actual < *count
            }
            ConstraintCondition::MaxCardinality {
                relationship,
                count,
            } => {
                let count_actual = object
                    .relationships
                    .get(relationship)
                    .map(|r| r.len())
                    .unwrap_or(0);
                count_actual > *count
            }
            ConstraintCondition::PropertyEquals { property, value } => {
                object.properties.get(property) != Some(value)
            }
            ConstraintCondition::MustExist => {
                // Object exists, so this is satisfied
                false
            }
            ConstraintCondition::MustBeUnique { property } => {
                // Check uniqueness across all objects of this type
                if let Ok(objects) = self
                    .domain_registry
                    .get_objects_by_type(&object.type_id)
                    .await
                {
                    let value = object.properties.get(property);
                    let duplicates = objects
                        .into_iter()
                        .filter(|o| o.object_id != object.object_id)
                        .filter(|o| o.properties.get(property) == value)
                        .count();
                    duplicates > 0
                } else {
                    false
                }
            }
            ConstraintCondition::TargetMustExist { relationship } => {
                // Check all targets of this relationship exist
                if let Some(targets) = object.relationships.get(relationship) {
                    for target_id in targets {
                        if self.domain_registry.get_object(target_id).await.is_none() {
                            return Some(ConstraintViolation {
                                constraint_id: constraint.constraint_id.clone(),
                                object_id: object.object_id.clone(),
                                message: format!("Target object '{}' does not exist", target_id),
                                action: constraint.on_violation.clone(),
                            });
                        }
                    }
                    false
                } else {
                    false
                }
            }
            _ => false, // Other constraint types not yet implemented
        };

        if is_violated {
            Some(ConstraintViolation {
                constraint_id: constraint.constraint_id.clone(),
                object_id: object.object_id.clone(),
                message: format!("Constraint '{}' violated", constraint.name),
                action: constraint.on_violation.clone(),
            })
        } else {
            None
        }
    }

    /// Validate an operation against constraints
    pub async fn validate_operation(
        &self,
        operation: &OntologyOperation,
    ) -> Result<ValidationResult, OntologyError> {
        let violations = match operation {
            OntologyOperation::CreateObject {
                type_id,
                properties,
            } => {
                // Check constraints that would apply to the new object
                let constraints = self.get_constraints_for_type(type_id).await;
                let mut violations = Vec::new();

                for constraint in constraints {
                    // For creation, only check property constraints
                    if let ConstraintCondition::PropertyEquals { property, value } =
                        &constraint.condition
                    {
                        if properties.get(property) != Some(value) {
                            violations.push(ConstraintViolation {
                                constraint_id: constraint.constraint_id.clone(),
                                object_id: "(new)".to_string(),
                                message: format!("Property '{}' must equal {:?}", property, value),
                                action: constraint.on_violation.clone(),
                            });
                        }
                    }
                }

                violations
            }
            _ => Vec::new(), // Other operations not yet implemented
        };

        let is_valid = !violations
            .iter()
            .any(|v| matches!(v.action, ViolationAction::Reject));

        Ok(ValidationResult {
            is_valid,
            violations,
        })
    }
}

/// A constraint violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintViolation {
    pub constraint_id: String,
    pub object_id: String,
    pub message: String,
    pub action: ViolationAction,
}

/// Result of validation
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub violations: Vec<ConstraintViolation>,
}

/// Operations that can be validated
#[derive(Debug, Clone)]
pub enum OntologyOperation {
    CreateObject {
        type_id: String,
        properties: HashMap<String, serde_json::Value>,
    },
    UpdateObject {
        object_id: String,
        properties: HashMap<String, serde_json::Value>,
    },
    DeleteObject {
        object_id: String,
    },
    CreateRelationship {
        from_object_id: String,
        relationship: String,
        to_object_id: String,
    },
}

// ============================================================================
// Ontology Injection Rules
// ============================================================================

/// Rule for injecting ontology context into prompts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectionRule {
    /// Unique identifier
    pub rule_id: String,
    /// Human-readable name
    pub name: String,
    /// When this rule applies
    pub trigger: InjectionTrigger,
    /// What to inject
    pub injection: InjectionContent,
    /// Priority (higher = applied first)
    pub priority: i32,
    /// Whether rule is active
    pub active: bool,
}

/// Triggers for injection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InjectionTrigger {
    /// Triggered by tool invocation
    ToolInvocation { tool_id: String },
    /// Triggered by object type
    ObjectType { type_id: String },
    /// Triggered by specific operation
    Operation { operation_type: String },
    /// Triggered by relationship traversal
    RelationshipTraversal { relationship: String },
    /// Always trigger
    Always,
    /// Custom trigger condition
    Custom { condition: String },
}

/// Content to inject
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InjectionContent {
    /// Inject type schema
    TypeSchema { type_id: String },
    /// Inject object instance
    ObjectInstance { object_id: String },
    /// Inject related objects
    RelatedObjects { relationship: String, depth: usize },
    /// Inject custom text
    CustomText { text: String },
    /// Inject from template
    Template { template: String },
}

/// Engine for managing ontology injection
pub struct OntologyInjectionEngine {
    rules: Arc<RwLock<Vec<InjectionRule>>>,
    domain_registry: DomainRegistry,
}

impl OntologyInjectionEngine {
    pub fn new(domain_registry: DomainRegistry) -> Self {
        Self {
            rules: Arc::new(RwLock::new(Vec::new())),
            domain_registry,
        }
    }

    /// Add an injection rule
    pub async fn add_rule(&self, rule: InjectionRule) {
        let mut rules = self.rules.write().await;
        rules.push(rule);
        // Sort by priority (descending)
        rules.sort_by(|a, b| b.priority.cmp(&a.priority));
    }

    /// Remove a rule
    pub async fn remove_rule(&self, rule_id: &str) -> bool {
        let mut rules = self.rules.write().await;
        let initial_len = rules.len();
        rules.retain(|r| r.rule_id != rule_id);
        rules.len() < initial_len
    }

    /// Get all rules
    pub async fn get_rules(&self) -> Vec<InjectionRule> {
        let rules = self.rules.read().await;
        rules.clone()
    }

    /// Generate injection context for a tool invocation
    pub async fn generate_context(
        &self,
        tool_id: &str,
        object_id: Option<&str>,
    ) -> Result<InjectionContext, OntologyError> {
        let mut context = InjectionContext {
            tool_id: tool_id.to_string(),
            object_id: object_id.map(|s| s.to_string()),
            injected_schemas: Vec::new(),
            injected_objects: Vec::new(),
            injected_relationships: Vec::new(),
            custom_text: Vec::new(),
        };

        let rules = self.rules.read().await;

        for rule in rules.iter().filter(|r| r.active) {
            let should_apply = match &rule.trigger {
                InjectionTrigger::ToolInvocation { tool_id: tid } => tid == tool_id,
                InjectionTrigger::ObjectType { type_id } => {
                    if let Some(oid) = object_id {
                        if let Some(obj) = self.domain_registry.get_object(oid).await {
                            &obj.type_id == type_id
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                }
                InjectionTrigger::Always => true,
                _ => false, // Other triggers not yet implemented
            };

            if should_apply {
                self.apply_injection(&mut context, &rule.injection).await?;
            }
        }

        Ok(context)
    }

    /// Apply a single injection to the context
    async fn apply_injection(
        &self,
        context: &mut InjectionContext,
        injection: &InjectionContent,
    ) -> Result<(), OntologyError> {
        match injection {
            InjectionContent::TypeSchema { type_id } => {
                if let Some(schema) = self.domain_registry.get_type(type_id).await {
                    context.injected_schemas.push(schema);
                }
            }
            InjectionContent::ObjectInstance { object_id } => {
                if let Some(object) = self.domain_registry.get_object(object_id).await {
                    context.injected_objects.push(object);
                }
            }
            InjectionContent::RelatedObjects {
                relationship,
                depth,
            } => {
                if let Some(oid) = &context.object_id {
                    let related = self
                        .domain_registry
                        .get_related_graph(oid, relationship, *depth)
                        .await?;
                    context.injected_relationships.extend(related);
                }
            }
            InjectionContent::CustomText { text } => {
                context.custom_text.push(text.clone());
            }
            _ => {} // Other injection types not yet implemented
        }

        Ok(())
    }

    /// Format the injection context as a prompt string
    pub fn format_context(&self, context: &InjectionContext) -> String {
        let mut parts = Vec::new();

        if !context.injected_schemas.is_empty() {
            parts.push("## Type Schemas\n".to_string());
            for schema in &context.injected_schemas {
                parts.push(format!("### {} ({})", schema.name, schema.type_id));
                parts.push(schema.description.clone());
                parts.push("Properties:".to_string());
                for prop in &schema.properties {
                    parts.push(format!(
                        "  - {}: {:?} {}",
                        prop.name,
                        prop.prop_type,
                        if prop.required { "(required)" } else { "" }
                    ));
                }
                parts.push(String::new());
            }
        }

        if !context.injected_objects.is_empty() {
            parts.push("## Object Instances\n".to_string());
            for obj in &context.injected_objects {
                parts.push(format!("### {} ({})", obj.object_id, obj.type_id));
                if let Ok(props) = serde_json::to_string_pretty(&obj.properties) {
                    parts.push(props);
                }
                parts.push(String::new());
            }
        }

        if !context.custom_text.is_empty() {
            parts.push("## Additional Context\n".to_string());
            for text in &context.custom_text {
                parts.push(text.clone());
            }
        }

        parts.join("\n")
    }
}

/// Context that has been injected
#[derive(Debug, Clone)]
pub struct InjectionContext {
    pub tool_id: String,
    pub object_id: Option<String>,
    pub injected_schemas: Vec<DomainType>,
    pub injected_objects: Vec<DomainObject>,
    pub injected_relationships: Vec<(String, String, String)>, // (from, rel, to)
    pub custom_text: Vec<String>,
}
