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
///
/// Aligned with the ACU planning loop's approval timeout
/// (`_DIRECT_APPROVAL_TIMEOUT_SECONDS = 120` in
/// `domains/computer-use/core/gateway/computer_use_router.py`): a Rust grant
/// must never outlive the Python `approval_future` it authorizes, so the
/// unified TTL for the product is 120 seconds. Override via env only when the
/// ACU side changes in lockstep.
const DEFAULT_GRANT_TTL_SECS: u64 = 120;

/// Cap retained receipts so the in-memory audit log cannot grow without bound.
const MAX_RETAINED_RECEIPTS: usize = 10_000;

/// Root directory for computer-use gateway state that must survive restarts:
/// approval receipts (JSONL), per-run event-buffer snapshots, and the VM pool
/// state file. Override with `ALLTERNIT_COMPUTER_USE_DIR` (used by tests);
/// defaults to `~/.allternit/computer-use`.
pub fn computer_use_dir() -> std::path::PathBuf {
    if let Ok(dir) = std::env::var("ALLTERNIT_COMPUTER_USE_DIR") {
        if !dir.is_empty() {
            return std::path::PathBuf::from(dir);
        }
    }
    dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".allternit")
        .join("computer-use")
}

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

/// One user-facing approval status, regardless of where the approval lives.
/// This is the vocabulary of `GET /api/aci/approvals/{id}`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnifiedApprovalStatus {
    /// A human decision has not been recorded yet (or the ACU run is still in
    /// `awaiting_approval`).
    Pending,
    /// Approved and still redeemable / actionable.
    Approved,
    /// Denied by the approver.
    Denied,
    /// The decision window lapsed (grant TTL, or the Python approval_future
    /// timed out after 120 s).
    Expired,
    /// Approved and already redeemed (hash grants are single-use).
    Consumed,
}

impl UnifiedApprovalStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Approved => "approved",
            Self::Denied => "denied",
            Self::Expired => "expired",
            Self::Consumed => "consumed",
        }
    }
}

/// Derive the unified status for a hash grant. Expiry dominates for pending
/// and approved grants: a grant past `expires_at` is reported `expired`, and
/// redeem will deny it the same way.
pub fn unified_status(grant: &ActionGrant, now_millis: i64) -> UnifiedApprovalStatus {
    let expired = now_millis > grant.expires_at;
    match grant.status {
        GrantStatus::Consumed => UnifiedApprovalStatus::Consumed,
        GrantStatus::Denied => UnifiedApprovalStatus::Denied,
        GrantStatus::Pending => {
            if expired {
                UnifiedApprovalStatus::Expired
            } else {
                UnifiedApprovalStatus::Pending
            }
        }
        GrantStatus::Approved => {
            if expired {
                UnifiedApprovalStatus::Expired
            } else {
                UnifiedApprovalStatus::Approved
            }
        }
    }
}

/// In-memory store for action grants and their redemption receipts, with an
/// optional append-only JSONL audit trail on disk. Global to the gateway
/// process (like `aci_routes::ACI_RUN_EVENTS`) so enforcement works without
/// threading new state through `AppState`.
///
/// When `receipts_path` is set, every receipt is appended to the JSONL file
/// and the file is (re)loaded at construction, so the audit trail survives a
/// gateway restart. Grants themselves stay in-memory: they are short-lived
/// (TTL ≤ the unified 120 s) and their backing Python `approval_future` dies
/// with the ACU process anyway.
#[derive(Debug, Default)]
pub struct ActionGrantStore {
    grants: Mutex<HashMap<String, ActionGrant>>,
    receipts: Mutex<Vec<RedemptionReceipt>>,
    receipts_path: Option<std::path::PathBuf>,
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

    /// A store that persists every receipt as a JSON line appended to
    /// `receipts_path`, reloading any previously recorded receipts from that
    /// file. The parent directory is created if needed.
    pub fn new_persisted(receipts_path: std::path::PathBuf) -> Self {
        let store = Self {
            grants: Mutex::new(HashMap::new()),
            receipts: Mutex::new(Vec::new()),
            receipts_path: Some(receipts_path),
        };
        store.load_receipts();
        store
    }

    /// Read the JSONL audit trail back into memory (boot-time restore).
    fn load_receipts(&self) {
        let Some(path) = &self.receipts_path else {
            return;
        };
        let Ok(text) = std::fs::read_to_string(path) else {
            return; // missing or unreadable file == empty trail
        };
        let mut receipts = self.receipts.lock().expect("receipt lock");
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            match serde_json::from_str::<RedemptionReceipt>(line) {
                Ok(receipt) => receipts.push(receipt),
                // The audit trail must never take the gateway down; skip
                // corrupt lines but keep the rest.
                Err(e) => tracing::warn!("receipts reload: skipping unparseable line: {e}"),
            }
        }
        let overflow = receipts.len().saturating_sub(MAX_RETAINED_RECEIPTS);
        if overflow > 0 {
            receipts.drain(0..overflow);
        }
    }

    /// Append one receipt to the JSONL audit trail. Best-effort: an I/O
    /// failure is logged, never propagated — the in-memory record is
    /// authoritative for enforcement, the file is the audit trail.
    fn persist_receipt(&self, receipt: &RedemptionReceipt) {
        let Some(path) = &self.receipts_path else {
            return;
        };
        let Ok(line) = serde_json::to_string(receipt) else {
            return;
        };
        if let Some(parent) = path.parent() {
            if std::fs::create_dir_all(parent).is_err() {
                return;
            }
        }
        use std::io::Write as _;
        match std::fs::OpenOptions::new().create(true).append(true).open(path) {
            Ok(mut file) => {
                if let Err(e) = writeln!(file, "{line}") {
                    tracing::warn!("receipts persist: write failed: {e}");
                }
            }
            Err(e) => tracing::warn!("receipts persist: open failed: {e}"),
        }
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
        drop(receipts);
        self.persist_receipt(&receipt);

        match denial {
            None => Ok(receipt),
            Some(d) => Err(d),
        }
    }

    /// Audit trail of redemption attempts, oldest first.
    pub fn receipts(&self) -> Vec<RedemptionReceipt> {
        self.receipts.lock().expect("receipt lock").clone()
    }

    /// Test-only: force a grant's expiry into the past so the expired-redeem
    /// path is exercisable without sleeping through a real TTL.
    #[cfg(test)]
    pub fn set_expires_for_test(&self, id: &str, expires_at: i64) {
        let mut grants = self.grants.lock().expect("grant store lock");
        if let Some(grant) = grants.get_mut(id) {
            grant.expires_at = expires_at;
        }
    }
}

/// Process-wide grant store shared by every computer-use entry route. The
/// JSONL receipt trail lives at `<computer_use_dir>/receipts/receipts.jsonl`
/// and is reloaded here at process boot.
pub static GRANTS: Lazy<ActionGrantStore> = Lazy::new(|| {
    ActionGrantStore::new_persisted(computer_use_dir().join("receipts").join("receipts.jsonl"))
});

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

    #[test]
    fn unified_status_maps_grant_lifecycle() {
        let store = ActionGrantStore::new();
        let hash = hash_action_payload(&json!({"a": 1}));
        let id = store.issue("user-1", &hash);
        let now = chrono::Utc::now().timestamp_millis();

        let pending = store.get(&id).unwrap();
        assert_eq!(
            unified_status(&pending, now),
            UnifiedApprovalStatus::Pending
        );
        // Future "now" past expiry: pending becomes expired.
        assert_eq!(
            unified_status(&pending, now + 200_000),
            UnifiedApprovalStatus::Expired
        );

        assert!(store.approve(&id));
        let approved = store.get(&id).unwrap();
        assert_eq!(
            unified_status(&approved, now),
            UnifiedApprovalStatus::Approved
        );
        assert_eq!(
            unified_status(&approved, now + 200_000),
            UnifiedApprovalStatus::Expired
        );

        assert!(store.redeem("user-1", &id, &hash).is_ok());
        let consumed = store.get(&id).unwrap();
        // Consumed stays consumed even past TTL — the audit fact outlives it.
        assert_eq!(
            unified_status(&consumed, now + 200_000),
            UnifiedApprovalStatus::Consumed
        );

        let id2 = store.issue("user-1", &hash);
        assert!(store.deny(&id2));
        let denied = store.get(&id2).unwrap();
        assert_eq!(unified_status(&denied, now), UnifiedApprovalStatus::Denied);
    }

    #[test]
    fn receipts_persist_to_jsonl_and_reload_on_boot() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("receipts.jsonl");

        // Generation 1: issue, approve, redeem (one allowed + one denied
        // attempt) against a persisted store.
        let store = ActionGrantStore::new_persisted(path.clone());
        let hash = hash_action_payload(&json!({"a": 1}));
        let id = store.issue("user-1", &hash);
        assert!(store.approve(&id));
        assert!(store.redeem("user-1", &id, &hash).is_ok());
        let _ = store.redeem("user-1", &id, &hash); // denied: already consumed

        // The audit trail is on disk, one JSON object per line.
        let text = std::fs::read_to_string(&path).expect("receipts file written");
        let lines: Vec<_> = text.lines().filter(|l| !l.trim().is_empty()).collect();
        assert_eq!(lines.len(), 2);
        let parsed: serde_json::Value = serde_json::from_str(lines[0]).unwrap();
        assert_eq!(parsed["outcome"], "allowed");

        // Generation 2 (simulated restart): a fresh store over the same file
        // reloads the audit trail, and new receipts append to it.
        let store2 = ActionGrantStore::new_persisted(path.clone());
        assert_eq!(store2.receipts().len(), 2);
        assert_eq!(store2.receipts()[0].outcome, "allowed");

        let id2 = store2.issue("user-2", &hash);
        assert!(store2.deny(&id2));
        let _ = store2.redeem("user-2", &id2, &hash);
        assert_eq!(store2.receipts().len(), 3);
        assert_eq!(std::fs::read_to_string(&path).unwrap().lines().count(), 3);
    }
}
