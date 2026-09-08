//! Product-scoped approval grants bound to action hashes (design decision D2).
//!
//! Approvals belong to the Allternit Computer Use product, not to any single
//! engine: the same grant machinery enforces the ACU loop (`/api/aci/run`),
//! the direct computer control routes (`/api/v1/computers/:id/*`), and the
//! capability path (`/tools/execute` `computer_*` tools).
//!
//! A grant is bound to the SHA-256 of a canonical serialization of the
//! specific action payload — not to a run id. Redeeming a grant for an action
//! whose hash differs from the granted hash is denied. Grants are single-use
//! (redeem consumes them), expire after a short TTL, and every redemption
//! attempt is recorded as a receipt for audit.
//!
//! Enforcement lives here and in `aci_safety`; the TS SDK's approval
//! predicates are a UX pre-filter only (see docs/public/aci/index.md).

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Mutex;

/// Default grant TTL when `ALLTERNIT_ACI_GRANT_TTL_SECS` is unset.
const DEFAULT_GRANT_TTL_SECS: u64 = 300;

/// Cap retained receipts so the in-memory audit log cannot grow without bound.
const MAX_RETAINED_RECEIPTS: usize = 10_000;

/// Serialize `value` with object keys sorted recursively so the same logical
/// payload always hashes identically, regardless of how the caller built the
/// JSON (and regardless of serde_json's `preserve_order` feature, which a
/// workspace sibling could enable).
fn canonical_json(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Number(n) => out.push_str(&n.to_string()),
        Value::String(s) => {
            out.push_str(&serde_json::to_string(s).expect("string serialization is infallible"));
        }
        Value::Array(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                canonical_json(item, out);
            }
            out.push(']');
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            out.push('{');
            for (i, key) in keys.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                out.push_str(&serde_json::to_string(key).expect("key serialization is infallible"));
                out.push(':');
                canonical_json(&map[*key], out);
            }
            out.push('}');
        }
    }
}

/// Stable content hash binding a grant (or a denied action) to the exact
/// action payload. Two payloads that differ in any field — including key
/// order — hash differently.
pub fn hash_action_payload(value: &Value) -> String {
    let mut canonical = String::new();
    canonical_json(value, &mut canonical);
    let digest = Sha256::digest(canonical.as_bytes());
    hex::encode(digest)
}

/// Lifecycle state of an action grant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GrantStatus {
    /// Issued, waiting for a human decision via the handoff endpoints.
    Pending,
    /// Human-approved; eligible for redemption exactly once before expiry.
    Approved,
    /// Human-denied; can never be redeemed.
    Denied,
    /// Redeemed against a matching action; never reusable.
    Consumed,
}

/// A grant binding a human approval to one specific action hash.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionGrant {
    pub id: String,
    pub user_id: String,
    pub action_hash: String,
    pub status: GrantStatus,
    pub created_at: String,
    pub expires_at: i64,
}

/// Why a redemption was denied. Serialized into the denial receipt's reason.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GrantDenial {
    UnknownGrant,
    WrongOwner,
    Denied,
    NotApproved,
    Expired,
    HashMismatch,
    AlreadyConsumed,
}

impl GrantDenial {
    pub fn reason(&self) -> &'static str {
        match self {
            Self::UnknownGrant => "unknown approval grant",
            Self::WrongOwner => "grant belongs to a different user",
            Self::Denied => "grant was denied by the approver",
            Self::NotApproved => "grant has not been approved yet",
            Self::Expired => "grant has expired",
            Self::HashMismatch => "action hash does not match the approved action",
            Self::AlreadyConsumed => "grant is single-use and has already been redeemed",
        }
    }
}

/// Immutable audit record of one redemption attempt (allowed or denied).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RedemptionReceipt {
    pub receipt_id: String,
    pub grant_id: String,
    pub user_id: String,
    pub action_hash: String,
    pub outcome: String,
    pub reason: Option<String>,
    pub redeemed_at: String,
}

/// In-memory store for action grants and their redemption receipts. Global to
/// the gateway process (like `aci_routes::ACI_RUN_EVENTS`) so enforcement
/// works without threading new state through `AppState`.
#[derive(Debug, Default)]
pub struct ActionGrantStore {
    grants: Mutex<HashMap<String, ActionGrant>>,
    receipts: Mutex<Vec<RedemptionReceipt>>,
}

/// Grant TTL from `ALLTERNIT_ACI_GRANT_TTL_SECS` (default 300 s).
pub fn grant_ttl_secs() -> u64 {
    std::env::var("ALLTERNIT_ACI_GRANT_TTL_SECS")
        .ok()
        .and_then(|s| s.parse().ok())
        .filter(|n| *n > 0)
        .unwrap_or(DEFAULT_GRANT_TTL_SECS)
}

impl ActionGrantStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Issue a fresh pending grant and return its id.
    pub fn issue(&self, user_id: &str, action_hash: &str) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        self.issue_with_id(&id, user_id, action_hash, grant_ttl_secs());
        id
    }

    /// Issue a grant under a caller-chosen id (used to keep the grant id in
    /// lockstep with the `permission_policy::ApprovalStore` handoff record).
    pub fn issue_with_id(&self, id: &str, user_id: &str, action_hash: &str, ttl_secs: u64) {
        let now = chrono::Utc::now();
        let grant = ActionGrant {
            id: id.to_string(),
            user_id: user_id.to_string(),
            action_hash: action_hash.to_string(),
            status: GrantStatus::Pending,
            created_at: now.to_rfc3339(),
            expires_at: (now.timestamp_millis() + ttl_secs as i64 * 1000),
        };
        let mut grants = self.grants.lock().expect("grant store lock");
        // Bound memory: drop grants that expired more than a day ago.
        let cutoff = now.timestamp_millis() - 86_400_000;
        grants.retain(|_, g| g.expires_at > cutoff);
        grants.insert(id.to_string(), grant);
    }

    pub fn get(&self, id: &str) -> Option<ActionGrant> {
        self.grants.lock().expect("grant store lock").get(id).cloned()
    }

    pub fn approve(&self, id: &str) -> bool {
        self.set_status(id, GrantStatus::Approved)
    }

    pub fn deny(&self, id: &str) -> bool {
        self.set_status(id, GrantStatus::Denied)
    }

    fn set_status(&self, id: &str, status: GrantStatus) -> bool {
        let mut grants = self.grants.lock().expect("grant store lock");
        match grants.get_mut(id) {
            Some(grant) if grant.status == GrantStatus::Pending => {
                grant.status = status;
                true
            }
            _ => false,
        }
    }

    /// Attempt to redeem a grant for `action_hash`. On success the grant is
    /// consumed (single-use) and an `allowed` receipt is recorded; every
    /// failure path records a `denied` receipt with the reason.
    pub fn redeem(
        &self,
        user_id: &str,
        id: &str,
        action_hash: &str,
    ) -> Result<RedemptionReceipt, GrantDenial> {
        let denial = {
            let mut grants = self.grants.lock().expect("grant store lock");
            match grants.get_mut(id) {
                None => Some(GrantDenial::UnknownGrant),
                Some(grant) if grant.user_id != user_id => Some(GrantDenial::WrongOwner),
                Some(grant) if grant.status == GrantStatus::Denied => Some(GrantDenial::Denied),
                Some(grant) if grant.status == GrantStatus::Consumed => {
                    Some(GrantDenial::AlreadyConsumed)
                }
                Some(grant) if grant.status == GrantStatus::Pending => {
                    Some(GrantDenial::NotApproved)
                }
                Some(grant) if chrono::Utc::now().timestamp_millis() > grant.expires_at => {
                    Some(GrantDenial::Expired)
                }
                Some(grant) if grant.action_hash != action_hash => Some(GrantDenial::HashMismatch),
                Some(grant) => {
                    grant.status = GrantStatus::Consumed;
                    None
                }
            }
        };

        let receipt = RedemptionReceipt {
            receipt_id: uuid::Uuid::new_v4().to_string(),
            grant_id: id.to_string(),
            user_id: user_id.to_string(),
            action_hash: action_hash.to_string(),
            outcome: if denial.is_none() { "allowed" } else { "denied" }.to_string(),
            reason: denial.map(|d| d.reason().to_string()),
            redeemed_at: chrono::Utc::now().to_rfc3339(),
        };
        let mut receipts = self.receipts.lock().expect("receipt lock");
        if receipts.len() >= MAX_RETAINED_RECEIPTS {
            let drop = receipts.len() - MAX_RETAINED_RECEIPTS + 1;
            receipts.drain(0..drop);
        }
        receipts.push(receipt.clone());

        match denial {
            None => Ok(receipt),
            Some(d) => Err(d),
        }
    }

    /// Audit trail of redemption attempts, oldest first.
    pub fn receipts(&self) -> Vec<RedemptionReceipt> {
        self.receipts.lock().expect("receipt lock").clone()
    }
}

/// Process-wide grant store shared by every computer-use entry route.
pub static GRANTS: Lazy<ActionGrantStore> = Lazy::new(ActionGrantStore::new);

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn hash_is_canonical_across_key_order_and_absent_fields() {
        let a = json!({"route": "computer.shell", "command": ["echo", "hi"], "flags": null});
        let b = json!({"command": ["echo", "hi"], "flags": null, "route": "computer.shell"});
        assert_eq!(hash_action_payload(&a), hash_action_payload(&b));

        // Absent vs explicitly-null fields are different payloads.
        let c = json!({"route": "computer.shell", "command": ["echo", "hi"]});
        assert_ne!(hash_action_payload(&a), hash_action_payload(&c));

        // Any field change changes the hash.
        let d = json!({"route": "computer.shell", "command": ["echo", "bye"], "flags": null});
        assert_ne!(hash_action_payload(&a), hash_action_payload(&d));
    }

    #[test]
    fn grant_lifecycle_approve_redeem_consume() {
        let store = ActionGrantStore::new();
        let hash = hash_action_payload(&json!({"route": "aci.run", "goal": "go"}));
        let id = uuid::Uuid::new_v4().to_string();
        store.issue_with_id(&id, "user-1", &hash, 60);

        // Pending grants cannot be redeemed.
        assert_eq!(
            store.redeem("user-1", &id, &hash),
            Err(GrantDenial::NotApproved)
        );

        assert!(store.approve(&id));
        // Approval is not double-applicable after consumption, but approve on
        // an approved (non-pending) grant is a no-op returning false.
        assert!(store.redeem("user-1", &id, &hash).is_ok());
        assert_eq!(
            store.redeem("user-1", &id, &hash),
            Err(GrantDenial::AlreadyConsumed)
        );
        assert_eq!(store.get(&id).unwrap().status, GrantStatus::Consumed);
    }

    #[test]
    fn redeem_denies_hash_mismatch_wrong_user_and_denied_grants() {
        let store = ActionGrantStore::new();
        let hash_a = hash_action_payload(&json!({"a": 1}));
        let hash_b = hash_action_payload(&json!({"b": 2}));
        let id = store.issue("user-1", &hash_a);
        assert!(store.approve(&id));

        assert_eq!(store.redeem("user-2", &id, &hash_a), Err(GrantDenial::WrongOwner));
        assert_eq!(store.redeem("user-1", &id, &hash_b), Err(GrantDenial::HashMismatch));

        let id2 = store.issue("user-1", &hash_a);
        assert!(store.deny(&id2));
        assert_eq!(store.redeem("user-1", &id2, &hash_a), Err(GrantDenial::Denied));

        assert!(store.redeem("user-1", &id, &hash_a).is_ok());
    }

    #[test]
    fn expired_grants_are_denied() {
        let store = ActionGrantStore::new();
        let hash = hash_action_payload(&json!({"a": 1}));
        // Negative TTL so the grant is already expired at issue time.
        let id = uuid::Uuid::new_v4().to_string();
        store.issue_with_id(&id, "user-1", &hash, 0);
        let mut grant = store.get(&id).unwrap();
        grant.expires_at = chrono::Utc::now().timestamp_millis() - 1;
        store.grants.lock().unwrap().insert(id.clone(), grant);
        assert!(store.approve(&id));
        assert_eq!(store.redeem("user-1", &id, &hash), Err(GrantDenial::Expired));
    }

    #[test]
    fn every_redemption_attempt_is_receipted() {
        let store = ActionGrantStore::new();
        let hash = hash_action_payload(&json!({"a": 1}));
        let id = store.issue("user-1", &hash);
        assert!(store.approve(&id));

        let before = store.receipts().len();
        assert!(store.redeem("user-1", &id, &hash).is_ok());
        assert_eq!(
            store.redeem("user-1", &id, &hash),
            Err(GrantDenial::AlreadyConsumed)
        );
        let receipts = store.receipts();
        assert_eq!(receipts.len(), before + 2);
        assert_eq!(receipts[receipts.len() - 2].outcome, "allowed");
        assert_eq!(receipts[receipts.len() - 1].outcome, "denied");
        assert!(receipts[receipts.len() - 1]
            .reason
            .as_deref()
            .unwrap()
            .contains("single-use"));
    }
}
