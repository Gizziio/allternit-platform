//! Declarative ACI policy document loader and the gateway-wide policy state.
//!
//! The policy document is a single JSON file whose path comes from the env
//! var `ALLTERNIT_ACI_POLICY_FILE`:
//!
//! ```json
//! {
//!   "rules": [
//!     {
//!       "id": "no-secrets",
//!       "tool": "aci.run",
//!       "intent": "*secret*",
//!       "action": "deny"
//!     },
//!     {
//!       "id": "default",
//!       "tool": "*",
//!       "action": "allow"
//!     }
//!   ]
//! }
//! ```
//!
//! Rules extend [`PermissionRule`]; every field a rule specifies must match
//! the action descriptor (AND semantics), absent fields are wildcards.
//!
//! Three states, all fail-closed:
//!
//! * **Env unset** — the engine is OFF. No policy is evaluated and behavior
//!   is exactly the pre-policy code path (the default; existing suites run
//!   this way).
//! * **Env set, document missing, empty, or malformed** (bad JSON, unknown
//!   action value, rule without `tool`) — [`load_from_env`] returns a
//!   [`PolicyLoadError`] naming the offending rule id or document reason;
//!   `main` refuses to start the gateway on this error.
//! * **Env set, valid document** — the engine is ON and [`evaluate_descriptor`]
//!   returns a verdict for every action. Per [`evaluate_policy`], deny rules
//!   evaluate before allow rules, `ask` passes through to the existing
//!   grant/approval flow, and an action no rule allows is denied. A document
//!   that parses to zero rules therefore denies every action.

use once_cell::sync::Lazy;
use std::path::PathBuf;
use std::sync::RwLock;

use crate::permission_policy::{
    evaluate_policy, PermissionPolicy, PermissionRule, PolicyRequest, PolicyVerdict,
};

/// Env var pointing at the declarative policy document.
pub const POLICY_FILE_ENV: &str = "ALLTERNIT_ACI_POLICY_FILE";

/// Errors that refuse gateway startup (the loader never fails open).
#[derive(Debug, thiserror::Error)]
pub enum PolicyLoadError {
    #[error("policy file not found: {0}")]
    Missing(PathBuf),
    #[error("policy file could not be read: {0}")]
    Io(String),
    #[error("policy file is empty: {0}")]
    Empty(PathBuf),
    #[error("policy file is not valid JSON: {0}")]
    Malformed(String),
    #[error("policy rule {0} is invalid: {1}")]
    RuleInvalid(String, String),
}

/// Owned action descriptor passed to the policy seats (aci_run,
/// execute_computer_tool). Borrowed as a [`PolicyRequest`] for evaluation.
#[derive(Debug, Clone, Default)]
pub struct PolicyDescriptor {
    pub tool: String,
    pub intent: Option<String>,
    pub bot_id: Option<String>,
    pub session_id: Option<String>,
    pub mcp_tool: Option<String>,
    pub network_host: Option<String>,
    pub file_path: Option<String>,
}

impl PolicyDescriptor {
    pub fn as_request(&self) -> PolicyRequest<'_> {
        PolicyRequest {
            tool: &self.tool,
            intent: self.intent.as_deref(),
            bot_id: self.bot_id.as_deref(),
            session_id: self.session_id.as_deref(),
            mcp_tool: self.mcp_tool.as_deref(),
            network_host: self.network_host.as_deref(),
            file_path: self.file_path.as_deref(),
        }
    }
}

/// The loaded policy document, or `None` when the engine is off (env unset).
pub type LoadedPolicy = Option<PermissionPolicy>;

/// Test-only lock serializing tests that mutate the process-global policy
/// state or the env vars it rides on (`ALLTERNIT_ACI_POLICY_FILE`,
/// `ALLTERNIT_COMPUTER_USE_DIR`, `ALLTERNIT_ACU_URL`). Without this, a test
/// that installs a deny policy races every other test hitting a policy seat.
/// Lock non-poisoningly: a panicking test must not cascade into unrelated
/// suites.
#[cfg(test)]
pub static POLICY_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// Gateway-wide policy state. `None` = engine off (env unset at load).
/// Written once by `main` at startup; tests may install policies directly.
static ACTIVE_POLICY: Lazy<RwLock<LoadedPolicy>> = Lazy::new(|| RwLock::new(None));

/// Install (or clear, with `None`) the active policy document.
pub fn install(policy: LoadedPolicy) {
    *ACTIVE_POLICY.write().expect("policy lock") = policy;
}

/// The active policy document, if the engine is on.
pub fn active_policy() -> LoadedPolicy {
    ACTIVE_POLICY.read().expect("policy lock").clone()
}

/// Load the policy document named by `ALLTERNIT_ACI_POLICY_FILE`.
///
/// * Env unset or empty → `Ok(None)` (engine off, legacy behavior).
/// * Env set → `Ok(Some(policy))` for a valid document, or `Err` naming the
///   offending rule id / document reason. A document with an empty `rules`
///   array is valid and denies every action once installed.
pub fn load_from_env() -> Result<LoadedPolicy, PolicyLoadError> {
    let path = match std::env::var(POLICY_FILE_ENV) {
        Ok(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => return Ok(None),
    };
    if !path.exists() {
        return Err(PolicyLoadError::Missing(path));
    }
    let text = std::fs::read_to_string(&path).map_err(|e| PolicyLoadError::Io(e.to_string()))?;
    if text.trim().is_empty() {
        return Err(PolicyLoadError::Empty(path));
    }
    let value: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| PolicyLoadError::Malformed(e.to_string()))?;
    let rule_values: Vec<&serde_json::Value> = value
        .get("rules")
        .and_then(|rules| rules.as_array())
        .map(|rules| rules.iter().collect())
        .ok_or_else(|| PolicyLoadError::Malformed("document must be an object with a `rules` array".to_string()))?;
    let mut rules: Vec<PermissionRule> = Vec::with_capacity(rule_values.len());
    for (index, rule_value) in rule_values.iter().enumerate() {
        let rule_name = rule_value
            .get("id")
            .and_then(|id| id.as_str())
            .map(str::to_string)
            .unwrap_or_else(|| format!("(index {index})"));
        let tool = rule_value.get("tool").and_then(|tool| tool.as_str());
        if tool.map(str::trim).unwrap_or("").is_empty() {
            return Err(PolicyLoadError::RuleInvalid(
                rule_name,
                "rule has no `tool` glob".to_string(),
            ));
        }
        match rule_value.get("action").and_then(|action| action.as_str()) {
            Some("allow" | "deny" | "ask") => {}
            Some(other) => {
                return Err(PolicyLoadError::RuleInvalid(
                    rule_name,
                    format!("unknown action `{other}` (expected allow|deny|ask)"),
                ));
            }
            None => {
                return Err(PolicyLoadError::RuleInvalid(
                    rule_name,
                    "rule has no `action`".to_string(),
                ));
            }
        }
        let rule: PermissionRule = serde_json::from_value((*rule_value).clone())
            .map_err(|e| PolicyLoadError::RuleInvalid(rule_name, e.to_string()))?;
        rules.push(rule);
    }
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "aci-policy".to_string());
    Ok(Some(PermissionPolicy { name, rules }))
}

/// Evaluate the active policy against an action descriptor.
///
/// Returns `None` when the engine is off (no document installed) — seats
/// treat this as "no policy decision" and continue the legacy flow.
/// Otherwise returns the fail-closed verdict (see module docs).
pub fn evaluate_descriptor(desc: &PolicyDescriptor) -> Option<PolicyVerdict> {
    active_policy().map(|policy| evaluate_policy(&policy, &desc.as_request()))
}

/// Human-readable reason for a policy refusal, naming the deciding rule when
/// it has an id.
pub fn deny_reason(verdict: &PolicyVerdict) -> String {
    match verdict.rule_id.as_deref() {
        Some(id) => format!("denied by policy rule `{id}`"),
        None => "denied by policy (no rule allows this action)".to_string(),
    }
}

/// Shape of the audit read API response rows as serialized from
/// `policy_audit::PolicyAuditRow`; re-exported here for seat convenience.
pub use crate::policy_audit::PolicyAuditRow;

/// Write the audit row for a policy decision (fsynced before returning), so
/// the seat's ordering guarantee — audit before dispatch — holds. `ask`
/// verdicts write nothing here: they fall through to the existing
/// grant/approval flow, which already persists redemption receipts before
/// execution.
///
/// A write error is returned to the caller, which must refuse to dispatch:
/// an action that cannot be audited must not run.
pub fn record_decision(
    desc: &PolicyDescriptor,
    verdict: &PolicyVerdict,
    actor: Option<&str>,
    run_id: Option<&str>,
) -> std::io::Result<()> {
    use crate::permission_policy::PermissionAction;
    // `ask` verdicts write nothing here: they fall through to the existing
    // grant/approval flow, which already persists redemption receipts before
    // execution.
    if verdict.action == PermissionAction::Ask {
        return Ok(());
    }
    let decision = match verdict.action {
        PermissionAction::Deny => crate::policy_audit::PolicyDecision::Denied,
        _ => crate::policy_audit::PolicyDecision::Allowed,
    };
    let mut row = PolicyAuditRow::new(decision, desc.tool.clone());
    row.rule_id = verdict.rule_id.clone();
    row.bot_id = desc.bot_id.clone();
    row.session_id = desc.session_id.clone();
    row.actor = actor.map(str::to_string);
    row.intent = desc.intent.clone();
    row.host = desc.network_host.clone();
    row.path = desc.file_path.clone();
    row.mcp_tool = desc.mcp_tool.clone();
    row.run_id = run_id.map(str::to_string);
    crate::policy_audit::record(&row)
}

/// Refusal body for a policy denial, following the existing refusal idiom
/// (`error` + human-readable `reason`) plus the deciding `rule_id`.
pub fn refusal_json(verdict: &PolicyVerdict) -> serde_json::Value {
    serde_json::json!({
        "error": "policy_denied",
        "reason": deny_reason(verdict),
        "rule_id": verdict.rule_id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::permission_policy::PermissionAction;
    use std::sync::Mutex;

    /// Serializes env-mutating tests in this module (env is process-global;
    /// the same caveat as the existing aci env-var tests applies).
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn write_policy(dir: &std::path::Path, name: &str, body: &str) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, body).unwrap();
        path
    }

    #[test]
    fn unset_env_means_engine_off() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var(POLICY_FILE_ENV);
        let loaded = load_from_env().expect("unset env must not error");
        assert!(loaded.is_none(), "unset env → engine off");
    }

    #[test]
    fn missing_file_refuses_startup() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("nope.json");
        std::env::set_var(POLICY_FILE_ENV, &path);
        let err = load_from_env().expect_err("missing file must error");
        assert!(matches!(err, PolicyLoadError::Missing(_)), "got: {err}");
        std::env::remove_var(POLICY_FILE_ENV);
    }

    #[test]
    fn empty_file_refuses_startup() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let path = write_policy(temp.path(), "empty.json", "  \n ");
        std::env::set_var(POLICY_FILE_ENV, &path);
        let err = load_from_env().expect_err("empty file must error");
        assert!(matches!(err, PolicyLoadError::Empty(_)), "got: {err}");
        std::env::remove_var(POLICY_FILE_ENV);
    }

    #[test]
    fn malformed_json_names_the_reason() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let path = write_policy(temp.path(), "bad.json", "{ not json");
        std::env::set_var(POLICY_FILE_ENV, &path);
        let err = load_from_env().expect_err("bad JSON must error");
        assert!(matches!(err, PolicyLoadError::Malformed(_)), "got: {err}");
        std::env::remove_var(POLICY_FILE_ENV);
    }

    #[test]
    fn rule_without_tool_names_the_rule_id() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let path = write_policy(
            temp.path(),
            "no-tool.json",
            r#"{"rules":[{"id":"broken-rule","action":"deny"}]}"#,
        );
        std::env::set_var(POLICY_FILE_ENV, &path);
        let err = load_from_env().expect_err("rule without tool must error");
        match err {
            PolicyLoadError::RuleInvalid(id, reason) => {
                assert_eq!(id, "broken-rule");
                assert!(reason.contains("tool"), "reason: {reason}");
            }
            other => panic!("expected RuleInvalid, got {other}"),
        }
        std::env::remove_var(POLICY_FILE_ENV);
    }

    #[test]
    fn unknown_action_names_the_rule() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let path = write_policy(
            temp.path(),
            "bad-action.json",
            r#"{"rules":[{"id":"wobbly","tool":"*","action":"maybe"}]}"#,
        );
        std::env::set_var(POLICY_FILE_ENV, &path);
        let err = load_from_env().expect_err("unknown action must error");
        match err {
            PolicyLoadError::RuleInvalid(id, reason) => {
                assert_eq!(id, "wobbly");
                assert!(reason.contains("maybe"), "reason: {reason}");
            }
            other => panic!("expected RuleInvalid, got {other}"),
        }
        std::env::remove_var(POLICY_FILE_ENV);
    }

    #[test]
    fn rule_without_id_falls_back_to_index() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let path = write_policy(
            temp.path(),
            "anon.json",
            r#"{"rules":[{"tool":"*"}]}"#,
        );
        std::env::set_var(POLICY_FILE_ENV, &path);
        let err = load_from_env().expect_err("rule without action must error");
        match err {
            PolicyLoadError::RuleInvalid(id, _) => assert_eq!(id, "(index 0)"),
            other => panic!("expected RuleInvalid, got {other}"),
        }
        std::env::remove_var(POLICY_FILE_ENV);
    }

    #[test]
    fn empty_valid_doc_denies_every_action() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let path = write_policy(temp.path(), "deny-all.json", r#"{"rules":[]}"#);
        std::env::set_var(POLICY_FILE_ENV, &path);
        let loaded = load_from_env().expect("empty rules array is valid");
        let policy = loaded.expect("engine on");
        assert!(policy.rules.is_empty());
        let verdict = evaluate_policy(
            &policy,
            &PolicyDescriptor {
                tool: "anything".to_string(),
                ..Default::default()
            }
            .as_request(),
        );
        assert_eq!(verdict.action, PermissionAction::Deny);
        std::env::remove_var(POLICY_FILE_ENV);
    }

    #[test]
    fn valid_doc_loads_and_evaluates() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let path = write_policy(
            temp.path(),
            "ok.json",
            r#"{"rules":[
                {"id":"deny-secrets","tool":"aci.run","intent":"*secret*","action":"deny"},
                {"id":"default","tool":"*","action":"allow"}
            ]}"#,
        );
        std::env::set_var(POLICY_FILE_ENV, &path);
        let policy = load_from_env().expect("valid doc").expect("engine on");
        assert_eq!(policy.rules.len(), 2);

        let mut desc = PolicyDescriptor {
            tool: "aci.run".to_string(),
            ..Default::default()
        };
        desc.intent = Some("exfiltrate secrets".to_string());
        let verdict = evaluate_descriptor_with(&policy, &desc);
        assert_eq!(verdict.action, PermissionAction::Deny);
        assert_eq!(verdict.rule_id.as_deref(), Some("deny-secrets"));

        desc.intent = Some("check the weather".to_string());
        let verdict = evaluate_descriptor_with(&policy, &desc);
        assert_eq!(verdict.action, PermissionAction::Allow);
        std::env::remove_var(POLICY_FILE_ENV);
    }

    fn evaluate_descriptor_with(policy: &PermissionPolicy, desc: &PolicyDescriptor) -> PolicyVerdict {
        evaluate_policy(policy, &desc.as_request())
    }

    #[test]
    fn install_and_active_policy_round_trip() {
        let _guard = POLICY_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let prior = active_policy();
        install(Some(PermissionPolicy {
            name: "round-trip".to_string(),
            rules: vec![],
        }));
        assert!(active_policy().is_some());
        install(prior);
    }
}
