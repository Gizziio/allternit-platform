//! Agent-level permission policies and approval lifecycle.
//!
//! Policies are ordered lists of rules that classify a tool execution request as
//! `allow`, `deny`, or `ask`. When a request matches an `ask` rule, the API
//! records a pending approval and returns its id so the caller can approve or
//! deny the request via `/beta/approvals/:id/{approve,deny}`.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

/// Decision/action a permission rule can produce.
#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionAction {
    #[default]
    Allow,
    Deny,
    Ask,
}

/// A single rule in a permission policy. A rule matches when every field that
/// is present matches the request. Fields are optional so a rule can be broad
/// (e.g. only `tool`) or narrow (e.g. `tool` + `file_path`).
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
pub struct PermissionRule {
    /// Tool name or glob (e.g. `file.read`, `http.*`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool: Option<String>,
    /// File path, path prefix, or glob matched against the request's file path.
    #[serde(
        default,
        rename = "filePath",
        alias = "file_path",
        skip_serializing_if = "Option::is_none"
    )]
    pub file_path: Option<String>,
    /// Network host matched against the request's target host.
    #[serde(
        default,
        rename = "networkHost",
        alias = "network_host",
        skip_serializing_if = "Option::is_none"
    )]
    pub network_host: Option<String>,
    /// Result when the rule matches.
    pub action: PermissionAction,
}

/// Named collection of permission rules. Policies are merged from company and
/// user config; the active policy is selected by name.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
pub struct PermissionPolicy {
    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rules: Vec<PermissionRule>,
}

/// Returns true when `value` satisfies `pattern`. Supports:
///
/// * `*`              – match anything
/// * `prefix*`        – starts with prefix
/// * `*suffix`        – ends with suffix
/// * `*contains*`     – contains substring
/// * exact match      – equality
fn matches_pattern(pattern: &str, value: &str) -> bool {
    if pattern == "*" {
        return true;
    }
    let starts = pattern.starts_with('*');
    let ends = pattern.ends_with('*');
    if starts && ends && pattern.len() > 1 {
        value.contains(&pattern[1..pattern.len() - 1])
    } else if ends && pattern.len() > 1 {
        value.starts_with(&pattern[..pattern.len() - 1])
    } else if starts && pattern.len() > 1 {
        value.ends_with(&pattern[1..])
    } else {
        value == pattern
    }
}

/// Evaluate the active policy against a tool request. Returns the action of the
/// first matching rule, or `Allow` when no policy/rule matches.
pub fn evaluate(
    policy: Option<&PermissionPolicy>,
    tool: &str,
    file_path: Option<&str>,
    network_host: Option<&str>,
) -> PermissionAction {
    let Some(policy) = policy else {
        return PermissionAction::Allow;
    };
    for rule in &policy.rules {
        let tool_ok = rule
            .tool
            .as_ref()
            .map(|p| matches_pattern(p, tool))
            .unwrap_or(true);
        let file_ok = rule
            .file_path
            .as_ref()
            .map(|p| file_path.map(|v| matches_pattern(p, v)).unwrap_or(false))
            .unwrap_or(true);
        let host_ok = rule
            .network_host
            .as_ref()
            .map(|p| network_host.map(|v| matches_pattern(p, v)).unwrap_or(false))
            .unwrap_or(true);
        if tool_ok && file_ok && host_ok {
            return rule.action;
        }
    }
    PermissionAction::Allow
}

/// Current state of an approval request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Denied,
}

/// Stored approval request produced by an `ask` policy decision.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ApprovalRequest {
    pub id: String,
    pub user_id: String,
    pub tool: String,
    pub args: Value,
    pub status: ApprovalStatus,
    pub created_at: String,
}

/// In-memory store for pending/resolved approval requests. All operations are
/// synchronous and short-lived; the store is kept behind `Arc` in `AppState`.
#[derive(Debug, Default)]
pub struct ApprovalStore {
    requests: Mutex<HashMap<String, ApprovalRequest>>,
}

impl ApprovalStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a new pending approval request and return its id.
    pub fn create(&self, user_id: &str, tool: &str, args: &Value) -> String {
        let id = Uuid::new_v4().to_string();
        let request = ApprovalRequest {
            id: id.clone(),
            user_id: user_id.to_string(),
            tool: tool.to_string(),
            args: args.clone(),
            status: ApprovalStatus::Pending,
            created_at: Utc::now().to_rfc3339(),
        };
        self.requests.lock().expect("approval store lock").insert(id.clone(), request);
        id
    }

    pub fn get(&self, id: &str) -> Option<ApprovalRequest> {
        self.requests.lock().expect("approval store lock").get(id).cloned()
    }

    pub fn approve(&self, id: &str) -> bool {
        let mut requests = self.requests.lock().expect("approval store lock");
        requests
            .get_mut(id)
            .map(|req| {
                req.status = ApprovalStatus::Approved;
            })
            .is_some()
    }

    pub fn deny(&self, id: &str) -> bool {
        let mut requests = self.requests.lock().expect("approval store lock");
        requests
            .get_mut(id)
            .map(|req| {
                req.status = ApprovalStatus::Denied;
            })
            .is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn policy(rules: Vec<PermissionRule>) -> PermissionPolicy {
        PermissionPolicy {
            name: "test".to_string(),
            rules,
        }
    }

    #[test]
    fn no_policy_defaults_to_allow() {
        assert_eq!(
            evaluate(None, "bash", None, None),
            PermissionAction::Allow
        );
    }

    #[test]
    fn exact_tool_match() {
        let p = policy(vec![PermissionRule {
            tool: Some("bash".to_string()),
            action: PermissionAction::Deny,
            ..Default::default()
        }]);
        assert_eq!(evaluate(Some(&p), "bash", None, None), PermissionAction::Deny);
        assert_eq!(evaluate(Some(&p), "file.read", None, None), PermissionAction::Allow);
    }

    #[test]
    fn wildcard_tool_prefix() {
        let p = policy(vec![PermissionRule {
            tool: Some("file.*".to_string()),
            action: PermissionAction::Ask,
            ..Default::default()
        }]);
        assert_eq!(evaluate(Some(&p), "file.read", None, None), PermissionAction::Ask);
        assert_eq!(evaluate(Some(&p), "file.write", None, None), PermissionAction::Ask);
        assert_eq!(evaluate(Some(&p), "bash", None, None), PermissionAction::Allow);
    }

    #[test]
    fn file_path_rule_only_matches_when_path_present() {
        let p = policy(vec![PermissionRule {
            tool: Some("file.read".to_string()),
            file_path: Some("/etc/*".to_string()),
            action: PermissionAction::Deny,
            ..Default::default()
        }]);
        assert_eq!(
            evaluate(Some(&p), "file.read", Some("/etc/passwd"), None),
            PermissionAction::Deny
        );
        assert_eq!(
            evaluate(Some(&p), "file.read", Some("/home/user/file"), None),
            PermissionAction::Allow
        );
        assert_eq!(evaluate(Some(&p), "file.read", None, None), PermissionAction::Allow);
    }

    #[test]
    fn network_host_rule_matches_host() {
        let p = policy(vec![PermissionRule {
            tool: Some("http.get".to_string()),
            network_host: Some("*.internal.example.com".to_string()),
            action: PermissionAction::Ask,
            ..Default::default()
        }]);
        assert_eq!(
            evaluate(Some(&p), "http.get", None, Some("api.internal.example.com")),
            PermissionAction::Ask
        );
        assert_eq!(
            evaluate(Some(&p), "http.get", None, Some("example.com")),
            PermissionAction::Allow
        );
    }

    #[test]
    fn first_matching_rule_wins() {
        let p = policy(vec![
            PermissionRule {
                tool: Some("bash".to_string()),
                action: PermissionAction::Deny,
                ..Default::default()
            },
            PermissionRule {
                tool: Some("*".to_string()),
                action: PermissionAction::Allow,
                ..Default::default()
            },
        ]);
        assert_eq!(evaluate(Some(&p), "bash", None, None), PermissionAction::Deny);
        assert_eq!(evaluate(Some(&p), "echo", None, None), PermissionAction::Allow);
    }

    #[test]
    fn approval_store_lifecycle() {
        let store = ApprovalStore::new();
        let id = store.create("user-1", "bash", &json!({"command": "echo hi"}));
        let req = store.get(&id).unwrap();
        assert_eq!(req.status, ApprovalStatus::Pending);
        assert_eq!(req.tool, "bash");

        assert!(store.approve(&id));
        assert_eq!(store.get(&id).unwrap().status, ApprovalStatus::Approved);

        assert!(!store.approve("missing"));

        let id2 = store.create("user-2", "file.write", &json!({}));
        assert!(store.deny(&id2));
        assert_eq!(store.get(&id2).unwrap().status, ApprovalStatus::Denied);
    }
}
