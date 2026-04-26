//! Allternit Purpose Binding
//!
//! Provides purpose-based access control and constraints for AI operations.
//! Ensures that data and tools are only used for explicitly declared purposes.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

pub mod enforcement;
pub mod wih_integration;

use enforcement::{EnforcementDecision, PurposeEnforcer};

// ============================================================================
// Core Types
// ============================================================================

/// A declared purpose for data/tool usage
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Purpose {
    /// Unique purpose ID
    pub purpose_id: String,
    /// Human-readable name
    pub name: String,
    /// Detailed description
    pub description: String,
    /// Purpose category
    pub category: PurposeCategory,
    /// Allowed operations under this purpose
    pub allowed_operations: Vec<OperationType>,
    /// Data sensitivity levels this purpose can access
    pub allowed_sensitivity_levels: Vec<SensitivityLevel>,
    /// Whether this purpose requires explicit user consent
    pub requires_consent: bool,
    /// Whether this purpose allows data retention
    pub allows_retention: bool,
    /// Maximum retention period (if allowed)
    pub max_retention_days: Option<u32>,
    /// Allowed data recipients (empty = internal only)
    pub allowed_recipients: Vec<String>,
    /// Whether data can be shared with third parties
    pub allows_third_party_sharing: bool,
    /// Whether this purpose allows automated decision making
    pub allows_automated_decisions: bool,
    /// Created timestamp
    pub created_at: DateTime<Utc>,
    /// Expiry timestamp (if temporary)
    pub expires_at: Option<DateTime<Utc>>,
}

/// Purpose categories
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PurposeCategory {
    /// Core system functionality
    SystemOperations,
    /// User-requested operations
    UserRequested,
    /// Security and safety
    SecuritySafety,
    /// Legal compliance
    LegalCompliance,
    /// Research and development
    ResearchDevelopment,
    /// Analytics and improvement
    AnalyticsImprovement,
    /// Marketing and communication
    MarketingCommunication,
    /// Custom category
    Custom(String),
}

/// Types of operations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum OperationType {
    /// Read data
    Read,
    /// Write/modify data
    Write,
    /// Delete data
    Delete,
    /// Process/transform data
    Process,
    /// Share data
    Share,
    /// Store/persist data
    Store,
    /// Analyze data
    Analyze,
    /// Train models
    Train,
    /// Inference/prediction
    Infer,
}

/// Data sensitivity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "snake_case")]
pub enum SensitivityLevel {
    /// Public data
    Public,
    /// Internal use only
    Internal,
    /// Confidential
    Confidential,
    /// Highly sensitive
    Restricted,
    /// Regulatory protected (GDPR, HIPAA, etc.)
    Protected,
}

/// A purpose binding - associates an operation with a purpose
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeBinding {
    /// Binding ID
    pub binding_id: String,
    /// The purpose being bound
    pub purpose_id: String,
    /// The operation context
    pub context: OperationContext,
    /// Data being accessed
    pub data_subjects: Vec<DataSubject>,
    /// Tools being used
    pub tools: Vec<ToolReference>,
    /// User who authorized this binding
    pub authorized_by: String,
    /// Authorization timestamp
    pub authorized_at: DateTime<Utc>,
    /// Expiration timestamp
    pub expires_at: Option<DateTime<Utc>>,
    /// Consent record (if required)
    pub consent_record: Option<ConsentRecord>,
    /// Audit log references
    pub audit_refs: Vec<String>,
}

/// Context for an operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationContext {
    /// Operation ID
    pub operation_id: String,
    /// Operation type
    pub operation_type: OperationType,
    /// Agent/user performing the operation
    pub actor_id: String,
    /// Session ID
    pub session_id: String,
    /// Request ID
    pub request_id: String,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Additional context data
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Data subject reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSubject {
    /// Subject ID (user, entity, etc.)
    pub subject_id: String,
    /// Subject type
    pub subject_type: String,
    /// Sensitivity level of this subject's data
    pub sensitivity_level: SensitivityLevel,
    /// Data types involved
    pub data_types: Vec<String>,
    /// Whether explicit consent was obtained
    pub has_consent: bool,
}

/// Tool reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolReference {
    /// Tool ID
    pub tool_id: String,
    /// Tool name
    pub tool_name: String,
    /// Tool category
    pub category: String,
    /// Whether tool is internal or external
    pub is_external: bool,
}

/// Consent record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentRecord {
    /// Consent ID
    pub consent_id: String,
    /// Who gave consent
    pub consenting_party: String,
    /// What they consented to
    pub purpose_id: String,
    /// Timestamp of consent
    pub given_at: DateTime<Utc>,
    /// How consent was obtained
    pub method: ConsentMethod,
    /// Whether consent can be withdrawn
    pub can_withdraw: bool,
    /// Withdrawal timestamp (if applicable)
    pub withdrawn_at: Option<DateTime<Utc>>,
}

/// Methods of obtaining consent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConsentMethod {
    /// Explicit opt-in
    ExplicitOptIn,
    /// Implied through action
    Implied,
    /// Legitimate interest
    LegitimateInterest,
    /// Legal requirement
    LegalRequirement,
    /// Contractual necessity
    ContractualNecessity,
}

// ============================================================================
// Purpose Registry
// ============================================================================

/// Registry for managing purposes and purpose bindings
pub struct PurposeRegistry {
    purposes: Arc<RwLock<HashMap<String, Purpose>>>,
    bindings: Arc<RwLock<HashMap<String, PurposeBinding>>>,
    enforcer: PurposeEnforcer,
    audit_log: Arc<RwLock<Vec<PurposeAuditEntry>>>,
}

/// Audit entry for purpose-related actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeAuditEntry {
    pub entry_id: String,
    pub timestamp: DateTime<Utc>,
    pub action: PurposeAction,
    pub purpose_id: Option<String>,
    pub binding_id: Option<String>,
    pub actor_id: String,
    pub details: String,
}

/// Purpose-related actions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PurposeAction {
    PurposeCreated,
    PurposeUpdated,
    PurposeDeleted,
    BindingCreated,
    BindingRevoked,
    BindingExpired,
    ConsentGiven,
    ConsentWithdrawn,
    EnforcementDecision,
    ViolationDetected,
}

impl PurposeRegistry {
    /// Create a new purpose registry
    pub fn new() -> Self {
        Self {
            purposes: Arc::new(RwLock::new(HashMap::new())),
            bindings: Arc::new(RwLock::new(HashMap::new())),
            enforcer: PurposeEnforcer::new(),
            audit_log: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Register a new purpose
    pub async fn register_purpose(&self, purpose: Purpose) -> Result<String, PurposeError> {
        let purpose_id = purpose.purpose_id.clone();

        // Validate purpose
        self.validate_purpose(&purpose).await?;

        let mut purposes = self.purposes.write().await;

        if purposes.contains_key(&purpose_id) {
            return Err(PurposeError::DuplicatePurpose(purpose_id));
        }

        purposes.insert(purpose_id.clone(), purpose);

        self.audit(
            PurposeAction::PurposeCreated,
            Some(&purpose_id),
            None,
            "system",
            "Purpose registered",
        )
        .await;

        info!(
            "Registered purpose: {} ({})",
            purpose_id,
            purposes.get(&purpose_id).unwrap().name
        );
        Ok(purpose_id)
    }

    /// Get a purpose by ID
    pub async fn get_purpose(&self, purpose_id: &str) -> Option<Purpose> {
        let purposes = self.purposes.read().await;
        purposes.get(purpose_id).cloned()
    }

    /// Get all purposes
    pub async fn get_all_purposes(&self) -> Vec<Purpose> {
        let purposes = self.purposes.read().await;
        purposes.values().cloned().collect()
    }

    /// Get purposes by category
    pub async fn get_purposes_by_category(&self, category: &PurposeCategory) -> Vec<Purpose> {
        let purposes = self.purposes.read().await;
        purposes
            .values()
            .filter(|p| &p.category == category)
            .cloned()
            .collect()
    }

    /// Update a purpose
    pub async fn update_purpose(&self, purpose: Purpose) -> Result<(), PurposeError> {
        let purpose_id = purpose.purpose_id.clone();

        let mut purposes = self.purposes.write().await;

        if !purposes.contains_key(&purpose_id) {
            return Err(PurposeError::PurposeNotFound(purpose_id));
        }

        purposes.insert(purpose_id.clone(), purpose);

        self.audit(
            PurposeAction::PurposeUpdated,
            Some(&purpose_id),
            None,
            "system",
            "Purpose updated",
        )
        .await;

        info!("Updated purpose: {}", purpose_id);
        Ok(())
    }

    /// Delete a purpose (if no active bindings)
    pub async fn delete_purpose(&self, purpose_id: &str) -> Result<(), PurposeError> {
        // Check for active bindings
        let bindings = self.bindings.read().await;
        let has_active_bindings = bindings
            .values()
            .any(|b| b.purpose_id == purpose_id && !self.is_binding_expired(b));

        if has_active_bindings {
            return Err(PurposeError::PurposeInUse(purpose_id.to_string()));
        }

        drop(bindings);

        let mut purposes = self.purposes.write().await;

        if purposes.remove(purpose_id).is_none() {
            return Err(PurposeError::PurposeNotFound(purpose_id.to_string()));
        }

        self.audit(
            PurposeAction::PurposeDeleted,
            Some(purpose_id),
            None,
            "system",
            "Purpose deleted",
        )
        .await;

        info!("Deleted purpose: {}", purpose_id);
        Ok(())
    }

    /// Create a purpose binding
    pub async fn create_binding(
        &self,
        purpose_id: &str,
        context: OperationContext,
        data_subjects: Vec<DataSubject>,
        tools: Vec<ToolReference>,
        authorized_by: &str,
    ) -> Result<PurposeBinding, PurposeError> {
        // Verify purpose exists
        let purpose = self
            .get_purpose(purpose_id)
            .await
            .ok_or_else(|| PurposeError::PurposeNotFound(purpose_id.to_string()))?;

        // Check if purpose is expired
        if let Some(expires_at) = purpose.expires_at {
            if Utc::now() > expires_at {
                return Err(PurposeError::PurposeExpired(purpose_id.to_string()));
            }
        }

        // Validate operation is allowed for this purpose
        if !purpose.allowed_operations.contains(&context.operation_type) {
            return Err(PurposeError::OperationNotAllowed(
                format!("{:?}", context.operation_type),
                purpose_id.to_string(),
            ));
        }

        // Check consent requirements
        let mut consent_record = None;
        if purpose.requires_consent {
            consent_record = self.verify_consent(purpose_id, &data_subjects).await?;
        }

        // Check sensitivity levels
        for subject in &data_subjects {
            if !purpose
                .allowed_sensitivity_levels
                .contains(&subject.sensitivity_level)
            {
                return Err(PurposeError::SensitivityNotAllowed(
                    subject.subject_id.clone(),
                    format!("{:?}", subject.sensitivity_level),
                ));
            }
        }

        // Create binding
        let binding_id = format!("bind-{}", uuid::Uuid::new_v4().simple());

        let expires_at = purpose
            .max_retention_days
            .map(|days| Utc::now() + chrono::Duration::days(days as i64));

        let binding = PurposeBinding {
            binding_id: binding_id.clone(),
            purpose_id: purpose_id.to_string(),
            context,
            data_subjects,
            tools,
            authorized_by: authorized_by.to_string(),
            authorized_at: Utc::now(),
            expires_at,
            consent_record,
            audit_refs: vec![],
        };

        let mut bindings = self.bindings.write().await;
        bindings.insert(binding_id.clone(), binding.clone());

        self.audit(
            PurposeAction::BindingCreated,
            Some(purpose_id),
            Some(&binding_id),
            authorized_by,
            "Purpose binding created",
        )
        .await;

        info!(
            "Created purpose binding: {} for purpose: {}",
            binding_id, purpose_id
        );
        Ok(binding)
    }

    /// Get a binding by ID
    pub async fn get_binding(&self, binding_id: &str) -> Option<PurposeBinding> {
        let bindings = self.bindings.read().await;
        bindings.get(binding_id).cloned()
    }

    /// Get active bindings for a purpose
    pub async fn get_active_bindings(&self, purpose_id: &str) -> Vec<PurposeBinding> {
        let bindings = self.bindings.read().await;
        bindings
            .values()
            .filter(|b| b.purpose_id == purpose_id && !self.is_binding_expired(b))
            .cloned()
            .collect()
    }

    /// Revoke a binding
    pub async fn revoke_binding(
        &self,
        binding_id: &str,
        revoked_by: &str,
    ) -> Result<(), PurposeError> {
        let mut bindings = self.bindings.write().await;

        if bindings.remove(binding_id).is_none() {
            return Err(PurposeError::BindingNotFound(binding_id.to_string()));
        }

        self.audit(
            PurposeAction::BindingRevoked,
            None,
            Some(binding_id),
            revoked_by,
            "Purpose binding revoked",
        )
        .await;

        info!("Revoked purpose binding: {}", binding_id);
        Ok(())
    }

    /// Check if an operation is permitted under a purpose binding
    pub async fn check_permission(
        &self,
        binding_id: &str,
        operation: &OperationType,
        data_subject: Option<&DataSubject>,
    ) -> Result<EnforcementDecision, PurposeError> {
        let binding = self
            .get_binding(binding_id)
            .await
            .ok_or_else(|| PurposeError::BindingNotFound(binding_id.to_string()))?;

        // Check if binding is expired
        if self.is_binding_expired(&binding) {
            return Err(PurposeError::BindingExpired(binding_id.to_string()));
        }

        // Get purpose
        let purpose = self
            .get_purpose(&binding.purpose_id)
            .await
            .ok_or_else(|| PurposeError::PurposeNotFound(binding.purpose_id.clone()))?;

        // Use enforcer to make decision
        let decision = self
            .enforcer
            .check_operation(&purpose, &binding, operation, data_subject);

        self.audit(
            PurposeAction::EnforcementDecision,
            Some(&binding.purpose_id),
            Some(binding_id),
            &binding.context.actor_id,
            &format!("Decision for {:?}: {:?}", operation, decision),
        )
        .await;

        Ok(decision)
    }

    /// Validate a purpose definition
    async fn validate_purpose(&self, purpose: &Purpose) -> Result<(), PurposeError> {
        if purpose.purpose_id.is_empty() {
            return Err(PurposeError::InvalidPurpose(
                "purpose_id cannot be empty".to_string(),
            ));
        }

        if purpose.name.is_empty() {
            return Err(PurposeError::InvalidPurpose(
                "name cannot be empty".to_string(),
            ));
        }

        if purpose.allowed_operations.is_empty() {
            return Err(PurposeError::InvalidPurpose(
                "must allow at least one operation".to_string(),
            ));
        }

        if purpose.allowed_sensitivity_levels.is_empty() {
            return Err(PurposeError::InvalidPurpose(
                "must allow at least one sensitivity level".to_string(),
            ));
        }

        Ok(())
    }

    /// Verify consent for data subjects
    async fn verify_consent(
        &self,
        purpose_id: &str,
        data_subjects: &[DataSubject],
    ) -> Result<Option<ConsentRecord>, PurposeError> {
        // In a real implementation, this would check a consent database
        // For now, verify all subjects have consent
        for subject in data_subjects {
            if !subject.has_consent {
                return Err(PurposeError::ConsentRequired(
                    subject.subject_id.clone(),
                    purpose_id.to_string(),
                ));
            }
        }

        // Create a consent record
        Ok(Some(ConsentRecord {
            consent_id: format!("consent-{}", uuid::Uuid::new_v4().simple()),
            consenting_party: "user".to_string(),
            purpose_id: purpose_id.to_string(),
            given_at: Utc::now(),
            method: ConsentMethod::ExplicitOptIn,
            can_withdraw: true,
            withdrawn_at: None,
        }))
    }

    /// Check if a binding is expired
    fn is_binding_expired(&self, binding: &PurposeBinding) -> bool {
        if let Some(expires_at) = binding.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }

    /// Add audit entry
    async fn audit(
        &self,
        action: PurposeAction,
        purpose_id: Option<&str>,
        binding_id: Option<&str>,
        actor_id: &str,
        details: &str,
    ) {
        let entry = PurposeAuditEntry {
            entry_id: format!("audit-{}", uuid::Uuid::new_v4().simple()),
            timestamp: Utc::now(),
            action,
            purpose_id: purpose_id.map(|s| s.to_string()),
            binding_id: binding_id.map(|s| s.to_string()),
            actor_id: actor_id.to_string(),
            details: details.to_string(),
        };

        let mut audit_log = self.audit_log.write().await;
        audit_log.push(entry);
    }

    /// Get audit log (with optional filtering)
    pub async fn get_audit_log(&self) -> Vec<PurposeAuditEntry> {
        let audit_log = self.audit_log.read().await;
        audit_log.clone()
    }

    /// Clean up expired bindings
    pub async fn cleanup_expired_bindings(&self) -> usize {
        let mut bindings = self.bindings.write().await;
        let expired: Vec<String> = bindings
            .values()
            .filter(|b| self.is_binding_expired(b))
            .map(|b| b.binding_id.clone())
            .collect();

        let count = expired.len();
        for binding_id in expired {
            bindings.remove(&binding_id);
            self.audit(
                PurposeAction::BindingExpired,
                None,
                Some(&binding_id),
                "system",
                "Binding expired",
            )
            .await;
        }

        count
    }
}

impl Default for PurposeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Errors
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum PurposeError {
    #[error("Purpose not found: {0}")]
    PurposeNotFound(String),

    #[error("Duplicate purpose ID: {0}")]
    DuplicatePurpose(String),

    #[error("Purpose is in use and cannot be deleted: {0}")]
    PurposeInUse(String),

    #[error("Purpose expired: {0}")]
    PurposeExpired(String),

    #[error("Invalid purpose: {0}")]
    InvalidPurpose(String),

    #[error("Binding not found: {0}")]
    BindingNotFound(String),

    #[error("Binding expired: {0}")]
    BindingExpired(String),

    #[error("Operation {0} not allowed for purpose {1}")]
    OperationNotAllowed(String, String),

    #[error("Consent required for subject {0} and purpose {1}")]
    ConsentRequired(String, String),

    #[error("Sensitivity level {1} not allowed for subject {0}")]
    SensitivityNotAllowed(String, String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_purpose() -> Purpose {
        Purpose {
            purpose_id: "test-purpose".to_string(),
            name: "Test Purpose".to_string(),
            description: "A purpose for testing".to_string(),
            category: PurposeCategory::UserRequested,
            allowed_operations: vec![OperationType::Read, OperationType::Process],
            allowed_sensitivity_levels: vec![SensitivityLevel::Internal, SensitivityLevel::Public],
            requires_consent: false,
            allows_retention: true,
            max_retention_days: Some(30),
            allowed_recipients: vec![],
            allows_third_party_sharing: false,
            allows_automated_decisions: false,
            created_at: Utc::now(),
            expires_at: None,
        }
    }

    fn create_test_context() -> OperationContext {
        OperationContext {
            operation_id: "op-1".to_string(),
            operation_type: OperationType::Read,
            actor_id: "actor-1".to_string(),
            session_id: "session-1".to_string(),
            request_id: "req-1".to_string(),
            timestamp: Utc::now(),
            metadata: HashMap::new(),
        }
    }

    #[tokio::test]
    async fn test_purpose_registration() {
        let registry = PurposeRegistry::new();
        let purpose = create_test_purpose();

        let purpose_id = registry.register_purpose(purpose).await.unwrap();

        assert_eq!(purpose_id, "test-purpose");
        assert!(registry.get_purpose(&purpose_id).await.is_some());
    }

    #[tokio::test]
    async fn test_duplicate_purpose() {
        let registry = PurposeRegistry::new();
        let purpose = create_test_purpose();

        registry.register_purpose(purpose.clone()).await.unwrap();

        let result = registry.register_purpose(purpose).await;
        assert!(matches!(result, Err(PurposeError::DuplicatePurpose(_))));
    }

    #[tokio::test]
    async fn test_binding_creation() {
        let registry = PurposeRegistry::new();
        let purpose = create_test_purpose();

        registry.register_purpose(purpose).await.unwrap();

        let context = create_test_context();
        let data_subjects = vec![];
        let tools = vec![];

        let binding = registry
            .create_binding("test-purpose", context, data_subjects, tools, "admin")
            .await
            .unwrap();

        assert_eq!(binding.purpose_id, "test-purpose");
        assert_eq!(binding.authorized_by, "admin");
    }

    #[tokio::test]
    async fn test_operation_not_allowed() {
        let registry = PurposeRegistry::new();
        let purpose = create_test_purpose();

        registry.register_purpose(purpose).await.unwrap();

        let mut context = create_test_context();
        context.operation_type = OperationType::Delete; // Not allowed

        let result = registry
            .create_binding("test-purpose", context, vec![], vec![], "admin")
            .await;

        assert!(matches!(
            result,
            Err(PurposeError::OperationNotAllowed(_, _))
        ));
    }

    #[tokio::test]
    async fn test_sensitivity_not_allowed() {
        let registry = PurposeRegistry::new();
        let purpose = create_test_purpose();

        registry.register_purpose(purpose).await.unwrap();

        let context = create_test_context();
        let data_subjects = vec![DataSubject {
            subject_id: "user-1".to_string(),
            subject_type: "user".to_string(),
            sensitivity_level: SensitivityLevel::Protected, // Not allowed
            data_types: vec!["personal".to_string()],
            has_consent: false,
        }];

        let result = registry
            .create_binding("test-purpose", context, data_subjects, vec![], "admin")
            .await;

        assert!(matches!(
            result,
            Err(PurposeError::SensitivityNotAllowed(_, _))
        ));
    }

    #[tokio::test]
    async fn test_binding_revocation() {
        let registry = PurposeRegistry::new();
        let purpose = create_test_purpose();

        registry.register_purpose(purpose).await.unwrap();

        let binding = registry
            .create_binding(
                "test-purpose",
                create_test_context(),
                vec![],
                vec![],
                "admin",
            )
            .await
            .unwrap();

        registry
            .revoke_binding(&binding.binding_id, "admin")
            .await
            .unwrap();

        assert!(registry.get_binding(&binding.binding_id).await.is_none());
    }
}
