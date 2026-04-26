use allternit_history::HistoryLedger;
use allternit_messaging::{EventEnvelope, MessagingSystem};
use allternit_security_governance::{
    AccessTier, AuditDecision, AuditEvent, AuthContext, GovernanceDecision, GovernanceEngine,
    GovernanceIdentity, IdentityKind,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use uuid::Uuid;

pub mod capability_grants;
pub use capability_grants::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IdentityType {
    HumanUser,
    AgentIdentity,
    ServiceAccount,
    DeviceIdentity,
    SkillPublisherIdentity,
    NodeIdentity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub id: String,
    pub identity_type: IdentityType,
    pub name: String,
    pub tenant_id: String,
    pub created_at: u64,
    pub active: bool,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SafetyTier {
    T0, // Read-only
    T1, // Compute
    T2, // Write
    T3, // Destructive
    T4, // Actuation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub condition: String, // Simple expression language
    pub effect: PolicyEffect,
    pub resource: String, // Resource pattern
    pub actions: Vec<String>,
    pub priority: i32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PolicyEffect {
    Allow,
    Deny,
    AllowWithConstraints,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyDecision {
    pub decision_id: String,
    pub request_id: String,
    pub identity_id: String,
    pub resource: String,
    pub action: String,
    pub decision: PolicyEffect,
    pub reason: String,
    pub timestamp: u64,
    pub constraints: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tier: SafetyTier,
    pub allowed_operations: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum PolicyError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("History error: {0}")]
    History(#[from] allternit_history::HistoryError),
    #[error("Identity not found: {0}")]
    IdentityNotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Invalid policy rule: {0}")]
    InvalidRule(String),
    #[error("Policy evaluation failed: {0}")]
    EvaluationFailed(String),
    #[error("Governance error: {0}")]
    Governance(#[from] allternit_security_governance::GovernanceError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyRequest {
    pub identity_id: String,
    pub resource: String,
    pub action: String,
    pub context: serde_json::Value, // Additional context for evaluation
    pub requested_tier: SafetyTier,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLMContextPolicy {
    pub max_context_size: usize,
    pub max_recursion_depth: u32,
    pub max_context_slice_size: usize,
    pub allowed_models: Vec<String>,
}

impl Default for RLMContextPolicy {
    fn default() -> Self {
        Self {
            max_context_size: 1_000_000,
            max_recursion_depth: 8,
            max_context_slice_size: 65_536,
            allowed_models: vec!["claude-opus".to_string(), "claude-sonnet".to_string()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLMPolicyRequest {
    pub identity_id: String,
    pub tenant_id: String,
    pub resource: String,
    pub action: String,
    pub model_id: String,
    pub mode: String,
    pub context_size: usize,
    pub recursion_depth: u32,
    pub context_slice_size: usize,
    pub session_id: Option<String>,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RLMPolicyContext {
    mode: String,
    model_id: String,
    context_size: usize,
    recursion_depth: u32,
    context_slice_size: usize,
}

pub struct PolicyEngine {
    identities: Arc<RwLock<HashMap<String, Identity>>>,
    permissions: Arc<RwLock<HashMap<String, Permission>>>,
    rules: Arc<RwLock<HashMap<String, PolicyRule>>>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
    governance_engine: Option<Arc<GovernanceEngine>>,
    default_decision: PolicyEffect,
    rlm_policy: Arc<RwLock<RLMContextPolicy>>,
}

impl PolicyEngine {
    pub fn new(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
    ) -> Self {
        PolicyEngine {
            identities: Arc::new(RwLock::new(HashMap::new())),
            permissions: Arc::new(RwLock::new(HashMap::new())),
            rules: Arc::new(RwLock::new(HashMap::new())),
            history_ledger,
            messaging_system,
            governance_engine: None,
            default_decision: PolicyEffect::Deny, // Deny by default
            rlm_policy: Arc::new(RwLock::new(RLMContextPolicy::default())),
        }
    }

    pub fn new_with_governance(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
        governance_engine: Arc<GovernanceEngine>,
    ) -> Self {
        PolicyEngine {
            identities: Arc::new(RwLock::new(HashMap::new())),
            permissions: Arc::new(RwLock::new(HashMap::new())),
            rules: Arc::new(RwLock::new(HashMap::new())),
            history_ledger,
            messaging_system,
            governance_engine: Some(governance_engine),
            default_decision: PolicyEffect::Deny, // Deny by default
            rlm_policy: Arc::new(RwLock::new(RLMContextPolicy::default())),
        }
    }

    pub fn attach_governance(&mut self, governance_engine: Arc<GovernanceEngine>) {
        self.governance_engine = Some(governance_engine);
    }

    pub async fn update_rlm_policy(&self, policy: RLMContextPolicy) {
        let mut rlm_policy = self.rlm_policy.write().await;
        *rlm_policy = policy;
    }

    pub async fn get_rlm_policy(&self) -> RLMContextPolicy {
        let rlm_policy = self.rlm_policy.read().await;
        rlm_policy.clone()
    }

    pub async fn register_identity(&self, mut identity: Identity) -> Result<String, PolicyError> {
        // Set created_at if not provided
        if identity.created_at == 0 {
            identity.created_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
        }

        let identity_id = identity.id.clone();

        // Store in memory
        let mut identities = self.identities.write().await;
        identities.insert(identity_id.clone(), identity.clone());
        drop(identities);

        // Log to history ledger
        let mut history = self.history_ledger.lock().unwrap();
        let content = serde_json::to_value(&identity)?;
        history.append(content)?;
        drop(history);

        if let Some(governance) = &self.governance_engine {
            let governance_identity = GovernanceIdentity {
                identity_id: identity.id.clone(),
                kind: map_identity_kind(&identity.identity_type),
                display_name: identity.name.clone(),
                organization_id: Some(identity.tenant_id.clone()),
                role_ids: identity.roles.clone(),
                group_ids: Vec::new(),
                email: None,
                active: identity.active,
                created_at: identity.created_at,
            };
            governance.register_identity(governance_identity).await?;
        }

        Ok(identity_id)
    }

    pub async fn add_permission(&self, permission: Permission) -> Result<String, PolicyError> {
        let permission_id = permission.id.clone();

        // Store in memory
        let mut permissions = self.permissions.write().await;
        permissions.insert(permission_id.clone(), permission.clone());
        drop(permissions);

        Ok(permission_id)
    }

    pub async fn add_rule(&self, rule: PolicyRule) -> Result<String, PolicyError> {
        // Validate rule
        if rule.id.is_empty() {
            return Err(PolicyError::InvalidRule(
                "Rule ID cannot be empty".to_string(),
            ));
        }

        let rule_id = rule.id.clone();

        // Store in memory
        let mut rules = self.rules.write().await;
        rules.insert(rule_id.clone(), rule.clone());
        drop(rules);

        Ok(rule_id)
    }

    pub async fn evaluate(&self, request: PolicyRequest) -> Result<PolicyDecision, PolicyError> {
        let decision_id = Uuid::new_v4().to_string();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Get identity
        let identities = self.identities.read().await;
        let identity = identities
            .get(&request.identity_id)
            .ok_or_else(|| PolicyError::IdentityNotFound(request.identity_id.clone()))?
            .clone();
        drop(identities);

        // Check if identity is active
        if !identity.active {
            return Ok(PolicyDecision {
                decision_id,
                request_id: Uuid::new_v4().to_string(),
                identity_id: request.identity_id,
                resource: request.resource,
                action: request.action,
                decision: PolicyEffect::Deny,
                reason: "Identity is inactive".to_string(),
                timestamp,
                constraints: None,
            });
        }

        let mut governance_decision: Option<GovernanceDecision> = None;
        let mut governance_denied_reason: Option<String> = None;

        if let Some(governance) = &self.governance_engine {
            let auth_context = request
                .context
                .get("auth")
                .and_then(|value| serde_json::from_value::<AuthContext>(value.clone()).ok());
            let required_scopes = policy_scopes_for_request(&request);
            let access_tier = map_safety_tier(&request.requested_tier);
            let identity_kind = map_identity_kind(&identity.identity_type);

            let decision = governance
                .authorize(
                    &identity.id,
                    identity_kind,
                    &required_scopes,
                    access_tier,
                    auth_context,
                )
                .await?;

            if !decision.allowed {
                governance_denied_reason = Some(decision.reason.clone());
            }
            governance_decision = Some(decision);
        }

        let mut decision = self.default_decision.clone();
        let mut reason = "Default deny policy".to_string();
        let mut constraints: Option<serde_json::Value> = None;

        if let Some(denied_reason) = governance_denied_reason {
            decision = PolicyEffect::Deny;
            reason = format!("Governance denied: {}", denied_reason);
        } else {
            // Evaluate rules in priority order
            let rules = self.rules.read().await;
            let mut applicable_rules: Vec<&PolicyRule> = rules
                .values()
                .filter(|rule| {
                    rule.enabled
                        && (rule.resource == "*" || rule.resource == request.resource)
                        && (rule.actions.is_empty() || rule.actions.contains(&request.action))
                })
                .collect();

            // Sort by priority (higher priority first)
            applicable_rules.sort_by(|a, b| b.priority.cmp(&a.priority));

            if let Some(rule) = applicable_rules.first() {
                // For simplicity, we'll just apply the first matching rule
                // In a real implementation, we'd evaluate the condition expression
                decision = rule.effect.clone();
                reason = rule.description.clone();

                if let PolicyEffect::AllowWithConstraints = &rule.effect {
                    constraints = Some(serde_json::json!({
                        "max_duration": "30m",
                        "resource_limits": {
                            "cpu": "1000m",
                            "memory": "1Gi"
                        }
                    }));
                }
            }

            drop(rules);
        }

        if matches!(decision, PolicyEffect::Allow | PolicyEffect::AllowWithConstraints) {
            if let Some(rlm_value) = request.context.get("rlm") {
                match parse_rlm_policy_context(rlm_value) {
                    Some(rlm_context) => {
                        if let Some(deny_reason) = self.check_rlm_policy(&rlm_context).await {
                            decision = PolicyEffect::Deny;
                            reason = format!("RLM policy denied: {}", deny_reason);
                            constraints = None;
                        }
                    }
                    None => {
                        decision = PolicyEffect::Deny;
                        reason = "RLM policy context invalid".to_string();
                        constraints = None;
                    }
                }
            }
        }

        // Create decision
        let policy_decision = PolicyDecision {
            decision_id: decision_id.clone(),
            request_id: Uuid::new_v4().to_string(),
            identity_id: request.identity_id.clone(),
            resource: request.resource.clone(),
            action: request.action.clone(),
            decision: decision.clone(),
            reason: reason.clone(),
            timestamp,
            constraints,
        };

        // Create event first
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "PolicyDecision".to_string(),
            session_id: request
                .context
                .get("session_id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            tenant_id: identity.tenant_id.clone(),
            actor_id: request.identity_id.clone(),
            role: identity
                .roles
                .first()
                .unwrap_or(&"unknown".to_string())
                .clone(),
            timestamp,
            trace_id: request
                .context
                .get("trace_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            payload: serde_json::json!({
                "decision": policy_decision,
                "request": request
            }),
        };

        // Log to history ledger first
        let mut history = self.history_ledger.lock().unwrap();
        let content = serde_json::to_value(&event)?;
        history.append(content)?;
        drop(history); // Release the lock before spawning async task

        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        if let Some(governance) = &self.governance_engine {
            let audit_decision = map_policy_decision(&decision);
            let access_tier = map_safety_tier(&request.requested_tier);
            let identity_kind = map_identity_kind(&identity.identity_type);
            let proof_id = governance_decision
                .as_ref()
                .and_then(|decision| decision.proof.as_ref().map(|proof| proof.proof_id.clone()));
            let approval_id = governance_decision
                .as_ref()
                .and_then(|decision| decision.approval_id.clone());

            governance
                .record_audit_event(AuditEvent {
                    event_id: Uuid::new_v4().to_string(),
                    identity_id: identity.id.clone(),
                    identity_kind,
                    resource: request.resource.clone(),
                    action: request.action.clone(),
                    tier: access_tier,
                    decision: audit_decision,
                    reason: reason.clone(),
                    proof_id,
                    approval_id,
                    timestamp,
                    session_id: request
                        .context
                        .get("session_id")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string()),
                    tenant_id: Some(identity.tenant_id.clone()),
                    trace_id: request
                        .context
                        .get("trace_id")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string()),
                })
                .await?;
        }

        Ok(policy_decision)
    }

    pub async fn evaluate_rlm_request(
        &self,
        request: RLMPolicyRequest,
    ) -> Result<PolicyDecision, PolicyError> {
        let policy_request = PolicyRequest {
            identity_id: request.identity_id,
            resource: request.resource,
            action: request.action,
            context: serde_json::json!({
                "tenant_id": request.tenant_id,
                "session_id": request.session_id,
                "trace_id": request.trace_id,
                "rlm": {
                    "mode": request.mode,
                    "model_id": request.model_id,
                    "context_size": request.context_size,
                    "recursion_depth": request.recursion_depth,
                    "context_slice_size": request.context_slice_size
                }
            }),
            requested_tier: SafetyTier::T1,
        };

        self.evaluate(policy_request).await
    }

    async fn check_rlm_policy(&self, context: &RLMPolicyContext) -> Option<String> {
        let policy = self.rlm_policy.read().await;

        if context.context_size > policy.max_context_size {
            return Some(format!(
                "context size {} exceeds max {}",
                context.context_size, policy.max_context_size
            ));
        }

        if context.recursion_depth > policy.max_recursion_depth {
            return Some(format!(
                "recursion depth {} exceeds max {}",
                context.recursion_depth, policy.max_recursion_depth
            ));
        }

        if context.context_slice_size > policy.max_context_slice_size {
            return Some(format!(
                "context slice size {} exceeds max {}",
                context.context_slice_size, policy.max_context_slice_size
            ));
        }

        if policy.allowed_models.is_empty() {
            return Some("no allowed models configured".to_string());
        }

        if !policy.allowed_models.iter().any(|model| model == &context.model_id) {
            return Some(format!("model '{}' is not allowed", context.model_id));
        }

        None
    }

    pub async fn is_allowed(&self, request: PolicyRequest) -> Result<bool, PolicyError> {
        let decision = self.evaluate(request).await?;
        match decision.decision {
            PolicyEffect::Allow | PolicyEffect::AllowWithConstraints => Ok(true),
            PolicyEffect::Deny => Ok(false),
        }
    }

    pub async fn get_identity(&self, identity_id: String) -> Option<Identity> {
        let identities = self.identities.read().await;
        identities.get(&identity_id).cloned()
    }

    pub async fn revoke_identity(&self, identity_id: String) -> Result<(), PolicyError> {
        let mut identities = self.identities.write().await;
        if let Some(identity) = identities.get_mut(&identity_id) {
            identity.active = false;
        } else {
            return Err(PolicyError::IdentityNotFound(identity_id));
        }
        drop(identities);

        // Log to history ledger
        let mut history = self.history_ledger.lock().unwrap();
        let content = serde_json::json!({
            "event": "IdentityRevoked",
            "identity_id": identity_id,
            "revoked_at": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        });
        history.append(content)?;

        if let Some(governance) = &self.governance_engine {
            governance.set_identity_active(&identity_id, false).await?;
        }

        Ok(())
    }

    /// Evaluate a capsule load request with capability grants.
    pub async fn list_policies(&self) -> Result<Vec<PolicyRule>, PolicyError> {
        let rules = self.rules.read().await;
        let policy_list: Vec<PolicyRule> = rules.values().cloned().collect();
        drop(rules);

        Ok(policy_list)
    }

    pub async fn get_policy(&self, policy_id: &str) -> Result<Option<PolicyRule>, PolicyError> {
        let rules = self.rules.read().await;
        let policy = rules.get(policy_id).cloned();
        drop(rules);

        Ok(policy)
    }

    pub async fn evaluate_capsule_load(
        &self,
        request: CapsuleLoadRequest,
    ) -> Result<CapsuleLoadDecision, PolicyError> {
        // 1. Verify requester identity exists and is active
        let identities = self.identities.read().await;
        let identity = identities
            .get(&request.requester_identity_id)
            .ok_or_else(|| PolicyError::IdentityNotFound(request.requester_identity_id.clone()))?
            .clone();
        drop(identities);

        if !identity.active {
            return Ok(CapsuleLoadDecision {
                allowed: false,
                grant: None,
                denied_capabilities: request.requested_capabilities.clone(),
                reason: "Requester identity is inactive".to_string(),
            });
        }

        // 2. Check policy rules for each requested capability
        let mut allowed_capabilities = Vec::new();
        let mut denied_capabilities = Vec::new();

        for capability in &request.requested_capabilities {
            // Create a policy request for this capability
            let policy_request = PolicyRequest {
                identity_id: request.requester_identity_id.clone(),
                resource: format!("capsule:{}", request.capsule_id),
                action: capability_to_action(capability),
                context: serde_json::json!({
                    "capability": capability,
                    "capsule_id": request.capsule_id,
                    "tenant_id": request.tenant_id,
                }),
                requested_tier: capability_to_tier(capability),
            };

            // Evaluate the capability request
            if self.is_allowed(policy_request).await? {
                allowed_capabilities.push(capability.clone());
            } else {
                denied_capabilities.push(capability.clone());
            }
        }

        // 3. Build decision
        let allowed = !allowed_capabilities.is_empty();
        let reason = if allowed {
            if denied_capabilities.is_empty() {
                "All requested capabilities granted".to_string()
            } else {
                format!("Partial grant: {} allowed, {} denied", 
                    allowed_capabilities.len(), 
                    denied_capabilities.len())
            }
        } else {
            "No capabilities granted".to_string()
        };

        let decision = CapsuleLoadDecision {
            allowed,
            grant: if allowed {
                Some(WasmCapabilityGrant {
                    grant_id: Uuid::new_v4(),
                    capsule_id: request.capsule_id.clone(),
                    tenant_id: request.tenant_id.clone(),
                    granted_capabilities: allowed_capabilities.clone(),
                    expires_at: None, // No expiration by default
                    granted_by: "policy-engine".to_string(),
                    granted_at: Utc::now(),
                })
            } else {
                None
            },
            denied_capabilities,
            reason,
        };

        // 4. Log decision to history ledger
        let mut history = self.history_ledger.lock().unwrap();
        let content = serde_json::json!({
            "event": "CapsuleLoadDecision",
            "request": request,
            "decision": decision,
            "timestamp": Utc::now(),
        });
        history.append(content)?;
        drop(history);

        // 5. Create and publish event
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "CapsuleLoadDecision".to_string(),
            session_id: "policy-engine".to_string(),
            tenant_id: request.tenant_id.clone(),
            actor_id: request.requester_identity_id.clone(),
            role: identity.roles.first().unwrap_or(&"unknown".to_string()).clone(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            trace_id: None,
            payload: serde_json::json!({
                "capsule_id": request.capsule_id,
                "allowed": decision.allowed,
                "capabilities_granted": decision.grant.as_ref()
                    .map(|g| &g.granted_capabilities)
                    .unwrap_or(&Vec::new()),
                "capabilities_denied": &decision.denied_capabilities,
                "reason": &decision.reason,
            }),
        };

        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            async move {
                let _ = event_bus.publish(event).await;
            }
        });

        Ok(decision)
    }
}

// Helper functions for common policy operations
impl PolicyEngine {
    pub async fn create_default_permissions(&self) -> Result<(), PolicyError> {
        let permissions = vec![
            Permission {
                id: "perm_t0_read".to_string(),
                name: "Read Operations".to_string(),
                description: "Permission to perform read-only operations".to_string(),
                tier: SafetyTier::T0,
                allowed_operations: vec!["read".to_string(), "get".to_string(), "list".to_string()],
            },
            Permission {
                id: "perm_t1_compute".to_string(),
                name: "Compute Operations".to_string(),
                description: "Permission to perform compute operations".to_string(),
                tier: SafetyTier::T1,
                allowed_operations: vec![
                    "compute".to_string(),
                    "calculate".to_string(),
                    "process".to_string(),
                ],
            },
            Permission {
                id: "perm_t2_write".to_string(),
                name: "Write Operations".to_string(),
                description: "Permission to perform write operations".to_string(),
                tier: SafetyTier::T2,
                allowed_operations: vec![
                    "write".to_string(),
                    "update".to_string(),
                    "create".to_string(),
                ],
            },
            Permission {
                id: "perm_t3_destructive".to_string(),
                name: "Destructive Operations".to_string(),
                description: "Permission to perform destructive operations".to_string(),
                tier: SafetyTier::T3,
                allowed_operations: vec![
                    "delete".to_string(),
                    "remove".to_string(),
                    "terminate".to_string(),
                ],
            },
        ];

        for perm in permissions {
            self.add_permission(perm).await?;
        }

        Ok(())
    }

    pub async fn create_default_rules(&self) -> Result<(), PolicyError> {
        // Allow all T0 (read) operations by default for authenticated users
        let read_rule = PolicyRule {
            id: "rule_allow_t0".to_string(),
            name: "Allow T0 Operations".to_string(),
            description: "Allow read-only operations".to_string(),
            condition: "identity.active && request.tier == 'T0'".to_string(),
            effect: PolicyEffect::Allow,
            resource: "*".to_string(),
            actions: vec!["read".to_string(), "get".to_string(), "list".to_string()],
            priority: 100,
            enabled: true,
        };

        // Deny all T3 (destructive) operations by default
        let destructive_rule = PolicyRule {
            id: "rule_deny_t3".to_string(),
            name: "Deny T3 Operations".to_string(),
            description: "Deny destructive operations by default".to_string(),
            condition: "request.tier == 'T3'".to_string(),
            effect: PolicyEffect::Deny,
            resource: "*".to_string(),
            actions: vec![
                "delete".to_string(),
                "remove".to_string(),
                "terminate".to_string(),
            ],
            priority: 200,
            enabled: true,
        };

        self.add_rule(read_rule).await?;
        self.add_rule(destructive_rule).await?;

        Ok(())
    }
}

fn map_identity_kind(identity_type: &IdentityType) -> IdentityKind {
    match identity_type {
        IdentityType::HumanUser => IdentityKind::HumanUser,
        IdentityType::AgentIdentity => IdentityKind::AgentIdentity,
        IdentityType::ServiceAccount => IdentityKind::ServiceAccount,
        IdentityType::DeviceIdentity => IdentityKind::DeviceIdentity,
        IdentityType::SkillPublisherIdentity => IdentityKind::SkillPublisherIdentity,
        IdentityType::NodeIdentity => IdentityKind::NodeIdentity,
    }
}

fn map_safety_tier(tier: &SafetyTier) -> AccessTier {
    match tier {
        SafetyTier::T0 => AccessTier::T0,
        SafetyTier::T1 => AccessTier::T1,
        SafetyTier::T2 => AccessTier::T2,
        SafetyTier::T3 => AccessTier::T3,
        SafetyTier::T4 => AccessTier::T4,
    }
}

fn map_policy_decision(decision: &PolicyEffect) -> AuditDecision {
    match decision {
        PolicyEffect::Allow | PolicyEffect::AllowWithConstraints => AuditDecision::Allowed,
        PolicyEffect::Deny => AuditDecision::Denied,
    }
}

fn policy_scopes_for_request(request: &PolicyRequest) -> Vec<String> {
    vec![
        format!("{}:{}", request.resource, request.action),
        request.action.clone(),
    ]
}

fn parse_rlm_policy_context(value: &serde_json::Value) -> Option<RLMPolicyContext> {
    serde_json::from_value(value.clone()).ok()
}

/// Convert a WASM capability to a policy action string.
fn capability_to_action(capability: &WasmCapability) -> String {
    match capability {
        WasmCapability::FilesystemRead { .. } => "fs_read".to_string(),
        WasmCapability::FilesystemWrite { .. } => "fs_write".to_string(),
        WasmCapability::Network { .. } => "network".to_string(),
        WasmCapability::Environment { .. } => "env_access".to_string(),
        WasmCapability::Clock => "clock".to_string(),
        WasmCapability::Random => "random".to_string(),
        WasmCapability::Stdio => "stdio".to_string(),
        WasmCapability::HttpClient { .. } => "http_client".to_string(),
    }
}

/// Convert a WASM capability to a safety tier.
fn capability_to_tier(capability: &WasmCapability) -> SafetyTier {
    match capability {
        WasmCapability::Clock | WasmCapability::Random | WasmCapability::Stdio => SafetyTier::T0,
        WasmCapability::FilesystemRead { .. } | 
        WasmCapability::Environment { .. } => SafetyTier::T1,
        WasmCapability::HttpClient { .. } => SafetyTier::T2,
        WasmCapability::Network { .. } => SafetyTier::T3,
        WasmCapability::FilesystemWrite { .. } => SafetyTier::T4,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_messaging::MessagingSystem;
    use sqlx::SqlitePool;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_policy_engine() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_policy_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let policy_engine = PolicyEngine::new(history_ledger, messaging_system);

        // Create an identity
        let identity = Identity {
            id: Uuid::new_v4().to_string(),
            identity_type: IdentityType::AgentIdentity,
            name: "test_agent".to_string(),
            tenant_id: "tenant1".to_string(),
            created_at: 0, // Will be set by the engine
            active: true,
            roles: vec!["user".to_string()],
            permissions: vec!["perm_t0_read".to_string()],
        };

        let identity_id = policy_engine.register_identity(identity).await.unwrap();

        // Create default permissions and rules
        policy_engine.create_default_permissions().await.unwrap();
        policy_engine.create_default_rules().await.unwrap();

        // Test a read request (should be allowed by default)
        let request = PolicyRequest {
            identity_id: identity_id.clone(),
            resource: "file1".to_string(),
            action: "read".to_string(),
            context: serde_json::json!({}),
            requested_tier: SafetyTier::T0,
        };

        let decision = policy_engine.evaluate(request).await.unwrap();
        assert!(matches!(decision.decision, PolicyEffect::Allow));

        // Test a destructive request (should be denied by default)
        let request = PolicyRequest {
            identity_id: identity_id.clone(),
            resource: "file1".to_string(),
            action: "delete".to_string(),
            context: serde_json::json!({}),
            requested_tier: SafetyTier::T3,
        };

        let decision = policy_engine.evaluate(request).await.unwrap();
        assert!(matches!(decision.decision, PolicyEffect::Deny));

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[tokio::test]
    async fn test_identity_revocation() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_revoke_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone())
                .await
                .unwrap(),
        );
        let policy_engine = PolicyEngine::new(history_ledger, messaging_system);

        // Create an identity
        let identity = Identity {
            id: Uuid::new_v4().to_string(),
            identity_type: IdentityType::HumanUser,
            name: "test_user".to_string(),
            tenant_id: "tenant1".to_string(),
            created_at: 0,
            active: true,
            roles: vec!["admin".to_string()],
            permissions: vec!["perm_t0_read".to_string()],
        };

        let identity_id = policy_engine.register_identity(identity).await.unwrap();

        // Verify identity is active
        let retrieved_identity = policy_engine
            .get_identity(identity_id.clone())
            .await
            .unwrap();
        assert!(retrieved_identity.active);

        // Revoke the identity
        policy_engine
            .revoke_identity(identity_id.clone())
            .await
            .unwrap();

        // Verify identity is now inactive
        let revoked_identity = policy_engine.get_identity(identity_id).await.unwrap();
        assert!(!revoked_identity.active);

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }
}
