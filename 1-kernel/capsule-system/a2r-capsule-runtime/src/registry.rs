use std::collections::HashMap;
use uuid::Uuid;
use crate::schema::{CapsuleSpec};
use a2rchitech_kernel_contracts::FrameworkSpec;
use crate::error::{CapsuleError, Result};

pub struct FrameworkRegistry {
    frameworks: HashMap<String, FrameworkSpec>,
}

impl FrameworkRegistry {
    pub fn new() -> Self {
        Self {
            frameworks: HashMap::new(),
        }
    }

    pub fn register(&mut self, framework: FrameworkSpec) -> Result<()> {
        if self.frameworks.contains_key(&framework.framework_id.to_string()) {
            return Err(CapsuleError::DuplicateFramework(framework.framework_id.to_string()));
        }

        self.frameworks.insert(framework.framework_id.to_string(), framework);
        Ok(())
    }

    pub fn lookup(&self, framework_id: &str) -> Option<&FrameworkSpec> {
        self.frameworks.get(framework_id)
    }

    pub fn find_for_intent(&self, intent_text: &str) -> Option<&FrameworkSpec> {
        for (_id, framework) in &self.frameworks {
            for pattern in &framework.intent_patterns {
                if intent_text.to_lowercase().contains(&pattern.to_lowercase()) {
                    return Some(framework);
                }
            }
        }

        None
    }
}
