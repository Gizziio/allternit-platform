//! Allternit Federation Package
//! 
//! This package provides node identity and trust graph functionality for federation capabilities.
//! It implements the foundation for secure multi-node coordination with device keypairs and
//! trust relationship primitives.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};
use uuid::Uuid;
use ed25519_dalek::{Signature, Signer, Verifier, VerifyingKey, SigningKey};
use rand::rngs::OsRng;
use sha2::{Sha256, Digest};
use anyhow::Result;
use tracing::{info, error, debug};

/// Error types for federation operations
#[derive(Debug, thiserror::Error)]
pub enum FederationError {
    #[error("Node identity not found: {0}")]
    NodeIdentityNotFound(String),

    #[error("Trust relationship not found: {0}")]
    TrustRelationshipNotFound(String),

    #[error("Invalid signature: {0}")]
    InvalidSignature(String),

    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

/// Node identity with cryptographic keypair
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeIdentity {
    /// Unique node identifier
    pub id: String,

    /// Public key for the node
    pub public_key: Vec<u8>,

    /// Node name for identification
    pub name: String,

    /// Node type (coordinator, worker, gateway, etc.)
    pub node_type: NodeType,

    /// Creation timestamp
    pub created_at: u64,

    /// Whether the node is active
    pub active: bool,

    /// Node metadata
    pub metadata: HashMap<String, String>,
}

/// Node type classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeType {
    Coordinator,
    Worker,
    Gateway,
    Storage,
    Compute,
    Router,
    Agent,
}

/// Trust relationship between nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustRelationship {
    /// Unique relationship identifier
    pub id: String,

    /// Source node ID (the one granting trust)
    pub from_node: String,

    /// Target node ID (the one receiving trust)
    pub to_node: String,

    /// Trust level
    pub trust_level: TrustLevel,

    /// When the relationship was established
    pub established_at: u64,

    /// When the relationship expires (None for permanent)
    pub expires_at: Option<u64>,

    /// Digital signature of the relationship
    pub signature: Vec<u8>,

    /// Relationship metadata
    pub metadata: HashMap<String, String>,
}

/// Trust level classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TrustLevel {
    /// No trust - requests are rejected
    None,
    
    /// Basic trust - can exchange public information
    Basic,
    
    /// Verified trust - can exchange authenticated data
    Verified,
    
    /// Full trust - can participate in coordinated operations
    Full,
}

/// Trust graph representing relationships between nodes
pub struct TrustGraph {
    nodes: Arc<RwLock<HashMap<String, NodeIdentity>>>,
    relationships: Arc<RwLock<HashMap<String, TrustRelationship>>>,
    keypairs: Arc<RwLock<HashMap<String, SigningKey>>>,
}

impl TrustGraph {
    /// Create a new trust graph
    pub fn new() -> Self {
        Self {
            nodes: Arc::new(RwLock::new(HashMap::new())),
            relationships: Arc::new(RwLock::new(HashMap::new())),
            keypairs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Generate a new node identity with cryptographic keypair
    pub async fn generate_node_identity(
        &self,
        name: String,
        node_type: NodeType,
        metadata: Option<HashMap<String, String>>,
    ) -> Result<NodeIdentity, FederationError> {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        
        let node_id = Uuid::new_v4().to_string();
        let public_key_bytes = signing_key.verifying_key().to_bytes().to_vec();
        
        let metadata = metadata.unwrap_or_default();
        
        let node_identity = NodeIdentity {
            id: node_id.clone(),
            public_key: public_key_bytes,
            name,
            node_type,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            active: true,
            metadata,
        };

        // Store the keypair
        let mut keypairs = self.keypairs.write().await;
        keypairs.insert(node_id.clone(), signing_key);
        drop(keypairs);

        // Store the node identity
        let mut nodes = self.nodes.write().await;
        nodes.insert(node_id.clone(), node_identity.clone());
        drop(nodes);

        info!("Generated new node identity: {}", node_id);
        Ok(node_identity)
    }

    /// Get a node identity by ID
    pub async fn get_node(&self, node_id: &str) -> Option<NodeIdentity> {
        let nodes = self.nodes.read().await;
        nodes.get(node_id).cloned()
    }

    /// Activate a node
    pub async fn activate_node(&self, node_id: &str) -> Result<(), FederationError> {
        let mut nodes = self.nodes.write().await;
        if let Some(node) = nodes.get_mut(node_id) {
            node.active = true;
            Ok(())
        } else {
            Err(FederationError::NodeIdentityNotFound(node_id.to_string()))
        }
    }

    /// Deactivate a node
    pub async fn deactivate_node(&self, node_id: &str) -> Result<(), FederationError> {
        let mut nodes = self.nodes.write().await;
        if let Some(node) = nodes.get_mut(node_id) {
            node.active = false;
            Ok(())
        } else {
            Err(FederationError::NodeIdentityNotFound(node_id.to_string()))
        }
    }

    /// Establish a trust relationship between two nodes
    pub async fn establish_trust(
        &self,
        from_node: &str,
        to_node: &str,
        trust_level: TrustLevel,
        expires_at: Option<u64>,
        metadata: Option<HashMap<String, String>>,
    ) -> Result<TrustRelationship, FederationError> {
        // Verify both nodes exist and are active
        {
            let nodes = self.nodes.read().await;
            let from_node_info = nodes.get(from_node)
                .ok_or_else(|| FederationError::NodeIdentityNotFound(from_node.to_string()))?;
            let to_node_info = nodes.get(to_node)
                .ok_or_else(|| FederationError::NodeIdentityNotFound(to_node.to_string()))?;
            
            if !from_node_info.active {
                return Err(FederationError::CryptoError(
                    format!("From node {} is not active", from_node)
                ));
            }
            if !to_node_info.active {
                return Err(FederationError::CryptoError(
                    format!("To node {} is not active", to_node)
                ));
            }
        }

        // Get the keypair for the from_node to sign the relationship
        let signing_key = {
            let keypairs = self.keypairs.read().await;
            keypairs.get(from_node)
                .ok_or_else(|| FederationError::NodeIdentityNotFound(from_node.to_string()))?
                .clone()
        };

        let relationship_id = Uuid::new_v4().to_string();
        let metadata = metadata.unwrap_or_default();

        // Create the trust relationship
        let mut trust_relationship = TrustRelationship {
            id: relationship_id.clone(),
            from_node: from_node.to_string(),
            to_node: to_node.to_string(),
            trust_level,
            established_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            expires_at,
            signature: vec![],
            metadata,
        };

        // Sign the relationship
        let message_to_sign = format!(
            "trust:{}->{}:{}:{}",
            trust_relationship.from_node,
            trust_relationship.to_node,
            serde_json::to_string(&trust_relationship.trust_level)?,
            trust_relationship.established_at
        );
        
        let mut hasher = Sha256::new();
        hasher.update(message_to_sign.as_bytes());
        let message_hash = hasher.finalize();

        let signature: Signature = signing_key.sign(&message_hash);
        trust_relationship.signature = signature.to_bytes().to_vec();

        // Store the trust relationship
        let mut relationships = self.relationships.write().await;
        relationships.insert(relationship_id.clone(), trust_relationship.clone());
        drop(relationships);

        info!(
            "Established trust relationship: {} -> {} ({:?})",
            from_node,
            to_node,
            trust_relationship.trust_level
        );
        Ok(trust_relationship)
    }

    /// Verify if a trust relationship exists between two nodes at a given level
    pub async fn verify_trust(
        &self,
        from_node: &str,
        to_node: &str,
        required_level: TrustLevel,
    ) -> Result<bool, FederationError> {
        let relationships = self.relationships.read().await;
        
        // Find the relationship
        let relationship = relationships.values()
            .find(|rel| rel.from_node == from_node && rel.to_node == to_node)
            .ok_or_else(|| FederationError::TrustRelationshipNotFound(
                format!("{}->{}", from_node, to_node)
            ))?;

        // Check if it's expired
        if let Some(expires_at) = relationship.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            if now > expires_at {
                return Ok(false);
            }
        }

        // Check if the trust level is sufficient
        if !self.is_trust_level_sufficient(&relationship.trust_level, &required_level) {
            return Ok(false);
        }

        // Verify the signature
        let nodes = self.nodes.read().await;
        let node = nodes.get(&relationship.from_node)
            .ok_or_else(|| FederationError::NodeIdentityNotFound(relationship.from_node.clone()))?;
        
        let public_key_bytes: [u8; 32] = node.public_key.as_slice().try_into()
            .map_err(|_| FederationError::CryptoError("Invalid public key length".to_string()))?;
        let public_key = VerifyingKey::from_bytes(&public_key_bytes)
            .map_err(|_| FederationError::CryptoError("Invalid public key".to_string()))?;

        let message_to_verify = format!(
            "trust:{}->{}:{}:{}",
            relationship.from_node,
            relationship.to_node,
            serde_json::to_string(&relationship.trust_level).map_err(|e| FederationError::Serialization(e))?,
            relationship.established_at
        );

        let mut hasher = Sha256::new();
        hasher.update(message_to_verify.as_bytes());
        let message_hash = hasher.finalize();

        let signature_bytes: [u8; 64] = relationship.signature.as_slice().try_into()
            .map_err(|_| FederationError::CryptoError("Invalid signature length".to_string()))?;
        let signature = ed25519_dalek::Signature::from_bytes(&signature_bytes);

        public_key
            .verify(&message_hash, &signature)
            .map_err(|_| FederationError::InvalidSignature("Trust relationship signature verification failed".to_string()))?;

        Ok(true)
    }

    /// Get all trust relationships for a node
    pub async fn get_trust_relationships(&self, node_id: &str) -> Result<Vec<TrustRelationship>, FederationError> {
        let relationships = self.relationships.read().await;
        let filtered: Vec<TrustRelationship> = relationships.values()
            .filter(|rel| rel.from_node == node_id || rel.to_node == node_id)
            .cloned()
            .collect();
        
        Ok(filtered)
    }

    /// Get the trust level between two nodes
    pub async fn get_trust_level(&self, from_node: &str, to_node: &str) -> Result<Option<TrustLevel>, FederationError> {
        let relationships = self.relationships.read().await;
        
        if let Some(relationship) = relationships.values()
            .find(|rel| rel.from_node == from_node && rel.to_node == to_node) {
            Ok(Some(relationship.trust_level.clone()))
        } else {
            Ok(None)
        }
    }

    /// Remove a trust relationship
    pub async fn remove_trust(&self, relationship_id: &str) -> Result<(), FederationError> {
        let mut relationships = self.relationships.write().await;
        relationships.remove(relationship_id)
            .ok_or_else(|| FederationError::TrustRelationshipNotFound(relationship_id.to_string()))
            .map(|_| ())
    }

    /// Check if the trust level is sufficient for the required level
    fn is_trust_level_sufficient(&self, actual: &TrustLevel, required: &TrustLevel) -> bool {
        match (actual, required) {
            (TrustLevel::None, TrustLevel::None) => true,
            (TrustLevel::Basic, TrustLevel::None) => true,
            (TrustLevel::Basic, TrustLevel::Basic) => true,
            (TrustLevel::Verified, TrustLevel::None) => true,
            (TrustLevel::Verified, TrustLevel::Basic) => true,
            (TrustLevel::Verified, TrustLevel::Verified) => true,
            (TrustLevel::Full, _) => true,  // Full trust satisfies any requirement
            _ => false,
        }
    }
}

/// Node identity manager for the federation system
pub struct NodeIdentityManager {
    trust_graph: Arc<TrustGraph>,
}

impl NodeIdentityManager {
    /// Create a new node identity manager
    pub fn new() -> Self {
        Self {
            trust_graph: Arc::new(TrustGraph::new()),
        }
    }

    /// Get the trust graph instance
    pub fn trust_graph(&self) -> Arc<TrustGraph> {
        self.trust_graph.clone()
    }

    /// Generate a new node identity
    pub async fn generate_node_identity(
        &self,
        name: String,
        node_type: NodeType,
        metadata: Option<HashMap<String, String>>,
    ) -> Result<NodeIdentity, FederationError> {
        self.trust_graph
            .generate_node_identity(name, node_type, metadata)
            .await
    }

    /// Get a node by ID
    pub async fn get_node(&self, node_id: &str) -> Option<NodeIdentity> {
        self.trust_graph.get_node(node_id).await
    }

    /// Establish trust between nodes
    pub async fn establish_trust(
        &self,
        from_node: &str,
        to_node: &str,
        trust_level: TrustLevel,
        expires_at: Option<u64>,
        metadata: Option<HashMap<String, String>>,
    ) -> Result<TrustRelationship, FederationError> {
        self.trust_graph
            .establish_trust(from_node, to_node, trust_level, expires_at, metadata)
            .await
    }

    /// Verify trust between nodes
    pub async fn verify_trust(
        &self,
        from_node: &str,
        to_node: &str,
        required_level: TrustLevel,
    ) -> Result<bool, FederationError> {
        self.trust_graph
            .verify_trust(from_node, to_node, required_level)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_node_identity_generation() {
        let manager = NodeIdentityManager::new();
        
        let metadata = Some(HashMap::from([("location".to_string(), "us-east".to_string())]));
        let node = manager
            .generate_node_identity("test-node".to_string(), NodeType::Coordinator, metadata)
            .await
            .expect("Failed to generate node identity");
        
        assert_eq!(node.name, "test-node");
        assert_eq!(node.node_type, NodeType::Coordinator);
        assert!(node.active);
        assert_eq!(node.metadata.get("location"), Some(&"us-east".to_string()));
    }

    #[tokio::test]
    async fn test_trust_establishment_and_verification() {
        let manager = NodeIdentityManager::new();
        
        // Create two nodes
        let node1 = manager
            .generate_node_identity("node1".to_string(), NodeType::Coordinator, None)
            .await
            .expect("Failed to create node1");
        
        let node2 = manager
            .generate_node_identity("node2".to_string(), NodeType::Worker, None)
            .await
            .expect("Failed to create node2");

        // Establish trust
        let trust_rel = manager
            .establish_trust(&node1.id, &node2.id, TrustLevel::Full, None, None)
            .await
            .expect("Failed to establish trust");

        // Verify trust
        let is_trusted = manager
            .verify_trust(&node1.id, &node2.id, TrustLevel::Full)
            .await
            .expect("Failed to verify trust");

        assert!(is_trusted);
        assert_eq!(trust_rel.from_node, node1.id);
        assert_eq!(trust_rel.to_node, node2.id);
        assert_eq!(trust_rel.trust_level, TrustLevel::Full);
    }

    #[tokio::test]
    async fn test_insufficient_trust() {
        let manager = NodeIdentityManager::new();
        
        // Create two nodes
        let node1 = manager
            .generate_node_identity("node1".to_string(), NodeType::Coordinator, None)
            .await
            .expect("Failed to create node1");
        
        let node2 = manager
            .generate_node_identity("node2".to_string(), NodeType::Worker, None)
            .await
            .expect("Failed to create node2");

        // Establish basic trust
        manager
            .establish_trust(&node1.id, &node2.id, TrustLevel::Basic, None, None)
            .await
            .expect("Failed to establish trust");

        // Try to verify with higher required level - should fail
        let is_trusted = manager
            .verify_trust(&node1.id, &node2.id, TrustLevel::Full)
            .await
            .expect("Failed to verify trust");

        assert!(!is_trusted);
    }
}
