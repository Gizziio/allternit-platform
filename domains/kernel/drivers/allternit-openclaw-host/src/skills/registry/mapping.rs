//! Skill Mapping
//!
//! Maps OpenClaw skill IDs to A2R native skill IDs.

use std::collections::HashMap;

/// Mapping between OpenClaw and A2R skills
#[derive(Debug, Clone)]
pub struct SkillMapping {
    /// OpenClaw skill ID
    pub openclaw_id: String,
    /// A2R native skill ID
    pub native_id: String,
    /// Whether mapping is bidirectional
    pub bidirectional: bool,
}

/// Maps skills between OpenClaw and A2R
#[derive(Debug)]
pub struct SkillMapper {
    /// OpenClaw -> A2R mappings
    openclaw_to_native: HashMap<String, String>,
    /// A2R -> OpenClaw mappings
    native_to_openclaw: HashMap<String, String>,
    /// Built-in mappings
    built_in: HashMap<String, String>,
}

impl SkillMapper {
    /// Create new mapper with built-in mappings
    pub fn new() -> Self {
        let mut mapper = Self {
            openclaw_to_native: HashMap::new(),
            native_to_openclaw: HashMap::new(),
            built_in: HashMap::new(),
        };

        mapper.init_built_in_mappings();
        mapper
    }

    /// Initialize built-in mappings for common skills
    fn init_built_in_mappings(&mut self) {
        // System skills
        self.add_built_in("system", "system");
        self.add_built_in("shell", "shell");
        self.add_built_in("files", "files");

        // Git skills
        self.add_built_in("github", "git");
        self.add_built_in("git", "git");

        // Build skills
        self.add_built_in("npm", "build");
        self.add_built_in("cargo", "build");
        self.add_built_in("make", "build");

        // Deploy skills
        self.add_built_in("docker", "deploy");
        self.add_built_in("kubernetes", "deploy");

        // Monitor skills
        self.add_built_in("logs", "monitor");
        self.add_built_in("status", "monitor");
    }

    /// Add a built-in mapping
    fn add_built_in(&mut self, openclaw: &str, native: &str) {
        self.built_in
            .insert(openclaw.to_string(), native.to_string());
    }

    /// Map OpenClaw skill ID to A2R native ID
    pub fn to_native(&self, openclaw_id: &str) -> Option<&str> {
        // Check user mappings first
        if let Some(native) = self.openclaw_to_native.get(openclaw_id) {
            return Some(native);
        }

        // Then check built-in
        self.built_in.get(openclaw_id).map(|s| s.as_str())
    }

    /// Map A2R native ID to OpenClaw skill ID
    pub fn to_openclaw(&self, native_id: &str) -> Option<&str> {
        // Check user mappings first
        if let Some(oc) = self.native_to_openclaw.get(native_id) {
            return Some(oc);
        }

        // Then check built-in (reverse lookup)
        self.built_in
            .iter()
            .find(|(_, v)| *v == native_id)
            .map(|(k, _)| k.as_str())
    }

    /// Add a custom mapping
    pub fn add_mapping(&mut self, openclaw_id: &str, native_id: &str) {
        self.openclaw_to_native
            .insert(openclaw_id.to_string(), native_id.to_string());
        self.native_to_openclaw
            .insert(native_id.to_string(), openclaw_id.to_string());
    }

    /// Check if a mapping exists
    pub fn has_mapping(&self, openclaw_id: &str) -> bool {
        self.to_native(openclaw_id).is_some()
    }

    /// Get all mappings
    pub fn get_all_mappings(&self) -> Vec<SkillMapping> {
        let mut mappings = Vec::new();

        // Add built-in mappings
        for (oc, native) in &self.built_in {
            mappings.push(SkillMapping {
                openclaw_id: oc.clone(),
                native_id: native.clone(),
                bidirectional: true,
            });
        }

        // Add user mappings
        for (oc, native) in &self.openclaw_to_native {
            mappings.push(SkillMapping {
                openclaw_id: oc.clone(),
                native_id: native.clone(),
                bidirectional: true,
            });
        }

        mappings
    }
}

impl Default for SkillMapper {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_built_in_mappings() {
        let mapper = SkillMapper::new();

        assert_eq!(mapper.to_native("github"), Some("git"));
        assert_eq!(mapper.to_native("system"), Some("system"));
        assert_eq!(mapper.to_native("docker"), Some("deploy"));
    }

    #[test]
    fn test_reverse_mapping() {
        let mapper = SkillMapper::new();

        // Should find OpenClaw ID from native ID
        assert!(mapper.to_openclaw("git").is_some());
        assert!(mapper.to_openclaw("system").is_some());
    }

    #[test]
    fn test_custom_mapping() {
        let mut mapper = SkillMapper::new();

        mapper.add_mapping("custom-oc", "custom-native");

        assert_eq!(mapper.to_native("custom-oc"), Some("custom-native"));
        assert_eq!(mapper.to_openclaw("custom-native"), Some("custom-oc"));
    }

    #[test]
    fn test_unknown_mapping() {
        let mapper = SkillMapper::new();

        assert_eq!(mapper.to_native("unknown"), None);
        assert_eq!(mapper.to_openclaw("unknown"), None);
    }
}
