use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use uuid::Uuid;

use a2rchitech_history::{HistoryError, HistoryLedger};
use a2rchitech_messaging::{EventEnvelope, MessagingError, MessagingSystem};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IdentityKind {
    HumanUser,
    AgentIdentity,
    ServiceAccount,
    DeviceIdentity,
    SkillPublisherIdentity,
    NodeIdentity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceIdentity {
    pub identity_id: String,
    pub kind: IdentityKind,
    pub display_name: String,
    pub organization_id: Option<String>,
    pub role_ids: Vec<String>,
    pub group_ids: Vec<String>,
    pub email: Option<String>,
    pub active: bool,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organization {
    pub organization_id: String,
    pub name: String,
    pub description: String,
    pub created_at: u64,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub role_id: String,
    pub name: String,
    pub description: String,
    pub scopes: Vec<String>,
    pub max_tier: AccessTier,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub group_id: String,
    pub name: String,
    pub description: String,
    pub role_ids: Vec<String>,
    pub member_ids: Vec<String>,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceIdentity {
    pub service_id: String,
    pub display_name: String,
    pub certificate_fingerprint: String,
    pub allowed_scopes: Vec<String>,
    pub created_at: u64,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AccessTier {
    T0,
    T1,
    T2,
    T3,
    T4,
}

impl AccessTier {
    pub fn level(&self) -> u8 {
        match self {
            AccessTier::T0 => 0,
            AccessTier::T1 => 1,
            AccessTier::T2 => 2,
            AccessTier::T3 => 3,
            AccessTier::T4 => 4,
        }
    }
}

impl PartialOrd for AccessTier {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.level().cmp(&other.level()))
    }
}

impl Ord for AccessTier {
    fn cmp(&self, other: &Self) -> Ordering {
        self.level().cmp(&other.level())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopedToken {
    pub token_id: String,
    pub token_hash: String,
    pub identity_id: String,
    pub scopes: Vec<String>,
    pub issued_at: u64,
    pub expires_at: u64,
    pub last_used_at: Option<u64>,
    pub revoked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityProof {
    pub proof_id: String,
    pub identity_id: String,
    pub token_id: String,
    pub scopes: Vec<String>,
    pub issued_at: u64,
    pub expires_at: u64,
    pub verified_at: u64,
    pub mtls_verified: bool,
    pub approval_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AuthContext {
    pub token: Option<String>,
    pub approval_id: Option<String>,
    pub mtls_peer_id: Option<String>,
    pub mtls_fingerprint: Option<String>,
    pub source: Option<String>,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwoManRulePolicy {
    pub enabled: bool,
    pub tier_threshold: AccessTier,
    pub approval_ttl_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub approval_id: String,
    pub requested_by: String,
    pub resource: String,
    pub action: String,
    pub tier: AccessTier,
    pub reason: String,
    pub status: ApprovalStatus,
    pub created_at: u64,
    pub expires_at: u64,
    pub approved_by: Option<String>,
    pub approved_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditDecision {
    Allowed,
    Denied,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub event_id: String,
    pub identity_id: String,
    pub identity_kind: IdentityKind,
    pub resource: String,
    pub action: String,
    pub tier: AccessTier,
    pub decision: AuditDecision,
    pub reason: String,
    pub proof_id: Option<String>,
    pub approval_id: Option<String>,
    pub timestamp: u64,
    pub session_id: Option<String>,
    pub tenant_id: Option<String>,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceDecision {
    pub allowed: bool,
    pub reason: String,
    pub proof: Option<IdentityProof>,
    pub approval_id: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum GovernanceError {
    #[error("History error: {0}")]
    History(#[from] HistoryError),
    #[error("Messaging error: {0}")]
    Messaging(#[from] MessagingError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Identity not found: {0}")]
    IdentityNotFound(String),
    #[error("Role not found: {0}")]
    RoleNotFound(String),
    #[error("Service identity not found: {0}")]
    ServiceIdentityNotFound(String),
    #[error("Token not found")]
    TokenNotFound,
    #[error("Token expired")]
    TokenExpired,
    #[error("Token revoked")]
    TokenRevoked,
    #[error("Scope denied: {0}")]
    ScopeDenied(String),
    #[error("Tier denied: {0}")]
    TierDenied(String),
    #[error("Approval required: {0}")]
    ApprovalRequired(String),
    #[error("Approval invalid: {0}")]
    ApprovalInvalid(String),
    #[error("mTLS required: {0}")]
    MtlsRequired(String),
    #[error("mTLS invalid: {0}")]
    MtlsInvalid(String),
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
}

pub struct GovernanceEngine {
    identities: Arc<RwLock<HashMap<String, GovernanceIdentity>>>,
    organizations: Arc<RwLock<HashMap<String, Organization>>>,
    roles: Arc<RwLock<HashMap<String, Role>>>,
    groups: Arc<RwLock<HashMap<String, Group>>>,
    service_identities: Arc<RwLock<HashMap<String, ServiceIdentity>>>,
    tokens: Arc<RwLock<HashMap<String, ScopedToken>>>,
    approvals: Arc<RwLock<HashMap<String, ApprovalRequest>>>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
    two_man_rule: Arc<RwLock<TwoManRulePolicy>>,
}

impl GovernanceEngine {
    pub fn new(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
    ) -> Self {
        GovernanceEngine {
            identities: Arc::new(RwLock::new(HashMap::new())),
            organizations: Arc::new(RwLock::new(HashMap::new())),
            roles: Arc::new(RwLock::new(HashMap::new())),
            groups: Arc::new(RwLock::new(HashMap::new())),
            service_identities: Arc::new(RwLock::new(HashMap::new())),
            tokens: Arc::new(RwLock::new(HashMap::new())),
            approvals: Arc::new(RwLock::new(HashMap::new())),
            history_ledger,
            messaging_system,
            two_man_rule: Arc::new(RwLock::new(TwoManRulePolicy {
                enabled: false,
                tier_threshold: AccessTier::T3,
                approval_ttl_seconds: 900,
            })),
        }
    }

    pub async fn set_two_man_rule(&self, policy: TwoManRulePolicy) {
        let mut config = self.two_man_rule.write().await;
        *config = policy;
    }

    pub async fn register_identity(
        &self,
        identity: GovernanceIdentity,
    ) -> Result<String, GovernanceError> {
        let identity_id = identity.identity_id.clone();
        let mut identities = self.identities.write().await;
        identities.insert(identity_id.clone(), identity);
        Ok(identity_id)
    }

    pub async fn set_identity_active(
        &self,
        identity_id: &str,
        active: bool,
    ) -> Result<(), GovernanceError> {
        let mut identities = self.identities.write().await;
        let identity = identities
            .get_mut(identity_id)
            .ok_or_else(|| GovernanceError::IdentityNotFound(identity_id.to_string()))?;
        identity.active = active;
        Ok(())
    }

    pub async fn register_organization(
        &self,
        organization: Organization,
    ) -> Result<String, GovernanceError> {
        let org_id = organization.organization_id.clone();
        let mut orgs = self.organizations.write().await;
        orgs.insert(org_id.clone(), organization);
        Ok(org_id)
    }

    pub async fn register_role(&self, role: Role) -> Result<String, GovernanceError> {
        let role_id = role.role_id.clone();
        let mut roles = self.roles.write().await;
        roles.insert(role_id.clone(), role);
        Ok(role_id)
    }

    pub async fn register_group(&self, group: Group) -> Result<String, GovernanceError> {
        let group_id = group.group_id.clone();
        let mut groups = self.groups.write().await;
        groups.insert(group_id.clone(), group);
        Ok(group_id)
    }

    pub async fn register_service_identity(
        &self,
        service_identity: ServiceIdentity,
    ) -> Result<String, GovernanceError> {
        let service_id = service_identity.service_id.clone();
        let mut services = self.service_identities.write().await;
        services.insert(service_id.clone(), service_identity);
        Ok(service_id)
    }

    pub async fn issue_token(
        &self,
        identity_id: &str,
        scopes: Vec<String>,
        ttl_seconds: u64,
    ) -> Result<String, GovernanceError> {
        let identity = self.get_identity(identity_id).await?;
        let allowed_scopes = self.allowed_scopes_for_identity(&identity).await?;

        for scope in &scopes {
            if !scope_allowed(scope, &allowed_scopes) {
                return Err(GovernanceError::ScopeDenied(scope.clone()));
            }
        }

        let token_id = Uuid::new_v4().to_string();
        let raw_token = Uuid::new_v4().to_string();
        let issued_at = current_timestamp();
        let expires_at = issued_at.saturating_add(ttl_seconds);

        let token_hash = hash_token(&raw_token);
        let token = ScopedToken {
            token_id: token_id.clone(),
            token_hash,
            identity_id: identity_id.to_string(),
            scopes,
            issued_at,
            expires_at,
            last_used_at: None,
            revoked: false,
        };

        let mut tokens = self.tokens.write().await;
        tokens.insert(token_id.clone(), token);

        self.record_audit_event(AuditEvent {
            event_id: Uuid::new_v4().to_string(),
            identity_id: identity_id.to_string(),
            identity_kind: identity.kind.clone(),
            resource: "token".to_string(),
            action: "issue".to_string(),
            tier: AccessTier::T2,
            decision: AuditDecision::Allowed,
            reason: "Token issued".to_string(),
            proof_id: None,
            approval_id: None,
            timestamp: issued_at,
            session_id: None,
            tenant_id: identity.organization_id.clone(),
            trace_id: None,
        })
        .await?;

        Ok(raw_token)
    }

    pub async fn revoke_token(&self, token_id: &str, reason: &str) -> Result<(), GovernanceError> {
        let mut tokens = self.tokens.write().await;
        let token = tokens
            .get_mut(token_id)
            .ok_or(GovernanceError::TokenNotFound)?;
        let identity_id = token.identity_id.clone();
        token.revoked = true;
        drop(tokens);

        let identity_kind = match self.get_identity(&identity_id).await {
            Ok(identity) => identity.kind,
            Err(_) => IdentityKind::ServiceAccount,
        };

        self.record_audit_event(AuditEvent {
            event_id: Uuid::new_v4().to_string(),
            identity_id,
            identity_kind,
            resource: "token".to_string(),
            action: "revoke".to_string(),
            tier: AccessTier::T2,
            decision: AuditDecision::Allowed,
            reason: reason.to_string(),
            proof_id: None,
            approval_id: None,
            timestamp: current_timestamp(),
            session_id: None,
            tenant_id: None,
            trace_id: None,
        })
        .await?;

        Ok(())
    }

    pub async fn create_approval(
        &self,
        requested_by: String,
        resource: String,
        action: String,
        tier: AccessTier,
        reason: String,
    ) -> Result<String, GovernanceError> {
        let approval_id = Uuid::new_v4().to_string();
        let now = current_timestamp();
        let ttl = self.two_man_rule.read().await.approval_ttl_seconds;
        let approval = ApprovalRequest {
            approval_id: approval_id.clone(),
            requested_by,
            resource,
            action,
            tier,
            reason,
            status: ApprovalStatus::Pending,
            created_at: now,
            expires_at: now.saturating_add(ttl),
            approved_by: None,
            approved_at: None,
        };

        let mut approvals = self.approvals.write().await;
        approvals.insert(approval_id.clone(), approval);

        Ok(approval_id)
    }

    pub async fn approve_request(
        &self,
        approval_id: &str,
        approver_id: &str,
    ) -> Result<(), GovernanceError> {
        let mut approvals = self.approvals.write().await;
        let approval = approvals
            .get_mut(approval_id)
            .ok_or_else(|| GovernanceError::ApprovalInvalid("Approval not found".to_string()))?;

        if approval.requested_by == approver_id {
            return Err(GovernanceError::ApprovalInvalid(
                "Approver must be different from requester".to_string(),
            ));
        }

        if approval.expires_at <= current_timestamp() {
            approval.status = ApprovalStatus::Expired;
            return Err(GovernanceError::ApprovalInvalid(
                "Approval expired".to_string(),
            ));
        }

        approval.status = ApprovalStatus::Approved;
        approval.approved_by = Some(approver_id.to_string());
        approval.approved_at = Some(current_timestamp());

        Ok(())
    }

    pub async fn authorize(
        &self,
        identity_id: &str,
        identity_kind: IdentityKind,
        required_scopes: &[String],
        requested_tier: AccessTier,
        auth_context: Option<AuthContext>,
    ) -> Result<GovernanceDecision, GovernanceError> {
        let identity = match self.get_identity(identity_id).await {
            Ok(identity) => identity,
            Err(_) => {
                if requested_tier >= AccessTier::T3 {
                    return Ok(GovernanceDecision {
                        allowed: false,
                        reason: "Identity missing for privileged request".to_string(),
                        proof: None,
                        approval_id: None,
                    });
                }

                return Ok(GovernanceDecision {
                    allowed: true,
                    reason: "Identity not registered in governance; allowed for low tier"
                        .to_string(),
                    proof: None,
                    approval_id: None,
                });
            }
        };

        if !identity.active {
            return Ok(GovernanceDecision {
                allowed: false,
                reason: "Identity inactive".to_string(),
                proof: None,
                approval_id: None,
            });
        }

        let allowed_scopes = self.allowed_scopes_for_identity(&identity).await?;
        let max_tier = self.max_tier_for_identity(&identity).await?;
        if requested_tier > max_tier {
            return Ok(GovernanceDecision {
                allowed: false,
                reason: format!(
                    "Requested tier {:?} exceeds allowed tier {:?}",
                    requested_tier, max_tier
                ),
                proof: None,
                approval_id: None,
            });
        }

        for scope in required_scopes {
            if !scope_allowed(scope, &allowed_scopes) {
                return Ok(GovernanceDecision {
                    allowed: false,
                    reason: format!("Scope denied: {}", scope),
                    proof: None,
                    approval_id: None,
                });
            }
        }

        let auth_context = auth_context.unwrap_or_default();
        let mut approval_id = None;

        let two_man_rule = self.two_man_rule.read().await.clone();
        if two_man_rule.enabled && requested_tier >= two_man_rule.tier_threshold {
            let provided_approval = auth_context.approval_id.clone().ok_or_else(|| {
                GovernanceError::ApprovalRequired("Approval ID required".to_string())
            })?;

            let approval = self
                .validate_approval(&provided_approval, identity_id)
                .await?;
            approval_id = Some(approval.approval_id);
        }

        let mut mtls_verified = false;
        if requires_mtls(&identity_kind) {
            let peer_id = auth_context.mtls_peer_id.clone().ok_or_else(|| {
                GovernanceError::MtlsRequired("mTLS peer id required".to_string())
            })?;
            let fingerprint = auth_context.mtls_fingerprint.clone().ok_or_else(|| {
                GovernanceError::MtlsRequired("mTLS fingerprint required".to_string())
            })?;
            self.verify_mtls(&peer_id, &fingerprint).await?;
            mtls_verified = true;
        }

        let proof = if let Some(token) = auth_context.token {
            Some(
                self.verify_token(
                    identity_id,
                    &token,
                    required_scopes,
                    mtls_verified,
                    approval_id.clone(),
                )
                .await?,
            )
        } else if requested_tier >= AccessTier::T3 {
            return Ok(GovernanceDecision {
                allowed: false,
                reason: "Scoped token required for destructive tiers".to_string(),
                proof: None,
                approval_id,
            });
        } else {
            None
        };

        Ok(GovernanceDecision {
            allowed: true,
            reason: "Governance checks passed".to_string(),
            proof,
            approval_id,
        })
    }

    pub async fn record_audit_event(&self, event: AuditEvent) -> Result<(), GovernanceError> {
        let mut history = self.history_ledger.lock().unwrap();
        let content = serde_json::to_value(&event)?;
        history.append(content)?;
        drop(history);

        let envelope = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "GovernanceAuditEvent".to_string(),
            session_id: event
                .session_id
                .clone()
                .unwrap_or_else(|| "unknown".to_string()),
            tenant_id: event
                .tenant_id
                .clone()
                .unwrap_or_else(|| "unknown".to_string()),
            actor_id: event.identity_id.clone(),
            role: format!("{:?}", event.identity_kind),
            timestamp: event.timestamp,
            trace_id: event.trace_id.clone(),
            payload: serde_json::to_value(&event)?,
        };

        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = envelope.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        Ok(())
    }

    async fn verify_token(
        &self,
        identity_id: &str,
        raw_token: &str,
        required_scopes: &[String],
        mtls_verified: bool,
        approval_id: Option<String>,
    ) -> Result<IdentityProof, GovernanceError> {
        let token_hash = hash_token(raw_token);
        let now = current_timestamp();
        let mut tokens = self.tokens.write().await;

        let token = tokens
            .values_mut()
            .find(|token| token.token_hash == token_hash && token.identity_id == identity_id)
            .ok_or(GovernanceError::TokenNotFound)?;

        if token.revoked {
            return Err(GovernanceError::TokenRevoked);
        }

        if token.expires_at <= now {
            return Err(GovernanceError::TokenExpired);
        }

        for scope in required_scopes {
            if !scope_allowed(scope, &token.scopes) {
                return Err(GovernanceError::ScopeDenied(scope.clone()));
            }
        }

        token.last_used_at = Some(now);

        Ok(IdentityProof {
            proof_id: Uuid::new_v4().to_string(),
            identity_id: identity_id.to_string(),
            token_id: token.token_id.clone(),
            scopes: token.scopes.clone(),
            issued_at: token.issued_at,
            expires_at: token.expires_at,
            verified_at: now,
            mtls_verified,
            approval_id,
        })
    }

    async fn get_identity(&self, identity_id: &str) -> Result<GovernanceIdentity, GovernanceError> {
        let identities = self.identities.read().await;
        identities
            .get(identity_id)
            .cloned()
            .ok_or_else(|| GovernanceError::IdentityNotFound(identity_id.to_string()))
    }

    async fn allowed_scopes_for_identity(
        &self,
        identity: &GovernanceIdentity,
    ) -> Result<Vec<String>, GovernanceError> {
        let role_ids = self.collect_role_ids(identity).await;
        if role_ids.is_empty() {
            return Ok(vec!["*".to_string()]);
        }

        let roles = self.roles.read().await;
        let mut scopes = Vec::new();
        for role_id in role_ids {
            if let Some(role) = roles.get(&role_id) {
                scopes.extend(role.scopes.clone());
            }
        }

        Ok(scopes)
    }

    async fn max_tier_for_identity(
        &self,
        identity: &GovernanceIdentity,
    ) -> Result<AccessTier, GovernanceError> {
        let role_ids = self.collect_role_ids(identity).await;
        if role_ids.is_empty() {
            return Ok(AccessTier::T1);
        }

        let roles = self.roles.read().await;
        let mut max_tier = AccessTier::T0;
        for role_id in role_ids {
            if let Some(role) = roles.get(&role_id) {
                if role.max_tier > max_tier {
                    max_tier = role.max_tier.clone();
                }
            }
        }

        Ok(max_tier)
    }

    async fn collect_role_ids(&self, identity: &GovernanceIdentity) -> Vec<String> {
        let mut role_ids: HashSet<String> = identity.role_ids.iter().cloned().collect();
        let groups = self.groups.read().await;
        for group_id in &identity.group_ids {
            if let Some(group) = groups.get(group_id) {
                for role_id in &group.role_ids {
                    role_ids.insert(role_id.clone());
                }
            }
        }

        role_ids.into_iter().collect()
    }

    async fn validate_approval(
        &self,
        approval_id: &str,
        requester_id: &str,
    ) -> Result<ApprovalRequest, GovernanceError> {
        let approvals = self.approvals.read().await;
        let approval = approvals
            .get(approval_id)
            .cloned()
            .ok_or_else(|| GovernanceError::ApprovalInvalid("Approval not found".to_string()))?;

        if approval.requested_by != requester_id {
            return Err(GovernanceError::ApprovalInvalid(
                "Approval does not match requester".to_string(),
            ));
        }

        if approval.expires_at <= current_timestamp() {
            return Err(GovernanceError::ApprovalInvalid(
                "Approval expired".to_string(),
            ));
        }

        if !matches!(approval.status, ApprovalStatus::Approved) {
            return Err(GovernanceError::ApprovalInvalid(
                "Approval not approved".to_string(),
            ));
        }

        Ok(approval)
    }

    async fn verify_mtls(&self, peer_id: &str, fingerprint: &str) -> Result<(), GovernanceError> {
        let services = self.service_identities.read().await;
        let service = services
            .get(peer_id)
            .ok_or_else(|| GovernanceError::ServiceIdentityNotFound(peer_id.to_string()))?;

        if !service.active {
            return Err(GovernanceError::MtlsInvalid("Service inactive".to_string()));
        }

        if service.certificate_fingerprint != fingerprint {
            return Err(GovernanceError::MtlsInvalid(
                "Fingerprint mismatch".to_string(),
            ));
        }

        Ok(())
    }
}

fn requires_mtls(identity_kind: &IdentityKind) -> bool {
    matches!(
        identity_kind,
        IdentityKind::ServiceAccount | IdentityKind::DeviceIdentity
    )
}

fn scope_allowed(requested: &str, allowed_scopes: &[String]) -> bool {
    for allowed in allowed_scopes {
        if allowed == "*" {
            return true;
        }
        if allowed.ends_with('*') {
            let prefix = allowed.trim_end_matches('*');
            if requested.starts_with(prefix) {
                return true;
            }
        }
        if allowed == requested {
            return true;
        }
    }

    false
}

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;
    use tempfile::NamedTempFile;

    async fn setup_engine() -> GovernanceEngine {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_governance_{}.jsonl", Uuid::new_v4());
        let history = Arc::new(Mutex::new(HistoryLedger::new(&temp_path).unwrap()));
        let messaging = Arc::new(
            MessagingSystem::new_with_storage(history.clone(), pool)
                .await
                .unwrap(),
        );
        GovernanceEngine::new(history, messaging)
    }

    #[tokio::test]
    async fn token_issue_and_verify() {
        let engine = setup_engine().await;
        let identity = GovernanceIdentity {
            identity_id: "user-1".to_string(),
            kind: IdentityKind::HumanUser,
            display_name: "Test User".to_string(),
            organization_id: Some("org-1".to_string()),
            role_ids: vec![],
            group_ids: vec![],
            email: Some("test@example.com".to_string()),
            active: true,
            created_at: current_timestamp(),
        };

        engine.register_identity(identity).await.unwrap();
        let token = engine
            .issue_token("user-1", vec!["tool:execute".to_string()], 3600)
            .await
            .unwrap();

        let decision = engine
            .authorize(
                "user-1",
                IdentityKind::HumanUser,
                &["tool:execute".to_string()],
                AccessTier::T1,
                Some(AuthContext {
                    token: Some(token),
                    ..Default::default()
                }),
            )
            .await
            .unwrap();

        assert!(decision.allowed);
        assert!(decision.proof.is_some());
    }
}
