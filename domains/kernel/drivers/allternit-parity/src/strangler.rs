//! Strangler Component Trait
//!
//! Defines the interface for components undergoing strangler migration.
//! Every component that migrates from OpenClaw to native Allternit must implement this trait.
//!
//! Migration phases:
//! - Q (Quarantine): reference_execute only (OpenClaw subprocess)
//! - B (Bridge): reference_execute + native_execute stub
//! - D (Dual-Run): Both implementations run, parity checked
//! - G (Graduate): native_execute primary, reference_execute for validation
//! - C (Complete): native_execute only, reference removed

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt::Debug;
use uuid::Uuid;

/// Status of a component in the strangler migration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MigrationPhase {
    /// Q: Quarantine - OpenClaw subprocess only
    Quarantine,
    /// B: Bridge - Allternit wraps OpenClaw calls
    Bridge,
    /// D: Dual-Run - Both implementations, parity testing
    DualRun,
    /// G: Graduate - Native is primary
    Graduate,
    /// C: Complete - Native only
    Complete,
    /// P: Permanent - Always use subprocess (e.g., skill execution)
    Permanent,
}

impl MigrationPhase {
    /// Can we run the reference (OpenClaw) implementation?
    pub fn can_run_reference(&self) -> bool {
        matches!(
            self,
            MigrationPhase::Quarantine
                | MigrationPhase::Bridge
                | MigrationPhase::DualRun
                | MigrationPhase::Graduate
                | MigrationPhase::Permanent
        )
    }

    /// Can we run the native (Allternit) implementation?
    pub fn can_run_native(&self) -> bool {
        matches!(
            self,
            MigrationPhase::Bridge
                | MigrationPhase::DualRun
                | MigrationPhase::Graduate
                | MigrationPhase::Complete
        )
    }

    /// Should we compare outputs between implementations?
    pub fn should_check_parity(&self) -> bool {
        matches!(self, MigrationPhase::DualRun | MigrationPhase::Graduate)
    }
}

/// Input to a strangler component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentInput {
    /// Component-specific input data
    pub data: Value,
    /// Context for the call (session ID, user ID, etc.)
    pub context: Value,
}

/// Output from a strangler component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentOutput {
    /// Component-specific output data
    pub data: Value,
    /// Metadata about the execution
    pub metadata: OutputMetadata,
}

/// Metadata about component execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputMetadata {
    /// Execution duration in milliseconds
    pub duration_ms: u64,
    /// Whether the execution was successful
    pub success: bool,
    /// Any error message (if not successful)
    pub error: Option<String>,
}

/// Result of a parity check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParityResult {
    /// Whether the outputs match
    pub matches: bool,
    /// The reference output (from OpenClaw)
    pub reference_output: ComponentOutput,
    /// The native output (from Allternit)
    pub native_output: ComponentOutput,
    /// Any differences found
    pub differences: Vec<Difference>,
}

/// A single difference between outputs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Difference {
    /// JSON path to the differing field
    pub path: String,
    /// Expected value (from reference)
    pub expected: Value,
    /// Actual value (from native)
    pub actual: Value,
}

/// A component undergoing strangler migration
#[async_trait]
pub trait StranglerComponent: Send + Sync + Debug {
    /// Unique name for this component
    fn name(&self) -> &str;

    /// Current migration phase
    fn phase(&self) -> MigrationPhase;

    /// Execute using the reference implementation (OpenClaw)
    ///
    /// This should call OpenClaw via the host subprocess
    async fn reference_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput>;

    /// Execute using the native implementation (Allternit)
    ///
    /// In early phases (Q, B), this may be a stub that returns an error
    async fn native_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput>;

    /// Normalize input for comparison
    ///
    /// Removes non-deterministic fields (timestamps, temp paths, etc.)
    fn normalize_input(&self, input: &ComponentInput) -> Value;

    /// Normalize output for comparison
    fn normalize_output(&self, output: &ComponentOutput) -> Value;

    /// Check parity between reference and native implementations
    ///
    /// Runs both implementations and compares outputs
    async fn check_parity(&self, input: ComponentInput) -> anyhow::Result<ParityResult> {
        // Run reference implementation
        let ref_start = std::time::Instant::now();
        let ref_output = self.reference_execute(input.clone()).await?;
        let _ref_duration = ref_start.elapsed();

        // Run native implementation
        let native_start = std::time::Instant::now();
        let native_output = self.native_execute(input).await?;
        let _native_duration = native_start.elapsed();

        // Compare outputs
        let normalized_ref = self.normalize_output(&ref_output);
        let normalized_native = self.normalize_output(&native_output);

        let differences = self.find_differences(&normalized_ref, &normalized_native, "");

        Ok(ParityResult {
            matches: differences.is_empty(),
            reference_output: ref_output,
            native_output,
            differences,
        })
    }

    /// Recursively find differences between two JSON values
    fn find_differences(&self, expected: &Value, actual: &Value, path: &str) -> Vec<Difference> {
        let mut differences = Vec::new();

        match (expected, actual) {
            // Both objects - compare fields
            (Value::Object(exp_obj), Value::Object(act_obj)) => {
                // Check for missing or different fields
                for (key, exp_val) in exp_obj {
                    let field_path = if path.is_empty() {
                        key.clone()
                    } else {
                        format!("{}.{}", path, key)
                    };

                    match act_obj.get(key) {
                        Some(act_val) => {
                            differences.extend(self.find_differences(
                                exp_val,
                                act_val,
                                &field_path,
                            ));
                        }
                        None => {
                            differences.push(Difference {
                                path: field_path,
                                expected: exp_val.clone(),
                                actual: Value::Null,
                            });
                        }
                    }
                }

                // Check for extra fields in actual
                for (key, act_val) in act_obj {
                    if !exp_obj.contains_key(key) {
                        let field_path = if path.is_empty() {
                            key.clone()
                        } else {
                            format!("{}.{}", path, key)
                        };
                        differences.push(Difference {
                            path: field_path,
                            expected: Value::Null,
                            actual: act_val.clone(),
                        });
                    }
                }
            }

            // Both arrays - compare elements
            (Value::Array(exp_arr), Value::Array(act_arr)) => {
                let max_len = exp_arr.len().max(act_arr.len());
                for i in 0..max_len {
                    let elem_path = format!("{}[{}]", path, i);
                    match (exp_arr.get(i), act_arr.get(i)) {
                        (Some(exp), Some(act)) => {
                            differences.extend(self.find_differences(exp, act, &elem_path));
                        }
                        (Some(exp), None) => {
                            differences.push(Difference {
                                path: elem_path,
                                expected: exp.clone(),
                                actual: Value::Null,
                            });
                        }
                        (None, Some(act)) => {
                            differences.push(Difference {
                                path: elem_path,
                                expected: Value::Null,
                                actual: act.clone(),
                            });
                        }
                        (None, None) => {}
                    }
                }
            }

            // Primitive values - direct comparison
            _ => {
                if expected != actual {
                    differences.push(Difference {
                        path: path.to_string(),
                        expected: expected.clone(),
                        actual: actual.clone(),
                    });
                }
            }
        }

        differences
    }
}

/// Component registration information
#[derive(Debug, Clone)]
pub struct ComponentInfo {
    pub id: Uuid,
    pub name: String,
    pub phase: MigrationPhase,
    pub description: String,
}

/// Registry of all strangler components
pub struct ComponentRegistry {
    components: std::collections::HashMap<String, Box<dyn StranglerComponent>>,
}

impl ComponentRegistry {
    pub fn new() -> Self {
        Self {
            components: std::collections::HashMap::new(),
        }
    }

    /// Register a component
    pub fn register(&mut self, component: Box<dyn StranglerComponent>) {
        let name = component.name().to_string();
        tracing::info!("Registering strangler component: {}", name);
        self.components.insert(name, component);
    }

    /// Get a component by name
    pub fn get(&self, name: &str) -> Option<&Box<dyn StranglerComponent>> {
        self.components.get(name)
    }

    /// List all registered components
    pub fn list(&self) -> Vec<ComponentInfo> {
        self.components
            .values()
            .map(|c| ComponentInfo {
                id: Uuid::new_v4(),
                name: c.name().to_string(),
                phase: c.phase(),
                description: format!("{:?} component", c.name()),
            })
            .collect()
    }

    /// Get components in a specific phase
    pub fn by_phase(&self, phase: MigrationPhase) -> Vec<&Box<dyn StranglerComponent>> {
        self.components
            .values()
            .filter(|c| c.phase() == phase)
            .collect()
    }
}

impl Default for ComponentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug)]
    struct TestComponent;

    #[async_trait]
    impl StranglerComponent for TestComponent {
        fn name(&self) -> &str {
            "test"
        }

        fn phase(&self) -> MigrationPhase {
            MigrationPhase::DualRun
        }

        async fn reference_execute(
            &self,
            _input: ComponentInput,
        ) -> anyhow::Result<ComponentOutput> {
            Ok(ComponentOutput {
                data: serde_json::json!({"result": "reference"}),
                metadata: OutputMetadata {
                    duration_ms: 100,
                    success: true,
                    error: None,
                },
            })
        }

        async fn native_execute(&self, _input: ComponentInput) -> anyhow::Result<ComponentOutput> {
            Ok(ComponentOutput {
                data: serde_json::json!({"result": "native"}),
                metadata: OutputMetadata {
                    duration_ms: 50,
                    success: true,
                    error: None,
                },
            })
        }

        fn normalize_input(&self, input: &ComponentInput) -> Value {
            input.data.clone()
        }

        fn normalize_output(&self, output: &ComponentOutput) -> Value {
            output.data.clone()
        }
    }

    #[test]
    fn test_migration_phase_checks() {
        assert!(MigrationPhase::Quarantine.can_run_reference());
        assert!(!MigrationPhase::Quarantine.can_run_native());
        assert!(!MigrationPhase::Quarantine.should_check_parity());

        assert!(MigrationPhase::DualRun.can_run_reference());
        assert!(MigrationPhase::DualRun.can_run_native());
        assert!(MigrationPhase::DualRun.should_check_parity());

        assert!(!MigrationPhase::Complete.can_run_reference());
        assert!(MigrationPhase::Complete.can_run_native());
        assert!(!MigrationPhase::Complete.should_check_parity());
    }

    #[test]
    fn test_component_registry() {
        let mut registry = ComponentRegistry::new();
        registry.register(Box::new(TestComponent));

        assert!(registry.get("test").is_some());
        assert!(registry.get("nonexistent").is_none());

        let list = registry.list();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "test");
    }
}
