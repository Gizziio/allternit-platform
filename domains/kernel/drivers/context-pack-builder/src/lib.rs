//! Allternit Context Pack Builder
//!
//! Builds deterministic context bundles for WIH execution.
//! Integrates with ontology runtime to provide domain-aware context.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::Path;
use tracing::{info, debug, warn};

use allternit_ontology_runtime::{DomainRegistry, OntologyInjectionEngine};
use std::sync::Arc;
use allternit_system_law::SystemLawEngine;

/// Context Pack identifier
pub type ContextPackId = String;
pub type WihId = String;
pub type DagId = String;
pub type NodeId = String;

/// Context Pack - Deterministic context bundle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextPack {
    /// Deterministic hash identifier (cp_<sha256>)
    pub pack_id: ContextPackId,
    /// Work Item Header identifier
    pub wih_id: WihId,
    /// DAG identifier
    pub dag_id: DagId,
    /// DAG node identifier
    pub node_id: NodeId,
    /// Context pack content
    pub inputs: PackInputs,
    /// Manifest of all inputs with hashes
    pub inputs_manifest: Vec<InputManifestEntry>,
    /// Builder version
    pub method_version: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Policy bundle reference
    pub policy_bundle: Option<PolicyBundleRef>,
    /// Ontology context (injected from ontology runtime)
    pub ontology_context: Option<OntologyContextPack>,
}

/// Pack inputs content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackInputs {
    /// Full text of SYSTEM_LAW.md
    pub tier0_law: String,
    /// Full text of SOT.md
    pub sot: String,
    /// Full text of ARCHITECTURE.md
    pub architecture: String,
    /// Relevant contract files
    pub contracts: Vec<ContractFile>,
    /// Relevant delta files
    pub deltas: Vec<DeltaFile>,
    /// Work Item Header
    pub wih: WihContent,
}

/// Contract file entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractFile {
    pub path: String,
    pub content: String,
    pub hash: String,
}

/// Delta file entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeltaFile {
    pub path: String,
    pub content: String,
    pub hash: String,
}

/// WIH content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihContent {
    pub wih_id: String,
    pub role: WihRole,
    pub scope_paths: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub acceptance_refs: Vec<String>,
    pub execution_mode: ExecutionMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WihRole {
    Orchestrator,
    Planner,
    Builder,
    Validator,
    Reviewer,
    Security,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ExecutionMode {
    PlanOnly,
    RequireApproval,
    AcceptEdits,
    BypassPermissions,
}

/// Input manifest entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputManifestEntry {
    pub path: String,
    pub hash: String,
    pub size_bytes: usize,
}

/// Policy bundle reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyBundleRef {
    pub bundle_id: String,
    pub agents_md_hash: String,
    pub role_envelope: String,
    pub pack_ids: Vec<String>,
}

/// Ontology context injected into the pack
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OntologyContextPack {
    /// Domain types relevant to this task
    pub relevant_types: Vec<DomainTypeInfo>,
    /// Relationship constraints
    pub relationship_constraints: Vec<RelationshipConstraint>,
    /// Tool bindings for allowed tools
    pub tool_bindings: Vec<ToolBindingInfo>,
    /// Reasoning constraints
    pub reasoning_constraints: Vec<ReasoningConstraintInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainTypeInfo {
    pub type_id: String,
    pub name: String,
    pub properties: Vec<PropertyInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyInfo {
    pub name: String,
    pub property_type: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipConstraint {
    pub from_type: String,
    pub to_type: String,
    pub relationship_type: String,
    pub cardinality: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolBindingInfo {
    pub tool_id: String,
    pub allowed_types: Vec<String>,
    pub constraints: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningConstraintInfo {
    pub constraint_type: String,
    pub description: String,
    pub severity: String,
}

/// Context Pack Builder
pub struct ContextPackBuilder {
    domain_registry: DomainRegistry,
    injection_engine: OntologyInjectionEngine,
    base_path: String,
}

impl ContextPackBuilder {
    /// Create a new Context Pack Builder
    pub fn new(base_path: impl Into<String>) -> Self {
        let system_law = Arc::new(SystemLawEngine::new());
        let domain_registry = DomainRegistry::new(system_law);
        let injection_engine = OntologyInjectionEngine::new(domain_registry.clone());
        Self {
            domain_registry,
            injection_engine,
            base_path: base_path.into(),
        }
    }

    /// Create a Context Pack Builder with custom domain registry
    pub fn with_registry(base_path: impl Into<String>, registry: DomainRegistry) -> Self {
        let injection_engine = OntologyInjectionEngine::new(registry.clone());
        Self {
            domain_registry: registry,
            injection_engine,
            base_path: base_path.into(),
        }
    }

    /// Build a context pack for a DAG node execution
    pub async fn build_pack(
        &self,
        wih_id: WihId,
        dag_id: DagId,
        node_id: NodeId,
        wih_content: WihContent,
    ) -> anyhow::Result<ContextPack> {
        info!("Building Context Pack for WIH:{}, DAG:{}, Node:{}", wih_id, dag_id, node_id);

        // Load base documents
        let tier0_law = self.load_file("SYSTEM_LAW.md").await?;
        let sot = self.load_file("SOT.md").await.unwrap_or_default();
        let architecture = self.load_file("ARCHITECTURE.md").await.unwrap_or_default();

        // Load contracts
        let contracts = self.load_contracts(&wih_content.scope_paths).await?;

        // Load deltas
        let deltas = self.load_deltas(&wih_content.scope_paths).await?;

        // Build inputs
        let inputs = PackInputs {
            tier0_law,
            sot,
            architecture,
            contracts,
            deltas,
            wih: wih_content.clone(),
        };

        // Build manifest
        let inputs_manifest = self.build_manifest(&inputs).await?;

        // Generate pack ID
        let pack_id = self.generate_pack_id(&wih_id, &dag_id, &node_id, &inputs_manifest);

        // Build ontology context
        let ontology_context = self.build_ontology_context(&wih_content).await?;

        let pack = ContextPack {
            pack_id,
            wih_id,
            dag_id,
            node_id,
            inputs,
            inputs_manifest,
            method_version: "1.0.0".to_string(),
            created_at: Utc::now(),
            policy_bundle: None, // Can be added later
            ontology_context: Some(ontology_context),
        };

        info!("Context Pack built successfully: {}", pack.pack_id);
        Ok(pack)
    }

    /// Build ontology-aware context for the pack
    async fn build_ontology_context(&self, wih: &WihContent) -> anyhow::Result<OntologyContextPack> {
        debug!("Building ontology context for WIH: {}", wih.wih_id);

        // Get relevant domain types based on allowed tools
        let mut relevant_types = Vec::new();
        let mut tool_bindings = Vec::new();

        for tool_id in &wih.allowed_tools {
            // Query ontology for tool bindings
            if let Some(binding) = self.query_tool_binding(tool_id).await {
                tool_bindings.push(binding);
            }
        }

        // Extract domain types from tool bindings
        for binding in &tool_bindings {
            for type_id in &binding.allowed_types {
                if let Some(type_info) = self.get_domain_type_info(type_id).await {
                    if !relevant_types.iter().any(|t: &DomainTypeInfo| t.type_id == type_info.type_id) {
                        relevant_types.push(type_info);
                    }
                }
            }
        }

        // Get relationship constraints for relevant types
        let relationship_constraints = self.get_relationship_constraints(&relevant_types).await;

        // Get reasoning constraints
        let reasoning_constraints = self.get_reasoning_constraints(&relevant_types).await;

        Ok(OntologyContextPack {
            relevant_types,
            relationship_constraints,
            tool_bindings,
            reasoning_constraints,
        })
    }

    /// Query ontology for tool binding
    async fn query_tool_binding(&self, tool_id: &str) -> Option<ToolBindingInfo> {
        // This would query the ontology runtime for tool bindings
        // For now, return mock data
        Some(ToolBindingInfo {
            tool_id: tool_id.to_string(),
            allowed_types: vec!["generic".to_string()],
            constraints: vec!["valid_input".to_string()],
        })
    }

    /// Get domain type information
    async fn get_domain_type_info(&self, type_id: &str) -> Option<DomainTypeInfo> {
        // Query the domain registry
        Some(DomainTypeInfo {
            type_id: type_id.to_string(),
            name: format!("Type_{}", type_id),
            properties: vec![
                PropertyInfo {
                    name: "id".to_string(),
                    property_type: "string".to_string(),
                    required: true,
                },
            ],
        })
    }

    /// Get relationship constraints for types
    async fn get_relationship_constraints(&self, types: &[DomainTypeInfo]) -> Vec<RelationshipConstraint> {
        let mut constraints = Vec::new();
        
        for type_info in types {
            // Query ontology for relationship constraints
            constraints.push(RelationshipConstraint {
                from_type: type_info.type_id.clone(),
                to_type: "any".to_string(),
                relationship_type: "depends_on".to_string(),
                cardinality: "0..*".to_string(),
            });
        }

        constraints
    }

    /// Get reasoning constraints for types
    async fn get_reasoning_constraints(&self, types: &[DomainTypeInfo]) -> Vec<ReasoningConstraintInfo> {
        let mut constraints = Vec::new();

        for type_info in types {
            constraints.push(ReasoningConstraintInfo {
                constraint_type: "domain_bounded".to_string(),
                description: format!("Reasoning must respect {} domain constraints", type_info.name),
                severity: "high".to_string(),
            });
        }

        constraints
    }

    /// Load a file from the base path
    async fn load_file(&self, filename: &str) -> anyhow::Result<String> {
        let path = Path::new(&self.base_path).join(filename);
        tokio::fs::read_to_string(&path).await.map_err(|e| {
            anyhow::anyhow!("Failed to load file {}: {}", path.display(), e)
        })
    }

    /// Load contract files
    async fn load_contracts(&self, scope_paths: &[String]) -> anyhow::Result<Vec<ContractFile>> {
        let mut contracts = Vec::new();
        let contracts_dir = Path::new(&self.base_path).join("spec/Contracts");

        if contracts_dir.exists() {
            let mut entries = tokio::fs::read_dir(&contracts_dir).await?;
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                if path.extension().map(|e| e == "md").unwrap_or(false) {
                    let content = tokio::fs::read_to_string(&path).await?;
                    let hash = self.hash_content(&content);
                    contracts.push(ContractFile {
                        path: path.to_string_lossy().to_string(),
                        content,
                        hash: format!("sha256:{}", hash),
                    });
                }
            }
        }

        Ok(contracts)
    }

    /// Load delta files
    async fn load_deltas(&self, scope_paths: &[String]) -> anyhow::Result<Vec<DeltaFile>> {
        let mut deltas = Vec::new();
        let deltas_dir = Path::new(&self.base_path).join("spec/Deltas");

        if deltas_dir.exists() {
            let mut entries = tokio::fs::read_dir(&deltas_dir).await?;
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                if path.extension().map(|e| e == "md").unwrap_or(false) {
                    let content = tokio::fs::read_to_string(&path).await?;
                    let hash = self.hash_content(&content);
                    deltas.push(DeltaFile {
                        path: path.to_string_lossy().to_string(),
                        content,
                        hash: format!("sha256:{}", hash),
                    });
                }
            }
        }

        Ok(deltas)
    }

    /// Build inputs manifest
    async fn build_manifest(&self, inputs: &PackInputs) -> anyhow::Result<Vec<InputManifestEntry>> {
        let mut manifest = Vec::new();

        // Add LAW
        manifest.push(InputManifestEntry {
            path: "SYSTEM_LAW.md".to_string(),
            hash: format!("sha256:{}", self.hash_content(&inputs.tier0_law)),
            size_bytes: inputs.tier0_law.len(),
        });

        // Add SOT
        manifest.push(InputManifestEntry {
            path: "SOT.md".to_string(),
            hash: format!("sha256:{}", self.hash_content(&inputs.sot)),
            size_bytes: inputs.sot.len(),
        });

        // Add Architecture
        manifest.push(InputManifestEntry {
            path: "ARCHITECTURE.md".to_string(),
            hash: format!("sha256:{}", self.hash_content(&inputs.architecture)),
            size_bytes: inputs.architecture.len(),
        });

        // Add contracts
        for contract in &inputs.contracts {
            manifest.push(InputManifestEntry {
                path: contract.path.clone(),
                hash: contract.hash.clone(),
                size_bytes: contract.content.len(),
            });
        }

        // Add deltas
        for delta in &inputs.deltas {
            manifest.push(InputManifestEntry {
                path: delta.path.clone(),
                hash: delta.hash.clone(),
                size_bytes: delta.content.len(),
            });
        }

        Ok(manifest)
    }

    /// Generate deterministic pack ID
    fn generate_pack_id(
        &self,
        wih_id: &str,
        dag_id: &str,
        node_id: &str,
        manifest: &[InputManifestEntry],
    ) -> ContextPackId {
        let mut hasher = Sha256::new();
        hasher.update(wih_id.as_bytes());
        hasher.update(dag_id.as_bytes());
        hasher.update(node_id.as_bytes());
        
        for entry in manifest {
            hasher.update(entry.path.as_bytes());
            hasher.update(entry.hash.as_bytes());
        }

        let hash = hex::encode(hasher.finalize());
        format!("cp_{}", hash)
    }

    /// Hash content using SHA-256
    fn hash_content(&self, content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Validate a context pack
    pub fn validate_pack(&self, pack: &ContextPack) -> ValidationResult {
        // Verify pack ID
        let expected_id = self.generate_pack_id(&pack.wih_id, &pack.dag_id, &pack.node_id, &pack.inputs_manifest);
        if pack.pack_id != expected_id {
            return ValidationResult::Invalid(format!("Pack ID mismatch: expected {}, got {}", expected_id, pack.pack_id));
        }

        // Verify all hashes in manifest
        for entry in &pack.inputs_manifest {
            // In a real implementation, we'd re-hash the content and verify
            if !entry.hash.starts_with("sha256:") {
                return ValidationResult::Invalid(format!("Invalid hash format for {}", entry.path));
            }
        }

        ValidationResult::Valid
    }
}

/// Validation result
#[derive(Debug, Clone)]
pub enum ValidationResult {
    Valid,
    Invalid(String),
}

impl ContextPack {
    /// Serialize to JSON
    pub fn to_json(&self) -> anyhow::Result<String> {
        serde_json::to_string_pretty(self).map_err(|e| e.into())
    }

    /// Deserialize from JSON
    pub fn from_json(json: &str) -> anyhow::Result<Self> {
        serde_json::from_str(json).map_err(|e| e.into())
    }

    /// Get total size of all inputs
    pub fn total_size_bytes(&self) -> usize {
        self.inputs_manifest.iter().map(|e| e.size_bytes).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_context_pack_builder() {
        // Create a temp directory with minimal files
        let temp_dir = tempfile::tempdir().unwrap();
        let base_path = temp_dir.path().to_str().unwrap();
        
        // Create required files
        tokio::fs::write(format!("{}/SYSTEM_LAW.md", base_path), "# System Law\nTest content").await.unwrap();
        tokio::fs::write(format!("{}/SOT.md", base_path), "# SOT\nTest content").await.unwrap();
        tokio::fs::write(format!("{}/ARCHITECTURE.md", base_path), "# Architecture\nTest content").await.unwrap();
        
        let builder = ContextPackBuilder::new(base_path);
        
        let wih_content = WihContent {
            wih_id: "wih-test-001".to_string(),
            role: WihRole::Builder,
            scope_paths: vec!["src/".to_string()],
            allowed_tools: vec!["file_read".to_string()],
            acceptance_refs: vec!["ACCEPT-001".to_string()],
            execution_mode: ExecutionMode::RequireApproval,
        };

        let result = builder.build_pack(
            "wih-test-001".to_string(),
            "dag-test-001".to_string(),
            "node-001".to_string(),
            wih_content,
        ).await;

        // Should succeed with temp files
        assert!(result.is_ok());
        
        let pack = result.unwrap();
        assert!(pack.pack_id.starts_with("cp_"));
        assert_eq!(pack.wih_id, "wih-test-001");
        assert!(pack.ontology_context.is_some());
    }

    #[test]
    fn test_pack_id_format() {
        let builder = ContextPackBuilder::new(".");
        let manifest = vec![
            InputManifestEntry {
                path: "test.md".to_string(),
                hash: "sha256:abc123".to_string(),
                size_bytes: 100,
            },
        ];

        let pack_id = builder.generate_pack_id("wih1", "dag1", "node1", &manifest);
        assert!(pack_id.starts_with("cp_"));
        assert_eq!(pack_id.len(), 67); // "cp_" + 64 hex chars
    }

    #[tokio::test]
    async fn test_pack_validation() {
        // Create a temp directory with minimal files
        let temp_dir = tempfile::tempdir().unwrap();
        let base_path = temp_dir.path().to_str().unwrap();
        
        // Create required files
        tokio::fs::write(format!("{}/SYSTEM_LAW.md", base_path), "# System Law\nTest content").await.unwrap();
        tokio::fs::write(format!("{}/SOT.md", base_path), "# SOT\nTest content").await.unwrap();
        tokio::fs::write(format!("{}/ARCHITECTURE.md", base_path), "# Architecture\nTest content").await.unwrap();
        
        let builder = ContextPackBuilder::new(base_path);
        
        let wih_content = WihContent {
            wih_id: "wih-test-002".to_string(),
            role: WihRole::Validator,
            scope_paths: vec![],
            allowed_tools: vec![],
            acceptance_refs: vec![],
            execution_mode: ExecutionMode::PlanOnly,
        };

        let pack = builder.build_pack(
            "wih-test-002".to_string(),
            "dag-test-002".to_string(),
            "node-002".to_string(),
            wih_content,
        ).await.unwrap();

        let result = builder.validate_pack(&pack);
        assert!(matches!(result, ValidationResult::Valid));
    }

    #[test]
    fn test_pack_serialization() {
        let pack = ContextPack {
            pack_id: "cp_test123".to_string(),
            wih_id: "wih-001".to_string(),
            dag_id: "dag-001".to_string(),
            node_id: "node-001".to_string(),
            inputs: PackInputs {
                tier0_law: "LAW content".to_string(),
                sot: "SOT content".to_string(),
                architecture: "ARCH content".to_string(),
                contracts: vec![],
                deltas: vec![],
                wih: WihContent {
                    wih_id: "wih-001".to_string(),
                    role: WihRole::Builder,
                    scope_paths: vec![],
                    allowed_tools: vec![],
                    acceptance_refs: vec![],
                    execution_mode: ExecutionMode::PlanOnly,
                },
            },
            inputs_manifest: vec![],
            method_version: "1.0.0".to_string(),
            created_at: Utc::now(),
            policy_bundle: None,
            ontology_context: None,
        };

        let json = pack.to_json().unwrap();
        let deserialized = ContextPack::from_json(&json).unwrap();
        assert_eq!(pack.pack_id, deserialized.pack_id);
    }
}
