//! Policy Enforcement Engine
//! 
//! Parses AGENTS.md constitution and enforces policies at runtime.
//! Gates tool calls and file operations based on permissions.

use std::collections::HashMap;
use std::path::Path;
use anyhow::Result;

/// Policy enforcement result
#[derive(Debug, Clone)]
pub enum PolicyDecision {
    /// Action is allowed
    Allow,
    /// Action requires explicit approval
    RequireApproval(String),
    /// Action is denied
    Deny(String),
}

/// Safety tier for tools
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SafetyTier {
    ReadOnly,
    Write,
    Destructive,
    Network,
}

impl std::fmt::Display for SafetyTier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SafetyTier::ReadOnly => write!(f, "read_only"),
            SafetyTier::Write => write!(f, "write"),
            SafetyTier::Destructive => write!(f, "destructive"),
            SafetyTier::Network => write!(f, "network"),
        }
    }
}

/// Parsed policy from AGENTS.md + POLICY.md
#[derive(Debug, Clone, Default)]
pub struct PolicyEngine {
    /// Tool-specific permissions
    tool_policies: HashMap<String, ToolPolicy>,
    
    /// Path-based permissions
    path_policies: PathPolicies,
    
    /// Global settings
    global: GlobalPolicy,
    
    /// Dynamic overrides from POLICY.md
    overrides: PolicyOverrides,
}

#[derive(Debug, Clone)]
pub struct ToolPolicy {
    pub tool_id: String,
    pub tier: SafetyTier,
    pub default_action: PolicyAction,
    pub requires_approval: bool,
}

#[derive(Debug, Clone)]
pub enum PolicyAction {
    Allow,
    Deny,
    Ask,
}

#[derive(Debug, Clone, Default)]
pub struct PathPolicies {
    pub read_allowed: Vec<String>,
    pub write_allowed: Vec<String>,
    pub external_read: Vec<String>,
    pub external_write: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct GlobalPolicy {
    pub destructive_requires_approval: bool,
    pub network_default: PolicyAction,
    pub auto_quarantine: bool,
    pub verify_after_edit: bool,
}

impl Default for GlobalPolicy {
    fn default() -> Self {
        Self {
            destructive_requires_approval: true,
            network_default: PolicyAction::Deny,
            auto_quarantine: true,
            verify_after_edit: false,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct PolicyOverrides {
    pub tool_overrides: HashMap<String, PolicyAction>,
    pub temporary_allows: Vec<String>,
}

impl PolicyEngine {
    /// Initialize policy engine from workspace files
    pub fn from_workspace(workspace: &Path) -> Result<Self> {
        let mut engine = Self::default();
        
        // Parse AGENTS.md
        engine.parse_agents_md(workspace)?;
        
        // Parse POLICY.md for overrides
        engine.parse_policy_md(workspace)?;
        
        Ok(engine)
    }
    
    /// Parse AGENTS.md constitution
    fn parse_agents_md(&mut self, workspace: &Path) -> Result<()> {
        let agents_path = workspace.join("AGENTS.md");
        
        if !agents_path.exists() {
            // Use defaults if no AGENTS.md
            return Ok(());
        }
        
        let content = std::fs::read_to_string(agents_path)?;
        
        // Extract sections
        self.parse_permissions_section(&content);
        self.parse_safety_section(&content);
        self.parse_scope_section(&content);
        
        Ok(())
    }
    
    /// Parse POLICY.md for dynamic overrides
    fn parse_policy_md(&mut self, workspace: &Path) -> Result<()> {
        let policy_path = workspace.join("POLICY.md");
        
        if !policy_path.exists() {
            return Ok(());
        }
        
        let content = std::fs::read_to_string(policy_path)?;
        
        // Parse tool access table
        self.parse_tool_overrides(&content);
        
        Ok(())
    }
    
    /// Parse permissions section from AGENTS.md
    fn parse_permissions_section(&mut self, content: &str) {
        // Look for "## Permissions Model" or "### Tool Safety Tiers"
        if let Some(section) = self.extract_section(content, "## Permissions") {
            // Parse read_only, write, destructive, network
            if section.contains("read_only") {
                self.tool_policies.insert("fs.read".to_string(), ToolPolicy {
                    tool_id: "fs.read".to_string(),
                    tier: SafetyTier::ReadOnly,
                    default_action: PolicyAction::Allow,
                    requires_approval: false,
                });
            }
            
            if section.contains("destructive") {
                self.global.destructive_requires_approval = true;
            }
        }
    }
    
    /// Parse safety section from AGENTS.md
    fn parse_safety_section(&mut self, content: &str) {
        if let Some(section) = self.extract_section(content, "## Safety") {
            if section.contains("quarantine") || section.contains("trash") {
                self.global.auto_quarantine = true;
            }
        }
    }
    
    /// Parse scope section from AGENTS.md
    fn parse_scope_section(&mut self, content: &str) {
        if let Some(section) = self.extract_section(content, "## Scope") {
            // Extract allowed paths
            for line in section.lines() {
                if line.contains("READ:") {
                    // Parse read paths
                }
                if line.contains("WRITE:") {
                    // Parse write paths
                }
            }
        }
    }
    
    /// Parse tool overrides from POLICY.md
    fn parse_tool_overrides(&mut self, content: &str) {
        // Look for "### Tool Access" table
        if let Some(section) = self.extract_section(content, "### Tool Access") {
            // Parse markdown table
            for line in section.lines() {
                // | Tool | Default | Override | Notes |
                if line.starts_with("| ") && !line.starts_with("| Tool") {
                    let parts: Vec<&str> = line.split("|").collect();
                    if parts.len() >= 4 {
                        let tool = parts[1].trim();
                        let _default = parts[2].trim();
                        let override_str = parts[3].trim();
                        
                        let action = match override_str {
                            "allow" => PolicyAction::Allow,
                            "deny" => PolicyAction::Deny,
                            "ask" => PolicyAction::Ask,
                            _ => PolicyAction::Allow,
                        };
                        
                        self.overrides.tool_overrides.insert(tool.to_string(), action);
                    }
                }
            }
        }
    }
    
    /// Extract a section from markdown
    fn extract_section(&self, content: &str, header: &str) -> Option<String> {
        let lines: Vec<&str> = content.lines().collect();
        let mut in_section = false;
        let mut section_lines = Vec::new();
        
        for line in lines {
            if line.starts_with(header) {
                in_section = true;
                continue;
            }
            
            if in_section {
                // Stop at next heading of same or higher level
                if line.starts_with("##") && !line.starts_with(header) {
                    break;
                }
                section_lines.push(line);
            }
        }
        
        if section_lines.is_empty() {
            None
        } else {
            Some(section_lines.join("\n"))
        }
    }
    
    /// Check if a tool call is allowed
    pub fn check_tool(&self, tool_id: &str, args: &HashMap<String, String>) -> PolicyDecision {
        // Check for override first
        if let Some(override_action) = self.overrides.tool_overrides.get(tool_id) {
            match override_action {
                PolicyAction::Allow => return PolicyDecision::Allow,
                PolicyAction::Deny => return PolicyDecision::Deny(format!("Tool {} is denied by policy", tool_id)),
                PolicyAction::Ask => return PolicyDecision::RequireApproval(format!("Tool {} requires approval", tool_id)),
            }
        }
        
        // Check tool policy
        if let Some(policy) = self.tool_policies.get(tool_id) {
            if policy.requires_approval {
                return PolicyDecision::RequireApproval(
                    format!("Tool {} (tier: {}) requires approval", tool_id, policy.tier)
                );
            }
            
            return match policy.default_action {
                PolicyAction::Allow => PolicyDecision::Allow,
                PolicyAction::Deny => PolicyDecision::Deny(format!("Tool {} is denied", tool_id)),
                PolicyAction::Ask => PolicyDecision::RequireApproval(format!("Tool {} requires approval", tool_id)),
            };
        }
        
        // Default: check tier
        let tier = self.infer_tier(tool_id);
        match tier {
            SafetyTier::Destructive => {
                if self.global.destructive_requires_approval {
                    PolicyDecision::RequireApproval(
                        "Destructive action requires approval".to_string()
                    )
                } else {
                    PolicyDecision::Allow
                }
            }
            SafetyTier::Network => {
                match self.global.network_default {
                    PolicyAction::Allow => PolicyDecision::Allow,
                    PolicyAction::Deny => PolicyDecision::Deny("Network access denied by default".to_string()),
                    PolicyAction::Ask => PolicyDecision::RequireApproval("Network access requires approval".to_string()),
                }
            }
            _ => PolicyDecision::Allow,
        }
    }
    
    /// Check if a file operation is allowed
    pub fn check_file_op(&self, path: &Path, operation: FileOperation) -> PolicyDecision {
        let path_str = path.to_string_lossy();
        
        // Check if path is in workspace
        let is_in_workspace = !path_str.starts_with("..") && !path_str.starts_with("/");
        
        match operation {
            FileOperation::Read => {
                // Reads are generally allowed in workspace
                if is_in_workspace {
                    PolicyDecision::Allow
                } else {
                    // Check external read allowlist
                    PolicyDecision::RequireApproval("External file read requires approval".to_string())
                }
            }
            FileOperation::Write => {
                if is_in_workspace {
                    PolicyDecision::Allow
                } else {
                    PolicyDecision::Deny("Writing outside workspace is not allowed".to_string())
                }
            }
            FileOperation::Delete => {
                if self.global.auto_quarantine {
                    PolicyDecision::RequireApproval(
                        "Deletion requires approval (will be quarantined)".to_string()
                    )
                } else {
                    PolicyDecision::RequireApproval("Deletion requires approval".to_string())
                }
            }
        }
    }
    
    /// Infer safety tier from tool ID
    fn infer_tier(&self, tool_id: &str) -> SafetyTier {
        if tool_id.contains("delete") || tool_id.contains("remove") || tool_id.contains("drop") {
            SafetyTier::Destructive
        } else if tool_id.contains("write") || tool_id.contains("edit") || tool_id.contains("create") {
            SafetyTier::Write
        } else if tool_id.contains("http") || tool_id.contains("net") || tool_id.contains("fetch") {
            SafetyTier::Network
        } else {
            SafetyTier::ReadOnly
        }
    }
    
    /// Add a temporary permission (for a session)
    pub fn grant_temporary(&mut self, permission: String) {
        self.overrides.temporary_allows.push(permission);
    }
    
    /// Revoke a temporary permission
    pub fn revoke_temporary(&mut self, permission: &str) {
        self.overrides.temporary_allows.retain(|p| p != permission);
    }
}

/// File operation types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileOperation {
    Read,
    Write,
    Delete,
}

/// Tool call with policy check
pub struct GatedToolCall<'a> {
    pub tool_id: String,
    pub args: HashMap<String, String>,
    pub engine: &'a PolicyEngine,
}

impl<'a> GatedToolCall<'a> {
    pub fn new(tool_id: &str, engine: &'a PolicyEngine) -> Self {
        Self {
            tool_id: tool_id.to_string(),
            args: HashMap::new(),
            engine,
        }
    }
    
    pub fn with_arg(mut self, key: &str, value: &str) -> Self {
        self.args.insert(key.to_string(), value.to_string());
        self
    }
    
    /// Execute with policy check
    pub fn execute<F>(&self, operation: F) -> Result<String, String>
    where
        F: FnOnce(&str, &HashMap<String, String>) -> Result<String, String>,
    {
        match self.engine.check_tool(&self.tool_id, &self.args) {
            PolicyDecision::Allow => operation(&self.tool_id, &self.args),
            PolicyDecision::RequireApproval(reason) => {
                Err(format!("APPROVAL_REQUIRED: {}", reason))
            }
            PolicyDecision::Deny(reason) => {
                Err(format!("DENIED: {}", reason))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_policy_decision() {
        let engine = PolicyEngine::default();
        
        // Read operations should be allowed
        let decision = engine.check_file_op(Path::new("test.txt"), FileOperation::Read);
        assert!(matches!(decision, PolicyDecision::Allow));
        
        // Delete operations should require approval
        let decision = engine.check_file_op(Path::new("test.txt"), FileOperation::Delete);
        assert!(matches!(decision, PolicyDecision::RequireApproval(_)));
    }
    
    #[test]
    fn test_tool_tier_inference() {
        let engine = PolicyEngine::default();
        
        // Test destructive detection
        let decision = engine.check_tool("fs.delete", &HashMap::new());
        assert!(matches!(decision, PolicyDecision::RequireApproval(_)));
        
        // Test network detection
        let decision = engine.check_tool("net.http_request", &HashMap::new());
        assert!(matches!(decision, PolicyDecision::Deny(_)));
    }
}
